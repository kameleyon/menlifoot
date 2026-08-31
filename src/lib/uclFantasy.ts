// Client helpers for the UCL Fantasy squad rater.
//
// Prices are null until the UEFA fantasy game opens (days before matchday 1),
// so every price is optional here on purpose — the UI must degrade rather than
// render a misleading 0.

import { supabase } from '@/integrations/supabase/client';

export type Position = 'GK' | 'DEF' | 'MID' | 'FWD';

/** The two products share this entire module; only the data is scoped. */
export type Competition = 'UCL' | 'EPL';

/** Premier League analysis is free for now; the UCL one is credit-gated. */
export const isFreeCompetition = (c: Competition) => c === 'EPL';

/**
 * The chips each game actually has. Bench Boost, Free Hit and Triple Captain
 * are Fantasy Premier League chips; the UCL game has Limitless instead.
 * Confirmed against the FPL feed, which lists wildcard/freehit/bboost/3xc.
 */
export const CHIPS_BY_COMPETITION: Record<Competition, string[]> = {
  UCL: ['Wildcard', 'Limitless'],
  EPL: ['Wildcard', 'Free Hit', 'Bench Boost', 'Triple Captain'],
};

export const COMPETITION_LABEL: Record<Competition, string> = {
  UCL: 'Champions League',
  EPL: 'Premier League',
};

export interface UclPlayer {
  id: string;
  photo_url: string | null;
  name: string;
  display_name: string;
  team: string;
  team_code: string | null;
  position: Position;
  price: number | null;
  total_points: number;
  form: number | null;
  points_per_game: number | null;
  ict_index: number | null;
  availability: string;
  availability_note: string | null;
  next_opponent: string | null;
  next_difficulty: number | null;
}

export interface SquadSlot {
  player_id: string | null;
  photo_url?: string | null;
  availability?: string | null;
  availability_note?: string | null;
  read_as?: string;
  name?: string;
  display_name?: string;
  team?: string;
  team_code?: string | null;
  position?: Position | null;
  price?: number | null;
  is_captain?: boolean;
  is_vice?: boolean;
  /** Points this player is expected to return in his next match. */
  projected_points?: number | null;
  on_bench?: boolean;
}

export interface Squad {
  formation?: string | null;
  starters: SquadSlot[];
  bench: SquadSlot[];
}

export interface ParseResult extends Squad {
  unresolved: string[];
  needs_review: boolean;
}

export interface SubScore {
  key: 'captain' | 'availability' | 'form' | 'fixtures' | 'structure' | 'diversity' | 'value';
  earned: number;
  max: number;
  ratio: number;
  /** Points still available in this dimension. */
  shortfall?: number;
  /** False when the season has not produced this data yet (form, price, fixtures). */
  applicable: boolean;
}

export interface Suggestion {
  out: string;
  in: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  /** Measured improvement over the player being replaced, 0-1. */
  upgrade?: number | null;
  /** The same improvement in expected points, which is what gets shown. */
  points_gain?: number | null;
  /** True only for the clearest upgrades, so the badge stays meaningful. */
  recommended?: boolean;
}

export interface CaptainOption {
  player_id: string;
  name: string;
  team: string;
  next_opponent: string | null;
  next_difficulty: number | null;
  form: number | null;
  is_current: boolean;
}

export interface ChipAdvice {
  /** UCL has Wildcard and Limitless; FPL adds Free Hit, Bench Boost, Triple Captain. */
  chip: string | null;
  urgency: 'high' | 'medium' | 'none';
  reason: string;
  /** True when this judges a chip the manager chose, rather than proposing one. */
  planned?: boolean;
}

export interface Optimisation {
  formation: string;
  starters: SquadSlot[];
  bench: SquadSlot[];
  captain: { player_id: string; name: string } | null;
  improvement: number;
  changes_needed: boolean;
}

export type Unlockable = 'optimisation' | 'captains' | 'chips';

export interface UnlockPrices {
  optimisation: number;
  captains: number;
  chips: number;
  transfers: number;
  max_transfers: number;
}

