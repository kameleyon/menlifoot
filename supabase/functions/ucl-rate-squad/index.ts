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

// Both games give 100m for the 15. Used to work out what is left in the bank,
// which is what a manager can actually spend on a replacement.
const SQUAD_BUDGET = 100;

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
  // Building a squad from nothing is the optimiser applied to an empty pitch,
  // so it is priced like the optimiser. Free on the Premier League side along
  // with everything else there.
  autofill: 1,
} as const;

const MAX_TRANSFERS = 5;

/**
 * Calibration.
 *
 * These decide what a full mark means, and they were set against a season-long
 * ideal that nothing in the game reaches. The best squad the optimiser could
 * build - every pound spent perfectly, inside the club cap - scored 78, losing
 * ten points on form and seven on value. A ceiling no squad can touch is not a
 * demanding scale, it is a broken one: it compresses every real squad into a
 * narrow band and makes the difference between a good and a great team smaller
 * than it should be.
 *
 * Measured against the live pool rather than picked by feel. Across Premier
 * League players with minutes, points per game runs p50 2.0, p90 6.0, and
 * points per game per million runs p50 0.36, p90 1.09.
 */

/**
 * Per-appearance return worth full marks. p90 of the pool is 6.0, and this
 * sits below it deliberately: the score averages eleven starters, and an XI
 * cannot be eleven p90 players inside the budget. The benchmark has to be what
 * a great SQUAD averages, not what a great player scores.
 */
const ELITE_POINTS_PER_GAME = 4.2;

/** Return per million per appearance worth full marks. p90 is 1.09. */
const ELITE_VALUE_PER_MILLION = 1.1;

/**
 * What the cheapest player in the game is assumed to be worth before any
 * evidence arrives.
 *
 * Price expectation used to run to zero at the 4.0m floor, which punished the
 * enabler every budget squad is forced to own: the optimal side starts three
 * 4.0m defenders precisely so it can afford a 15.5m striker, and each of them
 * scored nothing on form. The floor of the market is not the floor of ability
 * - a 4.0m player is a professional starting footballer, not a zero.
 */
const CHEAPEST_PLAYER_PRIOR = 0.35;

/**
 * What a perfect squad actually reaches in each dimension.
 *
 * Full marks used to mean a theoretical ideal that no squad could approach.
 * Some of those ceilings are unreachable by construction rather than by
 * accident: form shrinks each player toward what their price implies, so a
 * 4.0m defender playing out of his skin still blends to about 0.72 on three
 * games of evidence. That shrinkage is right - it is what stops one lucky haul
 * from outranking a genuinely better player - so the fix is not to weaken it.
 * Nor can eleven starters all draw the easiest fixture in the same round.
 *
 * So the top of the scale is the best squad the competition permits, measured
 * by running the optimiser and reading what it attains. A squad matching it
 * scores 100, and every real squad falls below on its own merits.
 *
 * Measured, not chosen. They drift as a season accumulates minutes and the
 * shrinkage loosens; re-measure by rating the autofill squad and reading the
 * ratios back. A ceiling that has drifted low only means more squads reach
 * 100, never that a bad squad does.
 */
/**
 * Headroom above the best squad the optimiser can build.
 *
 * Nothing scores 100, including the squad this function proposes itself. A
 * perfect score would say there is no move left to make, which is never true:
 * form moves, someone gets injured, a fixture turns. The optimiser's own squad
 * lands in the mid nineties and the last few points stay unclaimed.
 */
const PERFECTION_HEADROOM = 0.93;

/**
 * How steeply marks fall away from the ceiling.
 *
 * Linear normalisation was too generous near the top: a squad at nine tenths
 * of the ceiling kept nine tenths of the marks, so a keen but ordinary side
 * scored 86 and 90 was a short step from average. Above one, each point closer
 * to the ceiling costs more than the last, which is how the difficulty of
 * actually improving a squad behaves - swapping a weak pick for a good one is
 * easy, swapping a good one for the right one is not.
 *
 * Measured on four reference squads rather than chosen: the optimiser's own,
 * a keen manager's (best regular starters, sane captain, no optimiser), one
 * built from pool-median players, and the cheapest legal fifteen.
 */
const RATING_CURVE = 1.35;

type Ceilings = Partial<Record<keyof typeof WEIGHTS, number>>;

/**
 * Measured per competition, because the two do not sit on the same
 * distribution.
 *
 * The Champions League pool is 36 elite squads, so its best fifteen return
 * more per appearance and per million than the Premier League's best fifteen,
 * which must include cheap enablers from the bottom of the table. Scoring
 * Champions League squads against Premier League ceilings saturated form and
 * value at full marks for any decent side, which stopped those two dimensions
 * discriminating between a good squad and a great one at all.
 */
const ACHIEVABLE_BY_COMPETITION: Record<string, Ceilings> = {
  EPL: { captain: 0.97, form: 0.71, fixtures: 0.90, value: 0.71 },
  // Measured on the optimiser's own Champions League squad. Form and value sit
  // far above the Premier League's, which is why scoring against those
  // saturated both at full marks for any decent side; captain and fixtures sit
  // below, so those were being marked down against a bar this competition
  // cannot reach - 36 elite clubs means no easy fixture and no weak captain
  // pick to stand out against.
  UCL: { captain: 0.89, form: 0.96, fixtures: 0.81, value: 0.88 },
};

const ceilingsFor = (competition: string): Ceilings =>
  ACHIEVABLE_BY_COMPETITION[competition] ?? ACHIEVABLE_BY_COMPETITION.EPL;

// A suggestion is flagged as recommended when the replacement is clearly
// better, not merely better. Below this the upgrade is real but marginal and
// rarely worth a points hit, so it is offered without a badge.
const STRONG_UPGRADE = 0.10;

/**
 * Points a swap must be worth before it is recommended rather than merely
 * suggested. Below about a point the projection cannot tell the two players
 * apart with any confidence, and a transfer that gains nothing measurable is
 * how a manager talks themselves into a hit for no reason.
 */
const MIN_RECOMMENDED_POINTS = 1.0;

const PLAYER_FIELDS =
  "id,name,display_name,team,position,price,total_points,form,minutes,availability," +
  "availability_note,next_opponent,next_difficulty,starts,points_per_game,ict_index,updated_at";

const VALID_FORMATIONS = new Set([
  "3-4-3", "3-5-2", "4-3-3", "4-4-2", "4-5-1", "5-3-2", "5-4-1", "3-6-1", "5-2-3",
]);

