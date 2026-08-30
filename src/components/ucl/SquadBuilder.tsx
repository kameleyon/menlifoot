import { useEffect, useMemo, useState } from 'react';
import { Search, X, Star } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import PitchView from './PitchView';
import {
  benchShape,
  formatPrice,
  FORMATIONS,
  formationSlots,
  searchPlayers,
  squadCost,
  SQUAD_BUDGET,
  type Competition,
  type Position,
  type Squad,
  type SquadSlot,
  type UclPlayer,
} from '@/lib/uclFantasy';

interface Props {
  onSubmit: (squad: Squad) => void;
  submitting?: boolean;
  competition?: Competition;
}

const emptySlot = (position: Position): SquadSlot => ({ player_id: null, position });

const buildStarters = (formation: string): SquadSlot[] => {
  const slots = formationSlots(formation);
  return (['GK', 'DEF', 'MID', 'FWD'] as Position[]).flatMap((pos) =>
    Array.from({ length: slots[pos] }, () => emptySlot(pos)),
  );
};

const SquadBuilder = ({ onSubmit, submitting = false, competition = 'UCL' }: Props) => {
  const { t } = useLanguage();
  const [formation, setFormation] = useState<string>('4-3-3');
  const [starters, setStarters] = useState<SquadSlot[]>(() => buildStarters('4-3-3'));
  // Bench composition is derived from the formation against the 2/5/5/3 squad
  // rule, so a 4-3-3 benches 1 GK / 1 DEF / 2 MID rather than one per position.
  const [bench, setBench] = useState<SquadSlot[]>(() => benchShape('4-3-3').map(emptySlot));
  const [picking, setPicking] = useState<{ index: number; onBench: boolean; position: Position } | null>(
    null,
  );
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UclPlayer[]>([]);
  const [loading, setLoading] = useState(false);

  // Changing formation rebuilds the pitch. Players already picked are carried
  // over per position so a manager doesn't lose their whole XI to a reshape.
  const changeFormation = (next: string) => {
    // Pool every player currently held, then refill the new XI and the new
    // bench from it, so a reshape never silently drops someone.
    const pool = [...starters, ...bench].filter((s) => s.player_id);
    const take = (pos: Position) => {
      const i = pool.findIndex((c) => c.position === pos);
      return i === -1 ? emptySlot(pos) : pool.splice(i, 1)[0];
    };
    setFormation(next);
    setStarters(buildStarters(next).map((slot) => take(slot.position as Position)));
    setBench(benchShape(next).map((pos) => take(pos)));
  };

  useEffect(() => {
    if (!picking) return;
    let cancelled = false;
    setLoading(true);
    searchPlayers(query, picking.position, competition)
      .then((r) => !cancelled && setResults(r))
      .catch(() => !cancelled && setResults([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [query, picking, competition]);

  const chosenIds = useMemo(
    () => new Set([...starters, ...bench].map((s) => s.player_id).filter(Boolean) as string[]),
    [starters, bench],
  );

  const assign = (player: UclPlayer) => {
    if (!picking) return;
    const slot: SquadSlot = {
      player_id: player.id,
      name: player.name,
      display_name: player.display_name,
      team: player.team,
      team_code: player.team_code,
      position: player.position,
      price: player.price,
    };
    if (picking.onBench) {
      setBench((b) => b.map((s, i) => (i === picking.index ? slot : s)));
    } else {
      setStarters((s) => s.map((x, i) => (i === picking.index ? { ...slot, is_captain: x.is_captain } : x)));
    }
    setPicking(null);
    setQuery('');
  };

  const setCaptain = (index: number) =>
    setStarters((s) => s.map((x, i) => ({ ...x, is_captain: i === index })));

  const filled = starters.filter((s) => s.player_id).length;
  const hasCaptain = starters.some((s) => s.is_captain);
  const budget = useMemo(() => squadCost([...starters, ...bench]), [starters, bench]);
  // Over-budget blocks submission, but only once prices actually exist.
  const ready = filled === starters.length && hasCaptain && !budget.overBudget;

  return (
    <div className="space-y-4">
      {/* Budget. Prices only exist once UEFA opens the game, so before then this
          says so rather than implying a full EUR 100m is still available. */}
      <div className="rounded-lg border border-border bg-card/60 p-3">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-medium text-muted-foreground">{t('ucl.budget')}</span>
          {budget.priced === 0 ? (
            <span className="text-xs text-muted-foreground">{t('ucl.pricesPending')}</span>
          ) : (
            <span
              className={`font-display text-sm tabular-nums ${
                budget.overBudget ? 'text-destructive' : 'text-foreground'
              }`}
            >
              {formatPrice(budget.spent)} / {formatPrice(SQUAD_BUDGET)}
            </span>
          )}
        </div>

        {budget.priced > 0 && (
          <>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all ${
                  budget.overBudget ? 'bg-destructive' : 'bg-primary'
                }`}
                style={{ width: `${Math.min(100, (budget.spent / SQUAD_BUDGET) * 100)}%` }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[11px]">
              <span className={budget.overBudget ? 'text-destructive' : 'text-muted-foreground'}>
                {budget.overBudget
                  ? `${t('ucl.overBudget')} ${formatPrice(Math.abs(budget.remaining))}`
                  : `${t('ucl.remaining')} ${formatPrice(budget.remaining)}`}
              </span>
              {budget.priced < budget.picked && (
                <span className="text-muted-foreground">
                  {t('ucl.partialPrices')} ({budget.priced}/{budget.picked})
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* One line, scrolled horizontally rather than wrapped: seven chips plus a
          label will not fit a phone width, and a second row pushed the pitch
          down the screen. */}
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-xs font-medium text-muted-foreground">
          {t('ucl.formation')}
        </span>
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5">
          {FORMATIONS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => changeFormation(f)}
              className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium tabular-nums transition-colors ${
                formation === f
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <PitchView
        starters={starters}
        bench={bench}
        benchLabel={t('ucl.bench')}
        emptyLabel={t('ucl.addPlayer')}
        onSlotClick={(slot, index, onBench) =>
          setPicking({ index, onBench, position: (slot.position ?? 'MID') as Position })
        }
      />

      {/* Captain picker — only meaningful once there is someone to captain. */}
      {filled > 0 && (
        <div className="rounded-lg border border-border bg-card/60 p-3">
          <div className="mb-2 text-xs font-medium text-muted-foreground">{t('ucl.pickCaptain')}</div>
          <div className="flex flex-wrap gap-2">
            {starters.map((s, i) =>
              s.player_id ? (
                <button
                  key={i}
                  type="button"
                  onClick={() => setCaptain(i)}
                  className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs transition-colors ${
                    s.is_captain
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/70'
                  }`}
                >
                  {s.is_captain && <Star className="h-3 w-3" />}
                  {s.display_name ?? s.name}
                </button>
              ) : null,
            )}
          </div>
        </div>
      )}

      <Button className="w-full" disabled={!ready || submitting} onClick={() => onSubmit({ formation, starters, bench })}>
        {submitting
          ? t('ucl.analyzing')
          : budget.overBudget
          ? `${t('ucl.overBudget')} ${formatPrice(Math.abs(budget.remaining))}`
          : ready
          ? t('ucl.rateMyTeam')
          : !hasCaptain && filled === starters.length
          ? t('ucl.needCaptain')
          : `${filled}/${starters.length} ${t('ucl.playersPicked')}`}
      </Button>

      {picking && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center">
          <div className="max-h-[75vh] w-full max-w-md overflow-hidden rounded-t-2xl bg-card sm:rounded-2xl">
            <div className="flex items-center gap-2 border-b border-border p-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`${t('ucl.searchPlayer')} — ${picking.position}`}
                className="border-0 focus-visible:ring-0"
              />
              <button type="button" onClick={() => { setPicking(null); setQuery(''); }}>
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {loading && <div className="p-4 text-sm text-muted-foreground">{t('ucl.loading')}</div>}
              {!loading && results.length === 0 && (
                <div className="p-4 text-sm text-muted-foreground">{t('ucl.noPlayers')}</div>
              )}
              {results.map((p) => {
                const taken = chosenIds.has(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={taken}
                    onClick={() => assign(p)}
                    className="flex w-full items-center justify-between gap-2 border-b border-border/50 p-3 text-left disabled:opacity-40"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{p.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {p.team} · {p.position}
                        {p.availability !== 'available' && ` · ${p.availability}`}
                      </div>
                    </div>
                    {p.price != null && (
                      <span className="shrink-0 text-xs text-muted-foreground">{formatPrice(p.price)}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SquadBuilder;
