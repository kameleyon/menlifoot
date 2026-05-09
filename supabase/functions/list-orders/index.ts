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

    const orders = sessions.data
      .filter((s: any) => s.payment_status === "paid")
      .map((s: any) => {
        const addr =
          s.shipping_details?.address || s.customer_details?.address || null;
        const name =
          s.shipping_details?.name || s.customer_details?.name || null;
        const items = (s.line_items?.data || []).map((li: any) => ({
          name: li.description,
          quantity: li.quantity,
        }));
        const variants = Object.entries(s.metadata || {})
          .filter(([k]) => k.startsWith("variant_"))
          .map(([, v]) => v as string);
        const currency = (s.currency || "cad").toUpperCase();
        return {
          id: s.id,
          reference: `MF-${s.id.slice(-10).toUpperCase()}`,
          createdAt: s.created ? s.created * 1000 : null,
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
          subtotal: fmt(s.amount_subtotal, currency),
          shipping: fmt(
            (s as any).shipping_cost?.amount_total ?? null,
            currency,
          ),
          tax: fmt(s.total_details?.amount_tax ?? null, currency),
          total: fmt(s.amount_total, currency),
          currency,
          status: s.payment_status,
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
