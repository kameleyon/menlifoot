// Stripe checkout for a credit top-up.
//
// Creates the session with an inline price rather than a Stripe Price object so
// the pack can be repriced here without touching the Stripe dashboard. The
// user id travels in metadata, and stripe-webhook grants the credits on
// checkout.session.completed - never this function, because a client could
// abandon payment after the session is created.

import { createStripeClient } from "../_shared/stripe.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
};

// 15 credits for USD 0.99. Kept as a table so more packs are a data change.
const PACKS: Record<string, { credits: number; amount: number; label: string }> = {
  starter: { credits: 15, amount: 99, label: "15 credits" },
  plus: { credits: 50, amount: 299, label: "50 credits" },
  pro: { credits: 120, amount: 599, label: "120 credits" },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const { pack = "starter", returnUrl } = await req.json().catch(() => ({}));
    const chosen = PACKS[String(pack)];
    if (!chosen) return json({ error: `unknown pack "${pack}"` }, 400);
    if (!returnUrl || !/^https?:\/\//i.test(String(returnUrl))) {
      return json({ error: "returnUrl is required" }, 400);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : null;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    if (!token || token === anonKey) return json({ error: "sign_in_required" }, 401);

    const service = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const { data: userData } = await service.auth.getUser(token);
    const user = userData?.user;
    if (!user?.id) return json({ error: "sign_in_required" }, 401);

    const stripe = createStripeClient("live");
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: user.email ?? undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: chosen.amount,
            product_data: {
              name: `Menlifoot Fantasy — ${chosen.label}`,
              description: "Credits for squad analysis: optimiser, captain picks, chips, fixtures and transfers.",
            },
          },
        },
      ],
      // The webhook reads these to decide who to credit and how much. Stripe
      // metadata values must be strings.
      metadata: {
        kind: "ucl_credits",
        user_id: user.id,
        credits: String(chosen.credits),
        pack: String(pack),
      },
      success_url: `${returnUrl}?credits=success`,
      cancel_url: `${returnUrl}?credits=cancelled`,
    });

    return json({ url: session.url, credits: chosen.credits, amount: chosen.amount });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("ucl-credits-checkout failed:", message);
    return json({ error: message }, 500);
  }
});
