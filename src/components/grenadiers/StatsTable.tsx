import { useLanguage } from '@/contexts/LanguageContext';
import { HaitiStat, HaitiPlayer, fullName, localizeValue } from '@/types/grenadiers';

interface Props {
  stats: HaitiStat[];
  playersById: Record<string, HaitiPlayer>;
}

const StatsTable = ({ stats, playersById }: Props) => {
  const { t, language } = useLanguage();

  if (stats.length === 0) return <p className="py-10 text-center text-muted-foreground">{t('gren.noStats')}</p>;

  const headers = [
    'gren.thPlayer', 'gren.thSeason', 'gren.thCompetition',
    'gren.thMp', 'gren.thStarts', 'gren.thMin',
    'gren.thGoals', 'gren.thAssists', 'gren.thYellow', 'gren.thRed', 'gren.thRating',
  ];

  return (
    <div className="overflow-x-auto rounded-xl border border-border/50">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="bg-gradient-card text-[11px] uppercase text-muted-foreground">
          <tr>
            {headers.map((h) => (
              <th key={h} className="whitespace-nowrap px-3 py-2 text-left font-medium">{t(h)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {stats.map((s) => {
            const p = s.player_id ? playersById[s.player_id] : undefined;
            return (
              <tr key={s.id} className="border-t border-border/30 transition-colors hover:bg-gradient-card/40">
                <td className="whitespace-nowrap px-3 py-2 font-medium text-foreground">{p ? fullName(p) : s.player_id ?? '—'}</td>
                <td className="whitespace-nowrap px-3 py-2 text-foreground/80">{localizeValue(s.season, language) ?? '—'}</td>
                <td className="px-3 py-2 text-foreground/80">{localizeValue(s.competition, language) ?? '—'}</td>
                <td className="px-3 py-2">{s.matches_played ?? '—'}</td>
                <td className="px-3 py-2">{s.starts ?? '—'}</td>
                <td className="px-3 py-2">{s.minutes ?? '—'}</td>
                <td className="px-3 py-2 font-medium text-primary">{s.goals ?? '—'}</td>
                <td className="px-3 py-2">{s.assists ?? '—'}</td>
                <td className="px-3 py-2">{s.yellow_cards ?? '—'}</td>
                <td className="px-3 py-2">{s.red_cards ?? '—'}</td>
                <td className="px-3 py-2">{s.avg_rating ?? '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default StatsTable;
