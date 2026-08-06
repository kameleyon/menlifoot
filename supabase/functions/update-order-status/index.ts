import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const VALID_STATUSES = new Set([
  "new",
  "in_process",
  "shipped",
  "delivered",
  "canceled",
]);

const VALID_CARRIERS = new Set([
  "canada_post",
  "ups",
  "fedex",
  "usps",
  "amazon",
  "other",
]);

function trackingUrl(carrier: string | null | undefined, num: string | null | undefined): string | null {
  if (!num) return null;
  const t = encodeURIComponent(num);
  switch (carrier) {
    case "canada_post":
      return `https://www.canadapost-postescanada.ca/track-reperage/en#/details/${t}`;
    case "ups":
      return `https://www.ups.com/track?tracknum=${t}`;
    case "fedex":
      return `https://www.fedex.com/fedextrack/?trknbr=${t}`;
    case "usps":
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${t}`;
    case "amazon":
      return `https://track.amazon.com/tracking/${t}`;
    default:
      return null;
  }
}

// Human label for the carrier. For "other", the merchant-typed custom name is used.
function carrierLabel(c: string | null | undefined, custom?: string | null): string | null {
  switch (c) {
    case "canada_post": return "Canada Post";
    case "ups": return "UPS";
    case "fedex": return "FedEx";
    case "usps": return "USPS";
    case "amazon": return "Amazon";
    case "other": return (custom && custom.trim()) || "Carrier";
    default: return null;
  }
}

const SITE_URL = "https://menlifoot.ca";
const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

// Tracking / status email copy per language.
type TL = { badgeShip: string; badgePrep: string; headShip: string; headPrep: string; introShip: string; introPrep: string; hi: (n?: string) => string; carrier: string; tracking: string; track: string; shipTo: string; visit: string; note: string; subjShip: (r: string) => string; subjPrep: (r: string) => string };
const TLANG: Record<string, TL> = {
  en: { badgeShip: "Shipped", badgePrep: "In preparation", headShip: "Your order is on the way!", headPrep: "We're preparing your order", introShip: "Good news — your Menlifoot order has shipped.", introPrep: "Your Menlifoot order is now being prepared for shipment. We'll email tracking as soon as it's on the way.", hi: (n) => n ? `Hi ${n},` : "Hi,", carrier: "Carrier", tracking: "Tracking number", track: "Track your package", shipTo: "Shipping to", visit: "Visit the store", note: "Questions? Reply to this email or contact orders@menlifoot.ca.", subjShip: (r) => `Your Menlifoot order ${r} has shipped`, subjPrep: (r) => `Your Menlifoot order ${r} is being prepared` },
  fr: { badgeShip: "Expédiée", badgePrep: "En préparation", headShip: "Votre commande est en route !", headPrep: "Nous préparons votre commande", introShip: "Bonne nouvelle — votre commande Menlifoot a été expédiée.", introPrep: "Votre commande Menlifoot est en préparation. Nous vous enverrons le suivi dès l'expédition.", hi: (n) => n ? `Bonjour ${n},` : "Bonjour,", carrier: "Transporteur", tracking: "Numéro de suivi", track: "Suivre le colis", shipTo: "Livraison à", visit: "Visiter la boutique", note: "Des questions ? Répondez à cet e-mail ou écrivez à orders@menlifoot.ca.", subjShip: (r) => `Votre commande Menlifoot ${r} a été expédiée`, subjPrep: (r) => `Votre commande Menlifoot ${r} est en préparation` },
  es: { badgeShip: "Enviado", badgePrep: "En preparación", headShip: "¡Tu pedido está en camino!", headPrep: "Estamos preparando tu pedido", introShip: "Buenas noticias — tu pedido Menlifoot ha sido enviado.", introPrep: "Tu pedido Menlifoot se está preparando. Te enviaremos el seguimiento en cuanto salga.", hi: (n) => n ? `Hola ${n},` : "Hola,", carrier: "Transportista", tracking: "Número de seguimiento", track: "Rastrear paquete", shipTo: "Enviar a", visit: "Visitar la tienda", note: "¿Dudas? Responde a este correo o escribe a orders@menlifoot.ca.", subjShip: (r) => `Tu pedido Menlifoot ${r} ha sido enviado`, subjPrep: (r) => `Tu pedido Menlifoot ${r} se está preparando` },
  ht: { badgeShip: "Ekspedye", badgePrep: "Ap prepare", headShip: "Kòmand ou an wout!", headPrep: "N ap prepare kòmand ou", introShip: "Bon nouvèl — kòmand Menlifoot ou an ekspedye.", introPrep: "Kòmand Menlifoot ou an ap prepare. N ap voye swivi a touswit li pati.", hi: (n) => n ? `Bonjou ${n},` : "Bonjou,", carrier: "Transpòtè", tracking: "Nimewo swivi", track: "Swiv pake a", shipTo: "Livre bay", visit: "Vizite boutik la", note: "Kesyon? Reponn imèl sa a oswa ekri orders@menlifoot.ca.", subjShip: (r) => `Kòmand Menlifoot ou ${r} ekspedye`, subjPrep: (r) => `Kòmand Menlifoot ou ${r} ap prepare` },
};
const tl = (lang?: string): TL => TLANG[String(lang ?? "en")] ?? TLANG.en;

