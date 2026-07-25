import { ReactNode } from 'react';
import BottomNav from './BottomNav';

interface AppShellProps {
  children: ReactNode;
}

/** Mobile-first app frame: black canvas, centered mobile column on wide screens, 5-tab bottom nav. */
const AppShell = ({ children }: AppShellProps) => (
  <div className="min-h-screen bg-[#0a0a0b]">
    <div className="relative mx-auto flex min-h-screen max-w-[520px] flex-col overflow-hidden bg-[#070708] text-foreground shadow-[0_0_80px_rgba(0,0,0,0.6)]">
      <div className="flex-1 overflow-x-hidden pb-24">{children}</div>
      <BottomNav />
    </div>
  </div>
);

export default AppShell;
