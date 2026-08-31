// Fixtures, club strength and post-matchday player stats.
//
// Three modes, each on its own schedule because they change at different rates:
//   fixtures  — the league-phase schedule. Set at the draw, rarely changes.
//   teams     — club strength tiers. Refresh occasionally.
//   stats     — player points/form. Only moves after a matchday is played, so
//               this runs weekly rather than nightly.
//
// After fixtures or teams change, refresh_player_fixtures() recomputes every
// player's next opponent and difficulty in SQL.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
};

const POOL_SIZE = 6;

async function runPool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  }
  return out;
}

async function askPerplexity(prompt: string, apiKey: string): Promise<unknown> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "perplexity/sonar",
      messages: [
        {
          role: "system",
          content:
            "You return ONLY raw JSON matching the requested shape. No prose, no markdown fences. " +
            "Use null for anything you cannot confirm rather than guessing.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.1,
    }),
  });
  if (!res.ok) throw new Error(`openrouter ${res.status}: ${await res.text()}`);
  const body = await res.json();
  const text = String(body?.choices?.[0]?.message?.content ?? "");
  const match = text.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
  if (!match) throw new Error(`no JSON in response: ${text.slice(0, 200)}`);
  return JSON.parse(match[0]);
}

// UCL Fantasy prices run roughly EUR 4.0m to 12.0m. Anything outside this band
// is a recalled or invented figure, not a real price, so it is dropped rather
// than stored — a wrong price is worse than no price, because it makes the
// value sub-score look applicable when it is not.
const PRICE_MIN = 3.5;
const PRICE_MAX = 13.0;
const sanePrice = (v: unknown): number | null => {
  if (v == null) return null;
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) && n >= PRICE_MIN && n <= PRICE_MAX ? n : null;
};

// --------------------------------------------------------- Big Ball Sports ---
const BBS_BASE = "https://api.bigballsdata.com/v1";
// The league phase opens in September; anything earlier belongs to last season.
const SEASON_START = "2026-08-01";
// The league phase: 36 clubs, 8 rounds, each club once per round.
const LEAGUE_PHASE_MATCHDAYS = 8;
const FIXTURES_PER_MATCHDAY = 18;
// A league-phase day carries six matches. A qualifying leg sits alone on its
// own date, which is what separates the two without needing a hardcoded date.
const MIN_FIXTURES_PER_LEAGUE_DAY = 3;

type RawFixture = {
  id: string;
  kickoff: string;
  home: string;
  away: string;
  hs: number | null;
  as: number | null;
  status: string;
};

/**
 * Real fixtures from the archive. Returns null when the archive holds nothing
 * for this season yet, so the caller falls back instead of wiping good data.
 */
