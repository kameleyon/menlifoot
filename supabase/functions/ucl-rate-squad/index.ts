// Rates a UCL Fantasy squad 0-100 and proposes transfers.
//
// The score is computed in code, not by the model. The same squad must produce
// the same number every time, and each point lost has to be attributable to a
// named sub-score. The model is given the finished breakdown and only writes
// the narrative + picks between transfer candidates that this function already
// shortlisted from the database.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
};

// ---------------------------------------------------------------- weights ---
// Tune these to taste — they must sum to 100. Captain and availability are
// weighted heavily because they are the two decisions that most often decide a
// gameweek: the captain doubles a score, and an unavailable starter scores zero.
const WEIGHTS = {
  captain: 18,
  availability: 18,
  form: 22,
  fixtures: 12,
  structure: 10,
  diversity: 10,
  value: 10,
} as const;

// Stacking one club is the classic fantasy trap: a single bad night, a rotation
// or an early red card takes the whole squad down at once. Crucially this is
// measurable with NO season data, which is what keeps ratings meaningful before
// matchday 1 when form, price and fixtures are all still empty.
const MAX_COMFORTABLE_PER_CLUB = 3;

// UCL Fantasy squad rules (verified against the 2026/27 rules): 15 players for
// EUR 100m, split 2 GK / 5 DEF / 5 MID / 3 FWD. The bench is therefore whatever
// the formation leaves over — it is NOT one player per position.
const SQUAD_COMPOSITION: Record<string, number> = { GK: 2, DEF: 5, MID: 5, FWD: 3 };

// The two games have different chips, and mixing them up is a real error:
// Bench Boost and Triple Captain are Fantasy Premier League chips that do not
// exist in the UCL game, which has Limitless instead.
const CHIPS_BY_COMPETITION: Record<string, string[]> = {
  UCL: ["Wildcard", "Limitless"],
  EPL: ["Wildcard", "Free Hit", "Bench Boost", "Triple Captain"],
};

// ---------------------------------------------------------------- credits ---
// Advice costs credits; the rating, its breakdown and the narrative stay free,
// because the score is the hook that makes the product worth signing up for.
//
// Gating happens HERE, not in the UI. A blurred panel over a full response is
// not a paywall - the data sits in the network tab. Unpaid fields are omitted
// from the payload entirely.
const UNLOCK_PRICES = {
  optimisation: 1,
  captains: 1,
  chips: 1,
  // Charged per suggestion actually requested, capped at MAX_TRANSFERS.
  transfers: 1,
} as const;

const MAX_TRANSFERS = 3;

const VALID_FORMATIONS = new Set([
  "3-4-3", "3-5-2", "4-3-3", "4-4-2", "4-5-1", "5-3-2", "5-4-1", "3-6-1", "5-2-3",
]);

type Player = {
  id: string;
  name: string;
  display_name: string;
  team: string;
  position: string;
  price: number | null;
  total_points: number;
  form: number | null;
  minutes: number;
  availability: string;
  availability_note: string | null;
  next_opponent: string | null;
  next_difficulty: number | null;
};

// Ids are interpolated into a PostgREST `in.(...)` filter below, so they must
// be proven to be uuids first — an id like `x),name.eq.y` would otherwise
// rewrite the filter.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (s: unknown): s is string => typeof s === "string" && UUID_RE.test(s);

// Lead-capture only. Never treated as identity or used to look anything up.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const cleanEmail = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const e = v.trim().toLowerCase();
  return e.length <= 254 && EMAIL_RE.test(e) ? e : null;
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Form is roughly 0-10 points per match in this game; normalise onto 0-1. */
const formScore = (p: Player) => clamp01((p.form ?? 0) / 8);

/** next_difficulty is 1 (easiest) to 5 (hardest). */
const fixtureScore = (p: Player) =>
  p.next_difficulty == null ? 0.5 : clamp01((5 - p.next_difficulty) / 4);

const availabilityScore = (p: Player) => {
  switch (p.availability) {
    case "available": return 1;
    case "doubtful": return 0.5;
    case "injured":
    case "suspended":
    case "unavailable": return 0;
    default: return 0.75;
  }
};

