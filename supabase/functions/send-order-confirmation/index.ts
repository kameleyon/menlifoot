import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  sessionId: string;
  environment: StripeEnv;
}

function fmtMoney(amount: number | null | undefined, currency: string) {
  if (amount == null) return "";
  const cur = currency.toUpperCase();
  return `${cur === "CAD" ? "CA$" : cur === "USD" ? "US$" : cur + " "}${(amount / 100).toFixed(2)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { sessionId, environment } = (await req.json()) as RequestBody;
    if (!sessionId || !environment) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = createStripeClient(environment);
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items", "line_items.data.price.product", "shipping_cost.shipping_rate"],
    });

    if (session.payment_status !== "paid") {
      return new Response(JSON.stringify({ skipped: "not_paid" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = session.customer_details?.email || session.customer_email;
    if (!email) {
      return new Response(JSON.stringify({ error: "No customer email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const currency = (session.currency || "cad").toUpperCase();
    const items =
      (session.line_items?.data || []).map((li: any) => ({
        name: li.description || li.price?.product?.name || "Item",
        quantity: li.quantity || 1,
      })) || [];

    // Pull variant breakdown from metadata
    const variantNotes: string[] = [];
    Object.entries(session.metadata || {}).forEach(([k, v]) => {
      if (k.startsWith("variant_") && typeof v === "string") variantNotes.push(v);
    });
    if (variantNotes.length && items.length) {
      // Attach combined variant string to first item for visibility
      items[0] = { ...items[0], variant: variantNotes.join(" • ").slice(0, 200) };
    }

    const addr = session.shipping_details?.address || session.customer_details?.address;
    const name = session.shipping_details?.name || session.customer_details?.name || undefined;
    const shippingAddress = addr
      ? [
          name,
          addr.line1,
          addr.line2,
          [addr.postal_code, addr.city, addr.state].filter(Boolean).join(" "),
          addr.country,
        ]
          .filter(Boolean)
          .join(", ")
      : undefined;

    const subtotal = fmtMoney(session.amount_subtotal, currency);
    const total = fmtMoney(session.amount_total, currency);
    const shipping = fmtMoney(
      (session as any).shipping_cost?.amount_total ?? null,
      currency,
    );
    const tax = fmtMoney(session.total_details?.amount_tax ?? null, currency);

    const orderReference = `MF-${sessionId.slice(-10).toUpperCase()}`;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { error } = await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: "order-confirmation",
        recipientEmail: email,
        idempotencyKey: `order-confirm-${sessionId}`,
        templateData: {
          customerName: name?.split(" ")[0],
          orderReference,
          items,
          subtotal,
          shipping,
          tax,
          total,
          shippingAddress,
        },
      },
    });

    if (error) throw new Error(error.message);

    return new Response(JSON.stringify({ success: true, orderReference }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-order-confirmation error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    const isRateLimit = /rate limit/i.test(message);
    return new Response(
      JSON.stringify({ error: message, fallback: isRateLimit }),
      {
        status: isRateLimit ? 200 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