/** What exists but has not been paid for. Never carries the data itself. */
export interface LockedState {
  optimisation: boolean;
  captains: boolean;
  chips: boolean;
  /** How many further transfer suggestions are available to buy. */
  transfers: number;
}

export interface RatingResult {
  /** Expected points per player, keyed by player_id. */
  projections?: Record<string, number>;
  /** Expected points for the XI, counting the captain twice. */
  projected_points?: number | null;
  competition?: Competition;
  free?: boolean;
  planned_chip?: string | null;
  chips_available?: string[];
  chips_used?: string[];
  /** The round every player was rated against. */
  target_gameweek?: number | null;
  /** The score we are aiming to get a squad above. */
  target_rating?: number;
  /** Where the score lands if the optimiser and transfers are acted on. */
  projected_rating?: number;
  id: string | null;
  rating: number;
  formation: string;
  breakdown: SubScore[];
  narrative: { verdict?: string; strengths?: string[]; weaknesses?: string[] } | null;
  suggestions: Suggestion[];
  optimisation: Optimisation | null;
  captain_ranking: CaptainOption[];
  chip_advice: ChipAdvice | null;
  locked: LockedState;
  prices: UnlockPrices;
  credits_remaining: number | null;
}

/** Thrown when a paid action cannot proceed, so the UI can react precisely. */
export class CreditError extends Error {
  constructor(
    public kind: 'sign_in_required' | 'insufficient_credits',
    public cost: number,
  ) {
    super(kind);
  }
}

export interface Fixture {
  id: string;
  matchday: number;
  kickoff: string | null;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  status: 'scheduled' | 'live' | 'finished' | 'postponed';
}

export interface Matchday {
  matchday: number;
  deadline: string | null;
  starts_on: string | null;
  ends_on: string | null;
}

export interface UclTeam {
  name: string;
  code: string | null;
  strength: number;
  logo_url: string | null;
  elo_rating: number | null;
}

export interface BestPick {
  goals?: number | null;
  assists?: number | null;
  minutes?: number | null;
  id: string;
  name: string;
  display_name: string;
  team: string;
  position: Position;
  price: number | null;
  form: number | null;
  next_opponent: string | null;
  next_difficulty: number | null;
  jersey_number: number | null;
  clean_sheet_rate: number | null;
  avg_goals_scored: number | null;
  score: number;
  rank_in_position: number;
}

/**
 * Best players to own for the upcoming matchday, ranked per position.
 * Computed in Postgres, so opening the panel costs nothing and is instant.
 */
export const BEST_PICKS_PRICE = 2;

export interface BestPicksResult {
  picks: Record<Position, BestPick[]>;
  /** False while the schedule is unpublished, so the UI can say what it ranked on. */
  fixtures_known: boolean;
  /** The round this advice is for, so the panel never says a vague "this matchday". */
  gameweek: number | null;
  deadline: string | null;
  credits_remaining: number | null;
}

export const getBestPicks = async (
  perPosition = 3,
  competition: Competition = 'UCL',
): Promise<BestPicksResult> => {
  const { data, error } = await supabase.functions.invoke('ucl-best-picks', {
    body: { perPosition, competition },
  });
  const payload = data as { error?: string; cost?: number } | null;
  const reason = payload?.error;
  if (reason === 'sign_in_required' || reason === 'insufficient_credits') {
    throw new CreditError(reason, payload?.cost ?? BEST_PICKS_PRICE);
  }
  if (error) throw new Error(error.message);
  if (reason) throw new Error(reason);
  const grouped = (data as { picks?: Record<string, BestPick[]> })?.picks ?? {};
  return {
    picks: {
      GK: grouped.GK ?? [],
      DEF: grouped.DEF ?? [],
      MID: grouped.MID ?? [],
      FWD: grouped.FWD ?? [],
    },
    fixtures_known: Boolean((data as { fixtures_known?: boolean })?.fixtures_known),
    gameweek: (data as { gameweek?: number })?.gameweek ?? null,
    deadline: (data as { deadline?: string })?.deadline ?? null,
    credits_remaining: (data as { credits_remaining?: number })?.credits_remaining ?? null,
  };
};

