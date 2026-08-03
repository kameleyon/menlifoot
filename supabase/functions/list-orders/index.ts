import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function fmt(amount: number | null | undefined, currency: string) {
  if (amount == null) return "";
  const cur = currency.toUpperCase();
  const prefix = cur === "CAD" ? "CA$" : cur === "USD" ? "US$" : `${cur} `;
  return `${prefix}${(amount / 100).toFixed(2)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

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

    const url = new URL(req.url);
    const environment = (url.searchParams.get("environment") ||
      "sandbox") as StripeEnv;
    const limit = Math.min(
      Number(url.searchParams.get("limit") || 100),
      100,
    );

    const stripe = createStripeClient(environment);
    const sessions = await stripe.checkout.sessions.list({
      limit,
      expand: ["data.line_items", "data.shipping_cost.shipping_rate"],
    });

    const paid = sessions.data.filter((s: any) => s.payment_status === "paid");

    // Fetch saved statuses + stored order data (language, personalization per item)
    const sessionIds = paid.map((s: any) => s.id);
    const statusMap = new Map<string, any>();
    const storeMap = new Map<string, any>();
    if (sessionIds.length > 0) {
      const { data: statuses } = await service
        .from("order_status")
        .select("*")
        .in("stripe_session_id", sessionIds);
      for (const row of statuses || []) statusMap.set(row.stripe_session_id, row);
      const { data: stored } = await service
        .from("store_orders")
        .select("stripe_session_id, language, line_items")
        .in("stripe_session_id", sessionIds);
      for (const row of stored || []) storeMap.set(row.stripe_session_id, row);
    }

    const orders = paid.map((s: any) => {
      const addr =
        s.shipping_details?.address || s.customer_details?.address || null;
      const name =
        s.shipping_details?.name || s.customer_details?.name || null;
      const stored = storeMap.get(s.id);
      // Prefer stored line items (they carry clean title + personalization); else Stripe line items.
      const items = stored?.line_items
        ? (stored.line_items as any[]).map((v) => ({ name: v.title, quantity: v.quantity, personalization: v.personalization || null }))
        : (s.line_items?.data || []).map((li: any) => ({ name: li.description, quantity: li.quantity, personalization: null }));
      const variants = Object.entries(s.metadata || {})
        .filter(([k]) => k.startsWith("variant_"))
        .map(([, v]) => v as string);
      const currency = (s.currency || "cad").toUpperCase();
      const status = statusMap.get(s.id);
      return {
        id: s.id,
        reference: `MF-${s.id.slice(-10).toUpperCase()}`,
        createdAt: s.created ? s.created * 1000 : null,
        livemode: !!s.livemode,
        isTest: !s.livemode,
        email: s.customer_details?.email || s.customer_email || null,
        name,
        phone: s.customer_details?.phone || null,
        address: addr
          ? {
              line1: addr.line1,
              line2: addr.line2,
              city: addr.city,
              state: addr.state,
              postal_code: addr.postal_code,
              country: addr.country,
            }
          : null,
        items,
        variants,
        amountSubtotal: s.amount_subtotal ?? 0,
        amountShipping: (s as any).shipping_cost?.amount_total ?? 0,
        amountTax: s.total_details?.amount_tax ?? 0,
        amountTotal: s.amount_total ?? 0,
        subtotal: fmt(s.amount_subtotal, currency),
        shipping: fmt(
          (s as any).shipping_cost?.amount_total ?? null,
          currency,
        ),
        tax: fmt(s.total_details?.amount_tax ?? null, currency),
        total: fmt(s.amount_total, currency),
        currency,
        paymentStatus: s.payment_status,
        fulfillmentStatus: status?.status || "new",
        trackingNumber: status?.tracking_number || null,
        carrier: status?.carrier || null,
        carrierName: status?.carrier_name || null,
        language: stored?.language || null,
        notes: status?.notes || null,
        statusUpdatedAt: status?.updated_at || null,
      };
    });

    return new Response(JSON.stringify({ orders }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("list-orders error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
