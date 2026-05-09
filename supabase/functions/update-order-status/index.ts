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

        const templateName = body.status === "in_process" ? "order-in-process" : "order-shipped";
        const templateData: Record<string, unknown> = {
          customerName: firstName,
          orderReference,
        };
        if (body.status === "shipped") {
          templateData.trackingNumber = body.trackingNumber || undefined;
          templateData.carrier = carrierLabel(body.carrier);
          templateData.trackingUrl = trackingUrl(body.carrier, body.trackingNumber) || undefined;
          templateData.shippingAddress = shippingAddress;
        }

        const { error: emailErr } = await service.functions.invoke(
          "send-transactional-email",
          {
            body: {
              templateName,
              recipientEmail: email,
              idempotencyKey: `order-${body.status}-${body.sessionId}-${body.trackingNumber || ""}`,
              templateData,
            },
          },
        );
        if (emailErr) console.error("send email error", emailErr);
        else emailed = true;
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
