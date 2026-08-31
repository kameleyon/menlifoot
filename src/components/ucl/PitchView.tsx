import { AlertTriangle, Plus, Repeat2, Cross, X } from 'lucide-react';
import { formatPrice, type Position, type SquadSlot } from '@/lib/uclFantasy';

interface Props {
  starters: SquadSlot[];
  bench: SquadSlot[];
  benchLabel: string;
  onSlotClick?: (slot: SquadSlot, index: number, onBench: boolean) => void;
  /** Empty a slot without having to pick a replacement first. */
  onRemove?: (index: number, onBench: boolean) => void;
  /** Start or complete a swap between two slots. */
  onSwap?: (index: number, onBench: boolean) => void;
  /** The slot waiting for a partner, if a swap is half-made. */
  swapping?: { index: number; onBench: boolean } | null;
  emptyLabel?: string;
}

const LINES: Position[] = ['GK', 'DEF', 'MID', 'FWD'];

const PlayerCard = ({
  slot,
  onClick,
  onRemove,
  onSwap,
  armed,
  emptyLabel,
}: {
  slot: SquadSlot;
  onClick?: () => void;
  onRemove?: () => void;
  onSwap?: () => void;
  /** This card is the one waiting for a partner. */
  armed?: boolean;
  emptyLabel?: string;
}) => {
  const interactive = Boolean(onClick);
  const unresolved = !slot.player_id;
  // A triangle means "we read a name here and could not match it", not "this
  // slot is empty". Flagging every empty slot on a fresh squad put fourteen
  // warnings on screen before the manager had done anything wrong.
  const unreadable = unresolved && Boolean(slot.read_as);
  // An unavailable starter is the single most costly thing in a squad, and it
  // was invisible: the pitch showed nothing to distinguish him from a fit one.
  const out = slot.availability === 'injured' || slot.availability === 'unavailable' ||
    slot.availability === 'suspended';
  const doubtful = slot.availability === 'doubtful';
  const name = slot.display_name || slot.name || slot.read_as || emptyLabel || '—';

  return (
    <div
      className={`relative flex w-[92px] flex-col items-center gap-1 rounded-lg ${
        armed ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''
      }`}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        className="flex w-full flex-col items-center gap-1 disabled:cursor-default"
      >
      <div className="relative">
        {/* Initials, not a photo. The published headshots lag transfers badly
            enough to show players in a former club's kit, which reads as a bug
            rather than a stale image. */}
        {/* Filled slots are solid, empty ones are a dashed outline. Without
            photos this is the only thing telling a manager at a glance how much
            of the squad is actually picked. */}
        <span
          className={`flex h-11 w-11 items-center justify-center rounded-full border-2 text-[11px] font-semibold ${
            unresolved
              ? 'border-dashed border-muted-foreground/50 bg-muted/40 text-muted-foreground'
              : out
              ? 'border-destructive bg-destructive/30 text-foreground'
              : 'border-primary bg-primary text-primary-foreground'
          }`}
        >
          {slot.team_code ?? (unresolved ? '?' : name.slice(0, 3).toUpperCase())}
        </span>
        {/* A corner badge is what tells a manager the card does something:
            plus for an empty slot, swap arrows for one already filled. */}
        {/* The arrows used to be decoration saying "this card is tappable".
            They are the swap control now: press one, press another, the two
            change places. Tapping the card itself still opens the picker, so
            replacing a player and moving one are separate gestures rather than
            two meanings for the same tap. */}
        {interactive && unresolved && (
          <span className="absolute -bottom-0.5 -left-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Plus className="h-2.5 w-2.5" />
          </span>
        )}
        {onSwap && !unresolved && (
          <span
            role="button"
            tabIndex={0}
            aria-label="Swap player"
            onClick={(e) => {
              e.stopPropagation();
              onSwap();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
                onSwap();
              }
            }}
            className={`absolute -bottom-0.5 -left-1 flex h-[18px] w-[18px] cursor-pointer items-center justify-center rounded-full transition-colors ${
              armed ? 'bg-primary text-black ring-2 ring-primary' : 'bg-black text-primary ring-1 ring-primary/60'
            }`}
          >
            <Repeat2 className="h-3 w-3" />
          </span>
        )}
        {(out || doubtful) && (
          <span
            title={slot.availability_note ?? slot.availability ?? ''}
            className={`absolute -bottom-0.5 -right-1 flex h-4 w-4 items-center justify-center rounded-full ${
              out
                ? 'bg-destructive text-destructive-foreground'
                : 'bg-destructive/50 text-destructive-foreground'
            }`}
          >
            <Cross className="h-2.5 w-2.5" />
          </span>
        )}
        {/* Armband badges, top-left.
            Gold on gold was invisible once the filled circle became solid
            primary - a gold C on a gold disc. Black ground with a gold letter
            and a gold ring reads against the circle at any size and stays on
            the two colours the rest of the pitch uses.

            Top-left because the remove control took the top-right corner. The
            only other thing that sits here is the unreadable-name warning, and
            that appears only on an empty slot, which by definition has no
            captain. */}
        {slot.is_captain && (
          <span className="absolute -left-1 -top-1 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-black text-[11px] font-bold leading-none text-primary ring-2 ring-primary">
            C
          </span>
        )}
        {slot.is_vice && !slot.is_captain && (
          <span className="absolute -left-1 -top-1 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-black text-[11px] font-bold leading-none text-foreground ring-2 ring-foreground/50">
            V
          </span>
        )}
        {unreadable && (
          <AlertTriangle className="absolute -left-1 -top-1 h-4 w-4 text-primary" />
        )}
      </div>
      <span
        className={`w-full truncate rounded px-1 py-0.5 text-center text-[11px] font-medium ${
          out ? 'bg-destructive/20 text-destructive' : 'bg-card/90'
        }`}
      >
        {name}
      </span>
      {/* Expected points lead, price follows. The projection is the thing a
          manager is deciding on; the price is what they already paid. */}
      <span className="flex items-baseline gap-1 text-[10px] leading-tight">
        {slot.projected_points != null && (
          <span className="font-semibold text-primary">
            {slot.projected_points.toFixed(1)}
          </span>
        )}
        <span className="truncate text-muted-foreground">
          {formatPrice(slot.price) ?? slot.team ?? ''}
        </span>
      </span>
      </button>

      {/* Clearing a slot is its own action: a manager often wants a player out
          before deciding who replaces him, and tapping the card opens the
          picker instead. */}
      {onRemove && !unresolved && (
        <button
          type="button"
          aria-label={`Remove ${name}`}
          onClick={onRemove}
          className="absolute right-1 top-[-5px] flex h-4 w-4 items-center justify-center rounded-full bg-black text-primary ring-1 ring-primary/60 transition-transform hover:scale-110"
        >
          <X className="h-2.5 w-2.5" strokeWidth={3} />
        </button>
      )}
    </div>
  );
};

const PitchView = ({
  starters,
  bench,
  benchLabel,
  onSlotClick,
  onRemove,
  onSwap,
  swapping,
  emptyLabel,
}: Props) => {
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
                  onRemove={onRemove ? () => onRemove(i, false) : undefined}
                  onSwap={onSwap ? () => onSwap(i, false) : undefined}
                  armed={swapping?.onBench === false && swapping?.index === i}
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
                onRemove={onRemove ? () => onRemove(i, true) : undefined}
                onSwap={onSwap ? () => onSwap(i, true) : undefined}
                armed={swapping?.onBench === true && swapping?.index === i}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PitchView;
