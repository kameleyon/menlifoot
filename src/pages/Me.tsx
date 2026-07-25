import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import AppShell from '@/components/mobile/AppShell';

const STATS = [
  { n: '12', l: 'Saved' },
  { n: '48', l: 'Read' },
  { n: '6', l: 'Streak' },
];
const ROWS = [
  { label: 'Saved articles', value: '12' },
  { label: 'Reading history', value: '' },
  { label: 'Notifications', value: 'On' },
  { label: 'Language', value: 'FR' },
];

const Me = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  const name = email ? email.split('@')[0] : 'Guest';

  return (
    <AppShell>
      <div className="pt-14">
        {/* Profile */}
        <div className="flex items-center gap-4 px-5 pb-[22px]">
          <div className="h-16 w-16 rounded-full border border-white/10" style={{ background: 'repeating-linear-gradient(135deg,#1c1c20 0 6px,#141417 6px 12px)' }} />
          <div className="flex flex-col gap-1.5">
            <span className="font-display text-[22px] uppercase">{name}</span>
            <span className="font-sans text-[11.5px] text-foreground/45">{email ? `Member · ${email}` : 'Not signed in · Montréal'}</span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2.5 px-5 pb-[22px]">
          {STATS.map((s) => (
            <div key={s.l} className="flex flex-col gap-1.5 rounded-xl border border-white/[0.07] bg-[#101012] px-3 py-3.5">
              <span className="font-display text-[20px] text-primary">{s.n}</span>
              <span className="font-sans text-[9px] font-medium uppercase tracking-[0.1em] text-foreground/45">{s.l}</span>
            </div>
          ))}
        </div>

        {/* Rows */}
        {ROWS.map((r) => (
          <button key={r.label} className="flex w-full items-center justify-between border-t border-white/[0.06] px-5 py-4 text-left transition-colors hover:bg-white/[0.03]">
            <span className="font-sans text-[13.5px] font-medium">{r.label}</span>
            <span className="font-sans text-[12px] text-foreground/40">{r.value}</span>
          </button>
        ))}
        <button onClick={() => navigate(email ? '/me' : '/auth')} className="flex w-full items-center justify-between border-t border-white/[0.06] px-5 py-4 text-left transition-colors hover:bg-white/[0.03]">
          <span className="font-sans text-[13.5px] font-medium">{email ? 'Sign out' : 'Sign in'}</span>
          <span className="font-sans text-[12px] text-foreground/40">→</span>
        </button>

        {/* Menlifoot+ */}
        <div className="mx-5 mt-[26px] flex flex-col gap-2.5 rounded-2xl border border-primary/[0.28] p-[18px]" style={{ background: 'linear-gradient(135deg,rgba(200,154,60,.12),rgba(200,154,60,.02))' }}>
          <span className="font-sans text-[14px] font-semibold">Menlifoot+</span>
          <span className="font-sans text-[12px] leading-[1.5] text-foreground/60">Ad-free reading, early episode drops, 10% off every order.</span>
          <span className="mt-1 self-start rounded-full px-4 py-2.5 font-sans text-[12px] font-bold text-[#070708]" style={{ background: 'linear-gradient(135deg,#e9c877,#c08a2a)' }}>$4.99 / month</span>
        </div>
      </div>
    </AppShell>
  );
};

export default Me;
