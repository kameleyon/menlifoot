import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@16.12.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PRINTIFY_API = "https://api.printify.com/v1";
const SHOP_ID = "28370366";
const SITE_URL = "https://menlifoot.ca";
const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
// Escape buyer-supplied strings before interpolating into email HTML (Stripe passes them through unchanged).
const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

// Order-confirmation email copy per language.
type Tr = { badge: string; heading: string; order: string; subtotal: string; shipping: string; total: string; shipTo: string; delivery: string; standard: string; free: string; arrival: string; personalized: string; qty: string; cta: string; note: string; subject: (r: string) => string };
const L: Record<string, Tr> = {
  en: { badge: "Order confirmed", heading: "Thank you for your order!", order: "Order", subtotal: "Subtotal", shipping: "Shipping", total: "Total", shipTo: "Shipping to", delivery: "Delivery", standard: "Standard shipping", free: "Free shipping", arrival: "Est. arrival", personalized: "Personalized", qty: "Qty", cta: "Continue shopping", note: "We'll email you again when your order ships. Questions? Reply to this email or contact orders@menlifoot.ca.", subject: (r) => `Your Menlifoot order ${r}` },
  fr: { badge: "Commande confirmée", heading: "Merci pour votre commande !", order: "Commande", subtotal: "Sous-total", shipping: "Livraison", total: "Total", shipTo: "Livraison à", delivery: "Livraison", standard: "Livraison standard", free: "Livraison gratuite", arrival: "Arrivée est.", personalized: "Personnalisé", qty: "Qté", cta: "Continuer les achats", note: "Nous vous écrirons à l'expédition. Questions ? Répondez à cet e-mail ou écrivez à orders@menlifoot.ca.", subject: (r) => `Votre commande Menlifoot ${r}` },
  es: { badge: "Pedido confirmado", heading: "¡Gracias por tu pedido!", order: "Pedido", subtotal: "Subtotal", shipping: "Envío", total: "Total", shipTo: "Enviar a", delivery: "Entrega", standard: "Envío estándar", free: "Envío gratis", arrival: "Llegada est.", personalized: "Personalizado", qty: "Cant.", cta: "Seguir comprando", note: "Te escribiremos cuando tu pedido se envíe. ¿Dudas? Responde a este correo o escribe a orders@menlifoot.ca.", subject: (r) => `Tu pedido Menlifoot ${r}` },
  ht: { badge: "Kòmand konfime", heading: "Mèsi pou kòmand ou!", order: "Kòmand", subtotal: "Soutotal", shipping: "Livrezon", total: "Total", shipTo: "Livre bay", delivery: "Livrezon", standard: "Livrezon estanda", free: "Livrezon gratis", arrival: "Rive apeprè", personalized: "Pèsonalize", qty: "Kantite", cta: "Kontinye achte", note: "N ap ekri w lè kòmand la ekspedye. Kesyon? Reponn imèl sa a oswa ekri orders@menlifoot.ca.", subject: (r) => `Kòmand Menlifoot ou ${r}` },
};
const tr = (lang?: string): Tr => L[String(lang ?? "en")] ?? L.en;

