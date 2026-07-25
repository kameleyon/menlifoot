import { motion } from 'framer-motion';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { HaitiPlayer, fullName, initials } from '@/types/grenadiers';

interface PlayerCardProps {
  player: HaitiPlayer;
  onClick: () => void;
}

const statusDot = (status: string | null) => {
  const s = (status ?? '').toLowerCase();
  if (s.includes('bless')) return 'bg-red-500';
  if (s.includes('suspend')) return 'bg-amber-500';
  if (s.includes('actif')) return 'bg-emerald-500';
  return 'bg-muted-foreground';
};

const PlayerCard = ({ player, onClick }: PlayerCardProps) => {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -4 }}
      className="group relative flex w-full flex-col items-center rounded-xl border border-border/50 bg-gradient-card p-5 text-center transition-colors hover:border-primary/60"
    >
      {player.jersey_number != null && (
        <span className="absolute right-3 top-3 font-display text-2xl font-light text-primary/70">
          {player.jersey_number}
        </span>
      )}

      <Avatar className="mb-3 h-20 w-20 border-2 border-primary/40">
        <AvatarFallback className="bg-background font-display text-xl text-primary">
          {initials(player)}
        </AvatarFallback>
      </Avatar>

      <h3 className="font-medium text-foreground">{fullName(player)}</h3>
      <p className="mt-0.5 text-xs uppercase tracking-wide text-muted-foreground">{player.position ?? '—'}</p>
      <p className="mt-1 line-clamp-1 text-sm text-foreground/80">{player.current_club ?? '—'}</p>

      {player.status && (
        <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border/50 px-2.5 py-0.5 text-[11px] text-muted-foreground">
          <span className={`h-1.5 w-1.5 rounded-full ${statusDot(player.status)}`} />
          {player.status}
        </span>
      )}
    </motion.button>
  );
};

export default PlayerCard;
