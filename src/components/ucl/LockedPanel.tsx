import type { ReactNode } from 'react';
import { Lock, LogIn, Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

interface Props {
  /** Preview shown behind the blur. Must never be the real paid content. */
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
 * Blurs a teaser and offers to unlock it.
 *
 * The blur is presentation only — the real data never reaches the browser until
 * it is paid for, because the edge function omits unpaid fields from the
 * response entirely. What sits behind this blur is placeholder shapes, so
 * reading the DOM gains nothing.
 */
const LockedPanel = ({
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
    <div className="relative overflow-hidden rounded-xl border border-border">
      <div aria-hidden className="pointer-events-none select-none blur-[6px] saturate-50 opacity-60">
        {children}
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/70 p-4 text-center backdrop-blur-[2px]">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Lock className="h-3.5 w-3.5" />
          {cost} {cost === 1 ? t('ucl.credit') : t('ucl.credits')}
        </div>

        {!signedIn ? (
          <>
            <p className="max-w-[15rem] text-xs text-muted-foreground">{t('ucl.signInToUnlock')}</p>
            <Button size="sm" onClick={onSignIn}>
              <LogIn className="mr-1.5 h-3.5 w-3.5" />
              {t('ucl.signIn')}
            </Button>
          </>
        ) : affordable ? (
          <Button size="sm" disabled={busy} onClick={onUnlock}>
            {t('ucl.unlock')}
          </Button>
        ) : (
          <>
            <p className="max-w-[15rem] text-xs text-muted-foreground">
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
