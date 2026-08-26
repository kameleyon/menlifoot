// Article categories. The English string is the canonical value stored in
// `articles.category` (plain text, no DB constraint) — never store a translated
// label, or every category filter breaks. Translation happens at read time via
// getCategoryLabel(). Haiti stays last: it's the local/editorial focus category.
export const CATEGORY_VALUES = [
  'Match Analysis',
  'Transfer News',
  'Player Spotlight',
  'World Cup 2026',
  'Champions League',
  'Premier League',
  'La Liga',
  'Serie A',
  'Bundesliga',
  'MLS',
  'Tactics',
  'Opinion',
  'Did You Know?',
  'Flashback',
  'Football Business',
  'Lifestyle',
  'Haiti',
] as const;

export type CategoryValue = (typeof CATEGORY_VALUES)[number];

export const CATEGORY_LABEL_KEYS: Record<CategoryValue, string> = {
  'Match Analysis': 'articles.cat.matchAnalysis',
  'Transfer News': 'articles.cat.transferNews',
  'Player Spotlight': 'articles.cat.playerSpotlight',
  'World Cup 2026': 'articles.cat.worldCup2026',
  'Champions League': 'articles.cat.championsLeague',
  'Premier League': 'articles.cat.premierLeague',
  'La Liga': 'articles.cat.laLiga',
  'Serie A': 'articles.cat.serieA',
  Bundesliga: 'articles.cat.bundesliga',
  MLS: 'articles.cat.mls',
  Tactics: 'articles.cat.tactics',
  Opinion: 'articles.cat.opinion',
  'Did You Know?': 'articles.cat.didYouKnow',
  Flashback: 'articles.cat.flashback',
  'Football Business': 'articles.cat.footballBusiness',
  Lifestyle: 'articles.cat.lifestyle',
  Haiti: 'articles.cat.haiti',
};

/**
 * Localize a stored category value.
 * Unknown categories (legacy rows written before a rename) fall through to the
 * raw stored string rather than disappearing; null/empty gets the translated
 * "Uncategorized" label.
 */
export const getCategoryLabel = (
  t: (key: string) => string,
  category: string | null | undefined,
): string => {
  if (!category) return t('articles.cat.uncategorized');
  const key = (CATEGORY_LABEL_KEYS as Record<string, string>)[category];
  return key ? t(key) : category;
};
