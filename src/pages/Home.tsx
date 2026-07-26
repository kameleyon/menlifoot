import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthModal } from '@/components/AuthModal';
import { MessageCircle, User } from 'lucide-react';
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
const money = (c: number | null) => (c == null ? '' : `$${(c / 100).toFixed(2)}`);
interface ShopProduct { id: string; title: string; image: string | null; price_cents: number | null; }

const Home = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user, isAdmin, isEditor } = useAuth();
  const { open: openAuth } = useAuthModal();
  const [articles, setArticles] = useState<Article[]>([]);
  const [podcast, setPodcast] = useState<Podcast | null>(null);
  const [shop, setShop] = useState<ShopProduct[]>([]);

  useEffect(() => {
    (async () => {
      const a = await db.from('articles').select('id,title,summary,subtitle,category,thumbnail_url,author,published_at')
        .eq('is_published', true).order('published_at', { ascending: false, nullsFirst: false }).limit(12);
      if (a.data) setArticles(a.data as Article[]);
      const p = await db.from('podcasts').select('id,title,episode_number,duration,embed_url,original_url,thumbnail_url')
        .order('published_at', { ascending: false, nullsFirst: false }).limit(1);
      if (p.data && (p.data as Podcast[])[0]) setPodcast((p.data as Podcast[])[0]);
      const pr = await supabase.functions.invoke('printify', { body: { action: 'products' } });
      setShop(((pr.data as { products?: ShopProduct[] })?.products ?? []).slice(0, 4));
    })();
  }, []);

  const lead = articles[0];
  const latest = articles.slice(1, 5);
  const deskLatest = articles.slice(1, 7);

  return (
    <AppShell wide>
      {/* ===== Mobile ===== */}
      <div className="pb-2 pt-4 lg:hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-5">
          <img src={wordmark} alt="Menlifoot" className="h-9 w-auto" />
          <div className="flex gap-2.5">
            <button onClick={() => navigate('/ask')} aria-label={t('home.askTitle')} className="flex h-[38px] w-[38px] items-center justify-center rounded-full border border-white/[0.12] text-primary transition-colors hover:border-primary/60">
              <MessageCircle className="h-[19px] w-[19px]" strokeWidth={2} />
            </button>
            <button onClick={() => (user ? navigate(isAdmin || isEditor ? '/admin' : '/me') : openAuth('signin'))} aria-label={t('auth.signin')} className="flex h-[38px] w-[38px] items-center justify-center rounded-full border border-white/[0.12] text-foreground/70 transition-colors hover:border-primary/60 hover:text-primary">
              <User className="h-[19px] w-[19px]" strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Lead story */}
        {lead && (
          <button onClick={() => navigate(`/articles/${lead.id}`)} className="mx-5 mb-[22px] block w-[calc(100%-40px)] text-left">
            <div className="relative overflow-hidden rounded-2xl">
              <div className="aspect-[4/3] w-full" style={{ background: lead.thumbnail_url ? undefined : stripe }}>
                {lead.thumbnail_url && <img src={lead.thumbnail_url} alt="" className="h-full w-full object-cover" />}
              </div>
              <span className="absolute left-3.5 top-3.5 rounded-full bg-primary px-[9px] py-[5px] font-sans text-[9px] font-semibold uppercase tracking-[0.16em] text-[#070708]">{t('home.leadStory')}</span>
            </div>
            <div className="pt-3.5">
              <div className="mb-[9px] font-sans text-[9px] font-semibold uppercase tracking-[0.16em] text-primary">{lead.category ?? 'Analysis'}</div>
              <div className="font-display text-[25px] uppercase leading-[1.08] tracking-[0.005em]">{lead.title}</div>
              {lead.summary && <div className="mt-2 font-sans text-[13px] leading-[1.5] text-foreground/60 line-clamp-2">{lead.summary}</div>}
            </div>
          </button>
        )}

        {/* Ask Menli */}
        <button onClick={() => navigate('/ask')} className="mx-5 mb-[26px] flex w-[calc(100%-40px)] items-center gap-3.5 rounded-2xl px-[18px] py-[18px] text-left" style={{ background: '#d8a93f' }}>
          <div className="flex flex-1 flex-col gap-[5px]">
            <div className="font-sans text-[16px] font-bold text-[#070708]">{t('home.askTitle')}</div>
            <div className="font-sans text-[12.5px] font-medium leading-[1.45] text-[#070708]/75">{t('home.askSub')}</div>
          </div>
          <span className="font-display text-[22px] text-[#070708]">→</span>
        </button>

        {/* Latest */}
        <div className="flex items-baseline justify-between px-5 pb-3">
          <span className="font-display text-[15px] uppercase tracking-[0.04em]">{t('home.latest')}</span>
          <Link to="/articles" className="font-sans text-[11px] font-medium text-foreground/45">{t('home.allAnalysis')}</Link>
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
          <div className="mb-3.5 font-sans text-[9px] font-semibold uppercase tracking-[0.16em] text-primary">{t('home.podcastNew')}</div>
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
            <span className="font-display text-[15px] uppercase tracking-[0.04em]">{t('home.shopDrop')}</span>
            <Link to="/shop" className="font-sans text-[11px] font-medium text-primary">{t('home.seeAll')}</Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
            {shop.map((p) => (
              <Link key={p.id} to="/shop" className="w-[132px] flex-none">
                <div className="flex h-[150px] items-end justify-center overflow-hidden rounded-xl" style={{ background: p.image ? undefined : stripe }}>
                  {p.image && <img src={p.image} alt={p.title} className="h-full w-full object-cover" />}
                </div>
                <div className="mt-[9px] line-clamp-1 font-sans text-[12px] font-medium leading-[1.3]">{p.title}</div>
                <div className="mt-1 font-sans text-[12px] text-primary">{money(p.price_cents)}</div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ===== Desktop (wide web) ===== */}
      <div className="mx-auto hidden max-w-[1180px] lg:block">
        {/* Hero + latest */}
        <div className="flex border-b border-white/[0.07]">
          <div className="flex flex-[1.55] flex-col gap-5 border-r border-white/[0.07] p-10">
            {lead && (
              <>
                <button onClick={() => navigate(`/articles/${lead.id}`)} className="block h-[340px] w-full overflow-hidden rounded-2xl text-left" style={{ background: lead.thumbnail_url ? undefined : stripe }}>
                  {lead.thumbnail_url && <img src={lead.thumbnail_url} alt="" className="h-full w-full object-cover" />}
                </button>
                <span className="font-sans text-[9.5px] font-semibold uppercase tracking-[0.18em] text-primary">{lead.category ?? 'Analysis'}</span>
                <h2 className="m-0 max-w-[16ch] font-display text-[46px] uppercase leading-none">{lead.title}</h2>
                {lead.summary && <p className="m-0 max-w-[56ch] font-sans text-[15.5px] leading-[1.7] text-foreground/60">{lead.summary}</p>}
                <button onClick={() => navigate(`/articles/${lead.id}`)} className="self-start rounded-full px-[22px] py-[13px] font-sans text-[12px] font-bold uppercase tracking-[0.06em] text-[#070708]" style={{ background: 'linear-gradient(135deg,#e9c877,#c08a2a)' }}>{t('home.allAnalysis')}</button>
              </>
            )}
          </div>
          <div className="flex flex-1 flex-col gap-4 p-8">
            <span className="font-sans text-[9.5px] font-semibold uppercase tracking-[0.18em] text-foreground/40">{t('home.latest')}</span>
            {deskLatest.map((a) => (
              <button key={a.id} onClick={() => navigate(`/articles/${a.id}`)} className="flex gap-3.5 border-b border-white/[0.06] pb-4 text-left">
                <div className="flex flex-1 flex-col gap-1.5">
                  <span className="font-sans text-[9px] font-semibold uppercase tracking-[0.14em] text-primary/85">{a.category ?? 'Analysis'}</span>
                  <span className="font-sans text-[14px] font-semibold leading-[1.35]">{a.title}</span>
                </div>
                <div className="h-[62px] w-[62px] flex-none rounded-lg bg-cover bg-center" style={{ background: a.thumbnail_url ? `center/cover url(${a.thumbnail_url})` : stripe }} />
              </button>
            ))}
          </div>
        </div>

        {/* Podcast band */}
        <div className="flex items-center gap-10 border-b border-white/[0.07] px-10 py-[34px]" style={{ background: 'linear-gradient(90deg,rgba(200,154,60,.09),rgba(200,154,60,0) 65%)' }}>
          <div className="flex h-[110px] w-[110px] flex-none items-center justify-center overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0d0d0f]">
            {podcast && podcastThumb(podcast) ? <img src={podcastThumb(podcast)!} alt="" className="h-full w-full object-cover" /> : <img src="/logo.png" alt="" className="h-[60px] w-auto" />}
          </div>
          <div className="flex flex-1 flex-col gap-2.5">
            <span className="font-sans text-[9.5px] font-semibold uppercase tracking-[0.18em] text-primary">{t('home.podcastNew')}</span>
            <span className="font-display text-[30px] uppercase">{podcast?.title ?? 'Road to 2026: the math'}</span>
          </div>
          <button onClick={() => navigate('/listen')} className="flex h-[58px] w-[58px] flex-none items-center justify-center rounded-full font-display text-[16px] text-[#070708]" style={{ background: 'linear-gradient(135deg,#e9c877,#c08a2a)' }}>▶</button>
        </div>

        {/* Store */}
        <div className="flex flex-col gap-5 px-10 py-9">
          <div className="flex items-baseline justify-between">
            <span className="font-display text-[22px] uppercase tracking-[0.03em]">{t('home.shopDrop')}</span>
            <Link to="/shop" className="font-sans text-[10.5px] font-semibold uppercase tracking-[0.14em] text-primary">{t('home.seeAll')}</Link>
          </div>
          <div className="grid grid-cols-4 gap-5">
            {shop.map((p) => (
              <Link key={p.id} to="/shop">
                <div className="h-[220px] overflow-hidden rounded-xl" style={{ background: p.image ? undefined : stripe }}>{p.image && <img src={p.image} alt={p.title} className="h-full w-full object-cover" />}</div>
                <div className="mt-2.5 font-sans text-[13px] font-medium">{p.title}</div>
                <div className="mt-1 font-sans text-[12.5px] text-primary">{money(p.price_cents)}</div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export default Home;
