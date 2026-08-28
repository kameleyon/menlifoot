import { AlertTriangle } from 'lucide-react';
import { formatPrice, type Position, type SquadSlot } from '@/lib/uclFantasy';

interface Props {
  starters: SquadSlot[];
  bench: SquadSlot[];
  benchLabel: string;
  onSlotClick?: (slot: SquadSlot, index: number, onBench: boolean) => void;
  emptyLabel?: string;
}

const LINES: Position[] = ['GK', 'DEF', 'MID', 'FWD'];

const PlayerCard = ({
  slot,
  onClick,
  emptyLabel,
}: {
  slot: SquadSlot;
  onClick?: () => void;
  emptyLabel?: string;
}) => {
  const unresolved = !slot.player_id;
  const name = slot.display_name || slot.name || slot.read_as || emptyLabel || '—';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="flex w-[92px] flex-col items-center gap-1 disabled:cursor-default"
    >
      <div className="relative">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-full border-2 text-[11px] font-semibold ${
            unresolved
              ? 'border-dashed border-muted-foreground/50 bg-muted/40 text-muted-foreground'
              : 'border-primary/60 bg-card text-foreground'
          }`}
        >
          {slot.team_code ?? (unresolved ? '?' : name.slice(0, 3).toUpperCase())}
        </div>
        {slot.is_captain && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            C
          </span>
        )}
        {slot.is_vice && !slot.is_captain && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-foreground">
            V
          </span>
        )}
        {unresolved && (
          <AlertTriangle className="absolute -left-1 -top-1 h-4 w-4 text-amber-500" />
        )}
      </div>
      <span className="w-full truncate rounded bg-card/90 px-1 py-0.5 text-center text-[11px] font-medium">
        {name}
      </span>
      {/* Price is null until the UEFA game opens; show the club instead. */}
      <span className="text-[10px] text-muted-foreground">
        {formatPrice(slot.price) ?? slot.team ?? ''}
      </span>
    </button>
  );
};

const PitchView = ({ starters, bench, benchLabel, onSlotClick, emptyLabel }: Props) => {
  const lines = LINES.map((pos) => ({
    pos,
    players: starters
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => s.position === pos),
  })).filter((l) => l.players.length > 0);

  return (
    <div className="space-y-3">
      <div
        className="rounded-xl border border-primary/25 p-4"
        style={{
          background:
            'linear-gradient(180deg, hsl(var(--card)) 0%, hsl(var(--muted)) 100%)',
        }}
      >
        <div className="flex flex-col gap-5">
          {lines.map(({ pos, players }) => (
            <div key={pos} className="flex flex-wrap items-start justify-center gap-2">
              {players.map(({ s, i }) => (
                <PlayerCard
                  key={`${pos}-${i}`}
                  slot={s}
                  emptyLabel={emptyLabel}
                  onClick={onSlotClick ? () => onSlotClick(s, i, false) : undefined}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {bench.length > 0 && (
        <div className="rounded-xl border border-border bg-card/60 p-3">
          <div className="mb-2 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {benchLabel}
          </div>
          <div className="flex flex-wrap items-start justify-center gap-2">
            {bench.map((s, i) => (
              <PlayerCard
                key={`bench-${i}`}
                slot={s}
                emptyLabel={emptyLabel}
                onClick={onSlotClick ? () => onSlotClick(s, i, true) : undefined}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PitchView;