/** Current wallet balance, or null when signed out. */
export const getCreditBalance = async (): Promise<number | null> => {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return null;
  const { data } = await (supabase as any)
    .from('user_credits')
    .select('balance')
    .eq('user_id', auth.user.id)
    .maybeSingle();
  return (data as { balance?: number } | null)?.balance ?? 0;
};

/** Start a Stripe checkout for a credit pack; returns the URL to send them to. */
export const startTopUp = async (pack: 'starter' | 'plus' | 'pro' = 'starter') => {
  const { data, error } = await supabase.functions.invoke('ucl-credits-checkout', {
    body: { pack, returnUrl: `${window.location.origin}/fantasy` },
  });
  const payload = data as { error?: string; url?: string } | null;
  if (payload?.error === 'sign_in_required') throw new CreditError('sign_in_required', 0);
  if (error) throw new Error(error.message);
  if (!payload?.url) throw new Error(payload?.error ?? 'checkout failed');
  return payload.url;
};

/** Club crests, keyed by club name. The provider covers ~2/3 of the field. */
export const getTeamCrests = async (
  competition: Competition = 'UCL',
): Promise<Record<string, string>> => {
  const { data } = await (supabase as any)
    .from('ucl_teams')
    .select('name,logo_url')
    .eq('competition', competition);
  const out: Record<string, string> = {};
  for (const t of (data ?? []) as UclTeam[]) if (t.logo_url) out[t.name] = t.logo_url;
  return out;
};

/** Fixtures for one matchday, plus that matchday's deadline. */
export const getFixtures = async (matchday: number, competition: Competition = 'UCL') => {
  const [fx, md] = await Promise.all([
    (supabase as any)
      .from('ucl_fixtures')
      .select('id,matchday,kickoff,home_team,away_team,home_score,away_score,status')
      .eq('competition', competition)
      .eq('matchday', matchday)
      .order('kickoff', { ascending: true, nullsFirst: false }),
    (supabase as any)
      .from('ucl_matchdays')
      .select('*')
      .eq('competition', competition)
      .eq('matchday', matchday)
      .maybeSingle(),
  ]);
  return {
    fixtures: (fx.data ?? []) as Fixture[],
    matchday: (md.data ?? null) as Matchday | null,
  };
};

/**
 * The round currently in play: the next one whose deadline has not passed,
 * falling back to the earliest with an unplayed fixture.
 */
export const getCurrentMatchday = async (
  competition: Competition = 'UCL',
): Promise<number | null> => {
  // The round the game says is in play. Deadline-based guessing lands on the
  // NEXT round the moment the current one kicks off, which skips past the
  // fixtures being played right now.
  const { data: flagged } = await (supabase as any)
    .from('ucl_matchdays')
    .select('matchday')
    .eq('competition', competition)
    .eq('is_current', true)
    .limit(1);
  const c = (flagged ?? [])[0] as { matchday?: number } | undefined;
  if (c?.matchday) return c.matchday;

  const nowIso = new Date().toISOString();
  const { data: byDeadline } = await (supabase as any)
    .from('ucl_matchdays')
    .select('matchday,deadline')
    .eq('competition', competition)
    .gt('deadline', nowIso)
    .order('deadline', { ascending: true })
    .limit(1);
  const d = (byDeadline ?? [])[0] as { matchday?: number } | undefined;
  if (d?.matchday) return d.matchday;

  const { data: byFixture } = await (supabase as any)
    .from('ucl_fixtures')
    .select('matchday,kickoff')
    .eq('competition', competition)
    .eq('status', 'scheduled')
    .order('kickoff', { ascending: true })
    .limit(1);
  return ((byFixture ?? [])[0] as { matchday?: number } | undefined)?.matchday ?? null;
};

