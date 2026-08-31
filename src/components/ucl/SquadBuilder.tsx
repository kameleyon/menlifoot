import { useEffect, useMemo, useState } from 'react';
import { Search, X, Star, Shield, Zap, CheckCircle2, Wand2, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import PitchView from './PitchView';
import ScrollRow from './ScrollRow';
import {
  benchShape,
  DEFAULT_FORMATION,
  applyFormation,
  emptySlot,
  matchesFormation,
  formatPrice,
  FORMATIONS,
  formationSlots,
  rankStat,
  autofillSquad,
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
  /** Seed the pitch with an existing squad, so the same builder can edit one. */
  initialSquad?: Squad | null;
  submitLabel?: string;
  /** Only enable submit once something has actually changed. */
  requireChange?: boolean;
  /** Chips the game offers; empty hides the picker entirely. */
  chips?: string[];
  chip?: string | null;
  onChipChange?: (chip: string | null) => void;
  /** Chips already spent this season; they cannot be played again. */
  usedChips?: string[];
  onUsedChipsChange?: (chips: string[]) => void;
}


const buildStarters = (formation: string): SquadSlot[] => {
  const slots = formationSlots(formation);
  return (['GK', 'DEF', 'MID', 'FWD'] as Position[]).flatMap((pos) =>
    Array.from({ length: slots[pos] }, () => emptySlot(pos)),
  );
};

const SquadBuilder = ({
  onSubmit,
  submitting = false,
  competition = 'UCL',
  initialSquad = null,
  submitLabel,
  requireChange = false,
  chips = [],
  chip = null,
  onChipChange,
  usedChips = [],
  onUsedChipsChange,
}: Props) => {
  const { t } = useLanguage();
  const seedFormation = initialSquad?.formation ?? DEFAULT_FORMATION;
  // Deal the incoming squad into its own formation before showing it. A caller
  // can hand over a shape and a player list that disagree - a screenshot read
  // as fifteen starters, say - and the XI must obey the shape, not the list.
  //
  // Bench composition follows from the formation against the 2/5/5/3 squad
  // rule, so a 4-3-3 benches 1 GK / 1 DEF / 2 MID rather than one per position.
  const seed = useMemo(() => {
    const incoming = initialSquad?.starters ?? [];
    if (!incoming.length) {
      return { starters: buildStarters(seedFormation), bench: benchShape(seedFormation).map(emptySlot) };
    }
    if (matchesFormation(incoming, seedFormation)) {
      return {
        starters: incoming,
        bench: initialSquad?.bench?.length
          ? initialSquad.bench
          : benchShape(seedFormation).map(emptySlot),
      };
    }
    return applyFormation([...incoming, ...(initialSquad?.bench ?? [])], seedFormation);
    // Seeded once from the squad this builder was opened with; later edits are
    // the component's own state and must not be reset by a re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [formation, setFormation] = useState<string>(seedFormation);
  const [dirty, setDirty] = useState(false);
  const [starters, setStarters] = useState<SquadSlot[]>(seed.starters);
  const [bench, setBench] = useState<SquadSlot[]>(seed.bench);
  const [autofilling, setAutofilling] = useState(false);
  const [autofillError, setAutofillError] = useState<string | null>(null);
  // Cleared by any edit: the score describes the squad that was built, and the
  // moment a player changes it is describing something that is no longer on
  // the pitch.
  const [autofilled, setAutofilled] = useState<
    { rating: number; spend: number; budget: number } | null
  >(null);
  const [picking, setPicking] = useState<{ index: number; onBench: boolean; position: Position } | null>(
    null,
  );
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UclPlayer[]>([]);

  /**
   * Split the results into price bands.
   *
   * Consecutive grouping, not a sort: the query already returns players in
   * price order with the ranking stat deciding within each price, so re-sorting
   * here would only risk disagreeing with the order the rows arrived in.
   */
  const priceBands = useMemo(() => {
    const bands: { price: number | null; players: UclPlayer[] }[] = [];
    for (const p of results) {
      const price = p.price ?? null;
      const last = bands[bands.length - 1];
      if (last && last.price === price) last.players.push(p);
      else bands.push({ price, players: [p] });
    }
    return bands;
  }, [results]);
  const [loading, setLoading] = useState(false);

  // Changing formation rebuilds the pitch. Players already picked are carried
  // over per position so a manager doesn't lose their whole XI to a reshape.
  /**
   * Record a hand edit. Also drops the autofill score, which described the
   * squad as built and stops being true the moment a player changes.
   */
  const markEdited = () => {
    setDirty(true);
    setAutofilled(null);
  };

  const changeFormation = (next: string) => {
    // Pool every player currently held and re-deal them into the new shape.
    // Anything the new shape has no room for stays on the bench rather than
    // being lost - an earlier version dropped those leftovers on the floor, so
    // any squad that was not exactly 2/5/5/3 lost players to a reshape.
    const dealt = applyFormation([...starters, ...bench], next);
    setFormation(next);
    markEdited();
    setStarters(dealt.starters);
    setBench(dealt.bench);
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
      availability: player.availability,
      availability_note: player.availability_note,
    };
    if (picking.onBench) {
      setBench((b) => b.map((s, i) => (i === picking.index ? slot : s)));
    } else {
      setStarters((s) => s.map((x, i) => (i === picking.index ? { ...slot, is_captain: x.is_captain } : x)));
    }
    setPicking(null);
    setQuery('');
    markEdited();
  };

  /**
   * Fill the whole squad with the best the budget allows.
   *
   * The result is a starting point, not a verdict: it lands in the same
   * editable state as anything picked by hand, so a manager can take the
   * shape and change the two players they disagree about.
   */
  const runAutofill = async () => {
    setAutofilling(true);
    setAutofillError(null);
    try {
      const filled = await autofillSquad(competition);
      setFormation(filled.squad.formation);
      setStarters(filled.squad.starters);
      setBench(filled.squad.bench);
      setDirty(true);
      setAutofilled({ rating: filled.rating, spend: filled.spend, budget: filled.budget });
    } catch (err) {
      // The one failure that is expected rather than broken: UEFA publishes
      // prices late, and nothing can be costed against a budget until it does.
      const raw = err instanceof Error ? err.message : String(err);
      setAutofillError(raw.includes('not enough priced players') ? t('ucl.autofillNoPrices') : raw);
    } finally {
      setAutofilling(false);
    }
  };

  /** Empty a slot, keeping its position so the shape is unchanged. */
  const removeAt = (index: number, onBench: boolean) => {
    const clear = (list: SquadSlot[]) =>
      list.map((s, i) => (i === index ? emptySlot((s.position ?? 'MID') as Position) : s));
    if (onBench) setBench(clear);
    else setStarters(clear);
    markEdited();
  };

  const setCaptain = (index: number) => {
    // A player cannot be both, so taking the armband clears the vice flag.
    setStarters((s) =>
      s.map((x, i) => ({
        ...x,
        is_captain: i === index,
        is_vice: i === index ? false : x.is_vice,
      })),
    );
    markEdited();
  };

  const setVice = (index: number) => {
    setStarters((s) =>
      s.map((x, i) => ({
        ...x,
        is_vice: i === index,
        is_captain: i === index ? false : x.is_captain,
      })),
    );
    markEdited();
  };

  const filled = [...starters, ...bench].filter((s) => s.player_id).length;
  const squadSize = starters.length + bench.length;
  const startersFilled = starters.filter((s) => s.player_id).length;
  const hasCaptain = starters.some((s) => s.is_captain);
  const budget = useMemo(() => squadCost([...starters, ...bench]), [starters, bench]);
  // Over-budget blocks submission, but only once prices actually exist.
  const ready =
    startersFilled === starters.length &&
    hasCaptain &&
    !budget.overBudget &&
    (!requireChange || dirty);

  return (
    <div className="space-y-4">
      {/* Build the whole squad in one go. Offered before the budget bar because
          on an empty pitch it is the fastest thing a manager can do, and the
          budget it has to respect is the next thing they will look at. */}
      <div className="space-y-2">
        <Button
          type="button"
          variant="outline"
          onClick={runAutofill}
          disabled={autofilling || submitting}
          className="h-11 w-full gap-2"
        >
          {autofilling ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Wand2 className="h-4 w-4" />
          )}
          {autofilling ? t('ucl.autofilling') : t('ucl.autofill')}
        </Button>
        {autofillError && <p className="text-xs text-destructive">{autofillError}</p>}
        {autofilled && (
          <div className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-center">
            <div className="font-display text-sm text-primary">
              {t('ucl.autofillRates')} {autofilled.rating}/100
            </div>
            <div className="text-[11px] text-muted-foreground">
              {formatPrice(autofilled.spend)} / {formatPrice(autofilled.budget)} · {t('ucl.autofillEditable')}
            </div>
          </div>
        )}
      </div>

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
        <ScrollRow>
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
        </ScrollRow>
      </div>

      <PitchView
        starters={starters}
        bench={bench}
        benchLabel={t('ucl.bench')}
        emptyLabel={t('ucl.addPlayer')}
        onSlotClick={(slot, index, onBench) =>
          setPicking({ index, onBench, position: (slot.position ?? 'MID') as Position })
        }
        onRemove={removeAt}
      />

      {/* Captain and vice. The vice matters: if the captain does not play, his
          points are what the manager falls back on. */}
      {startersFilled > 0 && (
        <div className="space-y-3 rounded-lg border border-border bg-card/60 p-3">
          {([
            ['captain', t('ucl.pickCaptain'), setCaptain, (x: SquadSlot) => !!x.is_captain, Star],
            ['vice', t('ucl.pickVice'), setVice, (x: SquadSlot) => !!x.is_vice, Shield],
          ] as const).map(([key, label, onPick, isSet, Icon]) => (
            <div key={key}>
              <div className="mb-2 text-xs font-medium text-muted-foreground">{label}</div>
              <ScrollRow>
                {starters.map((s, i) =>
                  s.player_id ? (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onPick(i)}
                      className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs transition-colors ${
                        isSet(s)
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-muted/70'
                      }`}
                    >
                      {isSet(s) && <Icon className="h-3 w-3" />}
                      {s.display_name ?? s.name}
                    </button>
                  ) : null,
                )}
              </ScrollRow>
            </div>
          ))}
        </div>
      )}

      {/* Chips, in two parts. What is already spent is a fact about the season
          and narrows what can still be advised; what is being played now is a
          decision the analysis should judge. */}
      {chips.length > 0 && onChipChange && (
        <div className="space-y-3 rounded-lg border border-border bg-card/60 p-3">
          {onUsedChipsChange && (
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {t('ucl.chipsUsed')}
              </div>
              <ScrollRow>
                {chips.map((c) => {
                  const on = usedChips.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        const next = on ? usedChips.filter((x) => x !== c) : [...usedChips, c];
                        onUsedChipsChange(next);
                        // A chip cannot be spent and planned at once.
                        if (!on && chip === c) onChipChange(null);
                        markEdited();
                      }}
                      className={`shrink-0 rounded-full px-3 py-1 text-xs transition-colors ${
                        on
                          ? 'bg-muted-foreground/30 text-foreground line-through'
                          : 'bg-muted text-muted-foreground hover:bg-muted/70'
                      }`}
                    >
                      {c}
                    </button>
                  );
                })}
              </ScrollRow>
            </div>
          )}

          <div>
            <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Zap className="h-3.5 w-3.5" />
              {t('ucl.playAChip')}
            </div>
            <ScrollRow>
              <button
                type="button"
                onClick={() => { onChipChange(null); markEdited(); }}
                className={`shrink-0 rounded-full px-3 py-1 text-xs transition-colors ${
                  !chip ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}
              >
                {t('ucl.noChip')}
              </button>
              {chips
                .filter((c) => !usedChips.includes(c))
                .map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => { onChipChange(c); markEdited(); }}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs transition-colors ${
                      chip === c ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {c}
                  </button>
                ))}
            </ScrollRow>
            {usedChips.length > 0 && (
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                {usedChips.length} {t('ucl.chipsAlreadySpent')}
              </p>
            )}
          </div>
        </div>
      )}

      <Button className="w-full" disabled={!ready || submitting} onClick={() => onSubmit({ formation, starters, bench })}>
        {submitting
          ? t('ucl.analyzing')
          : budget.overBudget
          ? `${t('ucl.overBudget')} ${formatPrice(Math.abs(budget.remaining))}`
          : requireChange && !dirty
          ? t('ucl.makeAChange')
          : ready
          ? submitLabel ?? t('ucl.rateMyTeam')
          : !hasCaptain && startersFilled === starters.length
          ? t('ucl.needCaptain')
          : `${filled}/${squadSize} ${t('ucl.playersPicked')}`}
      </Button>

      {picking && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center">
          {/* Flex column with the list as the only growing child. Two
              independent height caps - 75vh here and 60vh on the list - meant
              the search bar's height pushed the bottom of the list past the
              clipped edge, so the last players could not be reached. dvh
              rather than vh because a phone's vh ignores the collapsing URL
              bar and puts the end of the list under it. */}
          <div className="flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-card sm:max-h-[80dvh] sm:rounded-2xl">
            <div className="flex shrink-0 items-center gap-2 border-b border-border p-3">
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
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2">
              {loading && <div className="p-4 text-sm text-muted-foreground">{t('ucl.loading')}</div>}
              {!loading && results.length === 0 && (
                <div className="p-4 text-sm text-muted-foreground">{t('ucl.noPlayers')}</div>
              )}
              {priceBands.map((band) => (
                <div key={band.price ?? 'unpriced'}>
                  {/* The band header is what makes the ordering legible. Without
                      it a list sorted by price then form just looks unsorted. */}
                  <div className="sticky top-0 z-10 flex items-center justify-between bg-muted/95 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur">
                    <span>{formatPrice(band.price) ?? t('ucl.priceTbc')}</span>
                    <span className="font-normal normal-case tracking-normal">
                      {band.players.length}
                    </span>
                  </div>
                  {band.players.map((p) => {
                    const taken = chosenIds.has(p.id);
                    const stat = rankStat(p);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        disabled={taken}
                        onClick={() => assign(p)}
                        className="flex w-full items-center justify-between gap-2 border-b border-border/50 p-3 text-left disabled:opacity-40"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{p.display_name || p.name}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {p.team} · {p.position}
                            {p.availability !== 'available' && ` · ${p.availability}`}
                          </div>
                        </div>
                        {/* Show the stat that put this player above the next one,
                            so the ranking can be checked rather than trusted. */}
                        <div className="shrink-0 text-right">
                          <div className="text-xs font-medium text-primary">
                            {stat != null ? `${stat.toFixed(1)} ${t('ucl.perGame')}` : '—'}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {p.total_points} {t('ucl.ptsShort')}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SquadBuilder;
