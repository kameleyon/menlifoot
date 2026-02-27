import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Trophy, Clock, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Skeleton } from "@/components/ui/skeleton";

interface Quiz {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  time_limit_seconds: number;
}

interface QuizTranslation {
  quiz_id: string;
  language: string;
  title: string;
  description: string | null;
}

const Quizzes = () => {
  const { t, language } = useLanguage();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [translations, setTranslations] = useState<Record<string, QuizTranslation>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchQuizzes = async () => {
      const { data, error } = await supabase
        .from("quizzes")
        .select("id, title, description, thumbnail_url, time_limit_seconds")
        .eq("is_published", true)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setQuizzes(data);

        // Fetch translations for current language if not English
        if (language !== "en" && data.length > 0) {
          const { data: transData } = await supabase
            .from("quiz_translations")
            .select("quiz_id, language, title, description")
            .eq("language", language)
            .in("quiz_id", data.map((q) => q.id));

          if (transData) {
            const map: Record<string, QuizTranslation> = {};
            transData.forEach((t) => (map[t.quiz_id] = t));
            setTranslations(map);
          }
        } else {
          setTranslations({});
        }
      }
      setLoading(false);
    };
    fetchQuizzes();
  }, [language]);

  const getTitle = (quiz: Quiz) => translations[quiz.id]?.title || quiz.title;
  const getDescription = (quiz: Quiz) =>
    translations[quiz.id]?.description ?? quiz.description;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="pt-28 pb-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-transparent" />
        <div className="container mx-auto px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <div className="flex items-center justify-center gap-3 mb-4">
              <Trophy className="h-10 w-10 text-primary" />
              <h1 className="font-display text-4xl md:text-6xl font-bold text-gradient-gold uppercase tracking-tight">
                {t('quiz.title') || 'Quiz'}
              </h1>
            </div>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              {t('quiz.subtitle') || 'Test your football knowledge with timed trivia challenges'}
            </p>
          </motion.div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-64 rounded-xl" />
              ))}
            </div>
          ) : quizzes.length === 0 ? (
            <div className="text-center py-20">
              <Trophy className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground text-lg">{t('quiz.noQuizzes') || 'No quizzes available yet'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {quizzes.map((quiz, index) => (
                <motion.div
                  key={quiz.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Link to={`/quizzes/${quiz.id}`}>
                    <div className="group relative rounded-xl overflow-hidden border border-border/50 bg-card hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10">
                      {quiz.thumbnail_url ? (
                        <div className="aspect-video overflow-hidden">
                          <img
                            src={quiz.thumbnail_url}
                            alt={getTitle(quiz)}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        </div>
                      ) : (
                        <div className="aspect-video bg-gradient-to-br from-primary/20 to-secondary flex items-center justify-center">
                          <Trophy className="h-16 w-16 text-primary/50" />
                        </div>
                      )}
                      <div className="p-5">
                        <h3 className="font-display text-lg font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 mb-2">
                          {getTitle(quiz)}
                        </h3>
                        {getDescription(quiz) && (
                          <p className="text-muted-foreground text-sm line-clamp-2 mb-3">
                            {getDescription(quiz)}
                          </p>
                        )}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" />
                            <span>{Math.floor(quiz.time_limit_seconds / 60)}:{(quiz.time_limit_seconds % 60).toString().padStart(2, '0')}</span>
                          </div>
                          <div className="flex items-center gap-1 text-primary text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                            {t('quiz.play') || 'Play'}
                            <ArrowRight className="h-4 w-4" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Quizzes;