type Player = {
  id: string;
  starts: number | null;
  points_per_game: number | null;
  ict_index: number | null;
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
  updated_at: string | null;
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

/**
 * How much football this player has actually played, 0-1.
 *
 * Two appearances is not evidence. Everything derived from form is shrunk
 * toward a prior by this weight, so a hot start cannot outrank an established
 * player until there is enough of a season to justify it. Five full matches is
 * treated as a complete sample.
 */
const sampleWeight = (p: Player) => clamp01((p.minutes ?? 0) / 450);

/**
 * What a player's price implies about expected output, 0-1.
 *
 * Price is the market's standing estimate of a player - set by the game and
 * moved by millions of managers - so it is the right thing to fall back on when
 * this season has barely started. Roughly 4.0m floor to 15.0m ceiling.
 */
const priceExpectation = (p: Player) =>
  p.price == null
    ? 0.45
    : CHEAPEST_PLAYER_PRIOR +
      (1 - CHEAPEST_PLAYER_PRIOR) * clamp01((p.price - 4) / 11);

/**
 * Scoring rate per appearance, which is steadier than a 30-day form window
 * because it is not distorted by a single blank or a single haul.
 */
const perGameScore = (p: Player) =>
  p.points_per_game == null ? null : clamp01(p.points_per_game / ELITE_POINTS_PER_GAME);

/**
 * Form, regressed toward what the player's price implies.
 *
 * The old version read raw form only, which two games into a season meant a
 * 5.5m midfielder with one good haul outranked an 8.5m forward who had started
 * quietly - and the optimiser duly benched the better player. Now the two are
 * blended by sample size: early on price dominates, and by five matches played
 * the actual returns do.
 */
const formScore = (p: Player) => {
  const w = sampleWeight(p);
  const observed = perGameScore(p) ?? clamp01((p.form ?? 0) / ELITE_POINTS_PER_GAME);
  const prior = priceExpectation(p);
  const blended = w * observed + (1 - w) * prior;

  // A player who is not starting cannot return points, whatever the blend says.
  // Only applied once there are matches to have started.
  if (p.starts != null && p.minutes != null && p.minutes > 0) {
    const appearances = Math.max(1, Math.round(p.minutes / 90));
    const startRate = clamp01(p.starts / appearances);
    if (startRate < 0.5) return blended * (0.55 + startRate * 0.9);
  }
  return blended;
};

/**
 * next_difficulty is 1 (easiest) to 5 (hardest).
 *
 * Divided by less than the full range for the same reason as the form
 * benchmark: a manager picks players, not fixtures, and no legal squad has all
 * eleven starters facing the weakest opposition in the same round. An average
 * difficulty around 2 is as good as a real squad gets, so that earns full
 * marks rather than the unreachable 1.
 */
const EASY_ENOUGH_DIFFICULTY = 3.2;
const fixtureScore = (p: Player) =>
  p.next_difficulty == null
    ? 0.5
    : clamp01((5 - p.next_difficulty) / EASY_ENOUGH_DIFFICULTY);

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

/**
 * Return per million, per appearance.
 *
 * The old version divided total points by price, which measured the calendar
 * rather than the squad: points accumulate all season, so the same player
 * scored 0.26 in August and saturated at 1.0 by midwinter. Every squad rated
 * before Christmas lost most of this dimension no matter who was in it.
 *
 * Per game instead, so a squad is judged on what its players return whenever
 * they play rather than on how many rounds have been played.
 */
const valueScore = (p: Player) => {
  if (!p.price || p.price <= 0) return 0.5;
  if (p.points_per_game == null) return 0.5;
  return clamp01(p.points_per_game / p.price / ELITE_VALUE_PER_MILLION);
};


/**
 * One definition of how good a player is right now, shared by the optimiser,
 * the captain ranking and the transfer shortlist. Three separate notions of
 * "good" was how the optimiser and the suggestions ended up contradicting each
 * other on the same screen.
 */
/**
 * How much each signal counts, depending on how far ahead the manager is
 * picking for.
 *
 * Over a season the opponent barely matters: every club plays everyone, the
 * draws even out, and what survives is how good a player is and whether he is
 * fit. For a single round the opponent is a third of the answer, because there
 * is no evening out - one fixture is the whole of it.
 *
 * Availability stays heavy in both. A player who cannot play returns nothing
 * on any horizon, and that is the one thing no fixture can compensate for.
 */
const HORIZON_WEIGHTS = {
  season: { availability: 0.4, form: 0.4, fixtures: 0.2 },
  gameweek: { availability: 0.35, form: 0.3, fixtures: 0.35 },
} as const;

type Horizon = keyof typeof HORIZON_WEIGHTS;

const valueForHorizon = (p: Player, horizon: Horizon): number => {
  const w = HORIZON_WEIGHTS[horizon];
  const parts: [number, number][] = [
    [w.availability, availabilityScore(p)],
    [w.form, formScore(p)],
  ];
  // Fixture difficulty is only weighted when it is known, so a player with no
  // published opponent is not scored as though he had a hard one.
  if (p.next_difficulty != null) parts.push([w.fixtures, fixtureScore(p)]);
  const total = parts.reduce((t, [x]) => t + x, 0);
  return total ? parts.reduce((t, [x, sc]) => t + x * sc, 0) / total : 0.5;
};

const expectedValue = (p: Player): number => valueForHorizon(p, "season");

/**
 * A captain is only as good as their form, fixture and fitness combined, but
 * weight only the components with data behind them - otherwise a captain pick
 * scores a fraction of its allowance purely because the season is young.
 */
const captainScore = (p: Player): number => {
  const parts: [number, number][] = [[0.2, availabilityScore(p)]];
  parts.push([0.5, formScore(p)]);
  if (p.next_difficulty != null) parts.push([0.3, fixtureScore(p)]);
  const w = parts.reduce((t, [x]) => t + x, 0);
  return w ? clamp01(parts.reduce((t, [x, sc]) => t + x * sc, 0) / w) : 0.5;
};

// Attacking returns dominate fantasy captaincy: a keeper's ceiling is a
// clean sheet and some saves, a forward's is a hat-trick. Without this the
// optimiser captains whoever sorts first when everyone ties on availability
// pre-season — which was a goalkeeper.
const CAPTAIN_POSITION_PRIOR: Record<string, number> = { FWD: 1, MID: 0.95, DEF: 0.7, GK: 0.45 };
const captaincyValue = (p: Player): number =>
  expectedValue(p) * (CAPTAIN_POSITION_PRIOR[p.position] ?? 0.8);

const optimiseXi = (squadPlayers: Player[], value: (p: Player) => number = expectedValue) => {
  const byPos = (pos: string) =>
    squadPlayers.filter((p) => p.position === pos).sort((a, c) => value(c) - value(a));
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
    const total = xi.reduce((t, p) => t + value(p), 0);
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

/**
 * What the cheapest and dearest players in the game are expected to return per
 * appearance, before any evidence.
 *
 * The rating works in a 0-1 space, which is right for comparing squads and
 * useless for telling a manager what to expect. These two numbers put the
 * projection back into points, where the question was asked.
 */
const FLOOR_PLAYER_PPG = 2.0;
const ELITE_PLAYER_PPG = 7.5;

/** How much one step of fixture difficulty moves a projection. */
const FIXTURE_SWING_PER_STEP = 0.125;

/**
 * Points this player is expected to return in his next match.
 *
 * Built from the same three signals the rating uses, kept in points rather
 * than normalised: a scoring rate shrunk toward what the price implies, scaled
 * by the fixture, and cut by anything that stops him playing.
 *
 * The shrinkage is the important part and the reason this is not simply the
 * player's average. Three games in, a 4.0m defender with one clean sheet has a
 * per-game average as high as a 12.0m midfielder, and reporting that as a
 * forecast would be reporting noise with a decimal point on it. Early on the
 * price carries most of the answer, and by five appearances the player's own
 * returns do.
 *
 * No provider sells this number for either competition - UEFA publishes
 * nothing forward-looking at all, and FPL's expected-points field is currently
 * a copy of its own per-game average - so it is derived here or not at all.
 */
const projectedPoints = (p: Player): number => {
  const priceImplied = p.price == null
    ? (FLOOR_PLAYER_PPG + ELITE_PLAYER_PPG) / 2
    : FLOOR_PLAYER_PPG +
      clamp01((p.price - 4) / 11) * (ELITE_PLAYER_PPG - FLOOR_PLAYER_PPG);

  const observed = p.points_per_game;
  const weight = sampleWeight(p);
  let expected = observed == null
    ? priceImplied
    : weight * observed + (1 - weight) * priceImplied;

  // Difficulty runs 1 (easiest) to 5 (hardest); 3 is neutral.
  if (p.next_difficulty != null) {
    expected *= 1 + (3 - p.next_difficulty) * FIXTURE_SWING_PER_STEP;
  }

  // A player who is not starting cannot return what a starter returns, however
  // good his rate looks over the minutes he has had.
  if (p.starts != null && p.minutes != null && p.minutes > 0) {
    const appearances = Math.max(1, Math.round(p.minutes / 90));
    const startRate = clamp01(p.starts / appearances);
    if (startRate < 0.5) expected *= 0.55 + startRate * 0.9;
  }

  // Availability last, because it multiplies everything else to nothing.
  expected *= availabilityScore(p);

  return Math.max(0, Number(expected.toFixed(1)));
};

/**
 * Score a squad, 0-100.
 *
 * Pulled out of the request handler so a hypothetical squad can be run through
 * exactly the same maths. Projecting an improvement with a second, slightly
 * different formula would be worse than not projecting one at all - the two
 * numbers have to be comparable to mean anything.
 */
function scoreSquad(
  starters: Player[],
  bench: Player[],
  captain: Player | null,
  competition = "EPL",
) {
  const ACHIEVABLE = ceilingsFor(competition);
  const perClub = [...starters, ...bench].reduce<Record<string, number>>((acc, p) => {
    acc[p.team] = (acc[p.team] ?? 0) + 1;
    return acc;
  }, {});
  const maxPerClub = Math.max(0, ...Object.values(perClub));

  const counts = starters.reduce<Record<string, number>>((acc, p) => {
    acc[p.position] = (acc[p.position] ?? 0) + 1;
    return acc;
  }, {});
  const shape = `${counts.DEF ?? 0}-${counts.MID ?? 0}-${counts.FWD ?? 0}`;
  const benchedBetter = bench.filter((b) =>
    starters.some(
      (st) => st.position === b.position && availabilityScore(st) === 0 && availabilityScore(b) === 1,
    ),
  ).length;
  const squadCounts = [...starters, ...bench].reduce<Record<string, number>>((acc, p) => {
    acc[p.position] = (acc[p.position] ?? 0) + 1;
    return acc;
  }, {});
  const compositionOk = starters.length + bench.length !== 15
    ? false
    : Object.entries(SQUAD_COMPOSITION).every(([pos, n]) => (squadCounts[pos] ?? 0) === n);

  let structure = 1;
  if (starters.length !== 11) structure -= 0.3;
  if ((counts.GK ?? 0) !== 1) structure -= 0.2;
  if (!VALID_FORMATIONS.has(shape)) structure -= 0.2;
  if (!captain) structure -= 0.25;
  // Only penalise composition when a full 15 was submitted; a screenshot that
  // captured just the XI should not be marked down for a bench never seen.
  if (bench.length > 0 && !compositionOk) structure -= 0.15;
  structure -= Math.min(0.3, benchedBetter * 0.15);

  const sub = {
    captain: captain ? captainScore(captain) : 0,
    availability: avg(starters.map(availabilityScore)),
    form: avg(starters.map(formScore)),
    fixtures: avg(starters.map(fixtureScore)),
    structure: clamp01(structure),
    diversity: clamp01(1 - (maxPerClub - MAX_COMFORTABLE_PER_CLUB) / 5),
    value: avg([...starters, ...bench].map(valueScore)),
  };

  // Snapshot before rescaling, so the breakdown can report both what the squad
  // actually scored and what that became on the curve.
  const rawSub = { ...sub };

  // Rescale each dimension against what a perfect squad reaches, so full marks
  // means "as good as this competition allows" rather than "as good as
  // arithmetic allows". Dimensions a real squad can already max out -
  // availability, structure, diversity - have no ceiling entry and are left
  // alone.
  for (const key of Object.keys(sub) as (keyof typeof WEIGHTS)[]) {
    const ceiling = ACHIEVABLE[key];
    if (ceiling) {
      sub[key] = Math.pow(clamp01((sub[key] / ceiling) * PERFECTION_HEADROOM), RATING_CURVE);
    }
  }

  const squadAll = [...starters, ...bench];
  const applicable: Record<keyof typeof WEIGHTS, boolean> = {
    captain: true,
    availability: true,
    structure: true,
    diversity: true,
    form: starters.some((p) => p.form != null || p.points_per_game != null),
    fixtures: starters.some((p) => p.next_difficulty != null),
    value: squadAll.some((p) => p.price != null && p.points_per_game != null),
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
    // Pre-ceiling, pre-curve. Kept so the ceilings above can be re-measured
    // from a live response instead of being reverse-engineered from one.
    raw: Number(rawSub[k].toFixed(4)),
    applicable: applicable[k],
    // Points still on the table here, which is what closing the gap to the
    // target actually means in practice.
    shortfall: applicable[k] ? Math.round((1 - sub[k]) * WEIGHTS[k]) : 0,
  }));

  return { rating, breakdown, sub, shape, maxPerClub, perClub };
}

