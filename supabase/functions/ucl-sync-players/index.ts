// Nightly refresh of the UCL Fantasy player pool.
//
// Strategy, in order:
//   1. UEFA fantasy feed  — the only source with real fantasy prices + points.
//      Datacenter IPs are often blocked by Akamai (403), so this may fail.
//   2. Perplexity backfill — used only when the table is EMPTY. Rebuilds the
//      pool team by team. Slower and less precise on prices; gets us running.
//   3. Perplexity refresh  — used nightly when UEFA is down but the table is
//      populated. Only refreshes availability/injury/suspension, which is what
//      actually changes day to day and what a search model is genuinely good
//      at. It deliberately does NOT invent prices or point totals.
//
// Invoked by pg_cron at midnight UTC (~01:00 CET, after full time).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
};

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-GB,en;q=0.9",
  Referer: "https://gaming.uefa.com/en/uclfantasy",
  Origin: "https://gaming.uefa.com",
};

// UEFA increments the season id each year; probe a window rather than pinning
// a value that silently goes stale next August.
const SEASON_CANDIDATES = [96, 94, 92, 90, 88, 86, 84];
const SKILL_TO_POSITION: Record<number, string> = { 1: "GK", 2: "DEF", 3: "MID", 4: "FWD" };

type Player = {
  uefa_id: string | null;
  name: string;
  normalized_name: string;
  display_name: string;
  team: string;
  team_code: string | null;
  position: string;
  price: number | null;
  total_points: number;
  form: number | null;
  minutes: number;
  goals: number;
  assists: number;
  clean_sheets: number;
  saves: number;
  yellow_cards: number;
  red_cards: number;
  availability: string;
  availability_note: string | null;
  selected_by_pct: number | null;
  source: string;
  updated_at: string;
};

const normalize = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

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

const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : fallback;
};

// --------------------------------------------------------------- UEFA feed ---

// Populated by fetchFromUefa so a failure can say WHY (403 = bot-blocked,
// 404 = wrong season id, network error = egress blocked entirely).
const uefaProbeLog: string[] = [];

/** Probe season ids until one returns a usable player list. */
async function fetchFromUefa(): Promise<{ players: Player[]; seasonId: number } | null> {
  uefaProbeLog.length = 0;
  for (const season of SEASON_CANDIDATES) {
    const url = `https://gaming.uefa.com/en/uclfantasy/services/feeds/players/players_${season}_en_1.json`;
    try {
      const res = await fetch(url, { headers: BROWSER_HEADERS });
      if (!res.ok) {
        uefaProbeLog.push(`${season}:HTTP${res.status}`);
        console.log(`uefa season ${season}: HTTP ${res.status}`);
        continue;
      }
      const json = await res.json();
      const rows: unknown[] = json?.data?.value?.playerList ?? json?.data?.value ?? json?.playerList ?? [];
      if (!Array.isArray(rows) || rows.length === 0) {
        uefaProbeLog.push(`${season}:no-playerList`);
        console.log(`uefa season ${season}: no playerList in payload`);
        continue;
      }
      const players = rows.map(mapUefaPlayer).filter((p): p is Player => p !== null);
      if (players.length > 0) {
        console.log(`uefa season ${season}: ${players.length} players`);
        return { players, seasonId: season };
      }
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      uefaProbeLog.push(`${season}:${m.slice(0, 60)}`);
      console.log(`uefa season ${season}: ${m}`);
    }
  }
  return null;
}