/** Which matchdays have any fixtures loaded, so the pager only offers real ones. */
export const getLoadedMatchdays = async (
  competition: Competition = 'UCL',
): Promise<number[]> => {
  const { data } = await (supabase as any)
    .from('ucl_fixtures')
    .select('matchday')
    .eq('competition', competition);
  const set = new Set<number>(((data ?? []) as { matchday: number }[]).map((r) => r.matchday));
  return [...set].sort((a, b) => a - b);
};

export const FORMATIONS = ['3-4-3', '3-5-2', '4-3-3', '4-4-2', '4-5-1', '5-3-2', '5-4-1'] as const;

/**
 * Used when nothing legible says otherwise - an unreadable screenshot, a plain
 * list, a squad built from scratch. 3-4-3 is the most common attacking shape
 * and is easy to reshape from, since it leaves spare defenders on the bench
 * rather than needing new ones.
 */
export const DEFAULT_FORMATION = '3-4-3';

/**
 * UCL Fantasy squad rules: 15 players for EUR 100m, split 2/5/5/3.
 * (Confirmed against the 2026/27 rules — this is NOT the same as FPL.)
 */
export const SQUAD_COMPOSITION: Record<Position, number> = { GK: 2, DEF: 5, MID: 5, FWD: 3 };

/** UCL Fantasy gives EUR 100m for the 15-man squad. Note euros, not pounds. */
export const SQUAD_BUDGET = 100;

/**
 * Most players a squad may hold from one club.
 *
 * A hard rule in both competitions, not a preference. UEFA publishes it in
 * their own constraints feed as maxTeamPlayers: 3, alongside maxTeamValue 100,
 * and the Premier League game enforces the same three.
 */
export const MAX_PER_CLUB = 3;

/** How many players each club contributes to a squad. */
export const clubCounts = (slots: SquadSlot[]): Record<string, number> =>
  slots.reduce<Record<string, number>>((acc, s) => {
    if (s.player_id && s.team) acc[s.team] = (acc[s.team] ?? 0) + 1;
    return acc;
  }, {});

/** Money formatter. Returns null when there is no price to show. */
export const formatPrice = (price: number | null | undefined): string | null =>
  price == null ? null : `€${price.toFixed(1)}m`;

/**
 * Squad cost against the budget.
 *
 * `priced` counts how many of the picked players actually carry a price. UEFA
 * only publishes prices when the game opens, so before then the total is
 * meaningless and the UI must say so rather than imply a full budget remains.
 */
export const squadCost = (slots: SquadSlot[]) => {
  const picked = slots.filter((s) => s.player_id);
  const priced = picked.filter((s) => s.price != null);
  const spent = priced.reduce((t, s) => t + (s.price ?? 0), 0);
  return {
    spent: Number(spent.toFixed(1)),
    remaining: Number((SQUAD_BUDGET - spent).toFixed(1)),
    priced: priced.length,
    picked: picked.length,
    complete: priced.length === picked.length && picked.length > 0,
    overBudget: spent > SQUAD_BUDGET,
  };
};

/** Slot counts per outfield line for a formation, plus the single keeper. */
export const formationSlots = (formation: string): Record<Position, number> => {
  const [def, mid, fwd] = formation.split('-').map((n) => parseInt(n, 10) || 0);
  return { GK: 1, DEF: def, MID: mid, FWD: fwd };
};

/**
 * The bench is whatever the formation leaves over from the 2/5/5/3 squad — not
 * one player per position. A 4-3-3 benches 1 GK, 1 DEF and 2 MID; a 4-4-2
 * benches one of each.
 */
export const benchShape = (formation: string): Position[] => {
  const starting = formationSlots(formation);
  return (['GK', 'DEF', 'MID', 'FWD'] as Position[]).flatMap((pos) =>
    Array.from({ length: Math.max(0, SQUAD_COMPOSITION[pos] - starting[pos]) }, () => pos),
  );
};

/** An unfilled slot, which still knows which line it belongs to. */
export const emptySlot = (position: Position): SquadSlot => ({ player_id: null, position });