/** Hard cap on players from one club. See autofillSquad for why 3. */
const MAX_PER_CLUB = 3;

/** How much a bench place is worth against a starting one, for the search. */
const BENCH_WEIGHT = 0.25;

/** Per position, how deep into the ranking a swap will look. */
const CANDIDATES_PER_POSITION = 40;

/** Safety stop. The climb converges well inside this. */
const MAX_CLIMB_STEPS = 60;

/**
 * How many cheap options per position a paired move may sell down to.
 *
 * Only the cheapest handful matter: the point of the sale is to free money,
 * and a player who frees fifty pence does not unlock anything the single-swap
 * pass had not already found.
 */
const DOWNGRADE_DEPTH = 4;

/** How deep the paid-for half of a paired move looks. */
const PAIRED_UPGRADE_DEPTH = 12;

/**
 * Paired passes to attempt before giving up on further gains.
 *
 * These four numbers multiply: a pass costs squad x DOWNGRADE_DEPTH x squad x
 * PAIRED_UPGRADE_DEPTH full evaluations, and the first version of this ran
 * 168,000 of them and was killed by the worker's CPU limit. Kept deliberately
 * small - the paired pass exists to escape a local optimum the single swaps
 * cannot leave, and the first move out is worth far more than an exhaustive
 * search for the last one.
 */
const MAX_PAIRED_PASSES = 2;

