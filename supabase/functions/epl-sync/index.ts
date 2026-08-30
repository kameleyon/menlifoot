// Premier League data sync.
//
// Shares the schema and the scoring machinery with the Champions League - the
// tables carry a `competition` column - but the sources differ. EPL is one of
// the five domestic leagues the provider actually ingests, so unlike UCL it has
// the full 380-match calendar, live scorelines and an injury list.
//
// Modes:
//   teams     - the 20 clubs, their Elo, crests and attack/defence profile
//   squads    - real rosters, one call per club
//   fixtures  - the whole season from the archive, grouped into gameweeks
//   injuries  - the league injury list, matched onto the pool by name
//   stats     - per-player goals/assists/minutes/xG from the league leaderboards
//
// Free plan is 100 requests/minute and 1,000/day, so every sweep is pooled and
// every call goes through a backoff that honours Retry-After.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
};

const BBS = "https://api.bigballsdata.com/v1";
const COMPETITION = "EPL";
const SEASON_START = "2026-07-01";
// EPL gameweeks run Fri-Mon, so a gap this size means a new round.
const GAMEWEEK_GAP_DAYS = 4;
const POOL_SIZE = 6;

const BBS_POSITION: Record<string, string> = {
  goalkeeper: "GK", gk: "GK", keeper: "GK",
  defender: "DEF", def: "DEF", defence: "DEF",
  midfielder: "MID", mid: "MID", midfield: "MID",
  attacker: "FWD", forward: "FWD", fwd: "FWD", striker: "FWD",
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * GET with the retry policy the provider documents: honour Retry-After on 429,
 * exponential backoff with jitter on 5xx, never retry other 4xx.
 */
async function bbs(path: string, apiKey: string, attempt = 0): Promise<Record<string, unknown>> {
  const res = await fetch(BBS + path, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (res.ok) return await res.json();

  if (res.status === 429 && attempt < 5) {
    const wait = Math.max(1, num(res.headers.get("Retry-After"), 2)) * 1000;
    await sleep(wait);
    return bbs(path, apiKey, attempt + 1);
  }
  if (res.status >= 500 && attempt < 5) {
    const backoff = Math.min(60000, 1000 * 2 ** attempt) * (0.5 + Math.random() / 2);
    await sleep(backoff);
    return bbs(path, apiKey, attempt + 1);
  }
  throw new Error(`bbs ${res.status} ${path}: ${(await res.text()).slice(0, 120)}`);
}

async function runPool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  }
  return out;
}

