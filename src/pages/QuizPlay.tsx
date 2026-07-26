import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Trophy, Share2, Clock, ListChecks } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import QuizGame from "@/components/QuizGame";
import AppShell from "@/components/mobile/AppShell";

interface Quiz {
  id: string;
  title: string;
  description: string | null;
  time_limit_seconds: number;
}

interface QuizItem {
  id: string;
  answer: string;
  acceptable_answers: string[] | null;
  hint: string | null;
  display_value: string | null;
  sort_order: number;
}

const QuizPlay = () => {
  const { id } = useParams<{ id: string }>();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [displayTitle, setDisplayTitle] = useState("");
  const [displayDescription, setDisplayDescription] = useState<string | null>(null);
  const [items, setItems] = useState<QuizItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [gameState, setGameState] = useState<"start" | "playing" | "finished">("start");
  const [score, setScore] = useState(0);
  const [timeTaken, setTimeTaken] = useState(0);

  useEffect(() => {
    if (!id) return;
    const fetchQuiz = async () => {
      const [quizRes, itemsRes] = await Promise.all([
        supabase.from("quizzes").select("*").eq("id", id).single(),
        supabase.from("quiz_items").select("*").eq("quiz_id", id).order("sort_order"),
      ]);
      if (quizRes.data) {
        setQuiz(quizRes.data);
        setDisplayTitle(quizRes.data.title);
        setDisplayDescription(quizRes.data.description);

        // Fetch translation if not English
        if (language !== "en") {
          const { data: trans } = await supabase
            .from("quiz_translations")
            .select("title, description")
            .eq("quiz_id", id)
            .eq("language", language)
            .maybeSingle();

          if (trans) {
            setDisplayTitle(trans.title);
            setDisplayDescription(trans.description);
          }
        }
      }
      if (itemsRes.data) setItems(itemsRes.data);
      setLoading(false);
    };
    fetchQuiz();
  }, [id, language]);

  const handleFinish = useCallback(async (finalScore: number, totalTime: number) => {
    setScore(finalScore);
    setTimeTaken(totalTime);
    setGameState("finished");

    if (quiz) {
      await supabase.from("quiz_attempts").insert({
        quiz_id: quiz.id,
        user_id: user?.id || null,
        score: finalScore,
        total_items: items.length,
        time_taken_seconds: totalTime,
      });
    }
  }, [quiz, items.length, user]);

  const handleRestart = () => {
    setScore(0);
    setTimeTaken(0);
    setGameState("start");
  };

  const quizUrl = `${window.location.origin}/quizzes/${id}`;

  const shareQuiz = async () => {
    const text = displayTitle;
    if (navigator.share) {
      try { await navigator.share({ title: text, url: quizUrl }); } catch {}
    } else {
      await navigator.clipboard.writeText(quizUrl);
      toast({ title: t('quiz.linkCopied') || 'Link copied!', duration: 2000 });
    }
  };

  const shareScore = async () => {
    const text = `⚽ ${displayTitle}\n🏆 ${score}/${items.length} — ${Math.floor(timeTaken / 60)}:${(timeTaken % 60).toString().padStart(2, '0')}\n${t('quiz.shareChallenge') || 'Can you beat my score?'}`;
    if (navigator.share) {
      try { await navigator.share({ title: displayTitle, text, url: quizUrl }); } catch {}
    } else {
      await navigator.clipboard.writeText(`${text}\n${quizUrl}`);
      toast({ title: t('quiz.linkCopied') || 'Link copied!', duration: 2000 });
    }
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const goldPill = "flex items-center justify-center gap-2 rounded-full px-[26px] py-[13px] font-sans text-[13px] font-bold uppercase tracking-[0.06em] text-[#070708]";
  const goldStyle = { background: 'linear-gradient(135deg,#e9c877,#c08a2a)' } as const;
  const outlinePill = "flex items-center justify-center gap-2 rounded-full border border-white/[0.15] px-[22px] py-[13px] font-sans text-[13px] font-semibold uppercase tracking-[0.06em] text-foreground/80 transition-colors hover:border-primary/60 hover:text-primary";

  const back = (
    <Link to="/quizzes" className="mb-7 inline-flex items-center gap-2 font-sans text-[12px] font-medium text-foreground/45 transition-colors hover:text-primary">
      <ArrowLeft className="h-4 w-4" />
      {t('quiz.browseQuizzes') || 'Browse Quizzes'}
    </Link>
  );

  if (loading || !quiz) {
    return (
      <AppShell wide>
        <div className="mx-auto max-w-[860px] px-5 pt-14 lg:px-10 lg:pt-10">
          {back}
          <p className="py-20 text-center font-sans text-foreground/50">{loading ? (t('quiz.loading') || 'Loading…') : (t('quiz.notFound') || 'Quiz not found')}</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell wide>
      <div className="mx-auto max-w-[860px] px-5 pt-14 lg:px-10 lg:pt-10">
        {back}

        {gameState === "start" && (
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center py-8 text-center lg:py-14">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-primary/25 bg-primary/[0.08]">
              <Trophy className="h-8 w-8 text-primary" />
            </div>
            <h1 className="max-w-[20ch] font-display text-[30px] uppercase leading-[1.05] lg:text-[44px]">{displayTitle}</h1>
            {displayDescription && <p className="mt-4 max-w-[52ch] font-sans text-[14px] leading-[1.6] text-foreground/55">{displayDescription}</p>}
            <div className="mt-6 flex items-center gap-6 font-sans text-[12.5px] text-foreground/50">
              <span className="inline-flex items-center gap-1.5"><Clock className="h-[15px] w-[15px] text-primary" /> {fmt(quiz.time_limit_seconds)} {t('quiz.minutes') || 'minutes'}</span>
              <span className="inline-flex items-center gap-1.5"><ListChecks className="h-[15px] w-[15px] text-primary" /> {items.length} {t('quiz.answers') || 'answers'}</span>
            </div>
            <div className="mt-8 flex items-center gap-3">
              <button className={goldPill} style={goldStyle} onClick={() => setGameState("playing")}>{t('quiz.startQuiz') || 'Start Quiz'}</button>
              <button className={outlinePill} onClick={shareQuiz}><Share2 className="h-4 w-4" />{t('quiz.share') || 'Share'}</button>
            </div>
          </motion.div>
        )}

        {gameState === "playing" && <QuizGame quiz={quiz} items={items} onFinish={handleFinish} />}

        {gameState === "finished" && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="pb-10">
            <div className="mb-8 flex flex-col items-center text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-primary/25 bg-primary/[0.08]">
                <Trophy className="h-7 w-7 text-primary" />
              </div>
              <h2 className="font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">{t('quiz.results') || 'Results'}</h2>
              <p className="mt-2 font-display text-[46px] leading-none text-primary">{score} <span className="text-foreground/40">/ {items.length}</span></p>
              <p className="mt-2 font-sans text-[13px] text-foreground/50">{t('quiz.timeTaken') || 'Time'}: {fmt(timeTaken)}</p>
            </div>

            <div className="mb-8 overflow-hidden rounded-2xl border border-white/[0.07]">
              <table className="w-full">
                <thead>
                  <tr className="bg-white/[0.03]">
                    <th className="w-12 px-4 py-3 text-left font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/40">#</th>
                    <th className="px-4 py-3 text-left font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/40">{t('quiz.answer') || 'Answer'}</th>
                    {items[0]?.display_value && <th className="px-4 py-3 text-right font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/40">{t('quiz.value') || 'Value'}</th>}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const found = (item as any)._found;
                    return (
                      <tr key={item.id} className={`border-t border-white/[0.05] ${found ? 'bg-primary/[0.08]' : ''}`}>
                        <td className="px-4 py-3 font-sans text-[13px] text-foreground/40">{idx + 1}</td>
                        <td className="px-4 py-3 font-sans text-[13px] font-medium">
                          <span className={`flex items-center gap-2 ${found ? 'text-foreground' : 'text-foreground/30'}`}>
                            {found && <span className="text-primary">✓</span>}
                            {item.answer}
                          </span>
                        </td>
                        {item.display_value && <td className="px-4 py-3 text-right font-sans text-[13px] text-foreground/50">{item.display_value}</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button className={goldPill} style={goldStyle} onClick={shareScore}><Share2 className="h-4 w-4" />{t('quiz.shareScore') || 'Share Score'}</button>
              <button className={outlinePill} onClick={handleRestart}>{t('quiz.playAgain') || 'Play Again'}</button>
              <Link to="/quizzes" className={outlinePill}>{t('quiz.browseQuizzes') || 'Browse Quizzes'}</Link>
            </div>
          </motion.div>
        )}
      </div>
    </AppShell>
  );
};

export default QuizPlay;