async function fetchFixturesFromBigBalls(apiKey: string): Promise<RawFixture[] | null> {
  const rows: Record<string, unknown>[] = [];
  for (let offset = 0; offset < 1200; offset += 200) {
    const url =
      `${BBS_BASE}/stored/matches?sport=football&league=${encodeURIComponent("UEFA Champions League")}` +
      `&limit=200&offset=${offset}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
    if (!res.ok) throw new Error(`bigballs fixtures ${res.status}`);
    const body = await res.json();
    const page: Record<string, unknown>[] = Array.isArray(body?.data) ? body.data : [];
    rows.push(...page);
    const total = Number((body?.pagination as Record<string, unknown>)?.total ?? 0);
    if (page.length === 0 || rows.length >= total) break;
  }

  const sumHalves = (xs?: number[]) =>
    Array.isArray(xs) && xs.length ? xs.reduce((a, c) => a + c, 0) : null;

  const current = rows
    .filter((r) => String(r.kickoff_utc ?? "") >= SEASON_START)
    .map((r): RawFixture => {
      const home = r.home as Record<string, unknown> | undefined;
      const away = r.away as Record<string, unknown> | undefined;
      const ls = r.linescore as { home?: number[]; away?: number[] } | undefined;
      return {
        id: String(r.id ?? ""),
        kickoff: String(r.kickoff_utc ?? ""),
        home: String(home?.name ?? ""),
        away: String(away?.name ?? ""),
        hs: sumHalves(ls?.home),
        as: sumHalves(ls?.away),
        status: String(r.status ?? "scheduled"),
      };
    })
    .filter((f) => f.home && f.away && f.kickoff);

  return current.length > 0 ? current : null;
}

/**
 * Number the league-phase rounds.
 *
 * The archive carries a `round` field but leaves it null for every Champions
 * League fixture, so the number has to be derived. It is derived from the
 * format rather than from the calendar, because the calendar lies twice:
 *
 *   - A two-legged qualifier in August took rounds 1 and 2 and pushed every
 *     real matchday up by two, so the opening round showed as Matchday 3.
 *   - October's two rounds chained into one, because no single gap inside
 *     13-21 October exceeded the old six-day threshold. The overflow then hit
 *     a clamp that dumped every later round into Matchday 8.
 *
 * Two facts about the league phase replace the guesswork. A round is eighteen
 * fixtures with each of the thirty-six clubs appearing exactly once, so a club
 * appearing twice or an eighteenth fixture ends the round. And a league-phase
 * day carries six matches, where a qualifying leg is alone on its date.
 */
function assignMatchdays(fixtures: RawFixture[]): (RawFixture & { matchday: number })[] {
  const sorted = [...fixtures].sort((a, b) => a.kickoff.localeCompare(b.kickoff));

  const perDay = new Map<string, number>();
  for (const f of sorted) {
    const day = f.kickoff.slice(0, 10);
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }
  const leaguePhase = sorted.filter(
    (f) => (perDay.get(f.kickoff.slice(0, 10)) ?? 0) >= MIN_FIXTURES_PER_LEAGUE_DAY,
  );

  const out: (RawFixture & { matchday: number })[] = [];
  let matchday = 1;
  let clubs = new Set<string>();
  let count = 0;

  for (const f of leaguePhase) {
    if (count === FIXTURES_PER_MATCHDAY || clubs.has(f.home) || clubs.has(f.away)) {
      matchday += 1;
      clubs = new Set();
      count = 0;
    }
    // Past the eighth round the competition is knockout, which has no matchday
    // number and must not be folded into one.
    if (matchday > LEAGUE_PHASE_MATCHDAYS) break;
    clubs.add(f.home);
    clubs.add(f.away);
    count += 1;
    out.push({ ...f, matchday });
  }

  return out;
}

// Club-name variants used for BOTH crest and Elo lookups. Every entry is
// hand-verified: token-overlap matching mapped Inter Milan to AC Milan,
// Atletico to Real Madrid and Manchester United to Leeds, because rival clubs
// share the distinctive words in their names.
const CLUB_ALIASES: Record<string, string> = {
  "Sporting CP": "Sporting Clube de Portugal",
  "Club Brugge": "Club Brugge KV",
  "PSV Eindhoven": "PSV",
  "Bodo/Glimt": "FK Bod\u00f8/Glimt",
  Galatasaray: "Galatasaray SK",
  "Slavia Prague": "SK Slavia Praha",
  Como: "Como 1907",
  Roma: "AS Roma",
};

/** Upstream team directory keyed by normalised name -> {id, logo}. */
async function fetchTeamDirectory(apiKey: string): Promise<Map<string, { id: string; logo: string | null }>> {
  const dir = new Map<string, { id: string; logo: string | null }>();
  for (let offset = 0; offset < 600; offset += 200) {
    const res = await fetch(`${BBS_BASE}/teams?sport=football&limit=200&offset=${offset}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) break;
    const body = await res.json();
    const page: Record<string, unknown>[] = Array.isArray(body?.data) ? body.data : [];
    for (const t of page) {
      const name = String(t.name ?? "");
      if (name) dir.set(normalize(name), { id: String(t.id ?? ""), logo: t.logo_url ? String(t.logo_url) : null });
    }
    if (page.length === 0) break;
  }
  return dir;
}

