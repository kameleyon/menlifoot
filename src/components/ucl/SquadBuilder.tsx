import { useEffect, useMemo, useState } from 'react';
import { Search, X, Star, Shield, Zap, CheckCircle2, Wand2, Loader2, CalendarDays, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
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
  type Horizon,
  searchPlayers,
  squadCost,
  SQUAD_BUDGET,
  MAX_PER_CLUB,
  clubCounts,
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
  const { toast } = useToast();
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
  /** The slot waiting for a partner, when a swap is half-made. */
  const [swapping, setSwapping] = useState<{ index: number; onBench: boolean } | null>(null);
  const [autofilling, setAutofilling] = useState<Horizon | null>(null);
  const [autofillError, setAutofillError] = useState<string | null>(null);
  // Cleared by any edit: the score describes the squad that was built, and the
  // moment a player changes it is describing something that is no longer on
  // the pitch.
  const [autofilled, setAutofilled] = useState<
    {
      rating: number;
      spend: number;
      budget: number;
      horizon: Horizon;
      gameweek: number | null;
      points: number | null;
    } | null
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
    // Overflow here means the squad was already over quota before the reshape,
    // so it keeps riding the bench. Dropping a player because the manager tried
    // a different shape would throw away work they did by hand.
    setBench([...dealt.bench, ...dealt.overflow]);
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

  /** Players held per club, for the three-per-club rule. */
  const perClub = useMemo(() => clubCounts([...starters, ...bench]), [starters, bench]);

  /**
   * Whether a club still has room, given which slot is being filled.
   *
   * The slot being replaced is discounted when it already holds someone from
   * that club, because swapping one Arsenal player for another leaves the
   * count where it was. Without that a manager could not change their mind
   * about which three they wanted.
   */
  const clubHasRoom = (team: string | null | undefined) => {
    if (!team) return true;
    const outgoing = picking
      ? (picking.onBench ? bench : starters)[picking.index]
      : null;
    const replacingSameClub = outgoing?.player_id && outgoing.team === team ? 1 : 0;
    return (perClub[team] ?? 0) - replacingSameClub < MAX_PER_CLUB;
  };

  /** Clubs already at the limit in the current squad, for the warning line. */
  const clubsOverCap = useMemo(
    () => Object.entries(perClub).filter(([, n]) => n > MAX_PER_CLUB).map(([team]) => team),
    [perClub],
  );

  const assign = (player: UclPlayer) => {
    if (!picking) return;
    // Guarded here as well as on the button: the rule belongs to the action,
    // not to how the row happens to be rendered.
    if (!clubHasRoom(player.team)) return;
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
  /**
   * Fill the squad.
   *
   * `keepMine` is the difference between the two buttons. Auto pick completes
   * a squad around the players already on the pitch and never moves them;
   * best-squad starts from nothing. A manager half way through picking wants
   * the gaps filled, not their work replaced.
   */
  const runAutofill = async (horizon: Horizon, keepMine = false) => {
    setAutofilling(horizon);
    setAutofillError(null);
    try {
      const keep = keepMine
        ? ([...starters, ...bench].map((s) => s.player_id).filter(Boolean) as string[])
        : [];
      const filled = await autofillSquad(competition, horizon, keep);
      setFormation(filled.squad.formation);
      setStarters(filled.squad.starters);
      setBench(filled.squad.bench);
      setDirty(true);
      setAutofilled({
        rating: filled.rating,
        spend: filled.spend,
        budget: filled.budget,
        horizon,
        gameweek: filled.target_gameweek,
        points: filled.projected_points ?? null,
      });
    } catch (err) {
      // The one failure that is expected rather than broken: UEFA publishes
      // prices late, and nothing can be costed against a budget until it does.
      const raw = err instanceof Error ? err.message : String(err);
      setAutofillError(raw.includes('not enough priced players') ? t('ucl.autofillNoPrices') : raw);
    } finally {
      setAutofilling(null);
    }
  };

  /**
   * Move a player between the XI and the bench, or reorder within either.
   *
   * Press the arrows on one card, then on another, and the two change places.
   * Two presses rather than a drag because this has to work with a thumb on a
   * phone, and because tapping the card itself already means "replace this
   * player" - one gesture per intention.
   */
  const handleSwap = (index: number, onBench: boolean) => {
    if (!swapping) {
      setSwapping({ index, onBench });
      return;
    }
    // Pressing the armed card again is how you change your mind.
    if (swapping.index === index && swapping.onBench === onBench) {
      setSwapping(null);
      return;
    }

    const a = swapping;
    const b = { index, onBench };
    const from = (x: typeof a) => (x.onBench ? bench : starters)[x.index];
    const slotA = from(a);
    const slotB = from(b);
    setSwapping(null);
    if (!slotA?.player_id || !slotB?.player_id) return;

    const nextStarters = [...starters];
    const nextBench = [...bench];
    const put = (x: typeof a, slot: SquadSlot) => {
      if (x.onBench) nextBench[x.index] = slot;
      else nextStarters[x.index] = slot;
    };

    // The armband belongs to the pitch. A captain sent to the bench would be
    // captaining nobody, so it is dropped and the manager is told - quietly
    // keeping a flag on a substitute would be worse than losing it.
    const benched = (slot: SquadSlot, goingToBench: boolean) =>
      goingToBench ? { ...slot, is_captain: false, is_vice: false } : slot;

    put(a, benched(slotB, a.onBench));
    put(b, benched(slotA, b.onBench));

    // A swap across the line changes the shape, and not every shape is legal.
    if (a.onBench !== b.onBench) {
      const counts = nextStarters.reduce<Record<string, number>>((acc, sl) => {
        if (sl.player_id && sl.position) acc[sl.position] = (acc[sl.position] ?? 0) + 1;
        return acc;
      }, {});
      const shape = `${counts.DEF ?? 0}-${counts.MID ?? 0}-${counts.FWD ?? 0}`;
      if ((counts.GK ?? 0) !== 1 || !(FORMATIONS as readonly string[]).includes(shape)) {
        toast({
          title: t('ucl.swapIllegal'),
          description: `${t('ucl.swapIllegalBody')} ${shape}`,
          variant: 'destructive',
        });
        return;
      }
      setFormation(shape);
    }

    const lostArmband =
      (slotA.is_captain || slotA.is_vice) && b.onBench ||
      (slotB.is_captain || slotB.is_vice) && a.onBench;

    setStarters(nextStarters);
    setBench(nextBench);
    markEdited();
    if (lostArmband) toast({ title: t('ucl.armbandCleared') });
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
        {/* Auto pick fills whatever is empty and leaves the rest alone, so on
            an empty pitch it fills all fifteen and on a part-built one it
            completes the squad around the manager's own choices.

            Always shown. It used to appear only once a player had been picked,
            on the reasoning that an empty squad made it identical to Best
            squad - which was true and beside the point: it hid the button at
            the exact moment someone would look for it, on an empty pitch. A
            control that only appears once you no longer need it is not a
            control. */}
        <Button
          type="button"
          onClick={() => runAutofill('season', true)}
          disabled={autofilling !== null || submitting}
          className="h-12 w-full gap-2 text-sm font-semibold"
        >
          {autofilling ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 shrink-0" />
          )}
          {t('ucl.autoPick')}
        </Button>

        {/* Two different questions, so two buttons rather than a hidden
            setting. "Best squad" is the side to hold; "best this round" will
            happily buy a modest player with the easiest fixture of the week and
            is a different squad - roughly half the picks change. Both replace
            the whole squad, which is why they sit below Auto pick rather than
            beside it. */}

        <div className="grid grid-cols-2 gap-2">
          {([
            { horizon: 'season' as Horizon, icon: Wand2, label: t('ucl.autofillSeason') },
            { horizon: 'gameweek' as Horizon, icon: CalendarDays, label: t('ucl.autofillWeek') },
          ]).map(({ horizon, icon: Icon, label }) => (
            <Button
              key={horizon}
              type="button"
              variant="outline"
              onClick={() => runAutofill(horizon)}
              disabled={autofilling !== null || submitting}
              className="h-10 w-full gap-2 px-2"
            >
              {autofilling === horizon ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              ) : (
                <Icon className="h-4 w-4 shrink-0" />
              )}
              <span className="truncate text-xs">
                {autofilling === horizon ? t('ucl.autofilling') : label}
              </span>
            </Button>
          ))}
        </div>
        {autofillError && <p className="text-xs text-destructive">{autofillError}</p>}
        {autofilled && (
          <div className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-center">
            <div className="font-display text-sm text-primary">
              {t('ucl.autofillRates')} {autofilled.rating}/100
              {autofilled.points != null && (
                <> · {autofilled.points} {t('ucl.predictedPoints')}</>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {formatPrice(autofilled.spend)} / {formatPrice(autofilled.budget)}
              {autofilled.horizon === 'gameweek' && autofilled.gameweek != null && (
                <> · {t('ucl.builtFor')} {autofilled.gameweek}</>
              )}
              {' · '}{t('ucl.autofillEditable')}
            </div>
          </div>
        )}
      </div>

      {/* Budget. Always the full 100m against what is spent - the bar and the
          figure show unconditionally rather than hiding behind a "prices not
          published yet" notice. The budget is a rule of the game, true before
          any price is published, and a manager wants to see it either way. */}
      <div className="rounded-lg border border-border bg-card/60 p-3">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-medium text-muted-foreground">{t('ucl.budget')}</span>
          <span
            className={`font-display text-sm tabular-nums ${
              budget.overBudget ? 'text-destructive' : 'text-foreground'
            }`}
          >
            {formatPrice(budget.spent)} / {formatPrice(SQUAD_BUDGET)}
          </span>
        </div>

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
          {/* Only when SOME players carry a price and others do not, which is a
              real inconsistency in the figure above. Silent when none are
              priced, since the total is then plainly zero spent. */}
          {budget.priced > 0 && budget.priced < budget.picked && (
            <span className="text-muted-foreground">
              {t('ucl.partialPrices')} ({budget.priced}/{budget.picked})
            </span>
          )}
        </div>
      </div>

      {clubsOverCap.length > 0 && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
          {t('ucl.clubCapBroken')} {clubsOverCap.map((c) => `${c} (${perClub[c]})`).join(', ')}
        </div>
      )}

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
        onSwap={handleSwap}
        swapping={swapping}
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
                    // Three per club is a rule of both games, so a fourth is
                    // not offered rather than offered and then rejected.
                    const clubFull = !taken && !clubHasRoom(p.team);
                    const stat = rankStat(p);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        disabled={taken || clubFull}
                        onClick={() => assign(p)}
                        className="flex w-full items-center justify-between gap-2 border-b border-border/50 p-3 text-left"
                      >
                        {/* The dimming is applied to the player, never to the
                            reason he cannot be picked. Fading the whole row
                            faded the one line that explains it, so the only
                            useful thing on a blocked row was the hardest thing
                            on it to read. */}
                        <div className={`min-w-0 ${taken || clubFull ? 'opacity-40' : ''}`}>
                          <div className="truncate text-sm font-medium">{p.display_name || p.name}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {p.team} · {p.position}
                            {p.availability !== 'available' && ` · ${p.availability}`}
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          {/* Full strength, and worded as the rule rather than
                              as an error - the squad is fine, this player just
                              will not fit in it. */}
                          {(clubFull || taken) && (
                            <span className="rounded-full border border-primary/50 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-primary">
                              {clubFull ? t('ucl.clubFull') : t('ucl.alreadyPicked')}
                            </span>
                          )}
                          {/* The stat that put this player above the next one,
                              so the ranking can be checked rather than trusted. */}
                          <div className={`text-right ${taken || clubFull ? 'opacity-40' : ''}`}>
                            <div className="text-xs font-medium text-primary">
                              {stat != null ? `${stat.toFixed(1)} ${t('ucl.perGame')}` : '—'}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {p.total_points} {t('ucl.ptsShort')}
                            </div>
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