function mapUefaPlayer(raw: unknown): Player | null {
  const p = raw as Record<string, unknown>;
  const name = String(p.pFName ?? p.pDName ?? p.pLName ?? "").trim();
  if (!name) return null;
  const position = SKILL_TO_POSITION[num(p.skill, 0)];
  if (!position) return null;

  // UEFA marks unavailability via isActive/pStatus rather than a text field.
  const active = p.isActive === undefined ? true : num(p.isActive, 1) === 1;
  const injured = String(p.pStatus ?? "").toUpperCase() === "I";
  const suspended = String(p.pStatus ?? "").toUpperCase() === "S";

  return {
    uefa_id: p.id != null ? String(p.id) : null,
    name,
    normalized_name: normalize(name),
    display_name: String(p.pDName ?? p.pLName ?? name).trim(),
    team: String(p.tName ?? p.cCode ?? "Unknown").trim(),
    team_code: p.cCode ? String(p.cCode).toUpperCase().slice(0, 4) : null,
    position,
    price: p.value != null ? num(p.value, 0) : null,
    total_points: Math.round(num(p.totPts)),
    form: p.avgPlayerPts != null ? num(p.avgPlayerPts) : null,
    minutes: Math.round(num(p.minsPlayed)),
    goals: Math.round(num(p.gS)),
    assists: Math.round(num(p.gAst)),
    clean_sheets: Math.round(num(p.cS)),
    saves: Math.round(num(p.sv)),
    yellow_cards: Math.round(num(p.yC)),
    red_cards: Math.round(num(p.rC)),
    availability: suspended ? "suspended" : injured ? "injured" : active ? "available" : "unavailable",
    availability_note: null,
    selected_by_pct: p.selPer != null ? num(p.selPer) : null,
    source: "uefa",
    updated_at: new Date().toISOString(),
  };
}

// -------------------------------------------------------------- Perplexity ---

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
            "If you are not confident about a value, use null rather than guessing.",
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

/**
 * Discover the current league-phase field. The 36 clubs change every season and
 * the draw lands in late August, so this is asked rather than hardcoded.
 */
async function discoverTeams(apiKey: string): Promise<string[]> {
  const rows = (await askPerplexity(
    "Which clubs are in the league phase of the UEFA Champions League for the current " +
      "2026/27 season? Return a JSON array of objects with a single key \"team\" holding " +
      "the club's common English name (e.g. \"Real Madrid\", \"Manchester City\"). " +
      "Return only clubs you can confirm have qualified.",
    apiKey,
  )) as Record<string, unknown>[];
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r) => String(r?.team ?? "").trim())
    .filter((t) => t.length > 1)
    .filter((t, i, a) => a.indexOf(t) === i);
}

// Sequential per-team calls take ~11.5s each; 36 clubs would be ~7 minutes and
// blow the Edge Function wall-clock limit. Six at a time brings a full sweep to
// roughly 70s while keeping one club per prompt, so no response gets truncated.
const POOL_SIZE = 6;

// Postgres rejects an upsert whose payload hits the same conflict key twice
// ("cannot affect row a second time"). A search model will happily list the
// same player under two positions, so collapse on the merge key first.
const dedupe = (players: Player[]): Player[] => {
  const seen = new Map<string, Player>();
  for (const p of players) seen.set(`${p.normalized_name}|${p.team}`, p);
  return [...seen.values()];
};

async function runPool<T, R>(
  items: T[],
  size: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  }
  return out;
}

// Per-team failure reasons, surfaced in the sync run row when nothing lands.
const backfillLog: string[] = [];

