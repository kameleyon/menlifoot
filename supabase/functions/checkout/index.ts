import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@16.12.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PRINTIFY_API = "https://api.printify.com/v1";
const SHOP_ID = "28370366";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

interface InItem { product_id: string; variant_id: number; quantity: number; personalization?: string }

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const STRIPE_KEY = Deno.env.get("STRIPE_SECRET_KEY");
  const PRINTIFY_KEY = Deno.env.get("PRINTIFY_API_KEY");
  if (!STRIPE_KEY) return json({ error: "STRIPE_SECRET_KEY not configured" }, 500);
  if (!PRINTIFY_KEY) return json({ error: "PRINTIFY_API_KEY not configured" }, 500);

  try {
    const { items, address, language } = (await req.json()) as { items: InItem[]; address: Record<string, string>; language?: string };
    const lang = ["en", "fr", "es", "ht"].includes(String(language)) ? String(language) : "en";
    if (!Array.isArray(items) || items.length === 0) return json({ error: "empty cart" }, 400);
    if (!address?.address1 || !address?.city || !address?.country || !address?.zip) return json({ error: "incomplete address" }, 400);

    const pfHeaders = { Authorization: `Bearer ${PRINTIFY_KEY}`, "Content-Type": "application/json", "User-Agent": "Menlifoot" };

    // Validate every item against Printify (server-side price is the source of truth).
    const validated: { product_id: string; variant_id: number; quantity: number; title: string; price: number; personalization?: string }[] = [];
    for (const it of items) {
      if (!/^[a-zA-Z0-9]{1,40}$/.test(String(it.product_id))) return json({ error: "invalid product" }, 400);
      const qty = Math.max(1, Math.min(20, Math.floor(Number(it.quantity) || 1)));
      const personalization = it.personalization ? String(it.personalization).slice(0, 60) : undefined;
      const r = await fetch(`${PRINTIFY_API}/shops/${SHOP_ID}/products/${it.product_id}.json`, { headers: pfHeaders });
      if (!r.ok) return json({ error: `product ${it.product_id} unavailable` }, 400);
      // deno-lint-ignore no-explicit-any
      const p: any = await r.json();
      const v = (p.variants ?? []).find((x: any) => x.id === Number(it.variant_id) && x.is_enabled);
      if (!v) return json({ error: "variant unavailable" }, 400);
      validated.push({ product_id: it.product_id, variant_id: v.id, quantity: qty, title: `${p.title} — ${v.title}`, price: v.price, ...(personalization ? { personalization } : {}) });
    }

    // Delivery estimate window (US vs international).
    const isUS = String(address.country ?? "").toUpperCase() === "US";
    const minDays = isUS ? 3 : 10;
    const maxDays = isUS ? 7 : 20;
    const addDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
    const fmtDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const arriveEarly = fmtDate(addDays(Math.ceil(minDays * 1.4)));
    const arriveLate = fmtDate(addDays(Math.ceil(maxDays * 1.4)));

    // Real shipping cost from Printify for this address + cart (customer pays shipping).
    let shippingCents = 0;
    try {
      const sr = await fetch(`${PRINTIFY_API}/shops/${SHOP_ID}/orders/shipping.json`, {
        method: "POST", headers: pfHeaders,
        body: JSON.stringify({
          line_items: validated.map((v) => ({ product_id: v.product_id, variant_id: v.variant_id, quantity: v.quantity })),
          address_to: address,
        }),
      });
      if (sr.ok) { const sd = await sr.json(); shippingCents = Number(sd.standard) || 0; }
    } catch { /* fall back below */ }
    // If Printify's shipping calc is unavailable, charge a conservative flat rate — never free.
    if (shippingCents <= 0) shippingCents = isUS ? 599 : 1499;

    // Always return to the canonical domain (not the vercel preview host).
    const origin = "https://menlifoot.ca";
    const stripe = new Stripe(STRIPE_KEY, { apiVersion: "2024-06-20", httpClient: Stripe.createFetchHttpClient() });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: validated.map((v) => ({
        price_data: {
          currency: "usd",
          // Personalization is appended to the name so it surfaces on the checkout page,
          // the Stripe dashboard, and the admin Orders list (which reads the line-item name).
          product_data: { name: (v.personalization ? `${v.title} [Personalized: ${v.personalization}]` : v.title).slice(0, 250) },
          unit_amount: v.price,
        },
        quantity: v.quantity,
      })),
      shipping_options: [{
        shipping_rate_data: {
          type: "fixed_amount",
          fixed_amount: { amount: shippingCents, currency: "usd" },
          display_name: `Standard shipping · arrives ${arriveEarly}–${arriveLate}`,
          delivery_estimate: {
            minimum: { unit: "business_day", value: minDays },
            maximum: { unit: "business_day", value: maxDays },
          },
        },
      }],
      customer_email: address.email || undefined,
      success_url: `${origin}/shop?checkout=success`,
      cancel_url: `${origin}/shop`,
    });

    // Persist the pending order (service role bypasses RLS).
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await db.from("store_orders").insert({
      stripe_session_id: session.id,
      status: "pending",
      email: address.email ?? null,
      amount_total: session.amount_total,
      line_items: validated,
      shipping_address: address,
      language: lang,
    });

    return json({ url: session.url });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "checkout error" }, 500);
  }
});
