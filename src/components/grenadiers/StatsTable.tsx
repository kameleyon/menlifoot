import { HaitiStat, HaitiPlayer, fullName } from '@/types/grenadiers';

interface Props {
  stats: HaitiStat[];
  playersById: Record<string, HaitiPlayer>;
}

const COLS = [
  ['Joueur', 'player'], ['Saison', 'season'], ['Compétition', 'competition'],
  ['MJ', 'matches_played'], ['Titu', 'starts'], ['Min', 'minutes'],
  ['Buts', 'goals'], ['PD', 'assists'], ['CJ', 'yellow_cards'], ['CR', 'red_cards'], ['Note', 'avg_rating'],
] as const;

const StatsTable = ({ stats, playersById }: Props) => {
  if (stats.length === 0) return <p className="py-10 text-center text-muted-foreground">Aucune statistique disponible.</p>;

  return (
    <div className="overflow-x-auto rounded-xl border border-border/50">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="bg-gradient-card text-[11px] uppercase text-muted-foreground">
          <tr>
            {COLS.map(([label]) => (
              <th key={label} className="whitespace-nowrap px-3 py-2 text-left font-medium">{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {stats.map((s) => {
            const p = s.player_id ? playersById[s.player_id] : undefined;
            return (
              <tr key={s.id} className="border-t border-border/30 transition-colors hover:bg-gradient-card/40">
                <td className="whitespace-nowrap px-3 py-2 font-medium text-foreground">{p ? fullName(p) : s.player_id ?? '—'}</td>
                <td className="whitespace-nowrap px-3 py-2 text-foreground/80">{s.season ?? '—'}</td>
                <td className="px-3 py-2 text-foreground/80">{s.competition ?? '—'}</td>
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
