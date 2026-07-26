import { useEffect, useRef, useState } from 'react';
import { Eye, Heart, MessageCircle, Bookmark, Share2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthModal } from '@/components/AuthModal';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';

interface Comment { id: string; author_name: string | null; body: string; created_at: string; user_id: string }

export interface Eng {
  views: number; likes: number; liked: boolean; bookmarked: boolean;
  comments: Comment[]; draft: string; busy: boolean; currentUserId: string | null;
  setDraft: (s: string) => void;
  toggleLike: () => void; toggleBookmark: () => void;
  getShare: () => { url: string; title: string; text: string };
  copyLink: () => void; canNativeShare: boolean; nativeShare: () => void;
  postComment: () => void; deleteComment: (id: string) => void;
}

// deno-lint-ignore no-explicit-any
const db = supabase as any;

export function useArticleEngagement(articleId: string, meta: { title: string; summary: string | null }): Eng {
  const { user } = useAuth();
  const { open: openAuth } = useAuthModal();
  const { t } = useLanguage();
  const { toast } = useToast();
  const metaRef = useRef(meta);
  metaRef.current = meta;

  const [views, setViews] = useState(0);
  const [likes, setLikes] = useState(0);
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const viewed = useRef(false);

  useEffect(() => {
    if (!articleId) return;
    (async () => {
      if (!viewed.current) { viewed.current = true; await db.rpc('increment_article_view', { article_id: articleId }); }
      const a = await db.from('articles').select('view_count').eq('id', articleId).maybeSingle();
      setViews(a.data?.view_count ?? 0);
      const { count } = await db.from('article_likes').select('*', { count: 'exact', head: true }).eq('article_id', articleId);
      setLikes(count ?? 0);
      const cm = await db.from('article_comments').select('id,author_name,body,created_at,user_id').eq('article_id', articleId).order('created_at', { ascending: false });
      setComments((cm.data ?? []) as Comment[]);
    })();
  }, [articleId]);

  useEffect(() => {
    if (!articleId || !user) { setLiked(false); setBookmarked(false); return; }
    (async () => {
      const l = await db.from('article_likes').select('id').eq('article_id', articleId).eq('user_id', user.id).maybeSingle();
      setLiked(!!l.data);
      const b = await db.from('article_bookmarks').select('user_id').eq('article_id', articleId).eq('user_id', user.id).maybeSingle();
      setBookmarked(!!b.data);
    })();
  }, [articleId, user]);

  const toggleLike = async () => {
    if (!user) return openAuth('signin');
    if (liked) { setLiked(false); setLikes((n) => Math.max(0, n - 1)); await db.from('article_likes').delete().eq('article_id', articleId).eq('user_id', user.id); }
    else { setLiked(true); setLikes((n) => n + 1); await db.from('article_likes').insert({ article_id: articleId, user_id: user.id }); }
  };

  const toggleBookmark = async () => {
    if (!user) return openAuth('signin');
    if (bookmarked) { setBookmarked(false); await db.from('article_bookmarks').delete().eq('article_id', articleId).eq('user_id', user.id); }
    else { setBookmarked(true); await db.from('article_bookmarks').insert({ article_id: articleId, user_id: user.id }); toast({ title: t('art.saved') }); }
  };

  const getShare = () => {
    const m = metaRef.current;
    const first15 = (m.summary ?? '').split(/\s+/).filter(Boolean).slice(0, 15).join(' ');
    return {
      url: `${window.location.origin}/articles/${articleId}`,
      title: m.title || 'Menlifoot',
      text: first15 ? `${first15}…` : (m.title || 'Menlifoot'),
    };
  };
  const copyLink = async () => {
    const { url } = getShare();
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url);
      else {
        const ta = document.createElement('textarea');
        ta.value = url; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
      }
      toast({ title: t('art.linkCopied') });
    } catch { toast({ title: url }); }
  };
  // deno-lint-ignore no-explicit-any
  const canNativeShare = typeof navigator !== 'undefined' && !!(navigator as any).share;
  const nativeShare = async () => {
    // deno-lint-ignore no-explicit-any
    try { await (navigator as any).share(getShare()); } catch { /* cancelled */ }
  };

  const postComment = async () => {
    if (!user) return openAuth('signin');
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    const author = (user.user_metadata?.display_name as string) || user.email?.split('@')[0] || 'User';
    const { data, error } = await db.from('article_comments')
      .insert({ article_id: articleId, user_id: user.id, author_name: author, body })
      .select('id,author_name,body,created_at,user_id').maybeSingle();
    setBusy(false);
    if (error) { toast({ title: error.message, variant: 'destructive' }); return; }
    if (data) setComments((c) => [data as Comment, ...c]);
    setDraft('');
  };

  const deleteComment = async (cid: string) => {
    if (!user) return;
    setComments((c) => c.filter((x) => x.id !== cid));
    await db.from('article_comments').delete().eq('id', cid).eq('user_id', user.id);
  };

  return { views, likes, liked, bookmarked, comments, draft, busy, currentUserId: user?.id ?? null, setDraft, toggleLike, toggleBookmark, getShare, copyLink, canNativeShare, nativeShare, postComment, deleteComment };
}

