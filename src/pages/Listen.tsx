import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import lockup from '@/assets/wordmark.png';
import AppShell from '@/components/mobile/AppShell';
import { useLanguage } from '@/contexts/LanguageContext';
import { podcastThumb } from '@/lib/podcast';

interface Podcast {
  id: string;
  title: string;
  platform: string | null;
  original_url: string | null;
  embed_url: string | null;
  thumbnail_url: string | null;
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

const embedSrc = (url: string | null) => (url ? `${url}${url.includes('?') ? '&' : '?'}autoplay=1` : '');

// Only ONE layout's player should mount — a CSS-hidden YouTube iframe still plays audio (doubled sound).
const useIsDesktop = () => {
  const [d, setD] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width:1024px)').matches);
  useEffect(() => {
    const m = window.matchMedia('(min-width:1024px)');
    const on = () => setD(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return d;
};

const Listen = () => {
  const { t } = useLanguage();
  const isDesktop = useIsDesktop();
  const [pods, setPods] = useState<Podcast[]>([]);
  const [playing, setPlaying] = useState<Podcast | null>(null);

  useEffect(() => {
    (async () => {
      const p = await db.from('podcasts').select('id,title,platform,original_url,embed_url,thumbnail_url,episode_number,duration,published_at')
        .order('published_at', { ascending: false, nullsFirst: false }).limit(30);
      if (p.data) setPods(p.data as Podcast[]);
    })();
  }, []);

  const now = pods[0];
  const current = playing ?? now;
  const rest = pods.slice(1);

  return (
    <AppShell wide>
      {/* ===== Mobile ===== */}
      <div className="pt-14 lg:hidden">
        <div className="flex flex-col gap-1.5 px-5 pb-[18px]">
          <span className="font-sans text-[9px] font-semibold uppercase tracking-[0.18em] text-primary">{t('listen.original')}</span>
          <span className="font-display text-[30px] uppercase tracking-[0.01em]">{t('listen.title')}</span>
        </div>

        {/* Now playing */}
        <div className="mx-5 mb-6 overflow-hidden rounded-2xl border border-white/[0.07] bg-[#101012]">
          <div className="relative aspect-video w-full overflow-hidden" style={{ background: 'radial-gradient(120% 100% at 50% 0%,#1d1a14,#0a0a0b)' }}>
            {playing && playing.embed_url && !isDesktop ? (
              <iframe src={embedSrc(playing.embed_url)} title={playing.title} className="h-full w-full" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
            ) : (
              <button onClick={() => current && setPlaying(current)} className="flex h-full w-full items-center justify-center">
                {current && podcastThumb(current)
                  ? <img src={podcastThumb(current)!} alt={current.title} className="h-full w-full object-cover" />
                  : <img src={lockup} alt="Menlifoot" className="h-[60px] w-auto opacity-95" />}
                <span className="absolute flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'linear-gradient(135deg,#e9c877,#c08a2a)' }}>
                  <span className="ml-0.5 font-display text-[18px] text-[#070708]">▶</span>
                </span>
              </button>
            )}
          </div>
          <div className="flex flex-col gap-2 px-[18px] pb-[18px] pt-4">
            <span className="font-sans text-[15px] font-semibold leading-[1.25]">{current?.title ?? 'Road to 2026: the math'}</span>
            <span className="font-sans text-[11px] text-foreground/45">{current ? `Ep. ${current.episode_number ?? '—'} · ${current.duration ?? ''}` : 'Ep. 48 · 54 min'}</span>
          </div>
        </div>

        {/* Episodes */}
        <div className="px-5 pb-2.5 font-display text-[15px] uppercase tracking-[0.04em]">{t('listen.episodes')}</div>
        {rest.map((e) => (
          <button key={e.id} onClick={() => setPlaying(e)} className="flex w-full items-center gap-3.5 border-t border-white/[0.06] px-5 py-3.5 text-left transition-colors hover:bg-white/[0.03]">
            <div className="relative flex h-11 w-11 flex-none items-center justify-center overflow-hidden rounded-lg border border-white/[0.08] bg-[#111114] font-display text-[12px] text-primary">
              {podcastThumb(e)
                ? <img src={podcastThumb(e)!} alt="" className="h-full w-full object-cover" />
                : (e.episode_number ?? '·')}
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <span className="font-sans text-[13.5px] font-semibold leading-[1.3]">{e.title}</span>
              <span className="font-sans text-[11px] text-foreground/40">{[e.platform, e.duration].filter(Boolean).join(' · ')}</span>
            </div>
            <span className="font-display text-[15px] text-foreground/35">▶</span>
          </button>
        ))}

        {/* Watch */}
        <div className="mx-5 mt-[26px] flex flex-col gap-2.5 rounded-2xl border border-white/[0.08] px-[18px] py-4">
          <span className="font-sans text-[13px] font-semibold">{t('listen.watch')}</span>
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

      {/* ===== Desktop (wide web) ===== */}
      <div className="hidden lg:block">
        <div className="border-b border-white/[0.07]" style={{ background: 'radial-gradient(90% 140% at 12% 0%,#1a1811,#070708)' }}>
          <div className="mx-auto flex max-w-[1180px] gap-10 px-10 py-11">
            <div className="aspect-video w-[420px] flex-none overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0b0b0d]">
              {playing && playing.embed_url && isDesktop ? (
                <iframe src={embedSrc(playing.embed_url)} title={playing.title} className="h-full w-full" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
              ) : (
                <button onClick={() => current && setPlaying(current)} className="relative flex h-full w-full items-center justify-center">
                  {current && podcastThumb(current) ? <img src={podcastThumb(current)!} alt={current.title} className="h-full w-full object-cover" /> : <img src={lockup} alt="Menlifoot" className="h-[80px] w-auto" />}
                  <span className="absolute flex h-16 w-16 items-center justify-center rounded-full font-display text-[20px] text-[#070708]" style={{ background: 'linear-gradient(135deg,#e9c877,#c08a2a)' }}>▶</span>
                </button>
              )}
            </div>
            <div className="flex flex-1 flex-col justify-center gap-4">
              <span className="font-sans text-[9.5px] font-semibold uppercase tracking-[0.18em] text-primary">{t('listen.original')}</span>
              <span className="font-display text-[56px] uppercase leading-[0.95]">{t('listen.title')}</span>
              <span className="font-sans text-[15px] font-semibold">{current?.title ?? ''}</span>
              <p className="m-0 max-w-[52ch] font-sans text-[14px] leading-[1.7] text-foreground/55">The Menlifoot desk on the week in football — squads, tactics, transfers, and the road through 2026.</p>
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-[1180px] px-10 pt-8">
          {rest.map((e) => (
            <button key={e.id} onClick={() => setPlaying(e)} className="flex w-full items-center gap-5 border-b border-white/[0.06] py-5 text-left transition-colors hover:bg-white/[0.02]">
              <div className="relative h-14 w-14 flex-none overflow-hidden rounded-lg border border-white/[0.08] bg-[#111114]">
                {podcastThumb(e) ? <img src={podcastThumb(e)!} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center font-display text-primary">{e.episode_number ?? '·'}</span>}
              </div>
              <div className="flex flex-1 flex-col gap-1.5"><span className="font-sans text-[15px] font-semibold">{e.title}</span><span className="font-sans text-[12px] text-foreground/40">{[e.platform, e.duration].filter(Boolean).join(' · ')}</span></div>
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.16] font-display text-[11px] text-foreground/70">▶</span>
            </button>
          ))}
        </div>
      </div>
    </AppShell>
  );
};

export default Listen;
