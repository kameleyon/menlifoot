import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@16.12.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PRINTIFY_API = "https://api.printify.com/v1";
const SHOP_ID = "28370366";

serve(async (req) => {
  const STRIPE_KEY = Deno.env.get("STRIPE_SECRET_KEY");
  const WH_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const PRINTIFY_KEY = Deno.env.get("PRINTIFY_API_KEY");
  if (!STRIPE_KEY || !WH_SECRET || !PRINTIFY_KEY) return new Response("not configured", { status: 500 });

  const stripe = new Stripe(STRIPE_KEY, { apiVersion: "2024-06-20", httpClient: Stripe.createFetchHttpClient() });
  const sig = req.headers.get("stripe-signature") ?? "";
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, WH_SECRET);
  } catch (e) {
    return new Response(`signature error: ${e instanceof Error ? e.message : ""}`, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") return new Response("ignored", { status: 200 });

  const session = event.data.object as Stripe.Checkout.Session;
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: order } = await db.from("store_orders").select("*").eq("stripe_session_id", session.id).maybeSingle();
  if (!order || order.status !== "pending") return new Response("ok", { status: 200 }); // idempotent

  try {
    const addr = order.shipping_address ?? {};
    // deno-lint-ignore no-explicit-any
    const lineItems = (order.line_items as any[]).map((v) => ({ product_id: v.product_id, variant_id: v.variant_id, quantity: v.quantity }));
    const pfHeaders = { Authorization: `Bearer ${PRINTIFY_KEY}`, "Content-Type": "application/json", "User-Agent": "Menlifoot" };

    const orderRes = await fetch(`${PRINTIFY_API}/shops/${SHOP_ID}/orders.json`, {
      method: "POST", headers: pfHeaders,
      body: JSON.stringify({
        external_id: order.id,
        label: "Menlifoot web order",
        line_items: lineItems,
        shipping_method: 1,
        send_shipping_notification: false,
        address_to: {
          first_name: addr.first_name ?? "", last_name: addr.last_name ?? "",
          email: order.email ?? addr.email ?? "", phone: addr.phone ?? "",
          country: addr.country ?? "", region: addr.region ?? "",
          address1: addr.address1 ?? "", address2: addr.address2 ?? "",
          city: addr.city ?? "", zip: addr.zip ?? "",
        },
      }),
    });
    const pf = await orderRes.json();
    if (!orderRes.ok) throw new Error(`printify order: ${JSON.stringify(pf)}`);

    // Send to production so it actually gets made & shipped.
    await fetch(`${PRINTIFY_API}/shops/${SHOP_ID}/orders/${pf.id}/send_to_production.json`, { method: "POST", headers: pfHeaders });

    await db.from("store_orders").update({ status: "submitted", printify_order_id: pf.id, updated_at: new Date().toISOString() }).eq("id", order.id);
  } catch (e) {
    await db.from("store_orders").update({ status: "failed", error: e instanceof Error ? e.message : "order error", updated_at: new Date().toISOString() }).eq("id", order.id);
  }

  return new Response("ok", { status: 200 });
});
