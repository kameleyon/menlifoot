import type { ReactNode } from 'react';
import { Lock, LogIn, Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

interface Props {
  /** Always rendered sharp: nobody should pay for something they cannot name. */
  title: string;
  icon: ReactNode;
  /** One line saying what unlocking actually gets them. Also sharp. */
  description?: string;
  /** Teaser shown behind the blur. Placeholder shapes only, never real data. */
  children: ReactNode;
  cost: number;
  balance: number | null;
  signedIn: boolean;
  busy?: boolean;
  onUnlock: () => void;
  onSignIn: () => void;
  onTopUp: () => void;
}

/**
 * A paid panel: legible header, blurred body, unlock control.
 *
 * The heading and description sit OUTSIDE the blur deliberately. Blurring them
 * too hides what the credit actually buys, which makes the price impossible to
 * judge and the whole panel read as a wall rather than an offer.
 *
 * The blur itself is presentation only — the real data never reaches the
 * browser until it is paid for, because the edge function omits unpaid fields
 * from the response entirely.
 */
const LockedPanel = ({
  title,
  icon,
  description,
  children,
  cost,
  balance,
  signedIn,
  busy = false,
  onUnlock,
  onSignIn,
  onTopUp,
}: Props) => {
  const { t } = useLanguage();
  const affordable = balance != null && balance >= cost;

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="flex items-start justify-between gap-3 border-b border-border/60 px-4 pb-2.5 pt-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 font-display text-sm uppercase tracking-wide">
            {icon}
            {title}
          </h3>
          {description && (
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{description}</p>
          )}
        </div>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">
          <Lock className="h-3 w-3" />
          {cost} {cost === 1 ? t('ucl.credit') : t('ucl.credits')}
        </span>
      </div>

      <div className="relative">
        <div aria-hidden className="pointer-events-none select-none blur-[6px] saturate-50 opacity-50">
          {children}
        </div>

        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/60 p-4 text-center">
          {!signedIn ? (
            <>
              <p className="max-w-[16rem] text-xs text-muted-foreground">
                {t('ucl.signInToUnlock')}
              </p>
              <Button size="sm" onClick={onSignIn}>
                <LogIn className="mr-1.5 h-3.5 w-3.5" />
                {t('ucl.signIn')}
              </Button>
            </>
          ) : affordable ? (
            <Button size="sm" disabled={busy} onClick={onUnlock}>
              {t('ucl.unlock')} · {cost}
            </Button>
          ) : (
            <>
              <p className="max-w-[16rem] text-xs text-muted-foreground">
                {t('ucl.notEnoughCredits')}
              </p>
              <Button size="sm" variant="outline" onClick={onTopUp}>
                <Coins className="mr-1.5 h-3.5 w-3.5" />
                {t('ucl.topUp')}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

/** Grey placeholder rows, used as the teaser behind a lock. */
export const PlaceholderRows = ({ rows = 3 }: { rows?: number }) => (
  <div className="space-y-2 p-3">
    {Array.from({ length: rows }, (_, i) => (
      <div key={i} className="space-y-1.5 rounded-lg border border-border/50 p-2.5">
        <div className="h-3 w-1/2 rounded bg-muted" />
        <div className="h-2.5 w-1/3 rounded bg-muted/60" />
      </div>
    ))}
  </div>
);

export default LockedPanel;
