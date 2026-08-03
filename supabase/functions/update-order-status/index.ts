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
    default:
      return null;
  }
}

function carrierLabel(c: string | null | undefined): string | null {
  switch (c) {
    case "canada_post": return "Canada Post";
    case "ups": return "UPS";
    case "fedex": return "FedEx";
    case "usps": return "USPS";
    case "other": return "Carrier";
    default: return null;
  }
}

const SITE_URL = "https://menlifoot-mvp.vercel.app";
const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function statusEmailHtml(o: { shipped: boolean; name?: string; ref: string; carrier?: string | null; trackingNumber?: string | null; trackingUrl?: string | null; shippingAddress?: string }) {
  const hi = o.name ? `Hi ${esc(o.name)},` : "Hi,";
  const heading = o.shipped ? "Your order is on the way!" : "We're preparing your order";
  const intro = o.shipped
    ? "Good news — your Menlifoot order has shipped."
    : "Your Menlifoot order is now being prepared for shipment. We'll email tracking as soon as it's on the way.";
  const trackingBlock = o.shipped && o.trackingNumber ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0;background:#f7f5f0;border-radius:12px;">
      <tr><td style="padding:16px 18px;font-family:Arial,sans-serif;">
        ${o.carrier ? `<div style="font-size:12px;color:#999;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">Carrier</div><div style="font-size:14px;color:#111;margin-bottom:10px;">${esc(o.carrier)}</div>` : ""}
        <div style="font-size:12px;color:#999;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">Tracking number</div>
        <div style="font-size:15px;color:#111;font-weight:bold;">${esc(o.trackingNumber)}</div>
        ${o.trackingUrl ? `<a href="${esc(o.trackingUrl)}" style="display:inline-block;margin-top:12px;background:linear-gradient(135deg,#e9c877,#c08a2a);color:#070708;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:.05em;text-decoration:none;padding:11px 22px;border-radius:999px;">Track your package</a>` : ""}
      </td></tr>
    </table>` : "";
  const addr = o.shippingAddress ? `<p style="margin:12px 0 0;font-family:Arial,sans-serif;font-size:12px;color:#999;">Shipping to: ${esc(o.shippingAddress)}</p>` : "";
  return `<!doctype html><html><body style="margin:0;background:#0a0a0b;padding:24px 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;">
      <tr><td style="background:#070708;padding:28px 32px;text-align:center;"><img src="${SITE_URL}/menlifootca.png" alt="Menlifoot" width="180" style="max-width:180px;height:auto;"></td></tr>
      <tr><td style="padding:34px 32px 8px;">
        <div style="display:inline-block;background:linear-gradient(135deg,#e9c877,#c08a2a);color:#070708;font-family:Arial,sans-serif;font-size:11px;font-weight:bold;letter-spacing:.08em;text-transform:uppercase;padding:7px 14px;border-radius:999px;">${o.shipped ? "Shipped" : "In preparation"}</div>
        <h1 style="margin:16px 0 4px;font-family:Arial,sans-serif;font-size:22px;color:#111;">${heading}</h1>
        <p style="margin:0;font-family:Arial,sans-serif;font-size:14px;color:#555;">Order <strong>${esc(o.ref)}</strong></p>
      </td></tr>
      <tr><td style="padding:14px 32px 0;font-family:Arial,sans-serif;font-size:14px;color:#333;line-height:1.6;">
        <p style="margin:0 0 8px;">${hi}</p>
        <p style="margin:0;">${intro}</p>
        ${trackingBlock}${addr}
      </td></tr>
      <tr><td style="padding:22px 32px 32px;">
        <a href="${SITE_URL}/shop" style="display:inline-block;background:#111;color:#fff;font-family:Arial,sans-serif;font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:.05em;text-decoration:none;padding:14px 28px;border-radius:999px;">Visit the store</a>
        <p style="margin:22px 0 0;font-family:Arial,sans-serif;font-size:12px;color:#999;line-height:1.6;">Questions? Reply to this email or contact orders@menlifoot.ca.</p>
      </td></tr>
      <tr><td style="background:#f4f2ee;padding:20px 32px;text-align:center;font-family:Arial,sans-serif;font-size:11px;color:#999;">© 2026 Menlifoot · menlifoot.ca</td></tr>
    </table>
  </td></tr></table></body></html>`;
}

async function sendStatusEmail(to: string, subject: string, html: string) {
  const KEY = Deno.env.get("RESEND_API_KEY");
  const FROM = Deno.env.get("EMAIL_FROM") ?? "noreply@menlifoot.ca";
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
          carrier: shipped ? carrierLabel(body.carrier) : null,
          trackingNumber: shipped ? body.trackingNumber : null,
          trackingUrl: shipped ? trackingUrl(body.carrier, body.trackingNumber) : null,
          shippingAddress: shipped ? shippingAddress : undefined,
        });
        const subject = shipped ? `Your Menlifoot order ${orderReference} has shipped` : `Your Menlifoot order ${orderReference} is being prepared`;
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