/**
 * Attacking / defensive profile per club. Free, and more useful than Elo alone:
 * a hard fixture means something different to a striker than to a keeper.
 */
async function fetchTeamStats(
  apiKey: string,
  teams: string[],
  dir: Map<string, { id: string; logo: string | null }>,
): Promise<Record<string, Record<string, number | string | null>>> {
  const out: Record<string, Record<string, number | string | null>> = {};
  await runPool(teams, POOL_SIZE, async (team: string) => {
    const entry = dir.get(normalize(CLUB_ALIASES[team] ?? team));
    if (!entry?.id) return;
    try {
      const res = await fetch(`${BBS_BASE}/teams/${entry.id}/stats?sport=football`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) return;
      const d = (await res.json())?.data as Record<string, unknown> | undefined;
      if (!d) return;
      const played = Number(d.matches_played);
      const cs = Number(d.clean_sheets);
      out[team] = {
        avg_goals_scored: Number.isFinite(Number(d.avg_goals_scored)) ? Number(d.avg_goals_scored) : null,
        avg_goals_conceded: Number.isFinite(Number(d.avg_goals_conceded)) ? Number(d.avg_goals_conceded) : null,
        clean_sheet_rate: Number.isFinite(cs) && played > 0 ? Number((cs / played).toFixed(3)) : null,
        form_string: typeof d.form_string === "string" ? d.form_string : null,
        matches_played: Number.isFinite(played) ? played : null,
      };
    } catch {
      // No stats for this club; it keeps its strength-based difficulty.
    }
  });
  return out;
}

/** Current Elo per club, where the provider has one. */
async function fetchElo(
  apiKey: string,
  teams: string[],
  dir: Map<string, { id: string; logo: string | null }>,
): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  await runPool(teams, POOL_SIZE, async (team: string) => {
    const entry = dir.get(normalize(CLUB_ALIASES[team] ?? team));
    if (!entry?.id) return;
    try {
      const res = await fetch(`${BBS_BASE}/teams/${entry.id}/elo?sport=football`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) return;
      const body = await res.json();
      const rating = Number((body?.data as Record<string, unknown>)?.elo_rating);
      if (Number.isFinite(rating)) out[team] = rating;
    } catch {
      // A club without Elo keeps its fallback strength; nothing to do here.
    }
  });
  return out;
}

const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : fallback;
};

