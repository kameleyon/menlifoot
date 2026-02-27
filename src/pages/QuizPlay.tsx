import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Trophy, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import QuizGame from "@/components/QuizGame";
import Navbar from "@/components/Navbar";

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

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center pt-32">
          <div className="text-muted-foreground">{t('quiz.loading') || 'Loading...'}</div>
        </div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex flex-col items-center justify-center pt-32 gap-4">
          <p className="text-muted-foreground">{t('quiz.notFound') || 'Quiz not found'}</p>
          <Link to="/quizzes">
            <Button variant="outline">{t('quiz.browseQuizzes') || 'Browse Quizzes'}</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-12 max-w-4xl">
        <Link to="/quizzes" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          {t('quiz.browseQuizzes') || 'Browse Quizzes'}
        </Link>

        {gameState === "start" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16"
          >
            <Trophy className="h-16 w-16 text-primary mx-auto mb-6" />
            <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
              {displayTitle}
            </h1>
            {displayDescription && (
              <p className="text-muted-foreground text-lg mb-6 max-w-xl mx-auto">
                {displayDescription}
              </p>
            )}
            <div className="flex items-center justify-center gap-6 mb-8 text-sm text-muted-foreground">
              <span>⏱ {Math.floor(quiz.time_limit_seconds / 60)}:{(quiz.time_limit_seconds % 60).toString().padStart(2, '0')} {t('quiz.minutes') || 'minutes'}</span>
              <span>📝 {items.length} {t('quiz.answers') || 'answers'}</span>
            </div>
            <div className="flex items-center justify-center gap-3">
              <Button variant="gold" size="lg" onClick={() => setGameState("playing")}>
                {t('quiz.startQuiz') || 'Start Quiz'}
              </Button>
              <Button variant="outline" size="lg" onClick={shareQuiz} className="gap-2">
                <Share2 className="h-4 w-4" />
                {t('quiz.share') || 'Share'}
              </Button>
            </div>
          </motion.div>
        )}

        {gameState === "playing" && (
          <QuizGame quiz={quiz} items={items} onFinish={handleFinish} />
        )}

        {gameState === "finished" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="text-center mb-8">
              <Trophy className="h-16 w-16 text-primary mx-auto mb-4" />
              <h2 className="font-display text-3xl font-bold text-foreground mb-2">
                {t('quiz.results') || 'Results'}
              </h2>
              <p className="text-4xl font-bold text-primary mb-2">
                {score} / {items.length}
              </p>
              <p className="text-muted-foreground">
                {t('quiz.timeTaken') || 'Time'}: {Math.floor(timeTaken / 60)}:{(timeTaken % 60).toString().padStart(2, '0')}
              </p>
            </div>

            <div className="rounded-xl overflow-hidden border border-border/50 mb-8">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">#</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">{t('quiz.answer') || 'Answer'}</th>
                    {items[0]?.display_value && (
                      <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">{t('quiz.value') || 'Value'}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const found = (item as any)._found;
                    return (
                      <tr key={item.id} className={found ? "bg-primary/15" : "bg-muted/20"}>
                        <td className="px-4 py-3 text-sm font-medium text-muted-foreground">{idx + 1}</td>
                        <td className="px-4 py-3 text-sm font-medium text-foreground flex items-center gap-2">
                          {found && <span className="text-primary">✓</span>}
                          {item.answer}
                        </td>
                        {item.display_value && (
                          <td className="px-4 py-3 text-sm text-right text-muted-foreground">{item.display_value}</td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-center gap-4 flex-wrap">
              <Button variant="gold" onClick={shareScore} className="gap-2">
                <Share2 className="h-4 w-4" />
                {t('quiz.shareScore') || 'Share Score'}
              </Button>
              <Button variant="outline" onClick={handleRestart}>
                {t('quiz.playAgain') || 'Play Again'}
              </Button>
              <Link to="/quizzes">
                <Button variant="outline">
                  {t('quiz.browseQuizzes') || 'Browse Quizzes'}
                </Button>
              </Link>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default QuizPlay;
