import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import AppShell from '@/components/mobile/AppShell';

interface Quiz { id: string; title: string; description: string | null; thumbnail_url: string | null; time_limit_seconds: number | null; }
const stripe = 'repeating-linear-gradient(135deg,#1b1b1f 0 8px,#131316 8px 16px)';

const QuizList = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).from('quizzes')
        .select('id,title,description,thumbnail_url,time_limit_seconds')
        .eq('is_published', true).order('created_at', { ascending: false });
      setQuizzes((data as Quiz[]) ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <AppShell wide>
      <div className="mx-auto max-w-[1180px] px-5 pt-14 lg:px-10 lg:pt-10">
        <div className="mb-6 flex flex-col gap-1.5 lg:mb-9">
          <span className="font-sans text-[9px] font-semibold uppercase tracking-[0.18em] text-primary">Menlifoot</span>
          <span className="font-display text-[34px] uppercase leading-none lg:text-[48px]">{t('nav.quiz')}</span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-[220px] animate-pulse rounded-2xl bg-white/[0.05]" />)}
          </div>
        ) : quizzes.length === 0 ? (
          <p className="py-16 text-center font-sans text-foreground/50">—</p>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {quizzes.map((q) => (
              <button key={q.id} onClick={() => navigate(`/quizzes/${q.id}`)} className="group flex flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-[#101012] text-left transition-colors hover:border-primary/50">
                <div className="aspect-[16/9] w-full overflow-hidden" style={{ background: q.thumbnail_url ? undefined : stripe }}>
                  {q.thumbnail_url && <img src={q.thumbnail_url} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />}
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <span className="font-display text-[18px] uppercase leading-[1.1]">{q.title}</span>
                  {q.description && <span className="line-clamp-2 font-sans text-[12.5px] leading-[1.5] text-foreground/55">{q.description}</span>}
                  <span className="mt-auto inline-flex items-center gap-1.5 pt-1 font-sans text-[11px] font-semibold uppercase tracking-wide text-primary">Play →</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default QuizList;