const normalize = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Captured before anything is written, so rows this run rewrote are strictly
  // newer than it and everything older is provably stale.
  const runStartedAt = new Date().toISOString();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
  const apiKey = Deno.env.get("OPENROUTER_API_KEY");

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    if (!apiKey) return json({ error: "OPENROUTER_API_KEY is not configured" }, 500);
    const body = await req.json().catch(() => ({}));
    const mode: string = body?.mode ?? "fixtures";

    // Club names already in the pool are the canonical spellings; everything
    // written here must match them or the joins silently produce nothing.
    const { data: teamRows } = await supabase
      .from("ucl_players").select("team").eq("competition", "UCL");
    const teams: string[] = [...new Set(((teamRows ?? []) as { team: string }[]).map((r) => r.team))];

    // ------------------------------------------------------------- teams ---
    if (mode === "teams") {
      // Ask for a RANKING, not absolute tiers. Asked for 1-5 directly the model
      // rated 22 of 36 clubs a 4 or 5, which compressed every fixture toward
      // "hard" and made the sub-score useless. An ordinal list bucketed into
      // fifths here guarantees a real spread whatever the model thinks.
      const rows = (await askPerplexity(
        `Rank these ${teams.length} football clubs from strongest to weakest for the 2026/27 ` +
          `UEFA Champions League, considering squad quality, recent European form and UEFA ` +
          `coefficient. Clubs: ${teams.join(", ")}. ` +
          `Return a JSON array ordered strongest first, one object per club with keys: ` +
          `team (exactly as given), code (3-letter uppercase abbreviation). ` +
          `Include every club exactly once.`,
        apiKey,
      )) as Record<string, unknown>[];
      if (!Array.isArray(rows)) return json({ error: "teams: not an array" }, 502);

      const known = new Map(teams.map((t) => [normalize(t), t]));
      const ranked: { name: string; code: string | null }[] = [];
      const seenTeams = new Set<string>();
      for (const r of rows) {
        const canonical = known.get(normalize(String(r.team ?? "")));
        if (!canonical || seenTeams.has(canonical)) continue;
        seenTeams.add(canonical);
        ranked.push({ name: canonical, code: r.code ? String(r.code).toUpperCase().slice(0, 4) : null });
      }
      // Anything the model dropped lands in the middle rather than vanishing.
      for (const t of teams) {
        if (!seenTeams.has(t)) ranked.splice(Math.floor(ranked.length / 2), 0, { name: t, code: null });
      }

      const total = ranked.length || 1;
      const payload = ranked.map((r, i) => ({
        name: r.name,
        code: r.code,
        // Fifths: top 20% -> 5, bottom 20% -> 1.
        strength: Math.max(1, 5 - Math.floor((i * 5) / total)),
        updated_at: new Date().toISOString(),
      }));

      // Attach crests where we have a verified match; null elsewhere so the UI
      // shows an initials chip instead of a broken image.
      // Real Elo beats a model's opinion of who is strong. Clubs the provider
      // has no Elo for keep the ranked fallback above, so each club uses the
      // best signal available rather than the whole field dropping to one.
      const bbsKey = Deno.env.get("BIGBALLS_API_KEY");
      let elo: Record<string, number> = {};
      let stats: Record<string, Record<string, number | string | null>> = {};
      let dir = new Map<string, { id: string; logo: string | null }>();
      if (bbsKey) {
        try {
          dir = await fetchTeamDirectory(bbsKey);
          elo = await fetchElo(bbsKey, teams, dir);
          stats = await fetchTeamStats(bbsKey, teams, dir);
        } catch (err) {
          console.log(`elo failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      // Rank the Elo-covered clubs among themselves and bucket into fifths, so
      // the 1-5 scale keeps a real spread instead of clustering on raw ratings.
      const eloRanked = Object.entries(elo).sort((a, b) => b[1] - a[1]);
      const eloStrength = new Map<string, number>();
      eloRanked.forEach(([club], i) => {
        eloStrength.set(club, Math.max(1, 5 - Math.floor((i * 5) / (eloRanked.length || 1))));
      });

      for (const row of payload) {
        const r = row as Record<string, unknown>;
        const club = String(r.name);
        if (eloStrength.has(club)) r.strength = eloStrength.get(club);
        r.elo_rating = elo[club] ?? null;
        Object.assign(r, stats[club] ?? {});
        r.logo_url = dir.get(normalize(CLUB_ALIASES[club] ?? club))?.logo ?? null;
      }

      const { error } = await supabase.from("ucl_teams").upsert(payload, { onConflict: "competition,name" });
      if (error) throw new Error(`teams upsert: ${error.message}`);

      const { data: touched } = await supabase.rpc("refresh_player_fixtures", {
        p_competition: "UCL",
      });
      return json({
        mode,
        teams: payload.length,
        with_elo: Object.keys(elo).length,
        with_crest: payload.filter((p) => (p as Record<string, unknown>).logo_url).length,
        with_stats: Object.keys(stats).length,
        players_touched: touched ?? 0,
      });
    }

    // ---------------------------------------------------------- fixtures ---
    if (mode === "fixtures") {
      // Real fixtures beat model-recalled ones outright. The archive refreshes
      // daily, so the genuine calendar lands here on its own once UEFA
      // publishes it after the draw.
      const bbsKey = Deno.env.get("BIGBALLS_API_KEY");
      // Declared out here because the response that reports it is outside the
      // key check.
      let bigballsReason: string | null = null;
      if (bbsKey) {
        // Why the archive was not used, so a failure cannot be reported as
        // "nothing published yet" - which sent me chasing a publishing delay
        // that was really a code path throwing.
        let real: RawFixture[] | null = null;
        try {
          real = await fetchFixturesFromBigBalls(bbsKey);
          if (real) {
            const known = new Map(teams.map((t) => [normalize(t), t]));
            const payload = assignMatchdays(real)
              .map((f) => {
                const home = known.get(normalize(f.home)) ?? f.home;
                const away = known.get(normalize(f.away)) ?? f.away;
                if (home === away) return null;
                const played = f.status === "finished" && f.hs !== null && f.as !== null;
                return {
                  competition: "UCL",
                  matchday: f.matchday,
                  kickoff: f.kickoff,
                  home_team: home,
                  away_team: away,
                  home_score: played ? f.hs : null,
                  away_score: played ? f.as : null,
                  status: f.status === "finished" ? "finished" : f.status === "live" ? "live" : "scheduled",
                  external_id: f.id,
                  updated_at: new Date().toISOString(),
                };
              })
              .filter(Boolean) as Record<string, unknown>[];

            const seen = new Map<string, Record<string, unknown>>();
            for (const f of payload) seen.set(String(f.external_id), f);
            const deduped = [...seen.values()];

            if (deduped.length > 0) {
              // Clear each fixture's previous row before writing it back.
              //
              // The upsert conflicts on (competition, matchday, home, away),
              // which changes when a round is renumbered - so a corrected
              // fixture reads as brand new and collides with the unique index
              // on external_id. That index is partial, so it cannot be the
              // conflict target either. Deleting by the archive's own id first
              // sidesteps both: identity is what does not change here.
              const ids = deduped.map((f) => String(f.external_id)).filter(Boolean);
              if (ids.length > 0) {
                await supabase.from("ucl_fixtures").delete().eq("competition", "UCL").in("external_id", ids);
              }
              const { error } = await supabase
                .from("ucl_fixtures")
                .upsert(deduped, { onConflict: "competition,matchday,home_team,away_team" });
              if (error) throw new Error(`fixtures upsert: ${error.message}`);
              // Renumbering a round leaves the old row behind under its old
              // number, so anything this run did not rewrite is stale and has
              // to go - otherwise a corrected calendar sits alongside the wrong
              // one it replaced.
              await supabase
                .from("ucl_fixtures")
                .delete()
                .eq("competition", "UCL")
                .lt("updated_at", runStartedAt);
              const { data: touched } = await supabase.rpc("refresh_player_fixtures", {
        p_competition: "UCL",
      });
              return json({ mode, source: "bigballs", fixtures: deduped.length, players_touched: touched ?? 0 });
            }
          }
          bigballsReason = real
            ? `archive returned ${real.length} fixtures but none survived matchday assignment`
            : "archive holds no fixtures dated after the season start";
          console.log(`bigballs archive unusable: ${bigballsReason}`);
        } catch (err) {
          bigballsReason = err instanceof Error ? err.message : String(err);
          console.log(`bigballs fixtures failed: ${bigballsReason}`);
        }
      }

      // Model-recalled fixtures are opt-in, never automatic. A guessed calendar
      // sets next_difficulty for hundreds of players and drives captain advice,
      // so it fails loud and specific rather than quietly wrong. The daily cron
      // simply waits until the real calendar is published.
      if (body?.allow_llm !== true) {
        return json({
          mode,
          source: "bigballs",
          fixtures: 0,
          reason: bigballsReason ?? "no BIGBALLS_API_KEY configured",
          note: "no real fixtures stored; pass {\"allow_llm\":true} to fall back to search-derived fixtures",
        });
      }

      const matchdays: number[] = Array.isArray(body?.matchdays) && body.matchdays.length
        ? body.matchdays.map((n: unknown) => num(n, 0)).filter((n: number) => n >= 1 && n <= 8)
        : [1, 2, 3, 4, 5, 6, 7, 8];

      // One matchday per call: 18 fixtures is a comfortable response, all eight
      // at once is not, and a truncated schedule is worse than a missing one.
      const perDay = await runPool(matchdays, POOL_SIZE, async (md: number) => {
        try {
          const res = (await askPerplexity(
            `Matchday ${md} of the league phase of the 2026/27 UEFA Champions League. ` +
              `Return a JSON object with keys: ` +
              `deadline (ISO 8601 datetime of the fantasy deadline, or null), ` +
              `fixtures (array of objects with home_team, away_team, ` +
              `kickoff (ISO 8601 datetime with timezone, or null), ` +
              `home_score (integer or null if not played), away_score (integer or null)). ` +
              `Use these exact club names where they appear: ${teams.join(", ")}.`,
            apiKey,
          )) as Record<string, unknown>;
          return { md, res };
        } catch (err) {
          console.log(`matchday ${md}: ${err instanceof Error ? err.message : String(err)}`);
          return { md, res: null };
        }
      });

      const known = new Map(teams.map((t) => [normalize(t), t]));
      const fixtures: Record<string, unknown>[] = [];
      const days: Record<string, unknown>[] = [];

      for (const { md, res } of perDay) {
        if (!res) continue;
        const list = Array.isArray(res.fixtures) ? (res.fixtures as Record<string, unknown>[]) : [];
        const kickoffs: string[] = [];
        for (const f of list) {
          const home = known.get(normalize(String(f.home_team ?? "")));
          const away = known.get(normalize(String(f.away_team ?? "")));
          if (!home || !away || home === away) continue;
          const kickoff = f.kickoff ? String(f.kickoff) : null;
          if (kickoff) kickoffs.push(kickoff);
          const played = f.home_score != null && f.away_score != null;
          fixtures.push({
            competition: "UCL",
            matchday: md,
            kickoff,
            home_team: home,
            away_team: away,
            home_score: played ? Math.round(num(f.home_score)) : null,
            away_score: played ? Math.round(num(f.away_score)) : null,
            status: played ? "finished" : "scheduled",
            updated_at: new Date().toISOString(),
          });
        }
        const sorted = kickoffs.sort();
        days.push({
          competition: "UCL",
          matchday: md,
          deadline: res.deadline ? String(res.deadline) : null,
          starts_on: sorted[0]?.slice(0, 10) ?? null,
          ends_on: sorted[sorted.length - 1]?.slice(0, 10) ?? null,
          updated_at: new Date().toISOString(),
        });
      }

      // Collapse duplicates before upserting — same reason as the player pool.
      const seen = new Map<string, Record<string, unknown>>();
      for (const f of fixtures) seen.set(`${f.matchday}|${f.home_team}|${f.away_team}`, f);
      const deduped = [...seen.values()];

      if (deduped.length) {
        const { error } = await supabase
          .from("ucl_fixtures")
          .upsert(deduped, { onConflict: "competition,matchday,home_team,away_team" });
        if (error) throw new Error(`fixtures upsert: ${error.message}`);
      }
      if (days.length) {
        await supabase.from("ucl_matchdays").upsert(days, { onConflict: "competition,matchday" });
      }

      const { data: touched } = await supabase.rpc("refresh_player_fixtures", {
        p_competition: "UCL",
      });
      return json({ mode, fixtures: deduped.length, matchdays: days.length, players_touched: touched ?? 0 });
    }

    // ------------------------------------------------------------- stats ---
    if (mode === "stats") {
      const { data: run } = await supabase
        .from("ucl_stats_runs")
        .insert({ status: "running", matchday: body?.matchday ?? null })
        .select("id")
        .single();
      const runId = run?.id as string | undefined;

      const perTeam = await runPool(teams, POOL_SIZE, async (team: string) => {
        try {
          const rows = (await askPerplexity(
            `UEFA Champions League Fantasy player statistics for ${team} in the 2026/27 season so far. ` +
              `Return a JSON array; one object per player with keys: ` +
              `name (full name), total_points (fantasy points this season, integer), ` +
              `form (average fantasy points per match so far, number or null), ` +
              `minutes (total minutes played, integer), goals (integer), assists (integer), ` +
              `clean_sheets (integer), price (current fantasy price in millions, number or null). ` +
              `Return [] if the competition has not started and no player has any points yet.`,
            apiKey,
          )) as Record<string, unknown>[];
          return Array.isArray(rows) ? rows.map((r) => ({ team, r })) : [];
        } catch (err) {
          console.log(`stats ${team}: ${err instanceof Error ? err.message : String(err)}`);
          return [];
        }
      });

      let updated = 0;
      for (const { team, r } of perTeam.flat()) {
        const name = String(r.name ?? "").trim();
        if (!name) continue;
        const { data: matches } = await supabase.rpc("match_ucl_player", {
          q: normalize(name),
          lim: 1,
        });
        const hit = Array.isArray(matches) ? matches[0] : null;
        if (!hit?.id) continue;

        // Only write fields the sweep actually returned. A null here means "not
        // reported", not "reset this player's season to zero".
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (r.total_points != null) patch.total_points = Math.round(num(r.total_points));
        if (r.form != null) patch.form = num(r.form);
        if (r.minutes != null) patch.minutes = Math.round(num(r.minutes));
        if (r.goals != null) patch.goals = Math.round(num(r.goals));
        if (r.assists != null) patch.assists = Math.round(num(r.assists));
        if (r.clean_sheets != null) patch.clean_sheets = Math.round(num(r.clean_sheets));
        const p = sanePrice(r.price);
        if (p != null) patch.price = p;
        if (Object.keys(patch).length === 1) continue;

        const { error } = await supabase.from("ucl_players").update(patch).eq("id", hit.id);
        if (!error) updated += 1;
        void team;
      }

      if (runId) {
        await supabase
          .from("ucl_stats_runs")
          .update({
            status: updated > 0 ? "success" : "partial",
            players_updated: updated,
            finished_at: new Date().toISOString(),
            error: updated > 0 ? null : "no player stats reported yet",
          })
          .eq("id", runId);
      }
      return json({ mode, players_updated: updated });
    }

    // ----------------------------------------------------------- lineups ---
    // The route is live but the upstream ingest has not shipped, so this
    // reports availability honestly rather than pretending. Written against the
    // documented shape so it returns real XIs the day the ingest switches on.
    if (mode === "lineups") {
      const bbsKey = Deno.env.get("BIGBALLS_API_KEY");
      if (!bbsKey) return json({ error: "BIGBALLS_API_KEY is not configured" }, 500);

      const { data: recent } = await supabase
        .from("ucl_fixtures")
        .select("id,home_team,away_team,external_id")
        .not("external_id", "is", null)
        .order("kickoff", { ascending: false })
        .limit(Number(body?.limit ?? 5));

      const fixtures = (recent ?? []) as Record<string, unknown>[];
      if (fixtures.length === 0) {
        return json({ mode, checked: [], any_available: false, note: "no fixtures with an upstream id yet" });
      }

      const checked = await runPool(fixtures, POOL_SIZE, async (f) => {
        const label = `${f.home_team} v ${f.away_team}`;
        try {
          const res = await fetch(`${BBS_BASE}/stored/matches/${String(f.external_id)}/lineups`, {
            headers: { Authorization: `Bearer ${bbsKey}` },
          });
          const bd = await res.json();
          const home = Array.isArray(bd?.data?.home) ? bd.data.home : [];
          const away = Array.isArray(bd?.data?.away) ? bd.data.away : [];
          return {
            fixture: label,
            available: Boolean(bd?.meta?.available) || home.length + away.length > 0,
            home_rows: home.length,
            away_rows: away.length,
            note: bd?.meta?.coverage_note ?? null,
          };
        } catch (err) {
          return { fixture: label, available: false, home_rows: 0, away_rows: 0, note: String(err) };
        }
      });

      return json({ mode, checked, any_available: checked.some((c) => c.available) });
    }

    return json({ error: `unknown mode "${mode}"` }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("ucl-sync-fixtures failed:", message);
    return json({ error: message }, 500);
  }
});
