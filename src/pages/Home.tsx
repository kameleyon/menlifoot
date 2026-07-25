import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import wordmark from '@/assets/wordmark.png';
import AppShell from '@/components/mobile/AppShell';
import { podcastThumb } from '@/lib/podcast';

interface Article {
  id: string;
  title: string;
  summary: string | null;
  subtitle: string | null;
  category: string | null;
  thumbnail_url: string | null;
  author: string | null;
  published_at: string | null;
}

interface Podcast {
  id: string;
  title: string;
  episode_number: number | null;
  duration: string | null;
  embed_url: string | null;
  original_url: string | null;
  thumbnail_url: string | null;
}

const db = supabase as unknown as {
  from: (t: string) => {
    select: (c: string) => {
      eq: (col: string, v: unknown) => { order: (c: string, o?: { ascending?: boolean; nullsFirst?: boolean }) => { limit: (n: number) => Promise<{ data: unknown }> } };
      order: (c: string, o?: { ascending?: boolean; nullsFirst?: boolean }) => { limit: (n: number) => Promise<{ data: unknown }> };
    };
  };
};

const stripe = 'repeating-linear-gradient(135deg,#1b1b1f 0 8px,#131316 8px 16px)';
const SCORES = [
  { min: "72'", h: 'Haiti', hs: '1', a: 'Canada', as: '0' },
  { min: 'HT', h: 'Jamaica', hs: '0', a: 'Mexico', as: '2' },
  { min: "36'", h: 'USA', hs: '1', a: 'Panama', as: '1' },
];
const SHOP = [
  { name: 'Grenadier Home Tee', price: '$42' },
  { name: 'Gold Mark Cap', price: '$34' },
  { name: 'Podcast Crewneck', price: '$68' },
];

