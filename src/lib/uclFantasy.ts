// Client helpers for the UCL Fantasy squad rater.
//
// Prices are null until the UEFA fantasy game opens (days before matchday 1),
// so every price is optional here on purpose — the UI must degrade rather than
// render a misleading 0.

import { supabase } from '@/integrations/supabase/client';

export type Position = 'GK' | 'DEF' | 'MID' | 'FWD';

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

export interface RatingResult {
  id: string | null;
  rating: number;
  formation: string;
  breakdown: SubScore[];
  narrative: { verdict?: string; strengths?: string[]; weaknesses?: string[] } | null;
  suggestions: Suggestion[];
}

export const FORMATIONS = ['3-4-3', '3-5-2', '4-3-3', '4-4-2', '4-5-1', '5-3-2', '5-4-1'] as const;

/** Slot counts per outfield line for a formation, plus the single keeper. */
export const formationSlots = (formation: string): Record<Position, number> => {
  const [def, mid, fwd] = formation.split('-').map((n) => parseInt(n, 10) || 0);
  return { GK: 1, DEF: def, MID: mid, FWD: fwd };
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
  opts: { source: 'screenshot' | 'manual'; language: string; email?: string | null },
): Promise<RatingResult> => {
  const { data, error } = await supabase.functions.invoke('ucl-rate-squad', {
    body: { squad, source: opts.source, language: opts.language, email: opts.email ?? null },
  });
  if (error) throw new Error(error.message);
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data as RatingResult;
};

/** Player search for the manual builder. Reads ucl_players directly (public). */
export const searchPlayers = async (query: string, position?: Position | null) => {
  // `as any` matches how quizzes/grenadiers tables are read elsewhere: the
  // generated types.ts predates these tables.
  let q = (supabase as any)
    .from('ucl_players')
    .select(
      'id,name,display_name,team,team_code,position,price,total_points,form,availability,availability_note,next_opponent,next_difficulty',
    )
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
