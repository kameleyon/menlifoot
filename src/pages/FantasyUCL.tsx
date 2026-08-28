import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Upload, PenLine, ArrowLeft, AlertTriangle, ArrowRight,
  Clipboard, Wand2, Star, Zap, CalendarDays, ChevronDown,
} from 'lucide-react';
import AppShell from '@/components/mobile/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import PitchView from '@/components/ucl/PitchView';
import RatingRing from '@/components/ucl/RatingRing';
import SquadBuilder from '@/components/ucl/SquadBuilder';
import FixturesCalendar from '@/components/ucl/FixturesCalendar';
import {
  fileToBase64,
  parseScreenshot,
  rateSquad,
  type RatingResult,
  type Squad,
} from '@/lib/uclFantasy';

type Step = 'start' | 'import' | 'build' | 'analyzing' | 'email' | 'result' | 'fixtures';

const STAGE_KEYS = ['ucl.stage.reading', 'ucl.stage.measuring', 'ucl.stage.finding'];

const FantasyUCL = () => {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('start');
  const [squad, setSquad] = useState<Squad | null>(null);
  const [source, setSource] = useState<'screenshot' | 'manual'>('manual');
  const [unresolved, setUnresolved] = useState<string[]>([]);
  const [stage, setStage] = useState(0);
  const [result, setResult] = useState<RatingResult | null>(null);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [showAllTransfers, setShowAllTransfers] = useState(false);

  // Advance the progress copy while the request is in flight. Purely cosmetic —
  // the real work is one round trip, but a blank wait reads as a hang.
  useEffect(() => {
    if (step !== 'analyzing') return;
    setStage(0);
    const id = setInterval(() => setStage((s) => Math.min(s + 1, STAGE_KEYS.length - 1)), 1400);
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
    async (next: Squad, src: 'screenshot' | 'manual', withEmail?: string) => {
      setSquad(next);
      setSource(src);
      setStep('analyzing');
      try {
        const r = await rateSquad(next, { source: src, language, email: withEmail ?? null });
        setResult(r);
        // Gate the score behind an email the first time only.
        setStep(withEmail ? 'result' : 'email');
      } catch (err) {
        toast({
          title: t('ucl.error'),
          description: err instanceof Error ? err.message : String(err),
          variant: 'destructive',
        });
        setStep(src === 'screenshot' ? 'import' : 'build');
      }
    },
    [language, t, toast],
  );

  const handleFile = async (file: File) => {
    setBusy(true);
    setStep('analyzing');
    try {
      const b64 = await fileToBase64(file);
      const parsed = await parseScreenshot(b64);
      setUnresolved(parsed.unresolved ?? []);
      const next: Squad = {
        formation: parsed.formation,
        starters: parsed.starters ?? [],
        bench: parsed.bench ?? [],
      };
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

  const submitEmail = async () => {
    if (!squad) return;
    setBusy(true);
    try {
      await rateSquad(squad, { source, language, email: email.trim() });
      setStep('result');
    } catch {
      // The score is already computed; a failed capture must not block it.
      setStep('result');
    } finally {
      setBusy(false);
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
    await analyze(next, source, email.trim() || undefined);
  };

  const reset = () => {
    setStep('start');
    setSquad(null);
    setResult(null);
    setUnresolved([]);
    setEmail('');
    setShowAllTransfers(false);
  };

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-lg px-4 pb-24 pt-6">
        {step !== 'start' && (
          <button
            type="button"
            onClick={reset}
            className="mb-4 flex items-center gap-1 text-xs text-muted-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t('ucl.startOver')}
          </button>
        )}

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
              <Button
                variant="ghost"
                className="h-12 w-full justify-start gap-3"
                onClick={() => setStep('fixtures')}
              >
                <CalendarDays className="h-4 w-4" />
                {t('ucl.viewFixtures')}
              </Button>
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

            {unresolved.length > 0 && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-400">
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
            <FixturesCalendar />
          </div>
        )}

        {step === 'build' && (
          <div className="space-y-4">
            <h2 className="font-display text-2xl uppercase">{t('ucl.buildTitle')}</h2>
            <SquadBuilder submitting={busy} onSubmit={(s) => analyze(s, 'manual')} />
          </div>
        )}

        {step === 'analyzing' && (
          <div className="space-y-6 pt-10">
            <div className="text-center">
              <div className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {t('ucl.holdOn')}
              </div>
              <h2 className="mt-2 font-display text-2xl uppercase">{t('ucl.analyzingTitle')}</h2>
            </div>
            <div className="space-y-3">
              {STAGE_KEYS.map((key, i) => (
                <div key={key} className="space-y-1">
                  <div className="text-xs text-muted-foreground">{t(key)}</div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-700"
                      style={{ width: i < stage ? '100%' : i === stage ? '60%' : '0%' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 'email' && result && (
          <div className="space-y-5 pt-6 text-center">
            <div>
              <div className="font-sans text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
                {t('ucl.almostThere')}
              </div>
              <h2 className="mt-2 font-display text-2xl uppercase">{t('ucl.ratingReady')}</h2>
              <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">{t('ucl.emailWhy')}</p>
            </div>
            <Input
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('ucl.emailPlaceholder')}
            />
            <Button className="w-full" disabled={busy || !email.includes('@')} onClick={submitEmail}>
              {t('ucl.seeMyRating')}
            </Button>
            <button
              type="button"
              onClick={() => setStep('result')}
              className="text-xs text-muted-foreground underline"
            >
              {t('ucl.skipEmail')}
            </button>
          </div>
        )}

        {step === 'result' && result && squad && (
          <div className="space-y-6">
            <div className="text-center">
              <RatingRing value={result.rating} />
              <h2 className="mt-3 font-display text-2xl uppercase">{t('ucl.teamRated')}</h2>
              {result.narrative?.verdict && (
                <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                  {result.narrative.verdict}
                </p>
              )}
            </div>

            <PitchView
              starters={squad.starters}
              bench={squad.bench}
              benchLabel={t('ucl.bench')}
              emptyLabel={t('ucl.unknown')}
            />

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
                  <div key={i} className="rounded-lg border border-border bg-card/60 p-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <span className="text-muted-foreground line-through">{s.out}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-primary" />
                      <span>{s.in}</span>
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

            <div className="space-y-2">
              <h3 className="flex items-center gap-2 font-display text-sm uppercase tracking-wide">
                <CalendarDays className="h-4 w-4 text-primary" />
                {t('ucl.fixturesTitle')}
              </h3>
              <FixturesCalendar />
            </div>

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
