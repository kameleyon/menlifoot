import { useMemo, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { HaitiConvocation, fullName, formatDate, localizeValue } from '@/types/grenadiers';

interface Props {
  convocations: HaitiConvocation[];
}

const ConvocationsTable = ({ convocations }: Props) => {
  const { t, language } = useLanguage();
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

  if (convocations.length === 0) return <p className="py-10 text-center text-muted-foreground">{t('gren.noCallups')}</p>;

  const headers = [
    'gren.thPlayer', 'gren.thTournament', 'gren.thDate', 'gren.thOpponent',
    'gren.thLocation', 'gren.thResult', 'gren.thPresence', 'gren.thGoals', 'gren.thMin',
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">{t('gren.tournament')}</span>
        <Select value={tournament} onValueChange={setTournament}>
          <SelectTrigger className="w-[280px] max-w-full">
            <SelectValue placeholder={t('gren.allTournaments')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('gren.allTournaments')}</SelectItem>
            {tournaments.map((tn) => (
              <SelectItem key={tn} value={tn}>{tn}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{rows.length} {t('gren.matches')}</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/50">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-gradient-card text-[11px] uppercase text-muted-foreground">
            <tr>
              {headers.map((h) => (
                <th key={h} className="whitespace-nowrap px-3 py-2 text-left font-medium">{t(h)}</th>
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
                  <td className="whitespace-nowrap px-3 py-2 text-foreground/80">{formatDate(c.match_date, language) ?? '—'}</td>
                  <td className="px-3 py-2">{c.opponent ?? '—'}</td>
                  <td className="px-3 py-2 text-foreground/80">{c.location ?? '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2">{c.result ?? '—'}</td>
                  <td className={`px-3 py-2 ${present ? 'text-emerald-400' : 'text-muted-foreground'}`}>{localizeValue(c.present_absent ?? c.callup_status, language) ?? '—'}</td>
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