/**
 * Build the strongest legal squad a budget allows.
 *
 * Not a knapsack solve, because the rating is not linear in the players picked
 * - captaincy, club spread and the bench all interact - so an exact solver
 * would be optimising a different function from the one that scores the
 * result. This is a cheapest-feasible start followed by hill climbing:
 * repeatedly make the single swap that gains the most and still fits.
 *
 * Starting cheap rather than starting with the best players is deliberate.
 * Beginning with the best fifteen puts the squad far over budget, and every
 * early move is then a downgrade forced by money rather than a real choice;
 * from the cheapest legal squad every move is an upgrade the budget allows,
 * and the squad is affordable at every step including the first.
 *
 * Three per club is applied as a hard rule. FPL enforces it, and even where a
 * competition does not, the diversity dimension of the rating penalises a
 * fourth - so three is the rating-optimal cap either way and does not depend
 * on getting the rulebook right.
 */
function autofillSquad(
  pool: Player[],
  budget: number,
  horizon: Horizon = "season",
  competition = "EPL",
) {
  const ev0 = (p: Player) => valueForHorizon(p, horizon);
  // No price means the player cannot be budgeted for, and someone who cannot
  // play is not worth a slot however good he is.
  const priced = pool.filter(
    (p) => p.price != null && p.price > 0 && availabilityScore(p) > 0,
  );

  const POSITIONS = ["GK", "DEF", "MID", "FWD"];
  const byPos: Record<string, Player[]> = {};
  for (const pos of POSITIONS) {
    byPos[pos] = priced
      .filter((p) => p.position === pos)
      .sort((a, b) => ev0(b) - ev0(a));
    if (byPos[pos].length < SQUAD_COMPOSITION[pos]) return null;
  }

  // expectedValue is called thousands of times below; compute each once.
  const cache = new Map(priced.map((p) => [p.id, ev0(p)] as const));
  const ev = (p: Player) => cache.get(p.id) ?? 0;

  /**
   * What the climb maximises.
   *
   * The XI carries almost all of the rating, so a bench place is worth having
   * but worth much less than a starting one. Weighting the fifteen equally
   * spends the budget on substitutes who never play.
   */
  const objective = (sq: Player[]) => {
    const best = optimiseXi(sq, ev);
    if (!best) return -Infinity;
    const starting = best.xi.reduce((t, p) => t + ev(p), 0);
    const benched = best.benchOut.reduce((t, p) => t + ev(p), 0);
    const cap = best.captain ? captaincyValue(best.captain) : 0;
    return starting + BENCH_WEIGHT * benched + 0.5 * cap;
  };

  // --- cheapest legal squad -------------------------------------------------
  const squad: Player[] = [];
  const owned = new Set<string>();
  const perClub: Record<string, number> = {};
  for (const pos of POSITIONS) {
    const cheapest = [...byPos[pos]].sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    let need = SQUAD_COMPOSITION[pos];
    for (const p of cheapest) {
      if (need === 0) break;
      if ((perClub[p.team] ?? 0) >= MAX_PER_CLUB) continue;
      squad.push(p);
      owned.add(p.id);
      perClub[p.team] = (perClub[p.team] ?? 0) + 1;
      need--;
    }
    if (need > 0) return null;
  }
  let spend = squad.reduce((t, p) => t + (p.price ?? 0), 0);
  // Every squad in the game is affordable, so this only trips if the pool is
  // broken - better to say so than to hand back something over budget.
  if (spend > budget) return null;

  /**
   * The real rating of a squad, as the manager will see it.
   *
   * The climb steers by `objective`, a cheap proxy summing expected value -
   * fast enough for the tens of thousands of trials below, but not the same
   * function as the rating. The paired pass proved the gap matters: it found a
   * squad the proxy preferred and the rating scored a point lower. So every
   * squad the search settles on is checked against the actual scorer, and the
   * best of those is what gets returned. Cheap, because it runs once per
   * accepted move rather than once per trial.
   */
  const ratingOf = (sq: Player[]) => {
    const xi = optimiseXi(sq, ev);
    return xi ? scoreSquad(xi.xi, xi.benchOut, xi.captain, competition).rating : -1;
  };

  let bestSquad = squad.slice();
  let bestRating = ratingOf(squad);
  const remember = () => {
    const r = ratingOf(squad);
    if (r > bestRating) {
      bestRating = r;
      bestSquad = squad.slice();
    }
  };

  // --- climb ----------------------------------------------------------------
  let score = objective(squad);
  for (let step = 0; step < MAX_CLIMB_STEPS; step++) {
    let move: { at: number; incoming: Player; gain: number } | null = null;

    for (let i = 0; i < squad.length; i++) {
      const outgoing = squad[i];
      for (const cand of byPos[outgoing.position].slice(0, CANDIDATES_PER_POSITION)) {
        if (owned.has(cand.id)) continue;
        if (spend - (outgoing.price ?? 0) + (cand.price ?? 0) > budget) continue;
        // Only a move to a different club can breach the cap.
        if (cand.team !== outgoing.team && (perClub[cand.team] ?? 0) >= MAX_PER_CLUB) continue;

        const trial = squad.slice();
        trial[i] = cand;
        const gain = objective(trial) - score;
        if (gain > 1e-9 && (!move || gain > move.gain)) {
          move = { at: i, incoming: cand, gain };
        }
      }
    }

    if (!move) break;
    const gone = squad[move.at];
    perClub[gone.team] -= 1;
    owned.delete(gone.id);
    squad[move.at] = move.incoming;
    perClub[move.incoming.team] = (perClub[move.incoming.team] ?? 0) + 1;
    owned.add(move.incoming.id);
    spend = spend - (gone.price ?? 0) + (move.incoming.price ?? 0);
    score += move.gain;
    remember();
  }

  // --- paired moves ------------------------------------------------------
  //
  // Single swaps stall as soon as the budget binds, which it always does: the
  // squad above finishes on exactly the budget, so every remaining upgrade is
  // one pound out of reach. The way out is to sell one player down and spend
  // what that frees on another, which no single swap can express - each half
  // is a loss on its own, and only the pair is an improvement.
  //
  // Bounded on both sides. The sold half only looks at the cheapest few in a
  // position, because freeing money is the entire point of it; the bought half
  // looks deeper, because that is where the gain comes from.
  const priceOf = (p: Player) => p.price ?? 0;
  const cheapestByPos: Record<string, Player[]> = {};
  for (const pos of POSITIONS) {
    cheapestByPos[pos] = [...byPos[pos]]
      .sort((a, b) => priceOf(a) - priceOf(b))
      .slice(0, DOWNGRADE_DEPTH);
  }

  for (let pass = 0; pass < MAX_PAIRED_PASSES; pass++) {
    let move: { sell: number; sellFor: Player; buy: number; buyFor: Player; gain: number } | null =
      null;

    for (let i = 0; i < squad.length; i++) {
      const out = squad[i];
      for (const down of cheapestByPos[out.position]) {
        if (down.id === out.id || owned.has(down.id)) continue;
        const freed = priceOf(out) - priceOf(down);
        // A sale that frees nothing cannot unlock a purchase the single-swap
        // pass had not already reached.
        if (freed <= 0) continue;

        for (let j = 0; j < squad.length; j++) {
          if (j === i) continue;
          const sold = squad[j];
          for (const up of byPos[sold.position].slice(0, PAIRED_UPGRADE_DEPTH)) {
            if (up.id === down.id || owned.has(up.id)) continue;
            const spendAfter = spend - priceOf(out) + priceOf(down) - priceOf(sold) + priceOf(up);
            if (spendAfter > budget) continue;

            // Club cap across both halves at once: the sale can itself free a
            // slot the purchase needs.
            const after: Record<string, number> = { ...perClub };
            after[out.team] -= 1;
            after[down.team] = (after[down.team] ?? 0) + 1;
            after[sold.team] -= 1;
            after[up.team] = (after[up.team] ?? 0) + 1;
            if (Object.values(after).some((n) => n > MAX_PER_CLUB)) continue;

            const trial = squad.slice();
            trial[i] = down;
            trial[j] = up;
            const gain = objective(trial) - score;
            if (gain > 1e-9 && (!move || gain > move.gain)) {
              move = { sell: i, sellFor: down, buy: j, buyFor: up, gain };
            }
          }
        }
      }
    }

    if (!move) break;
    for (const [at, incoming] of [
      [move.sell, move.sellFor],
      [move.buy, move.buyFor],
    ] as [number, Player][]) {
      const gone = squad[at];
      perClub[gone.team] -= 1;
      owned.delete(gone.id);
      squad[at] = incoming;
      perClub[incoming.team] = (perClub[incoming.team] ?? 0) + 1;
      owned.add(incoming.id);
      spend = spend - priceOf(gone) + priceOf(incoming);
    }
    score += move.gain;
    remember();
  }

  const best = optimiseXi(bestSquad, ev);
  if (!best) return null;
  return {
    xi: best.xi,
    bench: best.benchOut,
    captain: best.captain,
    formation: best.shape,
    spend: Number(bestSquad.reduce((t, p) => t + (p.price ?? 0), 0).toFixed(1)),
  };
}

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
      chip: rawChip = null,
      usedChips: rawUsedChips = [],
      mode: rawMode = "rate",
      horizon: rawHorizon = "season",
      skipNarrative: rawSkipNarrative = false,
    } = await req.json();

    // Credits gate the Champions League product only. The Premier League
    // version is free for now, so it asks for everything and pays nothing.
    const competition = ["UCL", "EPL"].includes(String(rawCompetition))
      ? String(rawCompetition)
      : "UCL";
    const FREE_COMPETITIONS = new Set(["EPL"]);
    const isFree = FREE_COMPETITIONS.has(competition);

    // The chip a manager plans to play this round, if any. It changes what the
    // advice should say: with Bench Boost the bench stops being a reserve and
    // becomes four more scorers.
    const allChips = CHIPS_BY_COMPETITION[competition] ?? [];
    // A chip already spent cannot be played again, so it is removed from both
    // what can be planned and what can be recommended.
    const usedChips = (Array.isArray(rawUsedChips) ? rawUsedChips : [])
      .map(String)
      .filter((c) => allChips.includes(c));
    const remainingChips = allChips.filter((c) => !usedChips.includes(c));
    const plannedChip = rawChip && remainingChips.includes(String(rawChip))
      ? String(rawChip)
      : null;

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

    // ------------------------------------------------------------ autofill ---
    // Build a squad from nothing. Answered before the squad parsing below,
    // which exists to validate a squad this request does not have.
    //
    // Priced like the optimiser on the Champions League side, free on the
    // Premier League side, matching everything else in this function.
    //
    // Charged after the squad is built, never before. Paying for something the
    // server then fails to produce is the one billing mistake worth designing
    // against: if the pool cannot yield a legal squad the caller is told so and
    // keeps their credit.
    if (rawMode === "autofill") {
      const { data: poolRows, error: poolError } = await supabase
        .from("ucl_players")
        .select(PLAYER_FIELDS)
        .eq("competition", competition)
        .not("price", "is", null);
      if (poolError) throw new Error(`player pool lookup failed: ${poolError.message}`);

      // supabase-js widens a string select to GenericStringError[]; the same
      // double cast the other player reads in this file use.
      // "season" builds the squad to hold; "gameweek" builds the one that scores
      // most in the round about to be played, which is a different squad - it
      // will happily buy a modest player with the easiest fixture of the week.
      const horizon: Horizon = rawHorizon === "gameweek" ? "gameweek" : "season";
      const filled = autofillSquad(
        (poolRows ?? []) as unknown as Player[],
        SQUAD_BUDGET,
        horizon,
        competition,
      );
      if (!filled) {
        return new Response(
          JSON.stringify({ error: "not enough priced players to build a squad yet" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      let autofillCredits: number | null = null;
      if (!isFree) {
        if (!userId || !token) {
          return new Response(
            JSON.stringify({ error: "sign_in_required", cost: UNLOCK_PRICES.autofill }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        // Spent as the caller, so spend_credits' own auth.uid() guard applies
        // and this cannot be aimed at somebody else's wallet.
        const asUser = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_ANON_KEY") ?? "",
          { global: { headers: { Authorization: `Bearer ${token}` } } },
        );
        const { data: newBalance, error: spendError } = await asUser.rpc("spend_credits", {
          p_amount: UNLOCK_PRICES.autofill,
          p_reason: "ucl_autofill",
          p_metadata: { competition },
        });
        if (spendError) throw new Error(`credit spend failed: ${spendError.message}`);
        if (typeof newBalance !== "number" || newBalance < 0) {
          return new Response(
            JSON.stringify({ error: "insufficient_credits", cost: UNLOCK_PRICES.autofill }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        autofillCredits = newBalance;
      }

      // Which round this squad is aimed at, so the UI can name it rather than
      // saying "the upcoming week" and leaving the manager to guess.
      const { data: autofillGw } = await supabase.rpc("target_gameweek", {
        p_competition: competition,
      });

      const scored = scoreSquad(filled.xi, filled.bench, filled.captain, competition);
      // The vice is the next best captain in the XI, so a late withdrawal does
      // not fall to whoever happens to sort first.
      const vice = [...filled.xi]
        .filter((p) => p.id !== filled.captain?.id)
        .sort((a, b) => captaincyValue(b) - captaincyValue(a))[0] ?? null;
      const toSlot = (p: Player) => ({
        player_id: p.id,
        name: p.name,
        display_name: p.display_name,
        team: p.team,
        position: p.position,
        price: p.price,
        availability: p.availability,
        availability_note: p.availability_note,
        is_captain: p.id === filled.captain?.id,
        is_vice: p.id === vice?.id,
      });

      return new Response(
        JSON.stringify({
          squad: {
            formation: filled.formation,
            starters: filled.xi.map(toSlot),
            bench: filled.bench.map(toSlot),
          },
          rating: scored.rating,
          breakdown: scored.breakdown,
          spend: filled.spend,
          budget: SQUAD_BUDGET,
          horizon,
          target_gameweek: autofillGw ?? null,
          cost: isFree ? 0 : UNLOCK_PRICES.autofill,
          credits_remaining: autofillCredits,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

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

    const { data: rows, error } = await supabase
      .from("ucl_players")
      .select(PLAYER_FIELDS)
      .eq("competition", competition)
      .in("id", [...starterIds, ...benchIds]);
    if (error) throw new Error(`player lookup failed: ${error.message}`);

    const byId = new Map<string, Player>((rows ?? []).map((p: Player) => [p.id, p]));
    const starters = starterIds.map((id) => byId.get(id)).filter((p): p is Player => !!p);
    const bench = benchIds.map((id) => byId.get(id)).filter((p): p is Player => !!p);
    if (starters.length === 0) throw new Error("none of the starter ids matched a known player");

    const captain = captainId ? byId.get(captainId) ?? null : null;

    // ------------------------------------------------------------ scoring ---
    const scored = scoreSquad(starters, bench, captain, competition);
    const { rating, breakdown, shape, maxPerClub, perClub } = scored;

    // ---------------------------------------------------- optimise the XI ---
    // Pure re-arrangement of the 15 players already owned: no transfers, no
    // budget, so it works today even with zero price data. Deterministic — the
    // same squad always yields the same optimal XI.
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
      const chips = remainingChips;
      if (chips.length === 0 && !plannedChip) {
        return { chip: null, urgency: "none", available: [],
          reason: "You have used every chip — this round comes down to transfers." };
      }

      // If the manager has already picked one, judge that choice rather than
      // proposing a different one they did not ask about.
      if (plannedChip) {
        const benchFit = bench.filter((p) => availabilityScore(p) === 1).length;
        if (plannedChip === "Bench Boost") {
          return benchFit === bench.length && bench.length > 0
            ? { chip: plannedChip, urgency: "medium", planned: true,
                reason: "Your whole bench is fit, so every one of them would score." }
            : { chip: plannedChip, urgency: "high", planned: true,
                reason: `Only ${benchFit} of ${bench.length} bench players are fit — you would be boosting blanks.` };
        }
        if (plannedChip === "Triple Captain" && captain) {
          const soft = (captain.next_difficulty ?? 5) <= 2;
          return { chip: plannedChip, urgency: soft ? "medium" : "high", planned: true,
            reason: soft
              ? `${captain.name} faces a soft fixture — a good week to triple.`
              : `${captain.name} faces a difficult fixture; tripling him is a gamble.` };
        }
        return { chip: plannedChip, urgency: "medium", planned: true,
          reason: `You plan to play ${plannedChip} this round.`, available: chips };
      }
      const holdText = `Hold your chips — nothing this ${competition === "EPL" ? "gameweek" : "matchday"} justifies one.`;

      // A broken squad is a Wildcard case in both games.
      if (unavailableStarters >= 4) {
        if (chips.includes("Wildcard")) return { chip: "Wildcard", urgency: "high",
          reason: `${unavailableStarters} of your XI cannot play — too many to fix with normal transfers.` };
      }

      if (competition === "EPL") {
        // Triple Captain wants one standout on an easy fixture, not a good squad.
        if (captain && (captain.next_difficulty ?? 5) <= 2 && (captain.form ?? 0) >= 6) {
          if (chips.includes("Triple Captain")) return { chip: "Triple Captain", urgency: "medium",
            reason: `${captain.name} is in form against a soft fixture — the best week to triple him.` };
        }
        // Bench Boost pays only when the bench itself is playable.
        const benchPlayable = bench.filter(
          (p) => availabilityScore(p) === 1 && (p.next_difficulty ?? 5) <= 3,
        ).length;
        if (bench.length >= 4 && benchPlayable === bench.length) {
          if (chips.includes("Bench Boost")) return { chip: "Bench Boost", urgency: "medium",
            reason: "Your whole bench is fit with a kind fixture — their points would all count." };
        }
        if (hardFixtures >= 8) {
          if (chips.includes("Free Hit")) return { chip: "Free Hit", urgency: "medium",
            reason: `${hardFixtures} of your XI face a hard fixture; a one-week rebuild may beat taking hits.` };
        }
      } else if (hardFixtures >= 7) {
        if (chips.includes("Limitless")) return { chip: "Limitless", urgency: "medium",
          reason: `${hardFixtures} of your XI face a top-tier opponent; a one-matchday reshape may pay.` };
      }

      if (unavailableStarters >= 2) {
        if (chips.includes("Wildcard")) return { chip: "Wildcard", urgency: "medium",
          reason: `${unavailableStarters} unavailable starters is more than a free transfer can cover.` };
      }
      return { chip: null, urgency: "none", reason: holdText, available: chips };
    })();

    // -------------------------------------------------- transfer shortlist ---
    // Candidates are ranked by the SAME expected value the optimiser uses, not
    // by the raw form column. Ordering by raw form was the reason suggestions
    // looked arbitrary: it surfaced whoever had spiked over two games, which is
    // the exact small-sample noise the scoring elsewhere was corrected for.
    //
    // A transfer is only proposed when the replacement is meaningfully better
    // than the incumbent. Filling a fixed quota means recommending sideways
    // moves that cost a manager a hit for nothing.
    const UPGRADE_MARGIN = 0.06;

    const weakest = [...starters]
      .map((p) => ({ p, s: expectedValue(p) }))
      .sort((a, b) => a.s - b.s)
      .slice(0, MAX_TRANSFERS);

    // Money available if this player is sold: their price plus whatever the
    // squad has not spent. Without prices the budget is simply not applied.
    const squadSpend = [...starters, ...bench].reduce((t, p) => t + (p.price ?? 0), 0);
    const anyPriced = [...starters, ...bench].some((p) => p.price != null);
    const bank = anyPriced ? Math.max(0, SQUAD_BUDGET - squadSpend) : null;

    const candidates: Record<string, { player: Player; gain: number; pointsGain: number }[]> = {};

    // Squad make-up, so a suggestion cannot propose a fourth player from a club
    // that already has three. The rule applies to advice exactly as it applies
    // to the builder - recommending a transfer the game will refuse is worse
    // than recommending nothing.
    const squadPerClub = [...starters, ...bench].reduce<Record<string, number>>((acc, pl) => {
      acc[pl.team] = (acc[pl.team] ?? 0) + 1;
      return acc;
    }, {});

    /** Whether bringing `incoming` in for `outgoing` keeps the club cap. */
    const swapKeepsClubCap = (incoming: Player, outgoing: Player) => {
      // Selling from the same club frees the slot the purchase would take.
      const freed = incoming.team === outgoing.team ? 1 : 0;
      return (squadPerClub[incoming.team] ?? 0) - freed < MAX_PER_CLUB;
    };

    for (const { p, s: incumbentScore } of weakest) {
      let q = supabase
        .from("ucl_players")
        .select(PLAYER_FIELDS)
        .eq("competition", competition)
        .eq("position", p.position)
        .eq("availability", "available")
        .not("id", "in", `(${[...starterIds, ...benchIds].join(",")})`);

      if (p.price != null && bank != null) {
        q = q.lte("price", Number((p.price + bank).toFixed(1)));
      }

      // Pull a wide net on a stable measure, then rank it properly in code.
      // Ordering the query itself by form would pre-filter on the noisy signal
      // before the real ranking ever sees the alternatives.
      const { data: alts } = await q
        .order("total_points", { ascending: false, nullsFirst: false })
        .limit(40);

      // Two measures of the same swap. `gain` is the score-space difference
      // the rating is calibrated on and still decides what qualifies as an
      // upgrade at all; `pointsGain` is that difference in points, which is
      // what a manager is deciding about and what gets shown.
      //
      // Ordered by points, because a shortlist ranked on one number and
      // presented with another invites exactly the mismatch that put a
      // Recommended badge on a transfer the write-up argued against.
      const incumbentPoints = projectedPoints(p);
      candidates[p.id] = ((alts ?? []) as Player[])
        .filter((c) => swapKeepsClubCap(c, p))
        .map((c) => ({
          player: c,
          gain: expectedValue(c) - incumbentScore,
          pointsGain: Number((projectedPoints(c) - incumbentPoints).toFixed(1)),
        }))
        .filter((c) => c.gain >= UPGRADE_MARGIN)
        .sort((a, b) => b.pointsGain - a.pointsGain || b.gain - a.gain)
        .slice(0, 5);
    }

    // ---------------------------------------------------------- projection ---
    // What the score becomes if the manager acts on this. Computed by running
    // the improved squad through the same scorer, never asserted by the model:
    // a projection the model invents is a number nobody can check.
    const TARGET_RATING = 90;

    const optimisedStarters = optimised?.xi ?? starters;
    const optimisedBench = optimised?.benchOut ?? bench;
    const optimisedCaptain = optimised?.captain ?? captain;

    // Apply the transfers on top of the optimised XI, best upgrade first.
    const swaps = Object.entries(candidates)
      .filter(([, alts]) => alts.length > 0)
      .map(([outId, alts]) => ({ outId, incoming: alts[0].player, gain: alts[0].gain }))
      .sort((a, b) => b.gain - a.gain);

    const applySwaps = (list: Player[]) =>
      list.map((p) => {
        const swap = swaps.find((sw) => sw.outId === p.id);
        return swap ? swap.incoming : p;
      });

    const projectedStarters = applySwaps(optimisedStarters);
    const projectedBench = applySwaps(optimisedBench);
    const projectedCaptain =
      projectedStarters.find((p) => p.id === optimisedCaptain?.id) ??
      [...projectedStarters].sort((a, b) => captaincyValue(b) - captaincyValue(a))[0] ?? null;

    const projected = scoreSquad(
      projectedStarters,
      projectedBench,
      projectedCaptain,
      competition,
    );

    // ------------------------------------------------------- data freshness ---
    // Nothing here is fetched live: the rating reads the pool the sync last
    // wrote. Prices and returns barely move between syncs, but availability
    // does - a player ruled out at a Friday press conference is exactly the
    // input that turns a captaincy to zero - so the age of the data is stated
    // rather than left to be assumed current.
    const dataAsOf = [...starters, ...bench]
      .map((pl) => pl.updated_at)
      .filter((d): d is string => Boolean(d))
      .sort()
      .pop() ?? null;

    // -------------------------------------------------- projected points ---
    const projections: Record<string, number> = {};
    for (const pl of [...starters, ...bench]) projections[pl.id] = projectedPoints(pl);

    // The captain scores twice, so the squad total has to say so - a projection
    // that ignored the armband would understate every squad by a player.
    const projectedTotal = Number(
      starters
        .reduce((t, pl) => t + projections[pl.id] * (pl.id === captain?.id ? 2 : 1), 0)
        .toFixed(1),
    );

    // ----------------------------------------------------------- narrative ---
    // The model call is six of the seven seconds a request takes. Unlocking a
    // panel re-runs the whole analysis, so a manager who has already read the
    // write-up waits six seconds to be handed the same prose about the same
    // squad - nothing changed but how much of it they have paid to see.
    //
    // Only skippable when no transfers are wanted, because the same call
    // produces the transfer shortlist: skipping it after paying for transfers
    // would return nothing for them.
    const reuseNarrative = rawSkipNarrative === true && transferCount === 0;

    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    let narrative: Record<string, unknown> | null = null;
    let suggestions: unknown[] = [];

    if (apiKey && !reuseNarrative) {
      const brief = {
        rating,
        target_rating: TARGET_RATING,
        // Points still available in each dimension, largest first: this is
        // where a squad actually gains ground toward the target.
        biggest_losses: [...breakdown]
          .filter((b) => b.applicable && b.shortfall > 0)
          .sort((a, b) => b.shortfall - a.shortfall)
          .slice(0, 3)
          .map((b) => ({ area: b.key, points_lost: b.shortfall, of: b.max })),
        projected_rating_if_followed: projected.rating,
        breakdown,
        dimensions_without_data: breakdown.filter((x) => !x.applicable).map((x) => x.key),
        formation: shape,
        club_concentration: { max_from_one_club: maxPerClub, by_club: perClub },
        projected_points: projectedTotal,
        chip_advice: chipAdvice,
        best_captain_options: captainRanking,
        captain: captain ? { name: captain.name, team: captain.team, form: captain.form } : null,
        starters: starters.map((p) => ({
          name: p.name, team: p.team, position: p.position, price: p.price,
          form: p.form, availability: p.availability, next: p.next_opponent,
          difficulty: p.next_difficulty,
        })),
        bench: bench.map((p) => ({ name: p.name, position: p.position, form: p.form })),
        transfer_options: Object.entries(candidates)
          .filter(([, alts]) => alts.length > 0)
          .map(([outId, alts]) => {
            const out = byId.get(outId);
            return {
              out: out?.name,
              out_stats: out
                ? {
                    price: out.price, points: out.total_points,
                    per_game: out.points_per_game, starts: out.starts,
                    next: out.next_opponent, difficulty: out.next_difficulty,
                  }
                : null,
              options: alts.map(({ player: a, gain, pointsGain }) => ({
                name: a.name, team: a.team, price: a.price,
                points: a.total_points, per_game: a.points_per_game,
                starts: a.starts, next: a.next_opponent,
                difficulty: a.next_difficulty,
                // How much better this player is than the one being replaced.
                upgrade: Number(gain.toFixed(3)),
                // The same thing in points, and the only figure the write-up
                // may quote. Left to work it out from the per-game averages,
                // the model produced its own number and contradicted the one
                // on the badge beside it - it said "about 4.5 points more"
                // under a badge reading +7.2, because a difference in raw
                // averages is not a difference in expected points once
                // shrinkage, fixture and minutes are applied.
                points_gain: pointsGain,
              })),
            };
          }),
      };

      const langName = { en: "English", fr: "French", es: "Spanish", ht: "Haitian Creole" }[
        language as string
      ] ?? "English";

      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "openai/gpt-5.6-sol",
          messages: [
            {
              role: "system",
              content:
                `You are a UEFA Champions League Fantasy analyst writing in ${langName}. ` +
                "The rating and breakdown are already final — never dispute or restate a different number. " +
                "If you give a figure for how much a transfer gains, use the option's " +
                "points_gain verbatim and never the upgrade score or a number you " +
                "worked out yourself from the per-game averages: those averages are " +
                "raw, points_gain already accounts for sample size, fixture and " +
                "minutes, and a figure of your own will contradict the one shown " +
                "beside your sentence. Saying nothing numeric is fine. " +
                "Write each transfer reason as the case for it. If the honest case needs a " +
                "concession — the incoming player returning less so far, a thinner sample — say " +
                "so plainly and let it read as the trade-off it is, rather than arguing for and " +
                "against in one sentence. Whether a suggestion is labelled recommended is " +
                "decided from the numbers after you write, not by you. " +
                `The goal is to get this squad above ${TARGET_RATING} out of 100. Use biggest_losses ` +
                "to say plainly where the points are going and what would recover them, and " +
                "projected_rating_if_followed as the honest outcome of taking this advice - do " +
                "not promise a different number. Not every squad can reach the target; say so " +
                "rather than overstating what a transfer can do. " +
                "Any dimension listed in dimensions_without_data scored zero ONLY because the season has " +
                "not started and that data does not exist yet. Never treat it as a weakness, never say the " +
                "manager is overpaying or out of form because of it, and do not mention it at all. " +
                "Explain what the squad does well and what costs it points, then recommend transfers " +
                "ONLY from the supplied transfer_options. Each option carries an `upgrade` score " +
                "and both players' points, per-game rate, starts and fixture: justify every " +
                "recommendation from those numbers, and never claim a player is in form when " +
                "his per_game and starts say otherwise. Give up to five suggestions, ordered by " +
                "how much they improve the squad, and recommend fewer or none rather than " +
                "padding the list. Return raw JSON, no markdown fences: " +
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
            const raw = Array.isArray(parsed?.suggestions) ? parsed.suggestions : [];

            // The model picks and explains; the ranking stays ours. Each
            // suggestion is matched back to the candidate it names so the
            // measured upgrade travels with it, rather than trusting a
            // priority label the model assigned itself.
    /**
     * Whether the plain numbers back the swap.
     *
     * expectedValue blends availability, form and fixture, so a modest player
     * with an easy draw can clear the upgrade threshold while returning less
     * than the player he replaces. The model then writes an honest sentence
     * that argues against its own suggestion - "although his 9 points and 4.5
     * per game are well below the other's 20 and 10" - under a Recommended
     * badge.
     *
     * A recommendation is a statement of confidence. When the returns say the
     * opposite it is still a legitimate suggestion, driven by the fixture, and
     * it is still shown - it just is not recommended.
     */
    const returnsSupportSwap = (incoming: Player, outgoing: Player): boolean => {
      const inRate = incoming.points_per_game;
      const outRate = outgoing.points_per_game;
      // Per appearance where both have played, since a total rewards whoever
      // has had more rounds rather than whoever is better.
      if (inRate != null && outRate != null) return inRate >= outRate;
      return incoming.total_points >= outgoing.total_points;
    };

    // Squad make-up as the suggestion list is walked, so the set stays legal
    // taken together and not merely one at a time.
    const runningPerClub: Record<string, number> = { ...squadPerClub };

    /** Look up the two players behind a suggestion the model phrased itself. */
    const playersFor = (outName: string, inName: string) => {
      for (const [outId, alts] of Object.entries(candidates)) {
        const out = byId.get(outId);
        if (!out || !String(outName ?? "").includes(out.name.split(" ").pop() ?? "")) continue;
        const hit = alts.find((a) =>
          String(inName ?? "").includes(a.player.name.split(" ").pop() ?? "")
        );
        if (hit) return { out, incoming: hit.player };
      }
      return null;
    };

    /** The same match-up, in points. */
    const pointsGainFor = (outName: string, inName: string): number | null => {
      for (const [outId, alts] of Object.entries(candidates)) {
        const out = byId.get(outId);
        if (!out || !String(outName ?? "").includes(out.name.split(" ").pop() ?? "")) continue;
        const hit = alts.find((a) =>
          String(inName ?? "").includes(a.player.name.split(" ").pop() ?? "")
        );
        if (hit) return hit.pointsGain;
      }
      return null;
    };

            const gainFor = (outName: string, inName: string): number | null => {
              for (const [outId, alts] of Object.entries(candidates)) {
                const out = byId.get(outId);
                if (!out || !String(outName ?? "").includes(out.name.split(" ").pop() ?? "")) continue;
                const hit = alts.find((a) =>
                  String(inName ?? "").includes(a.player.name.split(" ").pop() ?? "")
                );
                if (hit) return hit.gain;
              }
              return null;
            };

            suggestions = raw
              .map((sg: Record<string, unknown>) => ({
                ...sg,
                upgrade: gainFor(String(sg.out ?? ""), String(sg.in ?? "")),
                points_gain: pointsGainFor(String(sg.out ?? ""), String(sg.in ?? "")),
              }))
              .sort((a: Record<string, unknown>, c: Record<string, unknown>) =>
                Number(c.upgrade ?? 0) - Number(a.upgrade ?? 0)
              )
              // Each suggestion is checked against the squad, but a manager
              // reads the list top down and may take several. Three separately
              // legal moves can still be three players from one club, so the
              // list is walked in order against a running tally and anything
              // that would break the cap by then is dropped. Advice that is
              // only legal if you stop halfway is not advice.
              .filter((sg: Record<string, unknown>) => {
                const pair = playersFor(String(sg.out ?? ""), String(sg.in ?? ""));
                if (!pair) return true;
                const { incoming, out } = pair;
                const freed = incoming.team === out.team ? 1 : 0;
                if ((runningPerClub[incoming.team] ?? 0) - freed >= MAX_PER_CLUB) return false;
                runningPerClub[out.team] = (runningPerClub[out.team] ?? 1) - 1;
                runningPerClub[incoming.team] = (runningPerClub[incoming.team] ?? 0) + 1;
                return true;
              })
              .map((sg: Record<string, unknown>, i: number) => {
                const pair = playersFor(String(sg.out ?? ""), String(sg.in ?? ""));
                return {
                  ...sg,
                  // Top two, a gain clear enough to be worth acting on, and the
                  // plain numbers not pointing the other way. A marginal
                  // upgrade badged "recommended" is how a manager gets talked
                  // into a pointless hit; one the write-up itself argues
                  // against is worse, because it teaches them not to trust the
                  // badge at all.
                  recommended:
                    i < 2 &&
                    Number(sg.upgrade ?? 0) >= STRONG_UPGRADE &&
                    Number(sg.points_gain ?? 0) >= MIN_RECOMMENDED_POINTS &&
                    (pair ? returnsSupportSwap(pair.incoming, pair.out) : false),
                };
              });
          } catch {
            console.error("narrative JSON parse failed");
          }
        }
      } else {
        console.error(`narrative call failed: ${res.status}`);
      }
    }

    // The round every player was rated against, so the UI can name it and a
    // manager knows the advice is about a week they can still act on.
    const { data: targetGw } = await supabase.rpc("target_gameweek", {
      p_competition: competition,
    });

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
        // Per player, so the pitch can label each card, plus the XI total with
        // the armband counted twice - which is what a manager actually scores.
        projections,
        projected_points: projectedTotal,
        data_as_of: dataAsOf,
        target_rating: TARGET_RATING,
        // Where the score lands if the optimised XI and the transfers are taken.
        projected_rating: projected.rating,
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
        target_gameweek: targetGw ?? null,
        planned_chip: plannedChip,
        chips_available: remainingChips,
        chips_used: usedChips,
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
