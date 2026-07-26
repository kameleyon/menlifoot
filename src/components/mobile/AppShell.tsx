import { ReactNode } from 'react';
import BottomNav from './BottomNav';
import DesktopNav from '@/components/desktop/DesktopNav';
import DesktopFooter from '@/components/desktop/DesktopFooter';
import { SocialLinks } from '@/components/SocialLinks';

const MobileFooter = () => (
  <div className="flex flex-col items-center gap-3 border-t border-white/[0.06] px-5 pb-24 pt-7 lg:hidden">
    <SocialLinks size={20} />
    <span className="font-sans text-[10.5px] text-foreground/35">© 2026 Menlifoot · menlifoot.ca</span>
  </div>
);

interface AppShellProps {
  children: ReactNode;
  /** When true, desktop content spans the full wide layout (the page provides its own lg: layout). */
  wide?: boolean;
}

/** Responsive frame: mobile app (centered column + bottom tab bar) below lg; wide web (top nav + footer) at lg+. */
const AppShell = ({ children, wide }: AppShellProps) => (
  <div className="min-h-screen bg-[#0a0a0b] text-foreground">
    <div className="hidden lg:block">
      <DesktopNav />
    </div>

    {wide ? (
      // Full-width desktop; the page renders its own lg: layout.
      <main className="lg:min-h-[60vh]">
        <div className="relative mx-auto flex min-h-screen max-w-[520px] flex-col overflow-hidden bg-[#070708] shadow-[0_0_80px_rgba(0,0,0,0.6)] lg:min-h-0 lg:max-w-none lg:overflow-visible lg:bg-transparent lg:shadow-none">
          <div className="flex-1 lg:pb-0">{children}</div>
          <MobileFooter />
          <div className="lg:hidden"><BottomNav /></div>
        </div>
      </main>
    ) : (
      // Content screens: centered reading column on desktop.
      <div className="relative mx-auto flex min-h-screen max-w-[520px] flex-col overflow-hidden bg-[#070708] shadow-[0_0_80px_rgba(0,0,0,0.6)] lg:min-h-0 lg:max-w-[640px] lg:border-x lg:border-white/[0.06] lg:shadow-none">
        <div className="flex-1 lg:pb-10">{children}</div>
        <MobileFooter />
        <div className="lg:hidden"><BottomNav /></div>
      </div>
    )}

    <div className="hidden lg:block">
      <DesktopFooter />
    </div>
  </div>
);

export default AppShell;