/**
 * Deal a pool of players into a formation, returning the XI and the bench.
 *
 * A formation is a constraint, not a label. Choosing a default shape and then
 * handing the untouched pool to the pitch put all fifteen players in the XI -
 * two goalkeepers and all five defenders - because nothing ever enforced the
 * shape that had just been chosen.
 *
 * Order within a line is preserved, so whoever the screenshot listed first in a
 * position starts. Any player the shape has no room for stays on the bench
 * rather than being dropped.
 */
export const applyFormation = (
  pool: SquadSlot[],
  formation: string,
): { starters: SquadSlot[]; bench: SquadSlot[]; overflow: SquadSlot[] } => {
  const need = formationSlots(formation);
  // A slot holds something if a name was read into it, matched or not. Keeping
  // only resolved players would delete exactly the ones the manager opened the
  // builder to correct - they render as a "?" with a warning, not as a blank.
  const remaining = pool.filter((s) => s.player_id || s.read_as);
  const take = (pos: Position): SquadSlot => {
    const i = remaining.findIndex((s) => s.position === pos);
    return i === -1 ? emptySlot(pos) : remaining.splice(i, 1)[0];
  };
  const starters = (['GK', 'DEF', 'MID', 'FWD'] as Position[]).flatMap((pos) =>
    Array.from({ length: need[pos] }, () => take(pos)),
  );
  const bench = benchShape(formation).map(take);

  // Whatever is still in hand has no seat under the 2/5/5/3 rule, because the
  // XI and the bench together are exactly that. It means a position was
  // over-read - a screenshot scanned as six defenders - not that the manager
  // owns sixteen players. Returned rather than benched: a fifteen-man squad
  // with five substitutes is not a squad, and silently deleting a name the
  // reader can see on their own screenshot is worse than saying so.
  return { starters, bench, overflow: remaining };
};

/** True when a squad already matches its own formation, line for line. */
export const matchesFormation = (starters: SquadSlot[], formation: string): boolean => {
  const need = formationSlots(formation);
  if (starters.length !== Object.values(need).reduce((t, n) => t + n, 0)) return false;
  const have = starters.reduce<Record<string, number>>((acc, s) => {
    if (s.position) acc[s.position] = (acc[s.position] ?? 0) + 1;
    return acc;
  }, {});
  // A slot with no position cannot satisfy a line, so a squad carrying one is
  // never already in shape.
  if (starters.some((s) => !s.position)) return false;
  return (['GK', 'DEF', 'MID', 'FWD'] as Position[]).every((p) => (have[p] ?? 0) === need[p]);
};

export const parseScreenshot = async (
  imageBase64: string,
  competition: Competition = 'UCL',
): Promise<ParseResult> => {
  const { data, error } = await supabase.functions.invoke('ucl-parse-screenshot', {
    body: { imageBase64, competition },
  });
  if (error) throw new Error(error.message);
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data as ParseResult;
};

export const rateSquad = async (
  squad: Squad,
  opts: {
    source: 'screenshot' | 'manual';
    language: string;
    unlock?: Unlockable[];
    transferCount?: number;
    competition?: Competition;
    chip?: string | null;
    usedChips?: string[];
    /** Keep the narrative already on screen instead of paying to regenerate it. */
    skipNarrative?: boolean;
  },
): Promise<RatingResult> => {
  const { data, error } = await supabase.functions.invoke('ucl-rate-squad', {
    body: {
      squad,
      source: opts.source,
      language: opts.language,
      unlock: opts.unlock ?? [],
      transferCount: opts.transferCount ?? 0,
      competition: opts.competition ?? 'UCL',
      chip: opts.chip ?? null,
      usedChips: opts.usedChips ?? [],
      skipNarrative: opts.skipNarrative ?? false,
    },
  });
  // supabase-js surfaces a non-2xx as `error` with the body still in `data`,
  // so the credit reasons have to be read from either place.
  const payload = data as { error?: string; cost?: number } | null;
  const reason = payload?.error;
  if (reason === 'sign_in_required' || reason === 'insufficient_credits') {
    throw new CreditError(reason, payload?.cost ?? 0);
  }
  if (error) throw new Error(error.message);
  if (reason) throw new Error(reason);
  return data as RatingResult;
};

