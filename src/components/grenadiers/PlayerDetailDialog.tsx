import { Instagram, Youtube, Globe, Music2, Twitter, ShoppingBag } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  HaitiPlayer, HaitiStat, HaitiConvocation,
  fullName, initials, formatEuro, formatDate, ageFrom, localizePosition, localizeValue,
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

const PlayerDetailDialog = ({ player, stats, convocations, onOpenChange }: Props) => {
  const { t, language } = useLanguage();
  if (!player) return null;
  const age = ageFrom(player.birth_date);
  const socials: { icon: typeof Instagram; url: string | null; label: string }[] = [
    { icon: Instagram, url: player.instagram && (player.instagram.startsWith('http') ? player.instagram : `https://instagram.com/${player.instagram.replace(/^@/, '')}`), label: 'Instagram' },
    { icon: Twitter, url: player.twitter && (player.twitter.startsWith('http') ? player.twitter : `https://x.com/${player.twitter.replace(/^@/, '')}`), label: 'X' },
    { icon: Music2, url: player.tiktok && (player.tiktok.startsWith('http') ? player.tiktok : `https://tiktok.com/@${player.tiktok.replace(/^@/, '')}`), label: 'TikTok' },
    { icon: Youtube, url: player.youtube && (player.youtube.startsWith('http') ? player.youtube : null), label: 'YouTube' },
    { icon: Globe, url: player.website && (player.website.startsWith('http') ? player.website : null), label: 'Site' },
  ];

  const statHeaders = ['gren.thSeason', 'gren.thCompetition', 'gren.thClub', 'gren.thMp', 'gren.thGoals', 'gren.thAssists', 'gren.thRating'];

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
                {[localizePosition(player.position, language), player.jersey_number != null ? `#${player.jersey_number}` : null].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Profile */}
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Info label={t('gren.currentClub')} value={localizeValue(player.current_club, language)} />
          <Info label={t('gren.clubCountry')} value={localizeValue(player.club_country, language)} />
          <Info label={t('gren.birth')} value={[formatDate(player.birth_date, language), age ? `(${age} ${t('gren.years')})` : null].filter(Boolean).join(' ')} />
          <Info label={t('gren.birthPlace')} value={player.birth_place} />
          <Info label={t('gren.marketValue')} value={formatEuro(player.market_value_eur)} />
          <Info label={t('gren.status')} value={localizeValue(player.status, language)} />
          <Info label={t('gren.contract')} value={player.contract_end ? `${formatDate(player.contract_start, language) ?? '?'} → ${formatDate(player.contract_end, language)}` : null} />
          <Info label={t('gren.agent')} value={player.agent} />
          <Info label={t('gren.injuries')} value={localizeValue(player.recent_injuries, language)} />
        </dl>

        {player.clubs_history && (
          <div>
            <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">{t('gren.career')}</p>
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
            {[{ url: player.merch_personal_url, label: t('gren.merchPerso') }, { url: player.merch_club_url, label: t('gren.merchClub') }]
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
            <h4 className="mb-2 font-display text-sm uppercase tracking-wide text-primary">{t('gren.statsTitle')}</h4>
            <div className="overflow-x-auto rounded-lg border border-border/50">
              <table className="w-full text-sm">
                <thead className="bg-gradient-card text-[11px] uppercase text-muted-foreground">
                  <tr>
                    {statHeaders.map((h) => (
                      <th key={h} className="px-2 py-1.5 text-left font-medium">{t(h)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.map((s) => (
                    <tr key={s.id} className="border-t border-border/30">
                      <td className="px-2 py-1.5">{localizeValue(s.season, language) ?? '—'}</td>
                      <td className="px-2 py-1.5">{localizeValue(s.competition, language) ?? '—'}</td>
                      <td className="px-2 py-1.5">{localizeValue(s.club_or_selection, language) ?? '—'}</td>
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
              {t('gren.callupsTitle')} <span className="text-muted-foreground">({convocations.length})</span>
            </h4>
            <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
              {convocations.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/40 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate text-foreground">{c.tournament ?? '—'}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[formatDate(c.match_date, language), c.opponent ? `vs ${c.opponent}` : null].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-xs">
                    {c.result && <span className="text-foreground/80">{c.result}</span>}
                    <span className={`rounded px-1.5 py-0.5 ${(c.present_absent ?? '').toLowerCase().includes('présent') ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                      {localizeValue(c.present_absent ?? c.callup_status, language) ?? ''}
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
