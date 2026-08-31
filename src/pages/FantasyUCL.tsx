import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, PenLine, ArrowLeft, AlertTriangle, ArrowRight,
  Clipboard, Wand2, Star, Zap, CalendarDays, ChevronDown, Coins, Lock,
} from 'lucide-react';
import AppShell from '@/components/mobile/AppShell';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import PitchView from '@/components/ucl/PitchView';
import RatingRing from '@/components/ucl/RatingRing';
import SquadBuilder from '@/components/ucl/SquadBuilder';
import FixturesCalendar from '@/components/ucl/FixturesCalendar';
import BestPicks from '@/components/ucl/BestPicks';
import LockedPanel, { PlaceholderRows } from '@/components/ucl/LockedPanel';
import ChipPicker from '@/components/ucl/ChipPicker';
import { useAuth } from '@/contexts/AuthContext';
import {
  CreditError,
  fileToBase64,
  getCreditBalance,
  parseScreenshot,
  rateSquad,
  startTopUp,
  isFreeCompetition,
  CHIPS_BY_COMPETITION,
  DEFAULT_FORMATION,
  applyFormation,
  matchesFormation,
  type SquadSlot,
  FORMATIONS,
  COMPETITION_LABEL,
  type Competition,
  type RatingResult,
  type Squad,
  type Unlockable,
} from '@/lib/uclFantasy';

type Step = 'start' | 'import' | 'build' | 'analyzing' | 'result' | 'fixtures';

// The request is a single round trip of unknown length, so the bar eases
// toward 90% and only completes when the response lands. Three staged bars
// implied three steps that were never really happening.
const PROGRESS_CEILING = 92;

interface Props {
  /** UCL is the credit-gated product; EPL is free for now. */
  competition?: Competition;
}