const Home = () => {
  const navigate = useNavigate();
  const [articles, setArticles] = useState<Article[]>([]);
  const [podcast, setPodcast] = useState<Podcast | null>(null);

  useEffect(() => {
    (async () => {
      const a = await db.from('articles').select('id,title,summary,subtitle,category,thumbnail_url,author,published_at')
        .eq('is_published', true).order('published_at', { ascending: false, nullsFirst: false }).limit(6);
      if (a.data) setArticles(a.data as Article[]);
      const p = await db.from('podcasts').select('id,title,episode_number,duration,embed_url,original_url,thumbnail_url')
        .order('published_at', { ascending: false, nullsFirst: false }).limit(1);
      if (p.data && (p.data as Podcast[])[0]) setPodcast((p.data as Podcast[])[0]);
    })();
  }, []);

  const lead = articles[0];
  const latest = articles.slice(1, 5);

  return (
    <AppShell>
      <div className="pb-2 pt-14">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-4">
          <img src={wordmark} alt="Menlifoot" className="h-6 w-auto" />
          <div className="flex gap-2">
            <button onClick={() => navigate('/ask')} className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-white/[0.12] transition-colors hover:border-primary/60">
              <span className="font-sans text-[12px] font-bold text-primary">AI</span>
            </button>
            <Link to="/me" className="h-[34px] w-[34px] rounded-full border border-white/10" style={{ background: 'repeating-linear-gradient(135deg,#1c1c20 0 6px,#141417 6px 12px)' }} />
          </div>
        </div>

        {/* Live scores */}
        <div className="flex gap-2.5 overflow-x-auto px-5 pb-[18px] [scrollbar-width:none]">
          {SCORES.map((m, i) => (
            <div key={i} className="flex w-[132px] flex-none flex-col gap-[9px] rounded-xl border border-white/[0.07] bg-[#101012] px-3 py-[11px]">
              <div className="flex items-center gap-[5px]">
                <span className="h-[5px] w-[5px] animate-pulse rounded-full bg-[#e2483f]" />
                <span className="font-sans text-[9px] font-semibold uppercase tracking-[0.14em] text-foreground/50">{m.min}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between font-sans text-[13px] font-medium"><span>{m.h}</span><span className="font-display text-[15px]">{m.hs}</span></div>
                <div className="flex justify-between font-sans text-[13px] font-medium text-foreground/60"><span>{m.a}</span><span className="font-display text-[15px]">{m.as}</span></div>
              </div>
            </div>
          ))}
        </div>

        {/* Lead story */}
        {lead && (
          <button onClick={() => navigate(`/articles/${lead.id}`)} className="mx-5 mb-[22px] block w-[calc(100%-40px)] text-left">
            <div className="relative flex h-[290px] flex-col justify-end overflow-hidden rounded-2xl" style={{ background: lead.thumbnail_url ? undefined : stripe }}>
              {lead.thumbnail_url && <img src={lead.thumbnail_url} alt="" className="absolute inset-0 h-full w-full object-cover" />}
              <span className="absolute left-3.5 top-3.5 rounded-full bg-primary px-[9px] py-[5px] font-sans text-[9px] font-semibold uppercase tracking-[0.16em] text-[#070708]">Lead story</span>
              <div className="relative px-[18px] pb-[18px] pt-[22px]" style={{ background: 'linear-gradient(to top,rgba(7,7,8,.94) 12%,rgba(7,7,8,0))' }}>
                <div className="mb-[9px] font-sans text-[9px] font-semibold uppercase tracking-[0.16em] text-primary">{lead.category ?? 'Analysis'}</div>
                <div className="font-display text-[25px] uppercase leading-[1.08] tracking-[0.005em]">{lead.title}</div>
                {lead.summary && <div className="mt-2 font-sans text-[13px] leading-[1.5] text-foreground/60 line-clamp-2">{lead.summary}</div>}
              </div>
            </div>
          </button>
        )}

        {/* Ask Menli */}
        <button onClick={() => navigate('/ask')} className="mx-5 mb-[26px] flex w-[calc(100%-40px)] items-center gap-3.5 rounded-2xl border border-primary/30 px-[18px] py-4 text-left" style={{ background: 'linear-gradient(135deg,rgba(200,154,60,.1),rgba(200,154,60,.02))' }}>
          <div className="flex flex-1 flex-col gap-[5px]">
            <div className="font-sans text-[14px] font-semibold">Ask Menli</div>
            <div className="font-sans text-[12px] leading-[1.45] text-foreground/60">Anything about the game — squads, history, tactics.</div>
          </div>
          <span className="font-display text-[22px] text-primary">→</span>
        </button>

        {/* Latest */}
        <div className="flex items-baseline justify-between px-5 pb-3">
          <span className="font-display text-[15px] uppercase tracking-[0.04em]">Latest</span>
          <Link to="/articles" className="font-sans text-[11px] font-medium text-foreground/45">All analysis</Link>
        </div>
        <div className="flex flex-col">
          {latest.map((a) => (
            <button key={a.id} onClick={() => navigate(`/articles/${a.id}`)} className="flex gap-3.5 border-t border-white/[0.06] px-5 py-3.5 text-left transition-colors hover:bg-white/[0.03]">
              <div className="flex flex-1 flex-col gap-[7px]">
                <div className="font-sans text-[9px] font-semibold uppercase tracking-[0.14em] text-primary/85">{a.category ?? 'Analysis'}</div>
                <div className="font-sans text-[14px] font-semibold leading-[1.3]">{a.title}</div>
                <div className="font-sans text-[11px] text-foreground/40">{[a.author, a.published_at ? new Date(a.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null].filter(Boolean).join(' · ')}</div>
              </div>
              <div className="h-[76px] w-[76px] flex-none rounded-[10px] bg-cover bg-center" style={{ background: a.thumbnail_url ? `center/cover url(${a.thumbnail_url})` : stripe }} />
            </button>
          ))}
        </div>

        {/* Podcast */}
        <div className="mx-5 mt-7 rounded-2xl border border-white/[0.07] bg-[#101012] p-[18px]">
          <div className="mb-3.5 font-sans text-[9px] font-semibold uppercase tracking-[0.16em] text-primary">MVP Podcast · new episode</div>
          <div className="flex items-center gap-3.5">
            <div className="flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-[10px] border border-white/[0.09] bg-[#070708]">
              {podcast && podcastThumb(podcast)
                ? <img src={podcastThumb(podcast)!} alt="" className="h-full w-full object-cover" />
                : <img src="/logo.png" alt="" className="h-[34px] w-auto" />}
            </div>
            <div className="flex flex-1 flex-col gap-[5px]">
              <div className="font-sans text-[14px] font-semibold leading-[1.25]">{podcast?.title ?? 'Road to 2026: the math'}</div>
              <div className="font-sans text-[11px] text-foreground/45">{podcast ? `Ep. ${podcast.episode_number ?? '—'} · ${podcast.duration ?? ''}` : 'Ep. 48 · 54 min'}</div>
            </div>
            <button onClick={() => navigate('/listen')} className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-full" style={{ background: 'linear-gradient(135deg,#e9c877,#c08a2a)' }}>
              <span className="ml-0.5 font-display text-[13px] text-[#070708]">▶</span>
            </button>
          </div>
        </div>

        {/* Shop */}
        <div className="mx-5 mt-[22px] flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <span className="font-display text-[15px] uppercase tracking-[0.04em]">Shop · launch drop</span>
            <Link to="/shop" className="font-sans text-[11px] font-medium text-primary">See all</Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
            {SHOP.map((p, i) => (
              <Link key={i} to="/shop" className="w-[132px] flex-none">
                <div className="flex h-[150px] items-end justify-center rounded-xl pb-2.5" style={{ background: stripe }}>
                  <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-foreground/30">product</span>
                </div>
                <div className="mt-[9px] font-sans text-[12px] font-medium leading-[1.3]">{p.name}</div>
                <div className="mt-1 font-sans text-[12px] text-primary">{p.price}</div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export default Home;