export function EngagementBar({ eng }: { eng: Eng }) {
  const { t } = useLanguage();
  const [shareOpen, setShareOpen] = useState(false);
  const scrollToComments = () => document.getElementById('article-comments')?.scrollIntoView({ behavior: 'smooth' });
  const sh = eng.getShare();
  const socials = [
    { label: 'WhatsApp', href: `https://wa.me/?text=${encodeURIComponent(`${sh.text} ${sh.url}`)}` },
    { label: 'X', href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(sh.text)}&url=${encodeURIComponent(sh.url)}` },
    { label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(sh.url)}` },
  ];
  return (
    <div className="flex items-center gap-1 border-y border-white/[0.08] py-2">
      <span className="mr-auto flex items-center gap-1.5 font-sans text-[12px] text-foreground/45"><Eye className="h-[15px] w-[15px]" /> {eng.views}</span>
      <button onClick={eng.toggleLike} aria-label="like" className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 font-sans text-[12px] transition-colors ${eng.liked ? 'text-primary' : 'text-foreground/60 hover:text-primary'}`}>
        <Heart className={`h-[15px] w-[15px] ${eng.liked ? 'fill-current' : ''}`} /> {eng.likes}
      </button>
      <button onClick={scrollToComments} aria-label="comments" className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 font-sans text-[12px] text-foreground/60 hover:text-primary">
        <MessageCircle className="h-[15px] w-[15px]" /> {eng.comments.length}
      </button>
      <button onClick={eng.toggleBookmark} aria-label="bookmark" className={`rounded-full px-2 py-1.5 transition-colors ${eng.bookmarked ? 'text-primary' : 'text-foreground/60 hover:text-primary'}`}>
        <Bookmark className={`h-[15px] w-[15px] ${eng.bookmarked ? 'fill-current' : ''}`} />
      </button>
      <div className="relative">
        <button onClick={() => (eng.canNativeShare ? eng.nativeShare() : setShareOpen((v) => !v))} aria-label="share" className="rounded-full px-2 py-1.5 text-foreground/60 hover:text-primary">
          <Share2 className="h-[15px] w-[15px]" />
        </button>
        {shareOpen && !eng.canNativeShare && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShareOpen(false)} />
            <div className="absolute right-0 top-full z-50 mt-2 w-40 overflow-hidden rounded-xl border border-white/[0.1] bg-[#0d0d0f] py-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.6)]">
              <button onClick={() => { eng.copyLink(); setShareOpen(false); }} className="block w-full px-4 py-2 text-left font-sans text-[12.5px] text-foreground/75 transition-colors hover:bg-white/[0.04] hover:text-primary">{t('art.copyLink')}</button>
              {socials.map((s) => (
                <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" onClick={() => setShareOpen(false)} className="block px-4 py-2 text-left font-sans text-[12.5px] text-foreground/75 transition-colors hover:bg-white/[0.04] hover:text-primary">{s.label}</a>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function CommentsSection({ eng }: { eng: Eng }) {
  const { t } = useLanguage();
  return (
    <div id="article-comments" className="mt-6 flex flex-col gap-4 scroll-mt-20">
      <span className="font-display text-[18px] uppercase">{t('art.comments')} ({eng.comments.length})</span>
      <div className="flex gap-2">
        <input
          value={eng.draft} onChange={(e) => eng.setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') eng.postComment(); }}
          placeholder={t('art.writeComment')} maxLength={2000}
          className="flex-1 rounded-full border border-white/[0.12] bg-[#101012] px-4 py-2.5 font-sans text-[13.5px] text-foreground placeholder:text-foreground/35 focus:border-primary/50 focus:outline-none"
        />
        <button onClick={eng.postComment} disabled={eng.busy || !eng.draft.trim()} className="rounded-full px-4 py-2.5 font-sans text-[12px] font-bold uppercase tracking-[0.05em] text-[#070708] disabled:opacity-40" style={{ background: 'linear-gradient(135deg,#e9c877,#c08a2a)' }}>{t('art.post')}</button>
      </div>
      {eng.comments.length === 0 ? (
        <p className="py-4 text-center font-sans text-[12.5px] text-foreground/40">{t('art.noComments')}</p>
      ) : (
        <div className="flex flex-col gap-3.5">
          {eng.comments.map((c) => (
            <div key={c.id} className="flex flex-col gap-1 border-b border-white/[0.05] pb-3">
              <div className="flex items-center gap-2">
                <span className="font-sans text-[12.5px] font-semibold text-foreground/85">{c.author_name || 'User'}</span>
                <span className="font-sans text-[10.5px] text-foreground/35">{new Date(c.created_at).toLocaleDateString()}</span>
                {eng.currentUserId === c.user_id && <button onClick={() => eng.deleteComment(c.id)} aria-label="delete comment" className="ml-auto text-foreground/35 hover:text-primary"><X className="h-3.5 w-3.5" /></button>}
              </div>
              <p className="font-sans text-[13.5px] leading-[1.5] text-foreground/70">{c.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
