import { useState } from 'react';
import { Telescope, ChevronDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatPrice, getBestPicks, type BestPick, type Position } from '@/lib/uclFantasy';

const ORDER: Position[] = ['GK', 'DEF', 'MID', 'FWD'];

/**
 * "Who should I own this matchday" — loaded on demand rather than rendered
 * eagerly, because it is a question the manager asks after seeing their rating,
 * not something they need occupying the screen before they ask it.
 */
const BestPicks = () => {
  const { t } = useLanguage();
  const [picks, setPicks] = useState<Record<Position, BestPick[]> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = async () => {
    if (picks) {
      setPicks(null);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      setPicks(await getBestPicks(3));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  /** The single strongest reason to own this player, in plain language. */
  const reason = (p: BestPick): string => {
    if (p.next_opponent && p.next_difficulty != null) {
      return `${t('ucl.vs')} ${p.next_opponent} · ${t('ucl.difficulty')} ${p.next_difficulty}/5`;
    }
    if (p.position === 'GK' || p.position === 'DEF') {
      return p.clean_sheet_rate != null
        ? `${Math.round(p.clean_sheet_rate * 100)}% ${t('ucl.cleanSheets')}`
        : p.team;
    }
    return p.avg_goals_scored != null
      ? `${p.avg_goals_scored.toFixed(1)} ${t('ucl.goalsPerGame')}`
      : p.team;
  };

  return (
    <div className="space-y-3">
      <Button variant="outline" className="w-full justify-between" onClick={load} disabled={loading}>
        <span className="flex items-center gap-2">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Telescope className="h-4 w-4 text-primary" />
          )}
          {t('ucl.bestPicksTitle')}
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform ${picks ? 'rotate-180' : ''}`} />
      </Button>

      {error && <p className="text-xs text-destructive">{t('ucl.error')}</p>}

      {picks && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">{t('ucl.bestPicksBody')}</p>
          {ORDER.filter((pos) => picks[pos]?.length).map((pos) => (
            <div key={pos} className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t(`ucl.score.${pos === 'GK' ? 'gk' : pos.toLowerCase()}`)}
              </div>
              <div className="overflow-hidden rounded-lg border border-border">
                {picks[pos].map((p, i) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 border-b border-border/50 px-3 py-2 last:border-b-0"
                  >
                    <span className="w-4 shrink-0 text-center text-[11px] font-bold text-muted-foreground">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{p.display_name || p.name}</div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {p.team} · {reason(p)}
                      </div>
                    </div>
                    {formatPrice(p.price) && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatPrice(p.price)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BestPicks;
