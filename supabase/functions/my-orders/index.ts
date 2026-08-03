import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const money = (cents: number | null) => (cents == null ? "" : `$${(cents / 100).toFixed(2)}`);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user?.email) return json({ error: "Unauthorized" }, 401);

    const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    // The user's own paid orders (real, not test/pending), newest first.
    const { data: rows } = await service
      .from("store_orders")
      .select("stripe_session_id, amount_total, line_items, created_at, language")
      .eq("email", user.email)
      .eq("status", "submitted")
      .order("created_at", { ascending: false })
      .limit(50);

    const sessionIds = (rows ?? []).map((r) => r.stripe_session_id);
    const statusMap = new Map<string, any>();
    if (sessionIds.length) {
      const { data: statuses } = await service.from("order_status").select("*").in("stripe_session_id", sessionIds);
      for (const s of statuses ?? []) statusMap.set(s.stripe_session_id, s);
    }

    const orders = (rows ?? []).map((r) => {
      const st = statusMap.get(r.stripe_session_id);
      return {
        reference: `MF-${String(r.stripe_session_id).slice(-10).toUpperCase()}`,
        createdAt: r.created_at,
        total: money(r.amount_total),
        // deno-lint-ignore no-explicit-any
        items: ((r.line_items as any[]) ?? []).map((v) => ({ name: v.title, quantity: v.quantity, personalization: v.personalization || null })),
        status: st?.status || "new",
        trackingNumber: st?.tracking_number || null,
        carrier: st?.carrier || null,
        carrierName: st?.carrier_name || null,
      };
    });

    return json({ orders });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "error" }, 500);
  }
});