/** Cold start: rebuild the pool one team at a time. */
async function backfillViaPerplexity(apiKey: string, teams: string[]): Promise<Player[]> {
  backfillLog.length = 0;
  const perTeam = await runPool(teams, POOL_SIZE, async (team: string) => {
    const out: Player[] = [];
    try {
      // Ask for the CLUB SQUAD, not the "fantasy squad". Until the UEFA game
      // opens (days before matchday 1) there are no fantasy prices at all, and
      // a search model correctly refuses to invent them — which returns an
      // empty array and leaves the pool empty. Rosters exist year-round; price
      // and points are optional and fill in once the game is live.
      const rows = (await askPerplexity(
        `First-team squad for the football club ${team} for the 2026/27 season. ` +
          `Include every senior outfield player and goalkeeper currently registered. ` +
          `Return a JSON array; one object per player with keys: ` +
          `name (full name), display_name (surname or the short name shown on a shirt), ` +
          `position (one of "GK","DEF","MID","FWD"), ` +
          `price (UEFA Champions League Fantasy price in millions if the game is live, else null), ` +
          `total_points (UCL fantasy points this season, else 0), ` +
          `availability (one of "available","doubtful","injured","suspended","unavailable"), ` +
          `availability_note (short reason or null). ` +
          `Never return an empty array if the club has a squad — prices may be null.`,
        apiKey,
      )) as Record<string, unknown>[];

      if (!Array.isArray(rows)) {
        backfillLog.push(`${team}:not-an-array`);
        return out;
      }
      backfillLog.push(`${team}:${rows.length}rows`);
      for (const r of rows) {
        const name = String(r.name ?? "").trim();
        const position = String(r.position ?? "").toUpperCase();
        if (!name || !["GK", "DEF", "MID", "FWD"].includes(position)) continue;
        out.push({
          uefa_id: null,
          name,
          normalized_name: normalize(name),
          display_name: String(r.display_name ?? name).trim(),
          team,
          team_code: null,
          position,
          price: sanePrice(r.price),
          total_points: Math.round(num(r.total_points)),
          form: null,
          minutes: 0,
          goals: 0,
          assists: 0,
          clean_sheets: 0,
          saves: 0,
          yellow_cards: 0,
          red_cards: 0,
          availability: ["available", "doubtful", "injured", "suspended", "unavailable"].includes(
            String(r.availability ?? "available"),
          )
            ? String(r.availability ?? "available")
            : "available",
          availability_note: r.availability_note ? String(r.availability_note) : null,
          selected_by_pct: null,
          source: "perplexity",
          updated_at: new Date().toISOString(),
        });
      }
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      backfillLog.push(`${team}:ERR ${m.slice(0, 90)}`);
      console.log(`backfill ${team} failed: ${m}`);
    }
    return out;
  });
  return perTeam.flat();
}

/**
 * Warm nightly path when UEFA is unreachable. Only touches availability —
 * prices and point totals are left alone rather than re-hallucinated.
 */
