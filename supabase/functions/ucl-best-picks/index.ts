// Fixture analysis: the strongest players to own for the upcoming matchday.
//
// Paid feature. The underlying ucl_best_picks() RPC has had EXECUTE revoked
// from the browser roles, so this function is the only way in: it spends the
// credits as the signed-in user first, then reads with the service role.
//
// The ranking itself is pure SQL - no model call - so the cost here is entirely
// the credit, not compute.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
};

const PRICE = 2;
const DEFAULT_PER_POSITION = 3;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const body = await req.json().catch(() => ({}));
    const perPosition = Math.max(1, Math.min(5, Math.floor(Number(body?.perPosition) || DEFAULT_PER_POSITION)));
    const competition = ["UCL", "EPL"].includes(String(body?.competition ?? "UCL"))
      ? String(body?.competition ?? "UCL")
      : "UCL";
    // Free while the Premier League version has no credit system.
    const isFree = competition === "EPL";

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : null;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    const service0 = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    if (isFree) {
      const { data, error } = await service0.rpc("ucl_best_picks", {
        lim: perPosition,
        p_competition: competition,
      });
      if (error) throw new Error(`best picks failed: ${error.message}`);
      const grouped: Record<string, unknown[]> = { GK: [], DEF: [], MID: [], FWD: [] };
      for (const row of (data ?? []) as Record<string, unknown>[]) {
        const pos = String(row.position ?? "");
        if (grouped[pos]) grouped[pos].push(row);
      }
      return json({
        picks: grouped,
        fixtures_known: ((data ?? []) as Record<string, unknown>[]).some((r) => r.next_difficulty != null),
        credits_remaining: null,
        price: 0,
        free: true,
      });
    }

    // An anon-key bearer is not a signed-in user; treat it as signed out.
    if (!token || token === anonKey) {
      return json({ error: "sign_in_required", cost: PRICE }, 401);
    }

    const service = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const { data: userData } = await service.auth.getUser(token);
    if (!userData?.user?.id) return json({ error: "sign_in_required", cost: PRICE }, 401);

    // Spend as the user so spend_credits' own auth.uid() guard applies.
    const asUser = createClient(Deno.env.get("SUPABASE_URL") ?? "", anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: newBalance, error: spendError } = await asUser.rpc("spend_credits", {
      p_amount: PRICE,
      p_reason: "ucl_best_picks",
      p_metadata: { per_position: perPosition },
    });
    if (spendError) throw new Error(`credit spend failed: ${spendError.message}`);
    if (typeof newBalance !== "number" || newBalance < 0) {
      return json({ error: "insufficient_credits", cost: PRICE }, 402);
    }

    const { data, error } = await service.rpc("ucl_best_picks", {
      lim: perPosition,
      p_competition: competition,
    });
    if (error) throw new Error(`best picks failed: ${error.message}`);

    const grouped: Record<string, unknown[]> = { GK: [], DEF: [], MID: [], FWD: [] };
    for (const row of (data ?? []) as Record<string, unknown>[]) {
      const pos = String(row.position ?? "");
      if (grouped[pos]) grouped[pos].push(row);
    }

    return json({
      picks: grouped,
      // True once fixtures exist; until then the ranking leans on club form and
      // the client says so rather than implying a fixture was considered.
      fixtures_known: ((data ?? []) as Record<string, unknown>[]).some(
        (r) => r.next_difficulty != null,
      ),
      credits_remaining: newBalance,
      price: PRICE,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("ucl-best-picks failed:", message);
    return json({ error: message }, 500);
  }
});