/** Every stored EPL fixture for the current season. */
async function fetchFixtures(apiKey: string) {
  const rows: Record<string, unknown>[] = [];
  for (let offset = 0; offset < 1600; offset += 200) {
    const b = await bbs(
      `/stored/matches?sport=football&league=${encodeURIComponent("EPL")}&limit=200&offset=${offset}`,
      apiKey,
    );
    const page = (Array.isArray(b?.data) ? b.data : []) as Record<string, unknown>[];
    rows.push(...page);
    const total = Number((b?.pagination as Record<string, unknown>)?.total ?? 0);
    if (page.length === 0 || rows.length >= total) break;
  }
  const sumHalves = (xs?: number[]) =>
    Array.isArray(xs) && xs.length ? xs.reduce((a, c) => a + c, 0) : null;

  return rows
    .filter((r) => String(r.kickoff_utc ?? "") >= SEASON_START)
    .map((r) => {
      const home = r.home as Record<string, unknown> | undefined;
      const away = r.away as Record<string, unknown> | undefined;
      const ls = r.linescore as { home?: number[]; away?: number[] } | undefined;
      return {
        id: String(r.id ?? ""),
        kickoff: String(r.kickoff_utc ?? ""),
        home: String(home?.name ?? ""),
        away: String(away?.name ?? ""),
        homeLogo: home?.logo_url ? String(home.logo_url) : null,
        awayLogo: away?.logo_url ? String(away.logo_url) : null,
        hs: sumHalves(ls?.home),
        as: sumHalves(ls?.away),
        status: String(r.status ?? "scheduled"),
      };
    })
    .filter((f) => f.home && f.away && f.kickoff)
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
}

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
    const mode: string = body?.mode ?? "all";
    const run = (m: string) => mode === "all" || mode === m;
    const result: Record<string, unknown> = { competition: COMPETITION, mode };

    // Clubs are discovered from the fixture list rather than hardcoded, so
    // promotion and relegation need no code change.
    const fixtures = await fetchFixtures(apiKey);
    const clubs = [...new Set(fixtures.flatMap((f) => [f.home, f.away]))].sort();
    result.clubs_found = clubs.length;

    // ------------------------------------------------------------- teams ---
    if (run("teams")) {
      const dir = new Map<string, { id: string; logo: string | null }>();
      for (let offset = 0; offset < 600; offset += 200) {
        const b = await bbs(`/teams?sport=football&limit=200&offset=${offset}`, apiKey);
        const page = (Array.isArray(b?.data) ? b.data : []) as Record<string, unknown>[];
        for (const t of page) {
          const n = String(t.name ?? "");
          if (n) dir.set(normalize(n), { id: String(t.id ?? ""), logo: t.logo_url ? String(t.logo_url) : null });
        }
        if (page.length === 0) break;
      }

      const enriched = await runPool(clubs, POOL_SIZE, async (club) => {
        const entry = dir.get(normalize(club));
        const row: Record<string, unknown> = {
          competition: COMPETITION,
          name: club,
          logo_url: entry?.logo ?? null,
          strength: 3,
          updated_at: new Date().toISOString(),
        };
        if (!entry?.id) return row;
        try {
          const [eloRes, statsRes] = await Promise.all([
            bbs(`/teams/${entry.id}/elo?sport=football`, apiKey).catch(() => ({} as Record<string, unknown>)),
            bbs(`/teams/${entry.id}/stats?sport=football`, apiKey).catch(() => ({} as Record<string, unknown>)),
          ]);
          const elo = Number((eloRes?.data as Record<string, unknown>)?.elo_rating);
          if (Number.isFinite(elo)) row.elo_rating = elo;
          const st = (statsRes?.data ?? {}) as Record<string, unknown>;
          const played = num(st.matches_played);
          const cs = num(st.clean_sheets);
          if (st.avg_goals_scored != null) row.avg_goals_scored = num(st.avg_goals_scored);
          if (st.avg_goals_conceded != null) row.avg_goals_conceded = num(st.avg_goals_conceded);
          if (played > 0) row.clean_sheet_rate = Number((cs / played).toFixed(3));
          if (typeof st.form_string === "string") row.form_string = st.form_string;
          if (played > 0) row.matches_played = played;
        } catch { /* club keeps its defaults */ }
        return row;
      });

      // Strength from Elo, bucketed into fifths so the 1-5 scale always spreads.
      const withElo = enriched
        .filter((r) => Number.isFinite(Number(r.elo_rating)))
        .sort((a, b) => Number(b.elo_rating) - Number(a.elo_rating));
      withElo.forEach((r, i) => {
        r.strength = Math.max(1, 5 - Math.floor((i * 5) / (withElo.length || 1)));
      });

      const { error } = await supabase
        .from("ucl_teams")
        .upsert(enriched, { onConflict: "competition,name" });
      if (error) throw new Error(`teams upsert: ${error.message}`);
      result.teams = enriched.length;
      result.with_elo = withElo.length;
    }

    // ------------------------------------------------------------ squads ---
    if (run("squads")) {
      const perClub = await runPool(clubs, POOL_SIZE, async (club) => {
        try {
          const b = await bbs(
            `/players?sport=football&team=${encodeURIComponent(club)}&limit=200`,
            apiKey,
          );
          const rows = (Array.isArray(b?.data) ? b.data : []) as Record<string, unknown>[];
          return rows
            .map((r) => {
              const name = String(r.name ?? "").trim();
              const position = BBS_POSITION[String(r.position ?? "").trim().toLowerCase()];
              if (!name || !position) return null;
              return {
                competition: COMPETITION,
                name,
                normalized_name: normalize(name),
                display_name: name,
                team: club,
                position,
                jersey_number: Number.isFinite(Number(r.jersey_number)) ? Number(r.jersey_number) : null,
                photo_url: r.headshot_url ? String(r.headshot_url) : null,
                availability: "available",
                source: "bigballs",
                updated_at: new Date().toISOString(),
              };
            })
            .filter(Boolean) as Record<string, unknown>[];
        } catch {
          return [];
        }
      });

      const seen = new Map<string, Record<string, unknown>>();
      for (const p of perClub.flat()) seen.set(`${p.normalized_name}|${p.team}`, p);
      const players = [...seen.values()];
      if (players.length) {
        const { error } = await supabase
          .from("ucl_players")
          .upsert(players, { onConflict: "competition,normalized_name,team" });
        if (error) throw new Error(`squads upsert: ${error.message}`);
      }
      result.players = players.length;
    }

    // ---------------------------------------------------------- fixtures ---
    if (run("fixtures")) {
      // Cluster kick-offs into gameweeks; the archive carries no round number.
      let gw = 1;
      let anchor: number | null = null;
      const payload = fixtures.map((f) => {
        const t = Date.parse(f.kickoff);
        if (anchor !== null && (t - anchor) / 86400000 > GAMEWEEK_GAP_DAYS) gw += 1;
        anchor = t;
        const played = f.status === "finished" && f.hs !== null && f.as !== null;
        return {
          competition: COMPETITION,
          matchday: Math.min(gw, 38),
          kickoff: f.kickoff,
          home_team: f.home,
          away_team: f.away,
          home_score: played ? f.hs : null,
          away_score: played ? f.as : null,
          status: f.status === "finished" ? "finished" : f.status === "live" ? "live" : "scheduled",
          external_id: f.id,
          updated_at: new Date().toISOString(),
        };
      });

      const seen = new Map<string, Record<string, unknown>>();
      for (const f of payload) seen.set(`${f.matchday}|${f.home_team}|${f.away_team}`, f);
      const deduped = [...seen.values()];

      const { error } = await supabase
        .from("ucl_fixtures")
        .upsert(deduped, { onConflict: "competition,matchday,home_team,away_team" });
      if (error) throw new Error(`fixtures upsert: ${error.message}`);

      const days = [...new Set(deduped.map((f) => f.matchday))].map((md) => {
        const inRound = deduped
          .filter((f) => f.matchday === md)
          .map((f) => String(f.kickoff))
          .sort();
        return {
          competition: COMPETITION,
          matchday: md,
          starts_on: inRound[0]?.slice(0, 10) ?? null,
          ends_on: inRound[inRound.length - 1]?.slice(0, 10) ?? null,
          updated_at: new Date().toISOString(),
        };
      });
      await supabase.from("ucl_matchdays").upsert(days, { onConflict: "competition,matchday" });

      const { data: touched } = await supabase.rpc("refresh_player_fixtures", {
        p_competition: COMPETITION,
      });
      result.fixtures = deduped.length;
      result.gameweeks = days.length;
      result.players_touched = touched ?? 0;
    }

    // ---------------------------------------------------------- injuries ---
    if (run("injuries")) {
      const b = await bbs(`/injuries?sport=football&league=epl&limit=200`, apiKey);
      const d = (b?.data as Record<string, unknown>)?.injuries;
      const list = (Array.isArray(d) ? d : (d as Record<string, unknown>)?.value) as
        | Record<string, unknown>[]
        | undefined;
      const names = (list ?? [])
        .map((r) => String(r.full_name ?? r.display_name ?? "").trim())
        .filter(Boolean);

      // Everyone starts available, then the list re-flags: a player who has
      // recovered must not stay marked out forever.
      await supabase
        .from("ucl_players")
        .update({ availability: "available", availability_note: null })
        .eq("competition", COMPETITION)
        .neq("availability", "available");

      let flagged = 0;
      for (const n of names) {
        const { data: hit } = await supabase.rpc("match_ucl_player", {
          q: normalize(n),
          lim: 1,
          p_competition: COMPETITION,
        });
        const m = Array.isArray(hit) ? hit[0] : null;
        if (!m?.id) continue;
        const { error } = await supabase
          .from("ucl_players")
          .update({
            availability: "injured",
            // The list carries names only - no type, severity or return date.
            availability_note: "Reported in the league injury list",
            updated_at: new Date().toISOString(),
          })
          .eq("id", m.id);
        if (!error) flagged += 1;
      }
      result.injuries_reported = names.length;
      result.injuries_matched = flagged;
    }

    return json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("epl-sync failed:", message);
    return json({ error: message }, 500);
  }
});