async function refreshAvailability(
  apiKey: string,
  teams: string[],
): Promise<{ name: string; availability: string; note: string | null }[]> {
  const perTeam = await runPool(teams, POOL_SIZE, async (team: string) => {
    const updates: { name: string; availability: string; note: string | null }[] = [];
    try {
      const rows = (await askPerplexity(
        `Current injury and suspension list for ${team} ahead of their next UEFA Champions League match. ` +
          `Return a JSON array; one object per UNAVAILABLE or DOUBTFUL player with keys: ` +
          `name (full name), availability (one of "doubtful","injured","suspended","unavailable"), note (short reason). ` +
          `Return [] if everyone is fit and available.`,
        apiKey,
      )) as Record<string, unknown>[];
      if (!Array.isArray(rows)) return updates;
      for (const r of rows) {
        const name = String(r.name ?? "").trim();
        const availability = String(r.availability ?? "").toLowerCase();
        if (!name || !["doubtful", "injured", "suspended", "unavailable"].includes(availability)) continue;
        updates.push({ name, availability, note: r.note ? String(r.note) : null });
      }
    } catch (err) {
      console.log(`availability ${team} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    return updates;
  });
  return perTeam.flat();
}

// -------------------------------------------------------------------- main ---

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const { data: run } = await supabase
    .from("ucl_sync_runs")
    .insert({ status: "running" })
    .select("id")
    .single();
  const runId = run?.id as string | undefined;

  const finish = async (
    status: string,
    source: string | null,
    upserted: number,
    error: string | null,
  ) => {
    if (runId) {
      await supabase
        .from("ucl_sync_runs")
        .update({
          status,
          source,
          players_upserted: upserted,
          error,
          finished_at: new Date().toISOString(),
        })
        .eq("id", runId);
    }
    return new Response(JSON.stringify({ status, source, players_upserted: upserted, error }), {
      status: status === "failed" ? 500 : 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  };

  try {
    const body = await req.json().catch(() => ({}));
    const mode: string = body?.mode ?? "auto";

    // 1. UEFA first.
    if (mode === "auto" || mode === "uefa") {
      const startedAt = new Date().toISOString();
      const uefa = await fetchFromUefa();
      if (uefa) {
        const { error } = await supabase
          .from("ucl_players")
          .upsert(dedupe(uefa.players), { onConflict: "normalized_name,team" });
        if (error) throw new Error(`upsert failed: ${error.message}`);
        // UEFA is authoritative. Drop Perplexity stopgap rows it did not claim
        // (usually a team-name spelling the fallback got slightly different),
        // so the pool converges instead of accumulating near-duplicates.
        await supabase
          .from("ucl_players")
          .delete()
          .eq("source", "perplexity")
          .lt("updated_at", startedAt);
        return await finish("success", `uefa:${uefa.seasonId}`, uefa.players.length, null);
      }
      if (mode === "uefa") {
        return await finish("failed", "uefa", 0, `UEFA feed unreachable — ${uefaProbeLog.join(" | ")}`);
      }
    }

    // 2/3. Perplexity paths.
    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!apiKey) return await finish("failed", null, 0, "OPENROUTER_API_KEY is not configured");

    const { count } = await supabase
      .from("ucl_players")
      .select("id", { count: "exact", head: true });
    const isEmpty = (count ?? 0) === 0;

    // Teams to sweep: whatever is already in the pool, else the caller supplies
    // a list. We never guess the 36-team field ourselves.
    let teams: string[] = Array.isArray(body?.teams) && body.teams.length > 0
      ? body.teams.map(String)
      : isEmpty
      ? []
      : (
        await supabase.from("ucl_players").select("team").not("team", "is", null)
      ).data?.map((r: { team: string }) => r.team).filter((t, i, a) => a.indexOf(t) === i) ?? [];

    // Nothing supplied and nothing in the pool yet — find the field ourselves.
    if (teams.length === 0) {
      teams = await discoverTeams(apiKey);
      console.log(`discovered ${teams.length} teams`);
    }
    if (teams.length === 0) {
      return await finish(
        "failed",
        "perplexity",
        0,
        "UEFA feed unreachable and team discovery returned nothing. " +
          "Call again with {\"teams\":[...]} to seed the pool manually.",
      );
    }

    if (isEmpty || mode === "llm-backfill") {
      const players = await backfillViaPerplexity(apiKey, teams);
      if (players.length === 0) {
        return await finish("failed", "perplexity", 0, `backfill returned nothing — ${backfillLog.join(" | ")}`);
      }
      const { error } = await supabase
        .from("ucl_players")
        .upsert(dedupe(players), { onConflict: "normalized_name,team" });
      if (error) throw new Error(`upsert failed: ${error.message}`);
      return await finish("partial", "perplexity:backfill", players.length, "UEFA feed unreachable; prices are approximate");
    }

    const updates = await refreshAvailability(apiKey, teams);
    let applied = 0;
    // Reset everyone to available, then re-flag. Two passes so a player who
    // recovered does not stay flagged forever.
    await supabase
      .from("ucl_players")
      .update({ availability: "available", availability_note: null })
      .neq("availability", "available");
    for (const u of updates) {
      const { data: matches } = await supabase.rpc("match_ucl_player", { q: normalize(u.name), lim: 1 });
      const hit = Array.isArray(matches) ? matches[0] : null;
      if (!hit?.id) continue;
      const { error } = await supabase
        .from("ucl_players")
        .update({
          availability: u.availability,
          availability_note: u.note,
          updated_at: new Date().toISOString(),
        })
        .eq("id", hit.id);
      if (!error) applied += 1;
    }
    return await finish("partial", "perplexity:availability", applied, "UEFA feed unreachable; availability only");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("ucl-sync-players failed:", message);
    return await finish("failed", null, 0, message);
  }
});
