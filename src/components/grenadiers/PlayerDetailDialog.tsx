import { Instagram, Youtube, Globe, Music2, Twitter, ShoppingBag } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  HaitiPlayer, HaitiStat, HaitiConvocation,
  fullName, initials, formatEuro, formatDateFr, ageFrom,
} from '@/types/grenadiers';

interface Props {
  player: HaitiPlayer | null;
  stats: HaitiStat[];
  convocations: HaitiConvocation[];
  onOpenChange: (open: boolean) => void;
}

const Info = ({ label, value }: { label: string; value: React.ReactNode }) =>
  value == null || value === '' ? null : (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  );

const socialLink = (href: string | null, handle?: boolean) => {
  if (!href) return null;
  if (href.startsWith('http')) return href;
  if (handle) {
    const h = href.replace(/^@/, '');
    return `https://instagram.com/${h}`; // fallback; overridden per-network below
  }
  return href;
};

const PlayerDetailDialog = ({ player, stats, convocations, onOpenChange }: Props) => {
  if (!player) return null;
  const age = ageFrom(player.birth_date);
  const socials: { icon: typeof Instagram; url: string | null; label: string }[] = [
    { icon: Instagram, url: player.instagram && (player.instagram.startsWith('http') ? player.instagram : `https://instagram.com/${player.instagram.replace(/^@/, '')}`), label: 'Instagram' },
    { icon: Twitter, url: player.twitter && (player.twitter.startsWith('http') ? player.twitter : `https://x.com/${player.twitter.replace(/^@/, '')}`), label: 'X' },
    { icon: Music2, url: player.tiktok && (player.tiktok.startsWith('http') ? player.tiktok : `https://tiktok.com/@${player.tiktok.replace(/^@/, '')}`), label: 'TikTok' },
    { icon: Youtube, url: socialLink(player.youtube), label: 'YouTube' },
    { icon: Globe, url: socialLink(player.website), label: 'Site' },
  ];

  return (
    <Dialog open={!!player} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto bg-background">
        <DialogHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border-2 border-primary/40">
              <AvatarFallback className="bg-gradient-card font-display text-lg text-primary">{initials(player)}</AvatarFallback>
            </Avatar>
            <div>
              <DialogTitle className="text-left font-display text-2xl font-light tracking-wide text-gradient-gold">
                {fullName(player)}
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                {[player.position, player.jersey_number != null ? `#${player.jersey_number}` : null].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Profile */}
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Info label="Club actuel" value={player.current_club} />
          <Info label="Pays du club" value={player.club_country} />
          <Info label="Naissance" value={[formatDateFr(player.birth_date), age ? `(${age} ans)` : null].filter(Boolean).join(' ')} />
          <Info label="Lieu de naissance" value={player.birth_place} />
          <Info label="Valeur marchande" value={formatEuro(player.market_value_eur)} />
          <Info label="Statut" value={player.status} />
          <Info label="Contrat" value={player.contract_end ? `${formatDateFr(player.contract_start) ?? '?'} → ${formatDateFr(player.contract_end)}` : null} />
          <Info label="Agent" value={player.agent} />
          <Info label="Blessures récentes" value={player.recent_injuries} />
        </dl>

        {player.clubs_history && (
          <div>
            <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Parcours</p>
            <p className="text-sm text-foreground/80">{player.clubs_history}</p>
          </div>
        )}

        {/* Socials + merch */}
        {(socials.some((s) => s.url) || player.merch_personal_url || player.merch_club_url) && (
          <div className="flex flex-wrap items-center gap-2">
            {socials.filter((s) => s.url).map((s) => (
              <a key={s.label} href={s.url!} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-border/50 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary">
                <s.icon className="h-3.5 w-3.5" /> {s.label}
              </a>
            ))}
            {[{ url: player.merch_personal_url, label: 'Merch perso' }, { url: player.merch_club_url, label: 'Merch club' }]
              .filter((m) => m.url).map((m) => (
                <a key={m.label} href={m.url!} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/50 px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary">
                  <ShoppingBag className="h-3.5 w-3.5" /> {m.label}
                </a>
              ))}
          </div>
        )}

        {/* Stats */}
        {stats.length > 0 && (
          <section>
            <h4 className="mb-2 font-display text-sm uppercase tracking-wide text-primary">Statistiques</h4>
            <div className="overflow-x-auto rounded-lg border border-border/50">
              <table className="w-full text-sm">
                <thead className="bg-gradient-card text-[11px] uppercase text-muted-foreground">
                  <tr>
                    {['Saison', 'Compétition', 'Club/Sél.', 'MJ', 'Buts', 'PD', 'Note'].map((h) => (
                      <th key={h} className="px-2 py-1.5 text-left font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.map((s) => (
                    <tr key={s.id} className="border-t border-border/30">
                      <td className="px-2 py-1.5">{s.season ?? '—'}</td>
                      <td className="px-2 py-1.5">{s.competition ?? '—'}</td>
                      <td className="px-2 py-1.5">{s.club_or_selection ?? '—'}</td>
                      <td className="px-2 py-1.5">{s.matches_played ?? '—'}</td>
                      <td className="px-2 py-1.5">{s.goals ?? '—'}</td>
                      <td className="px-2 py-1.5">{s.assists ?? '—'}</td>
                      <td className="px-2 py-1.5">{s.avg_rating ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Convocations */}
        {convocations.length > 0 && (
          <section>
            <h4 className="mb-2 font-display text-sm uppercase tracking-wide text-primary">
              Convocations <span className="text-muted-foreground">({convocations.length})</span>
            </h4>
            <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
              {convocations.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/40 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate text-foreground">{c.tournament ?? '—'}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[formatDateFr(c.match_date), c.opponent ? `vs ${c.opponent}` : null].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-xs">
                    {c.result && <span className="text-foreground/80">{c.result}</span>}
                    <span className={`rounded px-1.5 py-0.5 ${(c.present_absent ?? '').toLowerCase().includes('présent') ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                      {c.present_absent ?? c.callup_status ?? ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {player.notes && <p className="text-xs italic text-muted-foreground">{player.notes}</p>}
      </DialogContent>
    </Dialog>
  );
};

export default PlayerDetailDialog;
