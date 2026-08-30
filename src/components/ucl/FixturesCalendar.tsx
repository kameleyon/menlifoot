import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  getFixtures,
  getLoadedMatchdays,
  getTeamCrests,
  type Competition,
  type Fixture,
  type Matchday,
} from '@/lib/uclFantasy';

/**
 * League-phase fixtures, grouped by day.
 *
 * The Premier League shows a weekly gameweek; the UCL league phase is 8
 * matchdays played Tue/Wed/Thu across the season, so the pager steps matchdays
 * rather than weeks. Kick-offs render in the viewer's local timezone.
 */
/**
 * Club badge, falling back to initials. The provider has crests for about two
 * thirds of the field, so a missing one must look deliberate rather than broken.
 */
const Crest = ({ team, src }: { team: string; src?: string }) =>
  src ? (
    <img src={src} alt="" loading="lazy" className="h-5 w-5 shrink-0 object-contain" />
  ) : (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[8px] font-bold text-muted-foreground">
      {team.replace(/[^A-Za-z ]/g, '').split(' ').map((w) => w[0]).join('').slice(0, 3).toUpperCase()}
    </span>
  );

const FixturesCalendar = ({ competition = 'UCL' }: { competition?: Competition }) => {
  const { t, language } = useLanguage();
  const [available, setAvailable] = useState<number[]>([]);
  const [matchday, setMatchday] = useState<number | null>(null);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [meta, setMeta] = useState<Matchday | null>(null);
  const [loading, setLoading] = useState(true);
  const [crests, setCrests] = useState<Record<string, string>>({});

  useEffect(() => {
    getTeamCrests(competition).then(setCrests).catch(() => setCrests({}));
  }, [competition]);

  useEffect(() => {
    getLoadedMatchdays(competition)
      .then((mds) => {
        setAvailable(mds);
        // Open on the round in progress rather than the first of the season.
        setMatchday((cur) => cur ?? mds[0] ?? null);
      })
      .catch(() => setAvailable([]))
      .finally(() => setLoading(false));
  }, [competition]);

  useEffect(() => {
    if (matchday == null) return;
    setLoading(true);
    getFixtures(matchday, competition)
      .then(({ fixtures: f, matchday: m }) => {
        setFixtures(f);
        setMeta(m);
      })
      .catch(() => setFixtures([]))
      .finally(() => setLoading(false));
  }, [matchday, competition]);

  const locale = { en: 'en-GB', fr: 'fr-FR', es: 'es-ES', ht: 'fr-FR' }[language as string] ?? 'en-GB';

  // Group by local calendar day so the list reads like a schedule, not a table.
  const byDay = useMemo(() => {
    const groups = new Map<string, Fixture[]>();
    for (const f of fixtures) {
      const key = f.kickoff
        ? new Date(f.kickoff).toLocaleDateString(locale, {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          })
        : t('ucl.tbd');
      groups.set(key, [...(groups.get(key) ?? []), f]);
    }
    return [...groups.entries()];
  }, [fixtures, locale, t]);

  const idx = matchday == null ? -1 : available.indexOf(matchday);
  const time = (iso: string | null) =>
    iso ? new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : '--:--';

  if (!loading && available.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card/60 p-6 text-center">
        <CalendarDays className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t('ucl.noFixtures')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          disabled={idx <= 0}
          onClick={() => setMatchday(available[idx - 1])}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border disabled:opacity-30"
          aria-label={t('ucl.previousMatchday')}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="text-center">
          <div className="font-display text-lg uppercase">
            {t('ucl.matchday')} {matchday ?? '—'}
          </div>
          {meta?.deadline && (
            <div className="text-[11px] text-muted-foreground">
              {t('ucl.deadline')}:{' '}
              {new Date(meta.deadline).toLocaleString(locale, {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          )}
          <div className="text-[10px] text-muted-foreground">{t('ucl.localTimes')}</div>
        </div>

        <button
          type="button"
          disabled={idx < 0 || idx >= available.length - 1}
          onClick={() => setMatchday(available[idx + 1])}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-border disabled:opacity-30"
          aria-label={t('ucl.nextMatchday')}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : (
        byDay.map(([day, list]) => (
          <div key={day} className="space-y-1">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {day}
            </div>
            <div className="overflow-hidden rounded-lg border border-border">
              {list.map((f) => {
                const played = f.home_score != null && f.away_score != null;
                return (
                  <div
                    key={f.id}
                    className="flex items-center gap-2 border-b border-border/50 px-3 py-2.5 last:border-b-0"
                  >
                    <span className="flex flex-1 items-center justify-end gap-1.5 truncate text-sm">
                      <span className="truncate">{f.home_team}</span>
                      <Crest team={f.home_team} src={crests[f.home_team]} />
                    </span>
                    <span
                      className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold tabular-nums ${
                        played ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {played ? `${f.home_score}–${f.away_score}` : time(f.kickoff)}
                    </span>
                    <span className="flex flex-1 items-center gap-1.5 truncate text-sm">
                      <Crest team={f.away_team} src={crests[f.away_team]} />
                      <span className="truncate">{f.away_team}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default FixturesCalendar;
