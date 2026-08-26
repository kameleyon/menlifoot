import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import AppShell from '@/components/mobile/AppShell';
import { getCategoryLabel } from '@/lib/articleCategories';

interface Art { id: string; title: string; summary: string | null; category: string | null; thumbnail_url: string | null; author: string | null; published_at: string | null; }
const stripe = 'repeating-linear-gradient(135deg,#1b1b1f 0 8px,#131316 8px 16px)';

const Editorial = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [articles, setArticles] = useState<Art[]>([]);
  const [loading, setLoading] = useState(true);

  // Base article rows are French; overlay the chosen language's translation when available.
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any).from('articles')
        .select('id,title,summary,category,thumbnail_url,author,published_at')
        .eq('is_published', true).order('published_at', { ascending: false, nullsFirst: false }).limit(60);
      let list = (data as Art[]) ?? [];
      if (language !== 'fr' && list.length) {
        const ids = list.map((x) => x.id);
        const tr = await (supabase as any).from('article_translations').select('article_id,title,summary').in('article_id', ids).eq('language', language);
        const byId = new Map(((tr.data ?? []) as { article_id: string; title?: string; summary?: string }[]).map((r) => [r.article_id, r]));
        list = list.map((x) => { const tx = byId.get(x.id); return tx ? { ...x, title: tx.title || x.title, summary: tx.summary ?? x.summary } : x; });
      }
      setArticles(list);
      setLoading(false);
    })();
  }, [language]);

  const date = (s: string | null) => (s ? new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '');

  return (
    <AppShell wide>
      <div className="mx-auto max-w-[1180px] px-5 pt-14 lg:px-10 lg:pt-10">
        <div className="mb-6 flex flex-col gap-1.5 lg:mb-9">
          <span className="font-sans text-[9px] font-semibold uppercase tracking-[0.18em] text-primary">{t('nav.editorial')}</span>
          <span className="font-display text-[34px] uppercase leading-none lg:text-[48px]">{t('home.latest')}</span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-[280px] animate-pulse rounded-2xl bg-white/[0.05]" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((a) => (
              <button key={a.id} onClick={() => navigate(`/articles/${a.id}`)} className="group flex flex-col gap-3 text-left">
                <div className="aspect-[16/10] w-full overflow-hidden rounded-2xl" style={{ background: a.thumbnail_url ? undefined : stripe }}>
                  {a.thumbnail_url && <img src={a.thumbnail_url} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />}
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="font-sans text-[9px] font-semibold uppercase tracking-[0.14em] text-primary/85">{getCategoryLabel(t, a.category)}</span>
                  <span className="font-display text-[19px] uppercase leading-[1.1]">{a.title}</span>
                  {a.summary && <span className="line-clamp-2 font-sans text-[12.5px] leading-[1.5] text-foreground/55">{a.summary}</span>}
                  <span className="mt-0.5 font-sans text-[11px] text-foreground/40">{[a.author, date(a.published_at)].filter(Boolean).join(' · ')}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default Editorial;
