// Reads a UCL Fantasy squad screenshot into a structured squad.
//
// Two stages, deliberately separated:
//   1. Vision model extracts what it can SEE (names, positions, captain badge,
//      who is on the bench). It is never asked for stats or player ids.
//   2. match_ucl_player() resolves those names to real rows in Postgres via
//      trigram similarity. Unresolved names come back to the client so the user
//      can correct them, rather than being silently dropped or hallucinated.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
};

const VISION_PROMPT = `You are reading a screenshot of a UEFA Champions League Fantasy squad.

Extract ONLY what is visibly present. Return raw JSON, no markdown fences:

{
  "formation": "3-4-3",
  "starters": [
    { "name": "as printed on the shirt card", "position": "GK|DEF|MID|FWD",
      "team_code": "3-4 letter club code if shown, else null",
      "price": 6.0 or null,
      "is_captain": false, "is_vice": false }
  ],
  "bench": [ { same shape } ]
}

Rules:
- Starters are the players on the pitch; bench players sit in the separate
  strip usually labelled BENCH.
- Infer position from the row a player sits in: goalkeeper row = GK, then DEF,
  MID, FWD moving up the pitch.
- A "C" badge means is_captain. A "V" badge means is_vice.
- Copy names exactly as printed, abbreviations included (e.g. "B.Fernandes").
- If a value is not visible, use null. Never invent players or prices.`;

type ParsedPlayer = {
  name: string;
  position: string | null;
  team_code: string | null;
  price: number | null;
  is_captain: boolean;
  is_vice: boolean;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured");

    const { imageBase64, imageUrl } = await req.json();
    if (!imageUrl && !imageBase64) throw new Error("imageBase64 or imageUrl is required");

    // imageUrl is relayed to OpenRouter, which fetches it. Restrict to https so
    // the endpoint cannot be used to hand another scheme (file:, gopher:, an
    // internal host) to a third-party fetcher.
    if (imageUrl && !/^https:\/\//i.test(String(imageUrl))) {
      throw new Error("imageUrl must be an https URL");
    }
    if (imageBase64 && !/^[A-Za-z0-9+/=\s]+$/.test(String(imageBase64))) {
      throw new Error("imageBase64 is not valid base64");
    }

    const imageContent = imageUrl
      ? { type: "image_url", image_url: { url: String(imageUrl) } }
      : { type: "image_url", image_url: { url: `data:image/png;base64,${imageBase64}` } };

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-5.6-sol",
        messages: [
          { role: "system", content: "You return only raw JSON. No prose, no markdown fences." },
          { role: "user", content: [{ type: "text", text: VISION_PROMPT }, imageContent] },
        ],
        temperature: 0,
      }),
    });
    if (!res.ok) throw new Error(`openrouter ${res.status}: ${await res.text()}`);

    const body = await res.json();
    const text = String(body?.choices?.[0]?.message?.content ?? "");
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error(`no JSON in vision response: ${text.slice(0, 200)}`);
    const parsed = JSON.parse(match[0]);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const unresolved: string[] = [];

    const resolve = async (list: unknown, onBench: boolean) => {
      const rows = Array.isArray(list) ? (list as ParsedPlayer[]) : [];
      const out: Record<string, unknown>[] = [];
      for (const p of rows) {
        const name = String(p?.name ?? "").trim();
        if (!name) continue;
        const pos = ["GK", "DEF", "MID", "FWD"].includes(String(p?.position ?? ""))
          ? String(p.position)
          : null;

        // Try with the position hint first; fall back to an unconstrained match
        // so a misread row placement does not lose the player entirely.
        let hit: Record<string, unknown> | null = null;
        for (const attempt of [pos, null]) {
          const { data } = await supabase.rpc("match_ucl_player", {
            q: name,
            pos: attempt,
            lim: 1,
          });
          if (Array.isArray(data) && data[0]) {
            hit = data[0];
            break;
          }
          if (attempt === null) break;
        }

        if (!hit) {
          unresolved.push(name);
          out.push({
            player_id: null,
            read_as: name,
            position: pos,
            is_captain: !!p?.is_captain,
            is_vice: !!p?.is_vice,
            on_bench: onBench,
          });
          continue;
        }

        out.push({
          player_id: hit.id,
          read_as: name,
          name: hit.name,
          display_name: hit.display_name,
          team: hit.team,
          team_code: hit.team_code,
          position: hit.position,
          price: hit.price,
          match_score: hit.score,
          is_captain: !!p?.is_captain,
          is_vice: !!p?.is_vice,
          on_bench: onBench,
        });
      }
      return out;
    };

    const starters = await resolve(parsed?.starters, false);
    const bench = await resolve(parsed?.bench, true);

    return new Response(
      JSON.stringify({
        formation: parsed?.formation ?? null,
        starters,
        bench,
        unresolved,
        // The client should prompt for manual correction when this is true.
        needs_review: unresolved.length > 0 || starters.length !== 11,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("ucl-parse-screenshot failed:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
