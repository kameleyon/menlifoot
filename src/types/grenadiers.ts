export interface HaitiPlayer {
  id: string;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  jersey_number: number | null;
  birth_date: string | null;
  birth_place: string | null;
  selection: string | null;
  current_club: string | null;
  club_country: string | null;
  clubs_history: string | null;
  market_value_eur: number | null;
  agent: string | null;
  agent_contact: string | null;
  instagram: string | null;
  twitter: string | null;
  tiktok: string | null;
  youtube: string | null;
  website: string | null;
  contract_start: string | null;
  contract_end: string | null;
  salary_eur: number | null;
  recent_injuries: string | null;
  status: string | null;
  merch_personal_url: string | null;
  merch_club_url: string | null;
  notes: string | null;
}

export interface HaitiStat {
  id: number;
  player_id: string | null;
  season: string | null;
  competition: string | null;
  category: string | null;
  club_or_selection: string | null;
  matches_played: number | null;
  starts: number | null;
  minutes: number | null;
  goals: number | null;
  assists: string | null;
  yellow_cards: number | null;
  red_cards: number | null;
  shots_per_match: number | null;
  dribbles: number | null;
  duels_won_pct: number | null;
  avg_rating: number | null;
  source: string | null;
  notes: string | null;
}

export interface HaitiConvocation {
  id: string;
  player_id: string | null;
  first_name: string | null;
  last_name: string | null;
  tournament: string | null;
  competition_type: string | null;
  phase: string | null;
  opponent: string | null;
  match_date: string | null;
  location: string | null;
  result: string | null;
  callup_status: string | null;
  present_absent: string | null;
  absence_reason: string | null;
  goals: number | null;
  assists: number | null;
  minutes: number | null;
  yellow_card: number | null;
  red_card: number | null;
  match_rating: number | null;
  notes: string | null;
}

// ---- helpers ----

export const fullName = (p: { first_name: string | null; last_name: string | null }) =>
  [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || '—';

export const initials = (p: { first_name: string | null; last_name: string | null }) =>
  `${(p.first_name ?? '').charAt(0)}${(p.last_name ?? '').charAt(0)}`.toUpperCase() || '?';

export const formatEuro = (v: number | null): string | null => {
  if (v == null) return null;
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
};

export const formatDateFr = (s: string | null): string | null => {
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
};

export const ageFrom = (birth: string | null): number | null => {
  if (!birth) return null;
  const d = new Date(birth);
  if (isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
};

// Group a free-text position string into a broad category.
export type PositionGroup = 'Gardiens' | 'Défenseurs' | 'Milieux' | 'Attaquants' | 'Autres';

export const positionGroup = (pos: string | null): PositionGroup => {
  const p = (pos ?? '').toLowerCase();
  if (p.includes('gardien')) return 'Gardiens';
  if (p.includes('défen') || p.includes('defen') || p.includes('latéral') || p.includes('arrière') || p.includes('back')) return 'Défenseurs';
  if (p.includes('milieu')) return 'Milieux';
  if (p.includes('attaq') || p.includes('ailier') || p.includes('avant') || p.includes('buteur') || p.includes('forward')) return 'Attaquants';
  return 'Autres';
};

export const POSITION_ORDER: PositionGroup[] = ['Gardiens', 'Défenseurs', 'Milieux', 'Attaquants', 'Autres'];
