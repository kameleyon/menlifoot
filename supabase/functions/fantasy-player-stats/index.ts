// Per-player season stats from the league leaderboards.
//
// This fills the `form` sub-score, which until now had no source at all: the
// per-player stats route returns coverage:false for football at every tier, and
// the paid rolling-form routes sit behind Solo. The league leaderboards are
// free, live, and carry exactly what form needs - goals, assists, minutes,
// appearances - plus xG and xA that the paid routes do not advertise.
//
// Two limitations are inherent and handled rather than hidden:
//   * Leaderboards are top-N per category, so only productive players appear.
//     That is acceptable: a player absent from every board has genuinely
//     negligible attacking form, and their score stays neutral rather than
//     being invented.
//   * Rows are keyed by player NAME with no id - the provider says the entity
//     bridge is not built - so they are resolved with the same trigram matcher
//     used for screenshot OCR.
//
// Serves both competitions: a UCL squad is drawn from these same domestic
// leagues, so the numbers apply to either pool.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
};

const BBS = "https://api.bigballsdata.com/v1";
const LEAGUES = ["epl", "laliga", "serie-a", "bundesliga", "ligue-1"];
const CATEGORIES = ["goals", "assists", "minutes", "matches"];
const DEFAULT_SEASON = 2026;

const normalize = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : fallback;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Documented retry policy: Retry-After on 429, jittered backoff on 5xx. */
async function bbs(path: string, apiKey: string, attempt = 0): Promise<Record<string, unknown>> {
  const res = await fetch(BBS + path, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (res.ok) return await res.json();
  if (res.status === 429 && attempt < 5) {
    await sleep(Math.max(1, num(res.headers.get("Retry-After"), 2)) * 1000);
    return bbs(path, apiKey, attempt + 1);
  }
  if (res.status >= 500 && attempt < 5) {
    await sleep(Math.min(60000, 1000 * 2 ** attempt) * (0.5 + Math.random() / 2));
    return bbs(path, apiKey, attempt + 1);
  }
  throw new Error(`bbs ${res.status} ${path}`);
}

type Row = {
  goals: number;
  assists: number;
  minutes: number;
  appearances: number;
  xg: number | null;
  xa: number | null;
  team: string | null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
  const apiKey = Deno.env.get("BIGBALLS_API_KEY");

  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    if (!apiKey) return json({ error: "BIGBALLS_API_KEY is not configured" }, 500);
    const body = await req.json().catch(() => ({}));
    const season = Math.floor(num(body?.season, DEFAULT_SEASON));
    const competitions: string[] = Array.isArray(body?.competitions) && body.competitions.length
      ? body.competitions.map(String)
      : ["UCL", "EPL"];

    // Merge every board into one row per player. Sorting by four categories
    // surfaces different slices - a defender with minutes but no goals only
    // appears on the minutes board - so the union is much wider than any one.
    const byName = new Map<string, Row>();
    const leagueCounts: Record<string, number> = {};

    for (const league of LEAGUES) {
      for (const category of CATEGORIES) {
        try {
          const b = await bbs(
            `/leagues/${league}/top-scorers?season=${season}&category=${category}&limit=100`,
            apiKey,
          );
          for (const r of (Array.isArray(b?.data) ? b.data : []) as Record<string, unknown>[]) {
            const name = String(r.player_name ?? "").trim();
            if (!name) continue;
            const key = normalize(name);
            const prev = byName.get(key);
            byName.set(key, {
              goals: Math.max(prev?.goals ?? 0, Math.round(num(r.goals))),
              assists: Math.max(prev?.assists ?? 0, Math.round(num(r.assists))),
              minutes: Math.max(prev?.minutes ?? 0, Math.round(num(r.minutes))),
              appearances: Math.max(prev?.appearances ?? 0, Math.round(num(r.matches))),
              xg: prev?.xg ?? null,
              xa: prev?.xa ?? null,
              team: prev?.team ?? (r.team ? String(r.team) : null),
            });
            leagueCounts[league] = (leagueCounts[league] ?? 0) + 1;
          }
        } catch (err) {
          console.log(`${league}/${category}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // xG boards carry the shot-quality numbers the scoring boards lack.
      try {
        const b = await bbs(`/leagues/${league}/xg-leaders?season=${season}&limit=100`, apiKey);
        const leaders = ((b?.data as Record<string, unknown>)?.leaders ?? []) as Record<string, unknown>[];
        for (const r of leaders) {
          const name = String(r.player_name ?? "").trim();
          if (!name) continue;
          const key = normalize(name);
          const prev = byName.get(key);
          byName.set(key, {
            goals: Math.max(prev?.goals ?? 0, Math.round(num(r.goals))),
            assists: Math.max(prev?.assists ?? 0, Math.round(num(r.assists))),
            minutes: Math.max(prev?.minutes ?? 0, Math.round(num(r.minutes))),
            appearances: Math.max(prev?.appearances ?? 0, Math.round(num(r.matches))),
            xg: r.xg != null ? num(r.xg) : prev?.xg ?? null,
            xa: r.xa != null ? num(r.xa) : prev?.xa ?? null,
            team: prev?.team ?? (r.team ? String(r.team) : null),
          });
        }
      } catch (err) {
        console.log(`${league}/xg: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const applied: Record<string, number> = {};
    for (const competition of competitions) {
      let n = 0;
      for (const [key, row] of byName) {
        const { data: hit } = await supabase.rpc("match_ucl_player", {
          q: key,
          lim: 1,
          p_competition: competition,
        });
        const m = Array.isArray(hit) ? hit[0] : null;
        if (!m?.id) continue;

        // Form is points per appearance on a fantasy-like scale: goals and
        // assists are what the boards actually measure, so it is derived from
        // those rather than pretending to be a real fantasy points total.
        const apps = Math.max(1, row.appearances);
        const form = Number((((row.goals * 4 + row.assists * 3) / apps) + 1).toFixed(2));

        const { error } = await supabase
          .from("ucl_players")
          .update({
            goals: row.goals,
            assists: row.assists,
            minutes: row.minutes,
            appearances: row.appearances,
            xg: row.xg,
            xa: row.xa,
            form,
            stats_source: "leaderboards",
            stats_updated_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", m.id);
        if (!error) n += 1;
      }
      applied[competition] = n;
    }

    return json({
      season,
      leaderboard_players: byName.size,
      league_rows: leagueCounts,
      players_updated: applied,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("fantasy-player-stats failed:", message);
    return json({ error: message }, 500);
  }
});
