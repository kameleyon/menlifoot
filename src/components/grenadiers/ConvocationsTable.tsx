import { useMemo, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { HaitiConvocation, fullName, formatDateFr } from '@/types/grenadiers';

interface Props {
  convocations: HaitiConvocation[];
}

const ConvocationsTable = ({ convocations }: Props) => {
  const tournaments = useMemo(
    () => Array.from(new Set(convocations.map((c) => c.tournament).filter(Boolean))) as string[],
    [convocations],
  );
  const [tournament, setTournament] = useState<string>('all');

  const rows = useMemo(
    () =>
      convocations
        .filter((c) => tournament === 'all' || c.tournament === tournament)
        .sort((a, b) => (b.match_date ?? '').localeCompare(a.match_date ?? '')),
    [convocations, tournament],
  );

  if (convocations.length === 0) return <p className="py-10 text-center text-muted-foreground">Aucune convocation disponible.</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Tournoi</span>
        <Select value={tournament} onValueChange={setTournament}>
          <SelectTrigger className="w-[280px] max-w-full">
            <SelectValue placeholder="Tous les tournois" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les tournois</SelectItem>
            {tournaments.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{rows.length} match(s)</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/50">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-gradient-card text-[11px] uppercase text-muted-foreground">
            <tr>
              {['Joueur', 'Tournoi', 'Date', 'Adversaire', 'Lieu', 'Résultat', 'Présence', 'Buts', 'Min'].map((h) => (
                <th key={h} className="whitespace-nowrap px-3 py-2 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const present = (c.present_absent ?? '').toLowerCase().includes('présent');
              return (
                <tr key={c.id} className="border-t border-border/30 transition-colors hover:bg-gradient-card/40">
                  <td className="whitespace-nowrap px-3 py-2 font-medium text-foreground">{fullName(c)}</td>
                  <td className="px-3 py-2 text-foreground/80">{c.tournament ?? '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-foreground/80">{formatDateFr(c.match_date) ?? '—'}</td>
                  <td className="px-3 py-2">{c.opponent ?? '—'}</td>
                  <td className="px-3 py-2 text-foreground/80">{c.location ?? '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2">{c.result ?? '—'}</td>
                  <td className={`px-3 py-2 ${present ? 'text-emerald-400' : 'text-muted-foreground'}`}>{c.present_absent ?? c.callup_status ?? '—'}</td>
                  <td className="px-3 py-2 font-medium text-primary">{c.goals ?? '—'}</td>
                  <td className="px-3 py-2">{c.minutes ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ConvocationsTable;
