import { useState } from 'react';
import { Telescope, ChevronDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import LockedPanel, { PlaceholderRows } from './LockedPanel';
import {
  BEST_PICKS_PRICE,
  CreditError,
  formatPrice,
  getBestPicks,
  isFreeCompetition,
  type Competition,
  type BestPick,
  type BestPicksResult,
  type Position,
} from '@/lib/uclFantasy';

const ORDER: Position[] = ['GK', 'DEF', 'MID', 'FWD'];

interface Props {
  competition?: Competition;
  signedIn: boolean;
  balance: number | null;
  onBalance: (n: number | null) => void;
  onSignIn: () => void;
  onTopUp: () => void;
}

/**
 * "Who should I own this matchday" — a paid, on-demand panel.
 *
 * Nothing is fetched until it is paid for: the underlying RPC has EXECUTE
 * revoked from the browser roles, so the list simply does not exist client-side
 * until the edge function has taken the credits.
 */
const BestPicks = ({
  competition = 'UCL',
  signedIn,
  balance,
  onBalance,
  onSignIn,
  onTopUp,
}: Props) => {
  const free = isFreeCompetition(competition);
  const { t } = useLanguage();
  const [result, setResult] = useState<BestPicksResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (result) {
      setResult(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = await getBestPicks(3, competition);
      setResult(r);
      onBalance(r.credits_remaining);
    } catch (err) {
      if (err instanceof CreditError) {
        setError(err.kind === 'sign_in_required' ? t('ucl.signInToUnlock') : t('ucl.notEnoughCredits'));
        if (err.kind === 'sign_in_required') onSignIn();
      } else {
        setError(t('ucl.error'));
      }
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

  // Before purchase, show a locked teaser rather than a bare button, so the
  // shape of what is on offer is visible without giving any of it away.
  if (!result) {
    if (free) {
      return (
        <div className="space-y-2">
          <Button variant="outline" className="w-full justify-between" onClick={load} disabled={loading}>
            <span className="flex items-center gap-2">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Telescope className="h-4 w-4 text-primary" />
              )}
              {t('ucl.bestPicksTitle')}
            </span>
            <ChevronDown className="h-4 w-4" />
          </Button>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      );
    }
    return (
      <div className="space-y-2">
        <LockedPanel
          title={t('ucl.bestPicksTitle')}
          description={t('ucl.bestPicksLockedBody')}
          icon={<Telescope className="h-4 w-4 text-primary" />}
          cost={BEST_PICKS_PRICE}
          balance={balance}
          signedIn={signedIn}
          busy={loading}
          onUnlock={load}
          onSignIn={onSignIn}
          onTopUp={onTopUp}
        >
          <PlaceholderRows rows={4} />
        </LockedPanel>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

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
        <ChevronDown className="h-4 w-4 rotate-180 transition-transform" />
      </Button>

      <p className="text-xs text-muted-foreground">
        {result.fixtures_known ? t('ucl.bestPicksBody') : t('ucl.bestPicksNoFixtures')}
      </p>

      {ORDER.filter((pos) => result.picks[pos]?.length).map((pos) => (
        <div key={pos} className="space-y-1">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t(`ucl.score.${pos === 'GK' ? 'gk' : pos.toLowerCase()}`)}
          </div>
          <div className="overflow-hidden rounded-lg border border-border">
            {result.picks[pos].map((p, i) => (
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
  );
};

export default BestPicks;