/**
 * How many players the picker pulls.
 *
 * Was 20, which is too few to browse by price: the twenty dearest defenders
 * are all premium, so the cheap end of the list a manager is usually shopping
 * in never appeared at all.
 */
const PICKER_LIMIT = 120;

/**
 * The stat that ranks two players who cost the same.
 *
 * Points per game rather than total points, because within a price band the
 * comparison is "who returns more when he plays": total points quietly
 * punishes someone who missed a month injured and is now fit, which is the
 * opposite of the advice a manager wants when choosing between two GBP 8.0m
 * midfielders. Total points breaks the remaining ties.
 */
export const rankStat = (p: UclPlayer): number | null => p.points_per_game;

/** Season builds the squad to hold; gameweek builds the one for the next round. */
export type Horizon = 'season' | 'gameweek';

export interface AutofillResult {
  squad: Squad;
  rating: number;
  breakdown: SubScore[];
  horizon: Horizon;
  target_gameweek: number | null;
  /** Credits this cost, and what is left. Zero and null on the free side. */
  cost: number;
  credits_remaining: number | null;
  /** What the squad costs, and what it was allowed to cost. */
  spend: number;
  budget: number;
}

/**
 * Ask the server to build the best squad the budget allows.
 *
 * Server-side because the selection has to be scored by the same model that
 * rates a squad. A picker built in the browser would need its own copy of the
 * scoring rules, and the moment the two disagreed the tool would be
 * recommending a squad it then marks down.
 */
export const autofillSquad = async (
  competition: Competition = 'UCL',
  horizon: Horizon = 'season',
): Promise<AutofillResult> => {
  const { data, error } = await supabase.functions.invoke('ucl-rate-squad', {
    body: { mode: 'autofill', competition, horizon },
  });
  // supabase-js reports a non-2xx as `error` with the body still in `data`, so
  // the real reason - no prices published yet - has to be read from there.
  const reason = (data as { error?: string; cost?: number } | null)?.error;
  if (reason === 'sign_in_required' || reason === 'insufficient_credits') {
    throw new CreditError(reason, (data as { cost?: number })?.cost ?? 0);
  }
  if (reason) throw new Error(reason);
  if (error) throw new Error(error.message);
  return data as AutofillResult;
};

/** Player search for the manual builder. Reads ucl_players directly (public). */
export const searchPlayers = async (
  query: string,
  position?: Position | null,
  competition: Competition = 'UCL',
) => {
  // `as any` matches how quizzes/grenadiers tables are read elsewhere: the
  // generated types.ts predates these tables.
  let q = (supabase as any)
    .from('ucl_players')
    .select(
      'id,name,display_name,team,team_code,position,price,total_points,form,points_per_game,ict_index,availability,availability_note,next_opponent,next_difficulty,photo_url',
    )
    .eq('competition', competition)
    // Ordering has to happen in the database, not on what comes back: the
    // limit is applied after the sort server-side but before anything the
    // client could do, so sorting here would only reorder an arbitrary slice.
    //
    // Price first, so equally-priced players sit together, then the ranking
    // stat inside each band. Players with no price sort last rather than
    // first - UEFA publishes prices late, and a null is "not known yet", not
    // "free".
    .order('price', { ascending: false, nullsFirst: false })
    .order('points_per_game', { ascending: false, nullsFirst: false })
    .order('total_points', { ascending: false })
    .limit(PICKER_LIMIT);
  if (position) q = q.eq('position', position);
  if (query.trim()) q = q.ilike('name', `%${query.trim()}%`);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as UclPlayer[];
};

/** Strip the data: prefix a FileReader result carries. */
export const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(new Error('Could not read that file'));
    reader.readAsDataURL(file);
  });
