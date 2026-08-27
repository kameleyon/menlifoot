import { useEffect, useMemo, useState } from 'react';
import { Search, X, Star } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import PitchView from './PitchView';
import {
  FORMATIONS,
  formationSlots,
  searchPlayers,
  type Position,
  type Squad,
  type SquadSlot,
  type UclPlayer,
} from '@/lib/uclFantasy';

interface Props {
  onSubmit: (squad: Squad) => void;
  submitting?: boolean;
}

const BENCH_SHAPE: Position[] = ['GK', 'DEF', 'MID', 'FWD'];

const emptySlot = (position: Position): SquadSlot => ({ player_id: null, position });

const buildStarters = (formation: string): SquadSlot[] => {
  const slots = formationSlots(formation);
  return (['GK', 'DEF', 'MID', 'FWD'] as Position[]).flatMap((pos) =>
    Array.from({ length: slots[pos] }, () => emptySlot(pos)),
  );
};

const SquadBuilder = ({ onSubmit, submitting = false }: Props) => {
  const { t } = useLanguage();
  const [formation, setFormation] = useState<string>('4-3-3');
  const [starters, setStarters] = useState<SquadSlot[]>(() => buildStarters('4-3-3'));
  const [bench, setBench] = useState<SquadSlot[]>(() => BENCH_SHAPE.map(emptySlot));
  const [picking, setPicking] = useState<{ index: number; onBench: boolean; position: Position } | null>(
    null,
  );
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UclPlayer[]>([]);
  const [loading, setLoading] = useState(false);

  // Changing formation rebuilds the pitch. Players already picked are carried
  // over per position so a manager doesn't lose their whole XI to a reshape.
  const changeFormation = (next: string) => {
    const carried = [...starters];
    const rebuilt = buildStarters(next).map((slot) => {
      const idx = carried.findIndex((c) => c.position === slot.position && c.player_id);
      if (idx === -1) return slot;
      const [taken] = carried.splice(idx, 1);
      return taken;
    });
    setFormation(next);
    setStarters(rebuilt);
  };

  useEffect(() => {
    if (!picking) return;
    let cancelled = false;
    setLoading(true);
    searchPlayers(query, picking.position)
      .then((r) => !cancelled && setResults(r))
      .catch(() => !cancelled && setResults([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [query, picking]);

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
    };
    if (picking.onBench) {
      setBench((b) => b.map((s, i) => (i === picking.index ? slot : s)));
    } else {
      setStarters((s) => s.map((x, i) => (i === picking.index ? { ...slot, is_captain: x.is_captain } : x)));
    }
    setPicking(null);
    setQuery('');
  };

  const setCaptain = (index: number) =>
    setStarters((s) => s.map((x, i) => ({ ...x, is_captain: i === index })));

  const filled = starters.filter((s) => s.player_id).length;
  const hasCaptain = starters.some((s) => s.is_captain);
  const ready = filled === starters.length && hasCaptain;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">{t('ucl.formation')}</span>
        {FORMATIONS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => changeFormation(f)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              formation === f
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/70'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <PitchView
        starters={starters}
        bench={bench}
        benchLabel={t('ucl.bench')}
        emptyLabel={t('ucl.addPlayer')}
        onSlotClick={(slot, index, onBench) =>
          setPicking({ index, onBench, position: (slot.position ?? 'MID') as Position })
        }
      />

      {/* Captain picker — only meaningful once there is someone to captain. */}
      {filled > 0 && (
        <div className="rounded-lg border border-border bg-card/60 p-3">
          <div className="mb-2 text-xs font-medium text-muted-foreground">{t('ucl.pickCaptain')}</div>
          <div className="flex flex-wrap gap-2">
            {starters.map((s, i) =>
              s.player_id ? (
                <button
                  key={i}
                  type="button"
                  onClick={() => setCaptain(i)}
                  className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs transition-colors ${
                    s.is_captain
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/70'
                  }`}
                >
                  {s.is_captain && <Star className="h-3 w-3" />}
                  {s.display_name ?? s.name}
                </button>
              ) : null,
            )}
          </div>
        </div>
      )}

      <Button className="w-full" disabled={!ready || submitting} onClick={() => onSubmit({ formation, starters, bench })}>
        {submitting
          ? t('ucl.analyzing')
          : ready
          ? t('ucl.rateMyTeam')
          : !hasCaptain && filled === starters.length
          ? t('ucl.needCaptain')
          : `${filled}/${starters.length} ${t('ucl.playersPicked')}`}
      </Button>

      {picking && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center">
          <div className="max-h-[75vh] w-full max-w-md overflow-hidden rounded-t-2xl bg-card sm:rounded-2xl">
            <div className="flex items-center gap-2 border-b border-border p-3">
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
            <div className="max-h-[60vh] overflow-y-auto">
              {loading && <div className="p-4 text-sm text-muted-foreground">{t('ucl.loading')}</div>}
              {!loading && results.length === 0 && (
                <div className="p-4 text-sm text-muted-foreground">{t('ucl.noPlayers')}</div>
              )}
              {results.map((p) => {
                const taken = chosenIds.has(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={taken}
                    onClick={() => assign(p)}
                    className="flex w-full items-center justify-between gap-2 border-b border-border/50 p-3 text-left disabled:opacity-40"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{p.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {p.team} · {p.position}
                        {p.availability !== 'available' && ` · ${p.availability}`}
                      </div>
                    </div>
                    {p.price != null && (
                      <span className="shrink-0 text-xs text-muted-foreground">£{p.price.toFixed(1)}m</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SquadBuilder;
