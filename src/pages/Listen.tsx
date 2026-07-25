import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import lockup from '@/assets/wordmark.png';
import AppShell from '@/components/mobile/AppShell';

interface Podcast {
  id: string;
  title: string;
  platform: string | null;
  original_url: string | null;
  episode_number: number | null;
  duration: string | null;
  published_at: string | null;
}

const db = supabase as unknown as {
  from: (t: string) => { select: (c: string) => { order: (c: string, o?: { ascending?: boolean; nullsFirst?: boolean }) => { limit: (n: number) => Promise<{ data: unknown }> } } };
};

const stripe = 'repeating-linear-gradient(135deg,#1b1b1f 0 7px,#131316 7px 14px)';
const VIDEOS = [
  { title: '“We never played for the score”', meta: '12 min · Legends series' },
  { title: 'Inside the 2026 camp', meta: '8 min · Featurette' },
];

const Listen = () => {
  const [pods, setPods] = useState<Podcast[]>([]);

  useEffect(() => {
    (async () => {
      const p = await db.from('podcasts').select('id,title,platform,original_url,episode_number,duration,published_at')
        .order('published_at', { ascending: false, nullsFirst: false }).limit(30);
      if (p.data) setPods(p.data as Podcast[]);
    })();
  }, []);

  const now = pods[0];
  const rest = pods.slice(1);
  const open = (url: string | null) => url && window.open(url, '_blank', 'noopener');

  return (
    <AppShell>
      <div className="pt-14">
        <div className="flex flex-col gap-1.5 px-5 pb-[18px]">
          <span className="font-sans text-[9px] font-semibold uppercase tracking-[0.18em] text-primary">Menlifoot original</span>
          <span className="font-display text-[30px] uppercase tracking-[0.01em]">MVP Podcast</span>
        </div>

        {/* Now playing */}
        <div className="mx-5 mb-6 overflow-hidden rounded-2xl border border-white/[0.07] bg-[#101012]">
          <div className="flex h-[190px] items-center justify-center" style={{ background: 'radial-gradient(120% 100% at 50% 0%,#1d1a14,#0a0a0b)' }}>
            <img src={lockup} alt="Menlifoot" className="h-[60px] w-auto opacity-95" />
          </div>
          <div className="flex flex-col gap-3.5 px-[18px] pb-[18px] pt-4">
            <div className="flex flex-col gap-1.5">
              <span className="font-sans text-[15px] font-semibold leading-[1.25]">{now?.title ?? 'Road to 2026: the math'}</span>
              <span className="font-sans text-[11px] text-foreground/45">{now ? `Ep. ${now.episode_number ?? '—'} · ${now.duration ?? ''}` : 'Ep. 48 · 54 min'}</span>
            </div>
            <div className="flex flex-col gap-[7px]">
              <div className="relative h-[3px] rounded-full bg-white/10">
                <div className="absolute inset-y-0 left-0 w-[8%] rounded-full" style={{ background: 'linear-gradient(90deg,#c08a2a,#e9c877)' }} />
              </div>
              <div className="flex justify-between font-mono text-[10px] text-foreground/40"><span>0:00</span><span>{now?.duration ?? '54:00'}</span></div>
            </div>
            <div className="flex items-center justify-center gap-[26px]">
              <span className="font-sans text-[12px] font-medium text-foreground/55">15s</span>
              <button onClick={() => open(now?.original_url ?? null)} className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'linear-gradient(135deg,#e9c877,#c08a2a)' }}>
                <span className="font-display text-[16px] text-[#070708]">▶</span>
              </button>
              <span className="font-sans text-[12px] font-medium text-foreground/55">30s</span>
            </div>
          </div>
        </div>

        {/* Episodes */}
        <div className="px-5 pb-2.5 font-display text-[15px] uppercase tracking-[0.04em]">Episodes</div>
        {rest.map((e) => (
          <button key={e.id} onClick={() => open(e.original_url)} className="flex w-full items-center gap-3.5 border-t border-white/[0.06] px-5 py-3.5 text-left transition-colors hover:bg-white/[0.03]">
            <div className="flex h-11 w-11 flex-none items-center justify-center rounded-lg border border-white/[0.08] bg-[#111114] font-display text-[12px] text-primary">{e.episode_number ?? '·'}</div>
            <div className="flex flex-1 flex-col gap-1.5">
              <span className="font-sans text-[13.5px] font-semibold leading-[1.3]">{e.title}</span>
              <span className="font-sans text-[11px] text-foreground/40">{[e.platform, e.duration].filter(Boolean).join(' · ')}</span>
            </div>
            <span className="font-display text-[15px] text-foreground/35">▶</span>
          </button>
        ))}

        {/* Watch */}
        <div className="mx-5 mt-[26px] flex flex-col gap-2.5 rounded-2xl border border-white/[0.08] px-[18px] py-4">
          <span className="font-sans text-[13px] font-semibold">Watch · interviews</span>
          <div className="flex gap-3 overflow-x-auto [scrollbar-width:none]">
            {VIDEOS.map((v, i) => (
              <div key={i} className="w-[180px] flex-none">
                <div className="flex h-[102px] items-center justify-center rounded-[10px]" style={{ background: stripe }}>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/50 bg-[#070708]/70 font-display text-[10px] text-primary">▶</span>
                </div>
                <div className="mt-2 font-sans text-[12px] font-medium leading-[1.35]">{v.title}</div>
                <div className="mt-1 font-sans text-[10px] text-foreground/40">{v.meta}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export default Listen;
