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

export const COMPETITION_LABEL: Record<Competition, string> = {
  UCL: 'Champions League',
  EPL: 'Premier League',
};

export interface UclPlayer {
  id: string;
  name: string;
  display_name: string;
  team: string;
  team_code: string | null;
  position: Position;
  price: number | null;
  total_points: number;
  form: number | null;
  availability: string;
  availability_note: string | null;
  next_opponent: string | null;
  next_difficulty: number | null;
}

export interface SquadSlot {
  player_id: string | null;
  read_as?: string;
  name?: string;
  display_name?: string;
  team?: string;
  team_code?: string | null;
  position?: Position | null;
  price?: number | null;
  is_captain?: boolean;
  is_vice?: boolean;
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
  key: 'captain' | 'availability' | 'form' | 'fixtures' | 'structure' | 'value';
  earned: number;
  max: number;
  ratio: number;
  /** False when the season has not produced this data yet (form, price, fixtures). */
  applicable: boolean;
}

export interface Suggestion {
  out: string;
  in: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
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
  /** UCL Fantasy has only Wildcard and Limitless. Null means hold them both. */
  chip: 'Wildcard' | 'Limitless' | null;
  urgency: 'high' | 'medium' | 'none';
  reason: string;
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
  competition?: Competition;
  free?: boolean;
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
 * UCL Fantasy squad rules: 15 players for EUR 100m, split 2/5/5/3.
 * (Confirmed against the 2026/27 rules — this is NOT the same as FPL.)
 */
export const SQUAD_COMPOSITION: Record<Position, number> = { GK: 2, DEF: 5, MID: 5, FWD: 3 };

/** UCL Fantasy gives EUR 100m for the 15-man squad. Note euros, not pounds. */
export const SQUAD_BUDGET = 100;

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

export const parseScreenshot = async (imageBase64: string): Promise<ParseResult> => {
  const { data, error } = await supabase.functions.invoke('ucl-parse-screenshot', {
    body: { imageBase64 },
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
      'id,name,display_name,team,team_code,position,price,total_points,form,availability,availability_note,next_opponent,next_difficulty',
    )
    .eq('competition', competition)
    .limit(20);
  if (position) q = q.eq('position', position);
  if (query.trim()) q = q.ilike('name', `%${query.trim()}%`);
  else q = q.order('total_points', { ascending: false });
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
