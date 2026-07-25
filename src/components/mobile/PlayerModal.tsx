import { useLanguage } from '@/contexts/LanguageContext';
import {
  HaitiPlayer, HaitiStat, HaitiConvocation,
  fullName, initials, formatEuro, formatDate, ageFrom, localizeValue, localizePosition,
} from '@/types/grenadiers';

interface Props {
  player: HaitiPlayer | null;
  stats: HaitiStat[];
  convocations: HaitiConvocation[];
  caps: number | null;
  goals: number | null;
  onClose: () => void;
}

const Row = ({ label, value }: { label: string; value: React.ReactNode }) =>
  value == null || value === '' ? null : (
    <div className="flex justify-between bg-[#101012] px-[15px] py-[13px] font-sans text-[12px]">
      <span className="text-foreground/50">{label}</span><span>{value}</span>
    </div>
  );

const PlayerModal = ({ player, stats, convocations, caps, goals, onClose }: Props) => {
  const { t, language } = useLanguage();
  if (!player) return null;
  const age = ageFrom(player.birth_date);
  const keyStats = [
    { n: caps ?? '—', l: t('gren.thMp') },
    { n: goals ?? '—', l: t('gren.thGoals') },
    { n: player.jersey_number ?? '—', l: '#' },
  ];

  return (
    <div className="fixed inset-0 z-50 mx-auto max-w-[520px] overflow-y-auto bg-[#070708] text-foreground" style={{ animation: 'mlin .22s ease-out' }}>
      {/* Hero */}
      <div className="relative flex h-[300px] flex-col items-center justify-end" style={{ background: 'radial-gradient(120% 90% at 50% 10%,#1d1a14,#0a0a0b)' }}>
        <button onClick={onClose} className="absolute left-4 top-[52px] flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[#070708]/65 font-display text-[15px]">←</button>
        <div className="absolute top-[86px] flex h-[120px] w-[120px] items-center justify-center rounded-full border-2 border-primary/40 font-display text-[40px] text-primary">{initials(player)}</div>
        <div className="flex w-full flex-col gap-2 px-5 pb-5" style={{ background: 'linear-gradient(to top,rgba(7,7,8,.95),rgba(7,7,8,0))' }}>
          <span className="font-sans text-[9px] font-semibold uppercase tracking-[0.16em] text-primary">{localizeValue(player.selection, language) ?? 'Sélection'}</span>
          <span className="font-display text-[32px] uppercase leading-[0.95]">{fullName(player)}</span>
          <span className="font-sans text-[12px] text-foreground/50">{[localizePosition(player.position, language), player.current_club].filter(Boolean).join(' · ')}</span>
        </div>
      </div>

      {/* Key stats */}
      <div className="mt-px grid grid-cols-3 gap-px bg-white/[0.07]">
        {keyStats.map((s, i) => (
          <div key={i} className="flex flex-col items-center gap-[7px] bg-[#070708] px-3 py-[18px]">
            <span className="font-display text-[24px] text-primary">{s.n}</span>
            <span className="font-sans text-[9px] font-medium uppercase tracking-[0.1em] text-foreground/45">{s.l}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-4 px-5 pt-[22px]">
        {player.notes && <p className="m-0 font-sans text-[14px] leading-[1.6] text-foreground/75">{player.notes}</p>}

        {/* Info */}
        <div className="flex flex-col gap-px overflow-hidden rounded-xl bg-white/[0.06]">
          <Row label={t('gren.currentClub')} value={localizeValue(player.current_club, language)} />
          <Row label={t('gren.clubCountry')} value={localizeValue(player.club_country, language)} />
          <Row label={t('gren.birth')} value={[formatDate(player.birth_date, language), age ? `(${age} ${t('gren.years')})` : null].filter(Boolean).join(' ')} />
          <Row label="Position" value={localizePosition(player.position, language)} />
          <Row label={t('gren.marketValue')} value={formatEuro(player.market_value_eur)} />
          <Row label={t('gren.status')} value={localizeValue(player.status, language)} />
        </div>

        {/* Career stats */}
        {stats.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="font-display text-[15px] uppercase tracking-[0.04em]">{t('gren.statsTitle')}</span>
            <div className="overflow-x-auto rounded-xl border border-white/[0.07]">
              <table className="w-full text-[12px]">
                <thead className="bg-[#101012] text-[10px] uppercase text-foreground/45">
                  <tr>{['gren.thSeason', 'gren.thCompetition', 'gren.thMp', 'gren.thGoals'].map((h) => <th key={h} className="px-2.5 py-2 text-left font-medium">{t(h)}</th>)}</tr>
                </thead>
                <tbody>
                  {stats.map((s) => (
                    <tr key={s.id} className="border-t border-white/[0.05]">
                      <td className="px-2.5 py-2">{localizeValue(s.season, language) ?? '—'}</td>
                      <td className="px-2.5 py-2 text-foreground/80">{localizeValue(s.competition, language) ?? '—'}</td>
                      <td className="px-2.5 py-2">{s.matches_played ?? '—'}</td>
                      <td className="px-2.5 py-2 text-primary">{s.goals ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Call-ups */}
        {convocations.length > 0 && (
          <div className="flex flex-col gap-2 pb-8">
            <span className="font-display text-[15px] uppercase tracking-[0.04em]">{t('gren.callupsTitle')} <span className="text-foreground/40">({convocations.length})</span></span>
            <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto pr-1">
              {convocations.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.06] px-3 py-2 text-[12px]">
                  <div className="min-w-0">
                    <p className="truncate">{c.tournament ?? '—'}</p>
                    <p className="truncate text-[11px] text-foreground/40">{[formatDate(c.match_date, language), c.opponent ? `vs ${c.opponent}` : null].filter(Boolean).join(' · ')}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-foreground/70">{c.result ?? ''}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlayerModal;