function statusEmailHtml(o: { shipped: boolean; name?: string; ref: string; carrier?: string | null; trackingNumber?: string | null; trackingUrl?: string | null; shippingAddress?: string; t: TL }) {
  const t = o.t;
  const hi = t.hi(o.name ? esc(o.name) : undefined);
  const heading = o.shipped ? t.headShip : t.headPrep;
  const intro = o.shipped ? t.introShip : t.introPrep;
  const trackingBlock = o.shipped && o.trackingNumber ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;background:#f7f5f0;border-radius:12px;">
      <tr><td style="padding:16px 18px;font-family:Arial,sans-serif;">
        ${o.carrier ? `<div style="font-size:12px;color:#999;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">${t.carrier}</div><div style="font-size:14px;color:#111;margin-bottom:10px;">${esc(o.carrier)}</div>` : ""}
        <div style="font-size:12px;color:#999;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">${t.tracking}</div>
        <div style="font-size:15px;color:#111;font-weight:bold;">${esc(o.trackingNumber)}</div>
        ${o.trackingUrl ? `<a href="${esc(o.trackingUrl)}" style="display:inline-block;margin-top:12px;background:linear-gradient(135deg,#e9c877,#c08a2a);color:#070708;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:.05em;text-decoration:none;padding:11px 22px;border-radius:999px;">${t.track}</a>` : ""}
      </td></tr>
    </table>` : "";
  const addr = o.shippingAddress ? `<p style="margin:12px 0 0;font-family:Arial,sans-serif;font-size:12px;color:#999;">${t.shipTo}: ${esc(o.shippingAddress)}</p>` : "";
  return `<!doctype html><html><body style="margin:0;background:#0a0a0b;padding:24px 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;">
      <tr><td style="background:#070708;padding:28px 32px;text-align:center;"><img src="${SITE_URL}/menlifootca.png" alt="Menlifoot" width="180" style="max-width:180px;height:auto;"></td></tr>
      <tr><td style="padding:34px 32px 8px;">
        <div style="display:inline-block;background:linear-gradient(135deg,#e9c877,#c08a2a);color:#070708;font-family:Arial,sans-serif;font-size:11px;font-weight:bold;letter-spacing:.08em;text-transform:uppercase;padding:7px 14px;border-radius:999px;">${o.shipped ? t.badgeShip : t.badgePrep}</div>
        <h1 style="margin:16px 0 4px;font-family:Arial,sans-serif;font-size:22px;color:#111;">${heading}</h1>
        <p style="margin:0;font-family:Arial,sans-serif;font-size:14px;color:#555;">${esc(o.ref)}</p>
      </td></tr>
      <tr><td style="padding:14px 32px 0;font-family:Arial,sans-serif;font-size:14px;color:#333;line-height:1.6;">
        <p style="margin:0 0 8px;">${hi}</p>
        <p style="margin:0;">${intro}</p>
        ${trackingBlock}${addr}
      </td></tr>
      <tr><td style="padding:22px 32px 32px;">
        <a href="${SITE_URL}/shop" style="display:inline-block;background:#111;color:#fff;font-family:Arial,sans-serif;font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:.05em;text-decoration:none;padding:14px 28px;border-radius:999px;">${t.visit}</a>
        <p style="margin:22px 0 0;font-family:Arial,sans-serif;font-size:12px;color:#999;line-height:1.6;">${t.note}</p>
      </td></tr>
      <tr><td style="background:#f4f2ee;padding:20px 32px;text-align:center;font-family:Arial,sans-serif;font-size:11px;color:#999;">© 2026 Menlifoot · menlifoot.ca</td></tr>
    </table>
  </td></tr></table></body></html>`;
}

async function sendStatusEmail(to: string, subject: string, html: string) {
  const KEY = Deno.env.get("RESEND_API_KEY");
  const FROM = Deno.env.get("EMAIL_FROM") ?? "Menlifoot <info@menlifoot.ca>";
  const REPLY_TO = Deno.env.get("REPLY_TO_EMAIL") ?? "info@menlifoot.ca";
  const STORE = Deno.env.get("ORDER_CONFIRMATION_EMAIL");
  if (!KEY || !to) return false;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: `Menlifoot <${FROM}>`, to: [to], reply_to: REPLY_TO, ...(STORE ? { bcc: [STORE] } : {}), subject, html }),
  });
  return r.ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const service = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: roleRow } = await service
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json() as {
      sessionId: string;
      environment: StripeEnv;
      status: string;
      trackingNumber?: string | null;
      carrier?: string | null;
      carrierName?: string | null;
      notes?: string | null;
      sendEmail?: boolean;
    };

    if (!body.sessionId || !body.environment || !VALID_STATUSES.has(body.status)) {
      return new Response(JSON.stringify({ error: "Invalid input" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (body.carrier && !VALID_CARRIERS.has(body.carrier)) {
      return new Response(JSON.stringify({ error: "Invalid carrier" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const upsert = {
      stripe_session_id: body.sessionId,
      environment: body.environment,
      status: body.status,
      tracking_number: body.trackingNumber || null,
      carrier: body.carrier || null,
      carrier_name: body.carrier === "other" ? (body.carrierName || null) : null,
      notes: body.notes || null,
      updated_by: user.id,
    };

    const { error: upsertErr } = await service
      .from("order_status")
      .upsert(upsert, { onConflict: "stripe_session_id" });
    if (upsertErr) throw new Error(upsertErr.message);

    let emailed = false;
    if (body.sendEmail && (body.status === "in_process" || body.status === "shipped")) {
      // Pull session details for email
      const stripe = createStripeClient(body.environment);
      const session = await stripe.checkout.sessions.retrieve(body.sessionId);
      const email = session.customer_details?.email || session.customer_email;
      const name = session.shipping_details?.name || session.customer_details?.name;
      const firstName = name?.split(" ")[0];
      const orderReference = `MF-${body.sessionId.slice(-10).toUpperCase()}`;
      // Send in the language the order was placed in.
      const { data: ord } = await service.from("store_orders").select("language").eq("stripe_session_id", body.sessionId).maybeSingle();
      const t = tl(ord?.language);

      if (email) {
        const addr = session.shipping_details?.address || session.customer_details?.address;
        const shippingAddress = addr
          ? [
              name,
              addr.line1,
              addr.line2,
              [addr.postal_code, addr.city, addr.state].filter(Boolean).join(" "),
              addr.country,
            ].filter(Boolean).join(", ")
          : undefined;

        const shipped = body.status === "shipped";
        const html = statusEmailHtml({
          shipped,
          name: firstName,
          ref: orderReference,
          carrier: shipped ? carrierLabel(body.carrier, body.carrierName) : null,
          trackingNumber: shipped ? body.trackingNumber : null,
          trackingUrl: shipped ? trackingUrl(body.carrier, body.trackingNumber) : null,
          shippingAddress: shipped ? shippingAddress : undefined,
          t,
        });
        const subject = shipped ? t.subjShip(orderReference) : t.subjPrep(orderReference);
        try {
          emailed = await sendStatusEmail(email, subject, html);
        } catch (e) {
          console.error("send email error", e);
        }
      }
    }

    return new Response(JSON.stringify({ success: true, emailed }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("update-order-status error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