const FantasyUCL = ({ competition = 'UCL' }: Props) => {
  const free = isFreeCompetition(competition);
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('start');
  const [squad, setSquad] = useState<Squad | null>(null);
  const [source, setSource] = useState<'screenshot' | 'manual'>('manual');
  const [unresolved, setUnresolved] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<RatingResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAllTransfers, setShowAllTransfers] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  // The results pitch is read-only until the manager chooses to change it, so
  // the score stays the thing on screen rather than a builder.
  const [editing, setEditing] = useState(false);
  // The chip the manager intends to play, so the advice judges their choice
  // instead of proposing a different one.
  const [chip, setChip] = useState<string | null>(null);
  // Chips already spent this season. They narrow what can still be advised.
  const [usedChips, setUsedChips] = useState<string[]>([]);
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const signedIn = Boolean(user);

  // Everything already paid for on this squad, so re-rating after an optimise
  // does not silently charge again for the same panels.
  const [paidUnlocks, setPaidUnlocks] = useState<Unlockable[]>([]);
  const [paidTransfers, setPaidTransfers] = useState(0);

  useEffect(() => {
    getCreditBalance().then(setBalance).catch(() => setBalance(null));
  }, [user]);

  const goSignIn = () => navigate('/auth');

  const topUp = async () => {
    try {
      window.location.href = await startTopUp('starter');
    } catch (err) {
      toast({
        title: t('ucl.error'),
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    }
  };

  // Fill while the request is in flight. A blank wait reads as a hang, but the
  // bar must never claim to be finished before the answer arrives, so it
  // decelerates toward the ceiling instead of reaching the end.
  useEffect(() => {
    if (step !== 'analyzing') {
      setProgress(0);
      return;
    }
    setProgress(8);
    const id = setInterval(() => {
      setProgress((p) => (p >= PROGRESS_CEILING ? p : p + Math.max(0.6, (PROGRESS_CEILING - p) / 12)));
    }, 120);
    return () => clearInterval(id);
  }, [step]);

  // Ctrl+V anywhere on the import step. Managers screenshot on a phone and
  // paste on a desktop far more often than they save and re-upload a file.
  useEffect(() => {
    if (step !== 'import') return;
    const onPaste = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'));
      const file = item?.getAsFile();
      if (file) {
        e.preventDefault();
        void handleFile(file);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  });

  const analyze = useCallback(
    async (
      next: Squad,
      src: 'screenshot' | 'manual',
      unlock: Unlockable[] = [],
      transferCount = 0,
    ) => {
      setSquad(next);
      setSource(src);
      setStep('analyzing');
      try {
        const r = await rateSquad(next, {
          source: src,
          language,
          competition,
          chip,
          usedChips,
          // A free competition asks for everything up front; nothing is locked.
          unlock: free ? ['optimisation', 'captains', 'chips'] : unlock,
          transferCount: free ? 3 : transferCount,
        });
        setResult(r);
        if (r.credits_remaining != null) setBalance(r.credits_remaining);
        setStep('result');
      } catch (err) {
        if (err instanceof CreditError) {
          toast({
            title: err.kind === 'sign_in_required' ? t('ucl.signIn') : t('ucl.notEnoughCredits'),
            description: err.kind === 'sign_in_required' ? t('ucl.signInToUnlock') : t('ucl.topUpPrompt'),
          });
          if (err.kind === 'sign_in_required') goSignIn();
          setStep('result');
          return;
        }
        toast({
          title: t('ucl.error'),
          description: err instanceof Error ? err.message : String(err),
          variant: 'destructive',
        });
        setStep(src === 'screenshot' ? 'import' : 'build');
      }
    },
    [language, t, toast, competition, free, chip, usedChips],
  );

  const handleFile = async (file: File) => {
    setBusy(true);
    setStep('analyzing');
    try {
      const b64 = await fileToBase64(file);
      const parsed = await parseScreenshot(b64, competition);
      // Trust the shape the screenshot showed, but only if the resolved
      // positions actually support it: the vision model reads rows off a
      // picture, while positions come from the game, and the game wins.
      const resolved = parsed.starters ?? [];
      const counts = resolved.reduce<Record<string, number>>((acc, p) => {
        if (p.position) acc[p.position] = (acc[p.position] ?? 0) + 1;
        return acc;
      }, {});
      const derived = `${counts.DEF ?? 0}-${counts.MID ?? 0}-${counts.FWD ?? 0}`;
      // Fall back to 3-4-3 when neither the picture nor the resolved positions
      // give a legal shape - an unreadable layout should still produce a squad
      // a manager can edit, not a pitch with nothing on it.
      const shape = (FORMATIONS as readonly string[]).includes(derived)
        ? derived
        : (FORMATIONS as readonly string[]).includes(parsed.formation ?? '')
        ? (parsed.formation as string)
        : DEFAULT_FORMATION;
      // Deal the players into that shape. Picking a formation and then passing
      // the untouched list through left every player in the XI - the pitch
      // showed two keepers and no bench, because the shape was only ever a
      // label on the squad and never a constraint on it.
      const pool = [...resolved, ...(parsed.bench ?? [])];
      const dealt = matchesFormation(resolved, shape)
        ? { starters: resolved, bench: parsed.bench ?? [], overflow: [] as SquadSlot[] }
        : applyFormation(pool, shape);
      const next: Squad = { formation: shape, starters: dealt.starters, bench: dealt.bench };

      // A squad is fifteen: eleven and four, never eleven and five. Anything
      // left over means a position was over-read - a screenshot scanned as six
      // defenders - so it is reported rather than benched, because a
      // sixteen-man squad cannot be entered in the game and silently deleting
      // a name the manager can see on their own screenshot is worse than
      // saying which one did not fit.
      const overflowNames = dealt.overflow.map(
        (o) => o.display_name || o.name || o.read_as || '?',
      );
      setUnresolved([...(parsed.unresolved ?? []), ...overflowNames]);
      // Anything the OCR could not resolve goes to the builder for correction
      // rather than being scored with holes in it.
      if (parsed.needs_review) {
        setSquad(next);
        setSource('screenshot');
        setStep('import');
        toast({ title: t('ucl.reviewNeeded'), description: t('ucl.reviewNeededBody') });
      } else {
        await analyze(next, 'screenshot');
      }
    } catch (err) {
      toast({
        title: t('ucl.error'),
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
      setStep('import');
    } finally {
      setBusy(false);
    }
  };

  /**
   * Buy one more panel for the squad already on screen. The rating is
   * recomputed server-side with the wider unlock set, so previously paid
   * panels survive without being charged again.
   */
  const unlockMore = async (add: Unlockable | 'transfer') => {
    if (!squad) return;
    const nextUnlocks: Unlockable[] =
      add === 'transfer' ? paidUnlocks : [...new Set([...paidUnlocks, add])];
    const nextTransfers = add === 'transfer' ? paidTransfers + 1 : paidTransfers;
    setUnlocking(true);
    try {
      const r = await rateSquad(squad, {
        source,
        language,
        competition,
        chip,
        usedChips,
        unlock: nextUnlocks,
        transferCount: nextTransfers,
        // The squad has not changed, so neither has the write-up. Asking for it
        // again costs six seconds to redisplay what is already on screen.
        skipNarrative: nextTransfers === 0,
      });
      // Keep the narrative we already have when the server was told to skip it.
      setResult((prev) => ({ ...r, narrative: r.narrative ?? prev?.narrative ?? null }));
      setPaidUnlocks(nextUnlocks);
      setPaidTransfers(nextTransfers);
      if (r.credits_remaining != null) setBalance(r.credits_remaining);
    } catch (err) {
      if (err instanceof CreditError) {
        toast({
          title: err.kind === 'sign_in_required' ? t('ucl.signIn') : t('ucl.notEnoughCredits'),
          description: err.kind === 'sign_in_required' ? t('ucl.signInToUnlock') : t('ucl.topUpPrompt'),
        });
        if (err.kind === 'sign_in_required') goSignIn();
      } else {
        toast({
          title: t('ucl.error'),
          description: err instanceof Error ? err.message : String(err),
          variant: 'destructive',
        });
      }
    } finally {
      setUnlocking(false);
    }
  };

  /** Apply the suggested XI/captain, then re-run the rating so the score moves. */
  const applyOptimisation = async () => {
    if (!result?.optimisation) return;
    const next: Squad = {
      formation: result.optimisation.formation,
      starters: result.optimisation.starters,
      bench: result.optimisation.bench,
    };
    setShowAllTransfers(false);
    await analyze(next, source, paidUnlocks, paidTransfers);
  };

  const reset = () => {
    setStep('start');
    setSquad(null);
    setResult(null);
    setUnresolved([]);
    setShowAllTransfers(false);
    setEditing(false);
    setChip(null);
    setUsedChips([]);
    setPaidUnlocks([]);
    setPaidTransfers(0);
  };

  // ------------------------------------------------------------- sign-in ---
  // Both competitions need an account. The squad is saved against a user and
  // the Champions League side spends credits, so there is no useful anonymous
  // version of this page - and letting someone build a full fifteen before
  // telling them wastes the only work they did.
  //
  // Waits for the auth check to finish. Rendering the gate while it is still
  // running would flash "sign in" at a member on every refresh.
  if (authLoading) {
    return (
      <AppShell>
        <div className="mx-auto w-full max-w-lg px-4 pt-24 text-center text-sm text-muted-foreground">
          {t('ucl.loading')}
        </div>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell>
        <div className="mx-auto w-full max-w-lg px-4 pb-24 pt-16 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary">
            <Lock className="h-5 w-5 text-black" />
          </div>
          <h1 className="font-display text-2xl uppercase">{t('ucl.signInRequired')}</h1>
          <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
            {t('ucl.signInRequiredBody')}
          </p>
          <button
            type="button"
            onClick={goSignIn}
            className="mt-6 w-full rounded-full bg-primary px-5 py-3 font-sans text-sm font-semibold uppercase tracking-[0.06em] text-black transition-opacity hover:opacity-90"
          >
            {t('ucl.signIn')}
          </button>
        </div>
      </AppShell>
    );
  }

  /**
   * The squad with expected points attached.
   *
   * The projections are keyed by player_id server-side rather than returned
   * inside the squad, because the squad on screen is client state the server
   * never sees - it is the manager's, and rewriting it from a response would
   * discard edits they have not submitted yet.
   */
  const projectedSquad = squad && result?.projections
    ? {
        ...squad,
        starters: squad.starters.map((s) => ({
          ...s,
          projected_points: s.player_id ? result.projections?.[s.player_id] ?? null : null,
        })),
        bench: squad.bench.map((s) => ({
          ...s,
          projected_points: s.player_id ? result.projections?.[s.player_id] ?? null : null,
        })),
      }
    : squad;

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-lg px-4 pb-24 pt-6">
        <div className="mb-4 flex items-center justify-between">
          {step !== 'start' ? (
            <button
              type="button"
              onClick={reset}
              className="flex items-center gap-1 text-xs text-muted-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {t('ucl.startOver')}
            </button>
          ) : (
            <span />
          )}

          {/* Balance is always visible once signed in: a paywall the user cannot
              see their side of feels arbitrary. */}
          {free ? (
            <span className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground">
              {COMPETITION_LABEL[competition]}
            </span>
          ) : signedIn ? (
            <button
              type="button"
              onClick={topUp}
              className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs"
            >
              <Coins className="h-3.5 w-3.5 text-primary" />
              <span className="tabular-nums font-medium">{balance ?? '—'}</span>
              <span className="text-muted-foreground">{t('ucl.credits')}</span>
            </button>
          ) : (
            <button type="button" onClick={goSignIn} className="text-xs text-primary underline">
              {t('ucl.signIn')}
            </button>
          )}
        </div>

        {step === 'start' && (
          <div className="space-y-6 text-center">
            <div>
              <div className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
                {t('ucl.eyebrow')}
              </div>
              <h1 className="mt-2 font-display text-3xl uppercase leading-tight">{t('ucl.title')}</h1>
              <p className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground">{t('ucl.subtitle')}</p>
            </div>

            <div className="space-y-3">
              <Button
                variant="outline"
                className="h-12 w-full justify-start gap-3"
                onClick={() => { setStep('import'); }}
              >
                <Upload className="h-4 w-4" />
                {t('ucl.importScreenshot')}
              </Button>
              <Button
                variant="outline"
                className="h-12 w-full justify-start gap-3"
                onClick={() => setStep('build')}
              >
                <PenLine className="h-4 w-4" />
                {t('ucl.buildManually')}
              </Button>
            </div>

            {/* Fixtures live on the page, not behind a button. The schedule is
                the first thing a manager checks, and it opens on the round in
                play with arrows to step back and forward. */}
            <div className="space-y-2 text-left">
              <h3 className="flex items-center gap-2 font-display text-sm uppercase tracking-wide">
                <CalendarDays className="h-4 w-4 text-primary" />
                {t('ucl.fixturesTitle')}
              </h3>
              <FixturesCalendar competition={competition} />
            </div>
          </div>
        )}

        {step === 'import' && (
          <div className="space-y-4">
            <h2 className="font-display text-2xl uppercase">{t('ucl.importTitle')}</h2>
            <p className="text-sm text-muted-foreground">{t('ucl.importHelp')}</p>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = '';
              }}
            />
            <Button className="w-full" disabled={busy} onClick={() => fileRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              {t('ucl.chooseImage')}
            </Button>
            <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Clipboard className="h-3.5 w-3.5" />
              {t('ucl.orPaste')}
            </div>

            {/* Set before uploading, so the first analysis already accounts for
                the chip rather than needing a second run. */}
            <ChipPicker
              chips={CHIPS_BY_COMPETITION[competition]}
              chip={chip}
              onChipChange={setChip}
              usedChips={usedChips}
              onUsedChipsChange={setUsedChips}
            />

            {unresolved.length > 0 && (
              <div className="rounded-lg border border-primary/40 bg-primary/10 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  <AlertTriangle className="h-4 w-4" />
                  {t('ucl.couldNotRead')}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{unresolved.join(', ')}</p>
              </div>
            )}

            {squad && (
              <>
                <PitchView
                  starters={squad.starters}
                  bench={squad.bench}
                  benchLabel={t('ucl.bench')}
                  emptyLabel={t('ucl.unknown')}
                />
                <Button className="w-full" onClick={() => analyze(squad, 'screenshot')}>
                  {t('ucl.rateMyTeam')}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => setStep('build')}>
                  {t('ucl.fixManually')}
                </Button>
              </>
            )}
          </div>
        )}

        {step === 'fixtures' && (
          <div className="space-y-4">
            <h2 className="font-display text-2xl uppercase">{t('ucl.fixturesTitle')}</h2>
            <FixturesCalendar competition={competition} />
          </div>
        )}

        {step === 'build' && (
          <div className="space-y-4">
            <h2 className="font-display text-2xl uppercase">{t('ucl.buildTitle')}</h2>
            {/* Seeded with whatever was imported, so "fix it manually" opens
                the squad that was just read rather than an empty pitch. Null
                after a reset, which is what "build manually" wants. */}
            <SquadBuilder
              competition={competition}
              submitting={busy}
              initialSquad={squad}
              chips={CHIPS_BY_COMPETITION[competition]}
              chip={chip}
              onChipChange={setChip}
              usedChips={usedChips}
              onUsedChipsChange={setUsedChips}
              onSubmit={(s) => analyze(s, 'manual')}
            />
          </div>
        )}

        {step === 'analyzing' && (
          <div className="space-y-5 pt-16 text-center">
            <h2 className="font-display text-2xl uppercase">{t('ucl.analyzingTitle')}</h2>
            <div className="mx-auto max-w-sm space-y-2">
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-200 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="text-xs text-muted-foreground">{t('ucl.analyzingSub')}</div>
            </div>
          </div>
        )}

        {step === 'result' && result && squad && (
          <div className="space-y-6">
            <div className="text-center">
              <RatingRing value={result.rating} />
              <h2 className="mt-3 font-display text-2xl uppercase">{t('ucl.teamRated')}</h2>
              {/* What the XI is expected to score, captain counted twice. No
                  provider publishes this for either competition, so it comes
                  from the same signals as the rating - stated in points, which
                  is the language the question was asked in. */}
              {result.projected_points != null && (
                <div className="mt-2 inline-flex items-baseline gap-1.5 rounded-full border border-primary/40 bg-primary/[0.10] px-3 py-1">
                  <span className="font-display text-lg leading-none text-primary">
                    {result.projected_points.toFixed(1)}
                  </span>
                  <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.08em] text-primary/70">
                    {t('ucl.predictedPoints')}
                  </span>
                </div>
              )}
              {result.target_gameweek != null && (
                <div className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                  {competition === 'EPL' ? t('ucl.gameweek') : t('ucl.matchday')}{' '}
                  {result.target_gameweek}
                </div>
              )}
              {/* What the score becomes if the advice below is followed. The
                  number is computed, not claimed, so it is safe to show. */}
              {result.projected_rating != null &&
                result.projected_rating > result.rating && (
                  <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/5 px-3 py-1 text-xs">
                    <span className="text-muted-foreground">{t('ucl.couldReach')}</span>
                    <span className="font-display text-sm text-primary">
                      {result.projected_rating}
                    </span>
                    {result.target_rating != null && (
                      <span className="text-muted-foreground">
                        / {t('ucl.target')} {result.target_rating}
                      </span>
                    )}
                  </div>
                )}
              {result.narrative?.verdict && (
                <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                  {result.narrative.verdict}
                </p>
              )}
            </div>

            {/* Swap players straight from the result, then re-run the rating.
                Editing is opt-in: the score is what the manager came for, and a
                builder in its place would bury it. */}
            {editing ? (
              <div className="space-y-2">
                <SquadBuilder
                  competition={competition}
                  submitting={busy}
                  initialSquad={squad}
                  requireChange
                  chips={CHIPS_BY_COMPETITION[competition]}
                  chip={chip}
                  onChipChange={setChip}
                  usedChips={usedChips}
                  onUsedChipsChange={setUsedChips}
                  submitLabel={t('ucl.doneReanalyse')}
                  onSubmit={(next) => {
                    setEditing(false);
                    analyze(next, source, paidUnlocks, paidTransfers);
                  }}
                />
                <Button variant="ghost" className="w-full" onClick={() => setEditing(false)}>
                  {t('ucl.cancelEdit')}
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <PitchView
                  starters={projectedSquad?.starters ?? squad.starters}
                  bench={projectedSquad?.bench ?? squad.bench}
                  benchLabel={t('ucl.bench')}
                  emptyLabel={t('ucl.unknown')}
                  onSlotClick={() => setEditing(true)}
                />
                <Button variant="outline" className="w-full" onClick={() => setEditing(true)}>
                  <PenLine className="mr-2 h-4 w-4" />
                  {t('ucl.changePlayers')}
                </Button>
              </div>
            )}

            <div className="space-y-2">
              <h3 className="font-display text-sm uppercase tracking-wide">{t('ucl.breakdown')}</h3>
              {result.breakdown
                // Pre-season there is no form, price or fixture data. The API
                // marks those dimensions inapplicable and excludes them from the
                // score; rendering "0/25" would read as a bad squad, not as
                // missing data, so they are hidden entirely.
                .filter((b) => b.applicable !== false)
                .map((b) => (
                  <div key={b.key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{t(`ucl.score.${b.key}`)}</span>
                      <span className="font-medium">
                        {b.earned}/{b.max}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${(b.earned / b.max) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
            </div>

            {/* Always rendered. Hiding it when nothing improves reads as a
                missing feature rather than "your XI is already right". */}
            {result.locked.optimisation && (
              <LockedPanel
                title={t('ucl.optimizeTitle')}
                description={t('ucl.optimizeLockedBody')}
                icon={<Wand2 className="h-4 w-4 text-primary" />}
                cost={result.prices.optimisation}
                balance={balance}
                signedIn={signedIn}
                busy={unlocking}
                onUnlock={() => unlockMore('optimisation')}
                onSignIn={goSignIn}
                onTopUp={topUp}
              >
                <PlaceholderRows rows={2} />
              </LockedPanel>
            )}

            {result.optimisation && (
              <div
                className={`rounded-xl border p-4 ${
                  result.optimisation.changes_needed
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-border bg-card/60'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Wand2
                    className={`h-4 w-4 ${
                      result.optimisation.changes_needed ? 'text-primary' : 'text-muted-foreground'
                    }`}
                  />
                  <h3 className="font-display text-sm uppercase tracking-wide">
                    {t('ucl.optimizeTitle')}
                  </h3>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {result.optimisation.changes_needed
                    ? `${t('ucl.optimizeBody')} ${result.optimisation.formation}`
                    : t('ucl.optimizeAlready')}
                </p>
                <Button
                  size="sm"
                  variant={result.optimisation.changes_needed ? 'default' : 'outline'}
                  className="mt-3 w-full"
                  disabled={busy}
                  onClick={applyOptimisation}
                >
                  {result.optimisation.changes_needed
                    ? t('ucl.optimizeApply')
                    : t('ucl.optimizeAnyway')}
                </Button>
              </div>
            )}

            {result.locked.captains && (
              <LockedPanel
                title={t('ucl.captainTitle')}
                description={t('ucl.captainLockedBody')}
                icon={<Star className="h-4 w-4 text-primary" />}
                cost={result.prices.captains}
                balance={balance}
                signedIn={signedIn}
                busy={unlocking}
                onUnlock={() => unlockMore('captains')}
                onSignIn={goSignIn}
                onTopUp={topUp}
              >
                <PlaceholderRows rows={3} />
              </LockedPanel>
            )}

            {result.captain_ranking?.length > 0 && (
              <div className="space-y-2">
                <h3 className="flex items-center gap-2 font-display text-sm uppercase tracking-wide">
                  <Star className="h-4 w-4 text-primary" />
                  {t('ucl.captainTitle')}
                </h3>
                {result.captain_ranking.map((c) => (
                  <div
                    key={c.player_id}
                    className={`flex items-center justify-between rounded-lg border p-2.5 ${
                      c.is_current ? 'border-primary/50 bg-primary/5' : 'border-border bg-card/60'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{c.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {c.next_opponent ? `${t('ucl.vs')} ${c.next_opponent}` : c.team}
                        {c.next_difficulty != null && ` · ${t('ucl.difficulty')} ${c.next_difficulty}/5`}
                      </div>
                    </div>
                    {c.is_current && (
                      <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                        C
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {result.locked.chips && (
              <LockedPanel
                title={t('ucl.chipTitle')}
                description={t('ucl.chipLockedBody')}
                icon={<Zap className="h-4 w-4 text-primary" />}
                cost={result.prices.chips}
                balance={balance}
                signedIn={signedIn}
                busy={unlocking}
                onUnlock={() => unlockMore('chips')}
                onSignIn={goSignIn}
                onTopUp={topUp}
              >
                <PlaceholderRows rows={2} />
              </LockedPanel>
            )}

            {!editing && (
              <ChipPicker
                chips={CHIPS_BY_COMPETITION[competition]}
                chip={chip}
                onChipChange={(c) => {
                  setChip(c);
                  if (squad) analyze(squad, source, paidUnlocks, paidTransfers);
                }}
                usedChips={usedChips}
                onUsedChipsChange={setUsedChips}
              />
            )}

            {result.chip_advice && (
              <div className="rounded-lg border border-border bg-card/60 p-3">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  <h3 className="font-display text-sm uppercase tracking-wide">{t('ucl.chipTitle')}</h3>
                </div>
                <p className="mt-1 text-sm font-medium">
                  {result.chip_advice.chip ?? t('ucl.chipHold')}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{result.chip_advice.reason}</p>
              </div>
            )}

            {result.suggestions.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-display text-sm uppercase tracking-wide">{t('ucl.transfers')}</h3>
                {(showAllTransfers ? result.suggestions : result.suggestions.slice(0, 3)).map((s, i) => (
                  <div
                    key={i}
                    className={`rounded-lg border p-3 ${
                      s.recommended ? 'border-primary/50 bg-primary/5' : 'border-border bg-card/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
                        <span className="truncate text-muted-foreground line-through">{s.out}</span>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-primary" />
                        <span className="truncate">{s.in}</span>
                      </div>
                      {s.recommended && (
                        <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
                          {t('ucl.recommended')}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{s.reason}</p>
                  </div>
                ))}
                {result.suggestions.length > 3 && !showAllTransfers && (
                  <button
                    type="button"
                    onClick={() => setShowAllTransfers(true)}
                    className="flex w-full items-center justify-center gap-1 py-1 text-xs text-muted-foreground underline"
                  >
                    {t('ucl.showMore')} ({result.suggestions.length - 3})
                    <ChevronDown className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}

            {/* Transfers are bought one at a time, so a manager only pays for
                the depth of advice they actually want. */}
            {result.locked.transfers > 0 && (
              <LockedPanel
                title={t('ucl.transfers')}
                description={`${result.locked.transfers} ${t('ucl.moreTransfersAvailable')}`}
                icon={<ArrowRight className="h-4 w-4 text-primary" />}
                cost={result.prices.transfers}
                balance={balance}
                signedIn={signedIn}
                busy={unlocking}
                onUnlock={() => unlockMore('transfer')}
                onSignIn={goSignIn}
                onTopUp={topUp}
              >
                <PlaceholderRows rows={2} />
              </LockedPanel>
            )}

            <BestPicks
              competition={competition}
              signedIn={signedIn}
              balance={balance}
              onBalance={setBalance}
              onSignIn={goSignIn}
              onTopUp={topUp}
            />

            <Button variant="outline" className="w-full" onClick={reset}>
              {t('ucl.rateAnother')}
            </Button>
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default FantasyUCL;