/** Points per million, normalised against a strong benchmark of 8 pts/£m. */
const valueScore = (p: Player) => {
  if (!p.price || p.price <= 0) return 0.5;
  return clamp01(p.total_points / p.price / 8);
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // userId is deliberately NOT read from the body — this endpoint is public,
    // so a client-supplied id would let anyone write rows attributed to another
    // user. It is derived from a verified JWT below, or left null.
    const {
      squad,
      source = "manual",
      language = "en",
      email: rawEmail = null,
      unlock: rawUnlock = [],
      transferCount: rawTransferCount = 0,
      competition: rawCompetition = "UCL",
    } = await req.json();

    // Credits gate the Champions League product only. The Premier League
    // version is free for now, so it asks for everything and pays nothing.
    const competition = ["UCL", "EPL"].includes(String(rawCompetition))
      ? String(rawCompetition)
      : "UCL";
    const FREE_COMPETITIONS = new Set(["EPL"]);
    const isFree = FREE_COMPETITIONS.has(competition);

    // What the caller is asking to pay for, normalised and bounded.
    const requested = new Set(
      (Array.isArray(rawUnlock) ? rawUnlock : []).map(String).filter((u) =>
        ["optimisation", "captains", "chips"].includes(u)
      ),
    );
    const transferCount = Math.max(
      0,
      Math.min(MAX_TRANSFERS, Math.floor(Number(rawTransferCount) || 0)),
    );
    const cost = isFree
      ? 0
      : (requested.has("optimisation") ? UNLOCK_PRICES.optimisation : 0) +
        (requested.has("captains") ? UNLOCK_PRICES.captains : 0) +
        (requested.has("chips") ? UNLOCK_PRICES.chips : 0) +
        transferCount * UNLOCK_PRICES.transfers;

    const rawStarterIds: unknown[] = (squad?.starters ?? []).map(
      (s: { player_id?: unknown }) => s?.player_id,
    ).filter(Boolean);
    const rawBenchIds: unknown[] = (squad?.bench ?? []).map(
      (s: { player_id?: unknown }) => s?.player_id,
    ).filter(Boolean);

    if (![...rawStarterIds, ...rawBenchIds].every(isUuid)) {
      return new Response(JSON.stringify({ error: "player_id values must be uuids" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const starterIds = rawStarterIds as string[];
    const benchIds = rawBenchIds as string[];
    const email = cleanEmail(rawEmail);
    const captainId: string | null = (squad?.starters ?? []).find(
      (s: { is_captain?: boolean }) => s?.is_captain,
    )?.player_id ?? null;

    if (starterIds.length === 0) throw new Error("squad.starters must contain resolved player_ids");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Anonymous ratings are allowed (verify_jwt = false). If the caller happens
    // to be signed in, attribute the rating to them — but only after the token
    // is verified server-side.
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : null;
    if (token && token !== Deno.env.get("SUPABASE_ANON_KEY")) {
      const { data: userData } = await supabase.auth.getUser(token);
      userId = userData?.user?.id ?? null;
    }

    const { data: rows, error } = await supabase
      .from("ucl_players")
      .select(
        "id,name,display_name,team,position,price,total_points,form,minutes,availability,availability_note,next_opponent,next_difficulty",
      )
      .eq("competition", competition)
      .in("id", [...starterIds, ...benchIds]);
    if (error) throw new Error(`player lookup failed: ${error.message}`);

    const byId = new Map<string, Player>((rows ?? []).map((p: Player) => [p.id, p]));
    const starters = starterIds.map((id) => byId.get(id)).filter((p): p is Player => !!p);
    const bench = benchIds.map((id) => byId.get(id)).filter((p): p is Player => !!p);
    if (starters.length === 0) throw new Error("none of the starter ids matched a known player");

    const captain = captainId ? byId.get(captainId) ?? null : null;

    // ------------------------------------------------------------ scoring ---
    // A captain is only as good as their form, fixture and fitness combined —
    // but weight only the components we actually have data for, or a captain
    // pick scores 0.35 out of 20 purely because the season has not started.
    const captainScore = (p: Player): number => {
      const parts: [number, number][] = [[0.2, availabilityScore(p)]];
      if (p.form != null) parts.push([0.5, formScore(p)]);
      if (p.next_difficulty != null) parts.push([0.3, fixtureScore(p)]);
      const w = parts.reduce((t, [x]) => t + x, 0);
      return w ? clamp01(parts.reduce((t, [x, sc]) => t + x * sc, 0) / w) : 0.5;
    };

    const perClub = [...starters, ...bench].reduce<Record<string, number>>((acc, p) => {
      acc[p.team] = (acc[p.team] ?? 0) + 1;
      return acc;
    }, {});
    const maxPerClub = Math.max(0, ...Object.values(perClub));

    const sub = {
      captain: captain ? captainScore(captain) : 0,
      availability: avg(starters.map(availabilityScore)),
      form: avg(starters.map(formScore)),
      fixtures: avg(starters.map(fixtureScore)),
      structure: 0,
      // Full marks up to three from one club, sliding to zero by eight.
      diversity: clamp01(1 - (maxPerClub - MAX_COMFORTABLE_PER_CLUB) / 5),
      value: avg([...starters, ...bench].map(valueScore)),
    };

    // Structure: legal shape, a captain set, and nobody good left rotting on
    // the bench while an unavailable player starts.
    const counts = starters.reduce<Record<string, number>>((acc, p) => {
      acc[p.position] = (acc[p.position] ?? 0) + 1;
      return acc;
    }, {});
    const shape = `${counts.DEF ?? 0}-${counts.MID ?? 0}-${counts.FWD ?? 0}`;
    const benchedBetter = bench.filter(
      (b) => starters.some((s) => s.position === b.position && availabilityScore(s) === 0 && availabilityScore(b) === 1),
    ).length;
    // Squad-wide composition must be 2/5/5/3 across all 15, not just a legal XI.
    const squadCounts = [...starters, ...bench].reduce<Record<string, number>>((acc, p) => {
      acc[p.position] = (acc[p.position] ?? 0) + 1;
      return acc;
    }, {});
    const compositionOk =
      starters.length + bench.length !== 15
        ? false
        : Object.entries(SQUAD_COMPOSITION).every(([pos, n]) => (squadCounts[pos] ?? 0) === n);

    let structure = 1;
    if (starters.length !== 11) structure -= 0.3;
    if ((counts.GK ?? 0) !== 1) structure -= 0.2;
    if (!VALID_FORMATIONS.has(shape)) structure -= 0.2;
    if (!captain) structure -= 0.25;
    // Only penalise composition when a full 15 was submitted; a screenshot that
    // only captured the XI should not be marked down for a bench we never saw.
    if (bench.length > 0 && !compositionOk) structure -= 0.15;
    structure -= Math.min(0.3, benchedBetter * 0.15);
    sub.structure = clamp01(structure);

    // Before matchday 1 there is no form, no points and usually no price.
    // Scoring those dimensions zero would cap every squad in the 60s and make
    // the rating meaningless pre-season, so a dimension with no underlying data
    // is dropped and the remaining weights are renormalised back to 100.
    const squadAll = [...starters, ...bench];
    const applicable: Record<keyof typeof WEIGHTS, boolean> = {
      captain: true,
      availability: true,
      structure: true,
      diversity: true,
      form: starters.some((p) => p.form != null),
      fixtures: starters.some((p) => p.next_difficulty != null),
      value: squadAll.some((p) => p.price != null && p.total_points > 0),
    };

    const liveKeys = (Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]).filter((k) => applicable[k]);
    const totalWeight = liveKeys.reduce((t, k) => t + WEIGHTS[k], 0) || 1;
    const rating = Math.round(
      (liveKeys.reduce((t, k) => t + sub[k] * WEIGHTS[k], 0) / totalWeight) * 100,
    );

    const breakdown = (Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]).map((k) => ({
      key: k,
      earned: Math.round(sub[k] * WEIGHTS[k]),
      max: WEIGHTS[k],
      ratio: Number(sub[k].toFixed(3)),
      applicable: applicable[k],
    }));

    // ---------------------------------------------------- optimise the XI ---
    // Pure re-arrangement of the 15 players already owned: no transfers, no
    // budget, so it works today even with zero price data. Deterministic — the
    // same squad always yields the same optimal XI.
    const expectedValue = (p: Player): number => {
      const parts: [number, number][] = [[0.4, availabilityScore(p)]];
      if (p.form != null) parts.push([0.4, formScore(p)]);
      if (p.next_difficulty != null) parts.push([0.2, fixtureScore(p)]);
      const w = parts.reduce((t, [x]) => t + x, 0);
      return w ? parts.reduce((t, [x, sc]) => t + x * sc, 0) / w : 0.5;
    };

    // Attacking returns dominate fantasy captaincy: a keeper's ceiling is a
    // clean sheet and some saves, a forward's is a hat-trick. Without this the
    // optimiser captains whoever sorts first when everyone ties on availability
    // pre-season — which was a goalkeeper.
    const CAPTAIN_POSITION_PRIOR: Record<string, number> = { FWD: 1, MID: 0.95, DEF: 0.7, GK: 0.45 };
    const captaincyValue = (p: Player): number =>
      expectedValue(p) * (CAPTAIN_POSITION_PRIOR[p.position] ?? 0.8);

    const optimiseXi = (squadPlayers: Player[]) => {
      const byPos = (pos: string) =>
        squadPlayers.filter((p) => p.position === pos).sort((a, c) => expectedValue(c) - expectedValue(a));
      const pools = { GK: byPos("GK"), DEF: byPos("DEF"), MID: byPos("MID"), FWD: byPos("FWD") };

      let best: { xi: Player[]; benchOut: Player[]; shape: string; total: number } | null = null;
      for (const f of VALID_FORMATIONS) {
        const [d, m, fw] = f.split("-").map(Number);
        if (pools.GK.length < 1 || pools.DEF.length < d || pools.MID.length < m || pools.FWD.length < fw) {
          continue;
        }
        const xi = [
          ...pools.GK.slice(0, 1),
          ...pools.DEF.slice(0, d),
          ...pools.MID.slice(0, m),
          ...pools.FWD.slice(0, fw),
        ];
        const total = xi.reduce((t, p) => t + expectedValue(p), 0);
        if (!best || total > best.total) {
          const picked = new Set(xi.map((p) => p.id));
          best = { xi, benchOut: squadPlayers.filter((p) => !picked.has(p.id)), shape: f, total };
        }
      }
      if (!best) return null;
      // Captain the highest captaincy value in the chosen XI.
      const cap = [...best.xi].sort((a, c) => captaincyValue(c) - captaincyValue(a))[0] ?? null;
      return { ...best, captain: cap };
    };

    const optimised = optimiseXi([...starters, ...bench]);
    const currentXiValue = starters.reduce((t, p) => t + expectedValue(p), 0);
    const optimisation = optimised
      ? {
          formation: optimised.shape,
          starters: optimised.xi.map((p) => ({
            player_id: p.id,
            name: p.name,
            display_name: p.display_name,
            team: p.team,
            position: p.position,
            price: p.price,
            is_captain: p.id === optimised.captain?.id,
          })),
          bench: optimised.benchOut.map((p) => ({
            player_id: p.id,
            name: p.name,
            display_name: p.display_name,
            team: p.team,
            position: p.position,
            price: p.price,
          })),
          captain: optimised.captain
            ? { player_id: optimised.captain.id, name: optimised.captain.name }
            : null,
          // Positive means the suggested XI is stronger than the current one.
          improvement: Number((optimised.total - currentXiValue).toFixed(3)),
          // A reshuffle that gains nothing is noise, so require a real delta in
          // XI strength or a genuinely better captain before flagging it.
          changes_needed:
            optimised.total - currentXiValue > 0.01 ||
            (optimised.captain != null &&
              captain != null &&
              captaincyValue(optimised.captain) - captaincyValue(captain) > 0.01) ||
            (optimised.captain != null && captain == null),
        }
      : null;

    // --------------------------------------------------- captain suggestion ---
    const captainRanking = [...starters]
      .sort((a, c) => captaincyValue(c) - captaincyValue(a))
      .slice(0, 3)
      .map((p) => ({
        player_id: p.id,
        name: p.name,
        team: p.team,
        next_opponent: p.next_opponent,
        next_difficulty: p.next_difficulty,
        form: p.form,
        is_current: p.id === captain?.id,
      }));

    // ---------------------------------------------------------- chip advice ---
    // UCL Fantasy only has Wildcard and Limitless, so the advice is a simple
    // read of how much of the squad is actually broken this matchday.
    const unavailableStarters = starters.filter((p) => availabilityScore(p) === 0).length;
    const hardFixtures = starters.filter((p) => (p.next_difficulty ?? 0) >= 4).length;
    const chipAdvice = (() => {
      const chips = CHIPS_BY_COMPETITION[competition] ?? CHIPS_BY_COMPETITION.UCL;
      const holdText = `Hold your chips — nothing this ${competition === "EPL" ? "gameweek" : "matchday"} justifies one.`;

      // A broken squad is a Wildcard case in both games.
      if (unavailableStarters >= 4) {
        return { chip: "Wildcard", urgency: "high",
          reason: `${unavailableStarters} of your XI cannot play — too many to fix with normal transfers.` };
      }

      if (competition === "EPL") {
        // Triple Captain wants one standout on an easy fixture, not a good squad.
        if (captain && (captain.next_difficulty ?? 5) <= 2 && (captain.form ?? 0) >= 6) {
          return { chip: "Triple Captain", urgency: "medium",
            reason: `${captain.name} is in form against a soft fixture — the best week to triple him.` };
        }
        // Bench Boost pays only when the bench itself is playable.
        const benchPlayable = bench.filter(
          (p) => availabilityScore(p) === 1 && (p.next_difficulty ?? 5) <= 3,
        ).length;
        if (bench.length >= 4 && benchPlayable === bench.length) {
          return { chip: "Bench Boost", urgency: "medium",
            reason: "Your whole bench is fit with a kind fixture — their points would all count." };
        }
        if (hardFixtures >= 8) {
          return { chip: "Free Hit", urgency: "medium",
            reason: `${hardFixtures} of your XI face a hard fixture; a one-week rebuild may beat taking hits.` };
        }
      } else if (hardFixtures >= 7) {
        return { chip: "Limitless", urgency: "medium",
          reason: `${hardFixtures} of your XI face a top-tier opponent; a one-matchday reshape may pay.` };
      }

      if (unavailableStarters >= 2) {
        return { chip: "Wildcard", urgency: "medium",
          reason: `${unavailableStarters} unavailable starters is more than a free transfer can cover.` };
      }
      return { chip: null, urgency: "none", reason: holdText, available: chips };
    })();

    // -------------------------------------------------- transfer shortlist ---
    // Rank starters worst-first, then pull same-position replacements the user
    // could plausibly afford. The model picks from THIS list; it never invents.
    const weakest = [...starters]
      .map((p) => ({
        p,
        s: 0.4 * formScore(p) + 0.3 * availabilityScore(p) + 0.3 * fixtureScore(p),
      }))
      .sort((a, b) => a.s - b.s)
      .slice(0, 5);

    const candidates: Record<string, Player[]> = {};
    for (const { p } of weakest) {
      let q = supabase
        .from("ucl_players")
        .select(
          "id,name,display_name,team,position,price,total_points,form,minutes,availability,availability_note,next_opponent,next_difficulty",
        )
        .eq("competition", competition)
        .eq("position", p.position)
        .eq("availability", "available")
        .not("id", "in", `(${[...starterIds, ...benchIds].join(",")})`);

      // Only constrain by budget when we actually know what the outgoing player
      // costs. `lte` against a null column matches nothing, so applying this
      // pre-season silently returned zero candidates for every slot.
      if (p.price != null) q = q.lte("price", p.price + 2.0);

      const { data: alts } = await q
        .order("form", { ascending: false, nullsFirst: false })
        .order("next_difficulty", { ascending: true, nullsFirst: false })
        .limit(6);
      candidates[p.id] = (alts ?? []) as Player[];
    }

    // ----------------------------------------------------------- narrative ---
    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    let narrative: Record<string, unknown> | null = null;
    let suggestions: unknown[] = [];

    if (apiKey) {
      const brief = {
        rating,
        breakdown,
        dimensions_without_data: (Object.keys(applicable) as (keyof typeof WEIGHTS)[])
          .filter((k) => !applicable[k]),
        formation: shape,
        club_concentration: { max_from_one_club: maxPerClub, by_club: perClub },
        chip_advice: chipAdvice,
        best_captain_options: captainRanking,
        captain: captain ? { name: captain.name, team: captain.team, form: captain.form } : null,
        starters: starters.map((p) => ({
          name: p.name, team: p.team, position: p.position, price: p.price,
          form: p.form, availability: p.availability, next: p.next_opponent,
          difficulty: p.next_difficulty,
        })),
        bench: bench.map((p) => ({ name: p.name, position: p.position, form: p.form })),
        transfer_options: Object.entries(candidates).map(([outId, alts]) => ({
          out: byId.get(outId)?.name,
          options: alts.map((a) => ({
            name: a.name, team: a.team, price: a.price, form: a.form,
            next: a.next_opponent, difficulty: a.next_difficulty,
          })),
        })),
      };

      const langName = { en: "English", fr: "French", es: "Spanish", ht: "Haitian Creole" }[
        language as string
      ] ?? "English";

      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "openai/gpt-5.6-luna",
          messages: [
            {
              role: "system",
              content:
                `You are a UEFA Champions League Fantasy analyst writing in ${langName}. ` +
                "The rating and breakdown are already final — never dispute or restate a different number. " +
                "Any dimension listed in dimensions_without_data scored zero ONLY because the season has " +
                "not started and that data does not exist yet. Never treat it as a weakness, never say the " +
                "manager is overpaying or out of form because of it, and do not mention it at all. " +
                "Explain what the squad does well and what costs it points, then recommend transfers " +
                "ONLY from the supplied transfer_options. Return raw JSON, no markdown fences: " +
                '{"verdict":"one punchy sentence","strengths":["..."],"weaknesses":["..."],' +
                '"suggestions":[{"out":"name","in":"name","reason":"one sentence","priority":"high|medium|low"}]}',
            },
            { role: "user", content: JSON.stringify(brief) },
          ],
          temperature: 0.4,
        }),
      });

      if (res.ok) {
        const body = await res.json();
        const text = String(body?.choices?.[0]?.message?.content ?? "");
        const m = text.match(/\{[\s\S]*\}/);
        if (m) {
          try {
            const parsed = JSON.parse(m[0]);
            narrative = {
              verdict: parsed?.verdict ?? null,
              strengths: parsed?.strengths ?? [],
              weaknesses: parsed?.weaknesses ?? [],
            };
            suggestions = Array.isArray(parsed?.suggestions) ? parsed.suggestions : [];
          } catch {
            console.error("narrative JSON parse failed");
          }
        }
      } else {
        console.error(`narrative call failed: ${res.status}`);
      }
    }

    // ------------------------------------------------------------ charge ---
    // Spend as the signed-in user rather than with the service role, so the
    // balance check and decrement run under spend_credits' own auth.uid()
    // guard and cannot be aimed at somebody else's wallet.
    let creditsRemaining: number | null = null;
    let paid = new Set<string>();
    let paidTransfers = 0;

    if (cost > 0) {
      if (!userId || !token) {
        return new Response(
          JSON.stringify({ error: "sign_in_required", cost }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const asUser = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: `Bearer ${token}` } } },
      );
      const { data: newBalance, error: spendError } = await asUser.rpc("spend_credits", {
        p_amount: cost,
        p_reason: "ucl_rate_squad",
        p_metadata: { unlock: [...requested], transfers: transferCount },
      });
      if (spendError) throw new Error(`credit spend failed: ${spendError.message}`);
      if (typeof newBalance !== "number" || newBalance < 0) {
        return new Response(
          JSON.stringify({ error: "insufficient_credits", cost }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      creditsRemaining = newBalance;
      paid = requested;
      paidTransfers = transferCount;
    } else if (isFree) {
      paid = new Set(["optimisation", "captains", "chips"]);
      paidTransfers = MAX_TRANSFERS;
    } else if (userId) {
      const { data: wallet } = await supabase
        .from("user_credits")
        .select("balance")
        .eq("user_id", userId)
        .maybeSingle();
      creditsRemaining = (wallet as { balance?: number } | null)?.balance ?? 0;
    }

    // The rating is still valid without the narrative, so persist either way.
    const { data: saved } = await supabase
      .from("ucl_squad_ratings")
      .insert({
        user_id: userId,
        email,
        email_captured_at: email ? new Date().toISOString() : null,
        squad,
        rating,
        competition,
        breakdown: { sub_scores: breakdown, formation: shape, narrative, chip_advice: chipAdvice },
        suggestions,
        source,
        language,
      })
      .select("id")
      .single();

    return new Response(
      JSON.stringify({
        id: saved?.id ?? null,
        rating,
        formation: shape,
        breakdown,
        narrative,
        // Everything below is omitted unless it was paid for. `locked` tells the
        // client what exists and what it would cost, without leaking any of it.
        suggestions: paidTransfers > 0 ? suggestions.slice(0, paidTransfers) : [],
        optimisation: paid.has("optimisation") ? optimisation : null,
        captain_ranking: paid.has("captains") ? captainRanking : [],
        chip_advice: paid.has("chips") ? chipAdvice : null,
        locked: {
          optimisation: !paid.has("optimisation") && optimisation != null,
          captains: !paid.has("captains") && captainRanking.length > 0,
          chips: !paid.has("chips") && chipAdvice != null,
          transfers: Math.max(0, Math.min(MAX_TRANSFERS, suggestions.length) - paidTransfers),
        },
        competition,
        free: isFree,
        prices: { ...UNLOCK_PRICES, max_transfers: MAX_TRANSFERS },
        credits_remaining: creditsRemaining,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("ucl-rate-squad failed:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
