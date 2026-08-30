// Fantasy Premier League official game data.
//
// bootstrap-static is the FPL game's own public feed and it carries everything
// the analysis needs and nothing else could supply: real prices, real fantasy
// points, official form, ownership, injury status with news text, expected
// points, and the gameweek deadlines.
//
// This is the authoritative source for the EPL product. Unlike UEFA's feed it
// is not bot-blocked, and unlike a general sports API it holds the fantasy
// parameters - price and points - that only the game itself defines.
//
// Squad rosters and fixtures still come from the provider sync; this fills in
// the fantasy layer on top and takes over availability, which it reports far
// better (a reason, and a chance-of-playing percentage).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
};

const FPL = "https://fantasy.premierleague.com/api/bootstrap-static/";
const COMPETITION = "EPL";

// The game publishes an official headshot keyed on its own player code.
const photoUrl = (code: unknown): string | null =>
  code ? `https://resources.premierleague.com/premierleague/photos/players/250x250/p${code}.png` : null;

// element_type in the feed.
const POSITION: Record<number, string> = { 1: "GK", 2: "DEF", 3: "MID", 4: "FWD" };

// FPL status codes. `n` means not in the squad at all, which for our purposes
// is the same as unavailable.
const AVAILABILITY: Record<string, string> = {
  a: "available",
  d: "doubtful",
  i: "injured",
  s: "suspended",
  u: "unavailable",
  n: "unavailable",
};

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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const res = await fetch(FPL, {
      headers: {
        // The endpoint is public but rejects a bare fetch with no user agent.
        "User-Agent": "Mozilla/5.0 (compatible; Menlifoot/1.0)",
        Accept: "application/json",
      },
    });
    if (!res.ok) throw new Error(`fpl ${res.status}`);
    const data = await res.json();

    const teams = new Map<number, string>(
      ((data.teams ?? []) as Record<string, unknown>[]).map((t) => [
        Number(t.id),
        String(t.name ?? ""),
      ]),
    );
    const elements = (data.elements ?? []) as Record<string, unknown>[];
    const events = (data.events ?? []) as Record<string, unknown>[];

    // ------------------------------------------------------------ players ---
    // Full names are matched against the pool; the fallback to web_name catches
    // players the roster stores by their short name.
    let updated = 0;
    let inserted = 0;
    const unmatched: string[] = [];

    for (const e of elements) {
      const position = POSITION[Number(e.element_type)];
      if (!position) continue;

      const first = String(e.first_name ?? "").trim();
      const second = String(e.second_name ?? "").trim();
      const web = String(e.web_name ?? "").trim();
      const full = [first, second].filter(Boolean).join(" ") || web;
      const team = teams.get(Number(e.team)) ?? "";
      if (!full || !team) continue;

      const status = String(e.status ?? "a");
      const chance = e.chance_of_playing_next_round;
      const news = String(e.news ?? "").trim();

      const patch: Record<string, unknown> = {
        // web_name is the name the game itself shows and the name fans use -
        // "Haaland", not "Erling Braut Haaland".
        display_name: web || full,
        photo_url: photoUrl(e.code),
        price: num(e.now_cost) / 10,
        total_points: Math.round(num(e.total_points)),
        form: num(e.form),
        minutes: Math.round(num(e.minutes)),
        goals: Math.round(num(e.goals_scored)),
        assists: Math.round(num(e.assists)),
        clean_sheets: Math.round(num(e.clean_sheets)),
        saves: Math.round(num(e.saves)),
        yellow_cards: Math.round(num(e.yellow_cards)),
        red_cards: Math.round(num(e.red_cards)),
        selected_by_pct: num(e.selected_by_percent),
        xg: e.expected_goals != null ? num(e.expected_goals) : null,
        xa: e.expected_assists != null ? num(e.expected_assists) : null,
        availability: AVAILABILITY[status] ?? "available",
        // The game gives a reason and a percentage; keep both, they are the
        // difference between "out" and "50/50, late fitness test".
        availability_note: news || (chance != null && Number(chance) < 100
          ? `${chance}% chance of playing`
          : null),
        stats_source: "fpl",
        stats_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Match on the full name first, then the short name the game displays.
      let matched: { id: string } | null = null;
      for (const candidate of [full, web]) {
        const { data: hit } = await supabase.rpc("match_ucl_player", {
          q: normalize(candidate),
          lim: 1,
          p_competition: COMPETITION,
        });
        const m = Array.isArray(hit) ? hit[0] : null;
        if (m?.id) {
          matched = m;
          break;
        }
      }

      if (matched) {
        const { error } = await supabase.from("ucl_players").update(patch).eq("id", matched.id);
        if (!error) updated += 1;
        continue;
      }

      // A player the roster sync missed still belongs in the pool: the game's
      // own list is definitive for who is ownable.
      const { error } = await supabase.from("ucl_players").upsert(
        {
          competition: COMPETITION,
          name: full,
          normalized_name: normalize(full),
          display_name: web || full,
          team,
          position,
          source: "fpl",
          ...patch,
        },
        { onConflict: "competition,normalized_name,team" },
      );
      if (!error) inserted += 1;
      else unmatched.push(full);
    }

    // --------------------------------------------------------- gameweeks ---
    // Deadlines are the thing a manager actually plans around.
    const days = events
      .filter((ev) => Number(ev.id) >= 1 && Number(ev.id) <= 38)
      .map((ev) => ({
        competition: COMPETITION,
        matchday: Number(ev.id),
        deadline: ev.deadline_time ? String(ev.deadline_time) : null,
        updated_at: new Date().toISOString(),
      }));
    if (days.length) {
      await supabase.from("ucl_matchdays").upsert(days, { onConflict: "competition,matchday" });
    }

    const current = events.find((ev) => ev.is_current);
    const next = events.find((ev) => ev.is_next);

    return json({
      competition: COMPETITION,
      players_in_feed: elements.length,
      players_updated: updated,
      players_inserted: inserted,
      failed: unmatched.length,
      gameweeks: days.length,
      current_gameweek: current ? Number(current.id) : null,
      next_gameweek: next ? Number(next.id) : null,
      next_deadline: next?.deadline_time ?? null,
      chips: ((data.chips ?? []) as Record<string, unknown>[]).map((c) => String(c.name)),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("fpl-sync failed:", message);
    return json({ error: message }, 500);
  }
});
