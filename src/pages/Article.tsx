import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { User } from 'lucide-react';
import { RichTextContent } from '@/components/RichTextContent';
import AppShell from '@/components/mobile/AppShell';
import { useArticleEngagement, EngagementBar, CommentsSection } from '@/components/ArticleEngagement';

interface Art {
  title: string; content: string; summary: string | null; category: string | null;
  thumbnail_url: string | null; author: string | null; published_at: string | null; keywords: string[] | string | null;
}

const stripe = 'repeating-linear-gradient(135deg,#1b1b1f 0 8px,#131316 8px 16px)';

const Article = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [art, setArt] = useState<Art | null>(null);
  const [loading, setLoading] = useState(true);
  const eng = useArticleEngagement(id ?? '', { title: art?.title ?? '', summary: art?.summary ?? null });

  useEffect(() => {
    (async () => {
      if (!id) return;
      const base = await (supabase as any).from('articles').select('title,content,summary,category,thumbnail_url,author,published_at,keywords').eq('id', id).maybeSingle();
      let a = base.data as Art | null;
      if (a) {
        const tr = await (supabase as any).from('article_translations').select('title,content,summary,keywords').eq('article_id', id).eq('language', language).maybeSingle();
        if (tr.data) a = { ...a, ...Object.fromEntries(Object.entries(tr.data).filter(([, v]) => v)) } as Art;
      }
      setArt(a);
      setLoading(false);
    })();
  }, [id, language]);

  const tags = art?.keywords ? (Array.isArray(art.keywords) ? art.keywords : String(art.keywords).split(',').map((s) => s.trim())).filter(Boolean).slice(0, 4) : [];

  return (
    <AppShell>
      {loading ? (
        <div className="h-[70dvh]" />
      ) : !art ? (
        <div className="px-6 pt-32 text-center font-sans text-foreground/50">Article not found.</div>
      ) : (
        <div className="pb-24 lg:pt-8">
          {/* Hero */}
          <div className="relative flex h-[280px] items-center justify-center overflow-hidden lg:rounded-2xl" style={{ background: art.thumbnail_url ? undefined : stripe }}>
            {art.thumbnail_url && <img src={art.thumbnail_url} alt="" className="absolute inset-0 h-full w-full object-cover" />}
            <button onClick={() => navigate(-1)} className="absolute left-4 top-[52px] flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[#070708]/65 font-display text-[15px] backdrop-blur-md">←</button>
          </div>
          <div className="flex flex-col gap-3.5 px-5 pt-[22px]">
            <span className="font-sans text-[9px] font-semibold uppercase tracking-[0.16em] text-primary">{art.category ?? 'Analysis'}</span>
            <h2 className="m-0 font-display text-[28px] uppercase leading-[1.08]">{art.title}</h2>
            <div className="flex items-center gap-2.5 border-b border-white/[0.08] pb-1.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-full border border-primary/40 text-primary"><User className="h-[15px] w-[15px]" /></div>
              <span className="font-sans text-[11.5px] text-foreground/50">{[art.author ?? 'Menlifoot desk', art.published_at ? new Date(art.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : null].filter(Boolean).join(' · ')}</span>
            </div>
            {/* Engagement (top) */}
            <EngagementBar eng={eng} />
            {/* Body */}
            <RichTextContent
              html={art.content}
              className="mt-1.5 max-w-none font-sans text-[15px] leading-[1.72] text-foreground/80 [&_a]:text-primary [&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_blockquote]:italic [&_h2]:mt-4 [&_h2]:font-display [&_h2]:text-[20px] [&_h2]:uppercase [&_h2]:text-foreground [&_h3]:mt-3 [&_h3]:font-semibold [&_h3]:text-foreground [&_img]:my-3 [&_img]:rounded-xl [&_p]:mb-3.5"
            />
            {tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {tags.map((t) => (
                  <span key={t} className="rounded-full border border-white/[0.12] px-3 py-[7px] font-sans text-[11px] font-medium text-foreground/65">{t}</span>
                ))}
              </div>
            )}
            {/* Engagement (bottom) + comments */}
            <div className="mt-4"><EngagementBar eng={eng} /></div>
            <CommentsSection eng={eng} />
          </div>
        </div>
      )}
    </AppShell>
  );
};

export default Article;