// deno-lint-ignore no-explicit-any
function confirmationHtml(o: { ref: string; date: string; items: any[]; subtotal: number; shipping: number; total: number; addr: any; shipMethod: string; delivery: string; t: Tr }) {
  const t = o.t;
  const rows = o.items.map((it) => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #eceae6;font-family:Arial,sans-serif;font-size:14px;color:#111;">
        ${esc(it.title)}${it.personalization ? `<br><span style="color:#a07d2c;font-size:12px;">${t.personalized}: ${esc(it.personalization)}</span>` : ""}
        <br><span style="color:#888;font-size:12px;">${t.qty} ${esc(it.quantity)}</span>
      </td>
      <td align="right" style="padding:12px 0;border-bottom:1px solid #eceae6;font-family:Arial,sans-serif;font-size:14px;color:#111;white-space:nowrap;">${money(it.price * it.quantity)}</td>
    </tr>`).join("");
  const a = o.addr ?? {};
  const addressLines = [
    `${esc(a.first_name)} ${esc(a.last_name)}`.trim(),
    esc(a.address1), esc(a.address2),
    [a.city, a.region, a.zip].filter(Boolean).map(esc).join(", "),
    esc(a.country),
  ].filter((l) => l && l !== " ").join("<br>");
  return `<!doctype html><html><body style="margin:0;background:#0a0a0b;padding:24px 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;">
      <tr><td style="background:#070708;padding:28px 32px;text-align:center;">
        <img src="${SITE_URL}/menlifootca.png" alt="Menlifoot" width="180" style="max-width:180px;height:auto;">
      </td></tr>
      <tr><td style="padding:34px 32px 8px;">
        <div style="display:inline-block;background:linear-gradient(135deg,#e9c877,#c08a2a);color:#070708;font-family:Arial,sans-serif;font-size:11px;font-weight:bold;letter-spacing:.08em;text-transform:uppercase;padding:7px 14px;border-radius:999px;">${t.badge}</div>
        <h1 style="margin:16px 0 4px;font-family:Arial,sans-serif;font-size:22px;color:#111;">${t.heading}</h1>
        <p style="margin:0;font-family:Arial,sans-serif;font-size:14px;color:#555;">${t.order} <strong>${esc(o.ref)}</strong> · ${esc(o.date)}</p>
      </td></tr>
      <tr><td style="padding:20px 32px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
      </td></tr>
      <tr><td style="padding:8px 32px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;font-size:14px;color:#111;">
          <tr><td style="padding:4px 0;color:#555;">${t.subtotal}</td><td align="right" style="padding:4px 0;">${money(o.subtotal)}</td></tr>
          <tr><td style="padding:4px 0;color:#555;">${t.shipping}</td><td align="right" style="padding:4px 0;">${o.shipping > 0 ? money(o.shipping) : "—"}</td></tr>
          <tr><td style="padding:10px 0 0;border-top:2px solid #111;font-weight:bold;">${t.total}</td><td align="right" style="padding:10px 0 0;border-top:2px solid #111;font-weight:bold;">${money(o.total)}</td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:24px 32px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td valign="top" style="width:50%;padding-right:12px;">
            <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:11px;font-weight:bold;letter-spacing:.06em;text-transform:uppercase;color:#999;">${t.shipTo}</p>
            <p style="margin:0;font-family:Arial,sans-serif;font-size:14px;color:#333;line-height:1.5;">${addressLines}</p>
          </td>
          <td valign="top" style="width:50%;padding-left:12px;">
            <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:11px;font-weight:bold;letter-spacing:.06em;text-transform:uppercase;color:#999;">${t.delivery}</p>
            <p style="margin:0;font-family:Arial,sans-serif;font-size:14px;color:#333;line-height:1.5;">${esc(o.shipMethod)}<br><span style="color:#a07d2c;">${t.arrival} ${esc(o.delivery)}</span></p>
          </td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:24px 32px 32px;">
        <a href="${SITE_URL}/shop" style="display:inline-block;background:linear-gradient(135deg,#e9c877,#c08a2a);color:#070708;font-family:Arial,sans-serif;font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:.05em;text-decoration:none;padding:14px 28px;border-radius:999px;">${t.cta}</a>
        <p style="margin:22px 0 0;font-family:Arial,sans-serif;font-size:12px;color:#999;line-height:1.6;">${t.note}</p>
      </td></tr>
      <tr><td style="background:#f4f2ee;padding:20px 32px;text-align:center;font-family:Arial,sans-serif;font-size:11px;color:#999;">© 2026 Menlifoot · menlifoot.ca</td></tr>
    </table>
  </td></tr></table>
  </body></html>`;
}

async function sendConfirmationEmail(order: {
  // deno-lint-ignore no-explicit-any
  ref: string; email: string; line_items: any[]; total: number; addr: any; date: string; language?: string;
}) {
  const t = tr(order.language);
  const KEY = Deno.env.get("RESEND_API_KEY");
  const FROM = Deno.env.get("EMAIL_FROM") ?? "Menlifoot <info@menlifoot.ca>";
  const STORE = Deno.env.get("ORDER_CONFIRMATION_EMAIL");
  const REPLY_TO = Deno.env.get("REPLY_TO_EMAIL") ?? "info@menlifoot.ca";
  if (!KEY || !order.email) return;
  const items = order.line_items.map((v) => ({ title: v.title, quantity: v.quantity, price: v.price, personalization: v.personalization }));
  const subtotal = items.reduce((s, it) => s + it.price * it.quantity, 0);
  const shipping = Math.max(0, order.total - subtotal);
  // Estimated delivery window (US vs international) — matches the checkout estimate.
  const isUS = String(order.addr?.country ?? "").toUpperCase() === "US";
  const addDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); };
  const delivery = `${addDays(isUS ? 4 : 14)} – ${addDays(isUS ? 10 : 28)}`;
  const shipMethod = shipping > 0 ? t.standard : t.free;
  const html = confirmationHtml({ ref: order.ref, date: order.date, items, subtotal, shipping, total: order.total, addr: order.addr, shipMethod, delivery, t });
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM,
      to: [order.email],
      reply_to: REPLY_TO,
      ...(STORE ? { bcc: [STORE] } : {}),
      subject: t.subject(order.ref),
      html,
    }),
  }).catch(() => {});
}

serve(async (req) => {
  const STRIPE_KEY = Deno.env.get("STRIPE_SECRET_KEY");
  const WH_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const WH_SECRET_TEST = Deno.env.get("STRIPE_WEBHOOK_SECRET_TEST");
  const PRINTIFY_KEY = Deno.env.get("PRINTIFY_API_KEY");
  if (!STRIPE_KEY || !WH_SECRET || !PRINTIFY_KEY) return new Response("not configured", { status: 500 });

  const stripe = new Stripe(STRIPE_KEY, { apiVersion: "2024-06-20", httpClient: Stripe.createFetchHttpClient() });
  const sig = req.headers.get("stripe-signature") ?? "";
  const body = await req.text();

  // Verify against the live secret; if a test secret is configured, accept those too (for test-mode checkouts).
  let event: Stripe.Event | null = null;
  for (const secret of [WH_SECRET, WH_SECRET_TEST].filter(Boolean) as string[]) {
    try { event = await stripe.webhooks.constructEventAsync(body, sig, secret); break; } catch { /* try next */ }
  }
  if (!event) return new Response("signature error", { status: 400 });

  if (event.type !== "checkout.session.completed") return new Response("ignored", { status: 200 });

  const session = event.data.object as Stripe.Checkout.Session;
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Credit top-ups are handled first and return early: they have no
  // store_orders row, so falling through would look like an unknown order.
  if (session.metadata?.kind === "ucl_credits") {
    const userId = session.metadata.user_id;
    const credits = parseInt(session.metadata.credits ?? "0", 10);
    if (!userId || !Number.isFinite(credits) || credits <= 0) {
      console.error("ucl_credits session missing user_id or credits", session.id);
      return new Response("ok", { status: 200 });
    }

    // Idempotent: Stripe retries webhooks, and the ledger is the record of
    // whether this particular session has already been credited.
    const { data: already } = await db
      .from("credit_ledger")
      .select("id")
      .eq("user_id", userId)
      .eq("reason", "topup")
      .contains("metadata", { session_id: session.id })
      .maybeSingle();
    if (already) return new Response("ok", { status: 200 });

    const { error: grantError } = await db.rpc("grant_credits", {
      p_user_id: userId,
      p_amount: credits,
      p_reason: "topup",
      p_metadata: { session_id: session.id, pack: session.metadata.pack ?? null },
    });
    if (grantError) {
      console.error("grant_credits failed:", grantError.message);
      return new Response("grant failed", { status: 500 });
    }
    return new Response("ok", { status: 200 });
  }

  const { data: order } = await db.from("store_orders").select("*").eq("stripe_session_id", session.id).maybeSingle();
  if (!order || order.status !== "pending") return new Response("ok", { status: 200 }); // idempotent

  try {
    const addr = order.shipping_address ?? {};
    // Test-mode Stripe purchases (livemode=false) must NOT create real Printify orders
    // (no real product made/shipped) — but we still send the confirmation email to test it.
    const isTest = session.livemode === false;

    if (!isTest) {
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
    } else {
      await db.from("store_orders").update({ status: "test", updated_at: new Date().toISOString() }).eq("id", order.id);
    }

    // Send the branded order-confirmation email (failure must not break the webhook).
    await sendConfirmationEmail({
      ref: `MF-${String(session.id).slice(-10).toUpperCase()}`,
      email: order.email ?? addr.email ?? "",
      line_items: order.line_items ?? [],
      total: order.amount_total ?? session.amount_total ?? 0,
      addr,
      date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
      language: order.language,
    });
  } catch (e) {
    await db.from("store_orders").update({ status: "failed", error: e instanceof Error ? e.message : "order error", updated_at: new Date().toISOString() }).eq("id", order.id);
  }

  return new Response("ok", { status: 200 });
});
