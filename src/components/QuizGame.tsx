import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Clock, Search, Flag, Lightbulb } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";

interface QuizItem {
  id: string;
  answer: string;
  acceptable_answers: string[] | null;
  hint: string | null;
  display_value: string | null;
  sort_order: number;
}

interface Props {
  quiz: { id: string; title: string; time_limit_seconds: number };
  items: QuizItem[];
  onFinish: (score: number, timeTaken: number) => void;
}

const normalizeAnswer = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

const QuizGame = ({ quiz, items, onFinish }: Props) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const [timeLeft, setTimeLeft] = useState(quiz.time_limit_seconds);
  const [guess, setGuess] = useState("");
  const [foundIds, setFoundIds] = useState<Set<string>>(new Set());
  const [revealedHints, setRevealedHints] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const startTimeRef = useRef(Date.now());

  // Timer
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Time up
  useEffect(() => {
    if (timeLeft === 0) {
      finishGame();
    }
  }, [timeLeft]);

  // All found
  useEffect(() => {
    if (foundIds.size === items.length && items.length > 0) {
      finishGame();
    }
  }, [foundIds.size, items.length]);

  const finishGame = useCallback(() => {
    const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
    // Mark found items on the items array for results display
    items.forEach((item) => {
      (item as any)._found = foundIds.has(item.id);
    });
    onFinish(foundIds.size, elapsed);
  }, [foundIds, items, onFinish]);

  const handleGuess = (value: string) => {
    setGuess(value);
    const normalized = normalizeAnswer(value);
    if (!normalized) return;

    for (const item of items) {
      if (foundIds.has(item.id)) continue;

      const answers = [item.answer, ...(item.acceptable_answers || [])];
      const match = answers.some((a) => normalizeAnswer(a) === normalized);

      if (match) {
        setFoundIds((prev) => new Set(prev).add(item.id));
        setGuess("");
        // Brief flash feedback
        toast({ title: "✓ " + item.answer, duration: 1500 });
        inputRef.current?.focus();
        break;
      }
    }
  };

  const handleGiveUp = () => {
    finishGame();
  };

  const handleHint = (itemId: string) => {
    if (!user) {
      toast({
        title: t('quiz.loginForHint') || 'Login required',
        description: t('quiz.loginForHintDesc') || 'Create an account to unlock hints',
        variant: 'destructive',
      });
      return;
    }
    setRevealedHints((prev) => new Set(prev).add(itemId));
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timerPercent = (timeLeft / quiz.time_limit_seconds) * 100;

  return (
    <div>
      {/* Header: Timer + Score */}
      <div className="sticky top-16 z-30 bg-background/95 backdrop-blur-sm border-b border-border/50 py-3 mb-6 -mx-4 px-4">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-primary" />
            <span className={`font-mono text-2xl font-bold ${timeLeft < 60 ? 'text-destructive animate-pulse' : 'text-primary'}`}>
              {minutes}:{seconds.toString().padStart(2, '0')}
            </span>
          </div>
          <div className="text-sm font-medium text-foreground">
            <span className="text-primary text-lg font-bold">{foundIds.size}</span>
            <span className="text-muted-foreground"> / {items.length}</span>
          </div>
          <Button variant="outline" size="sm" onClick={handleGiveUp} className="gap-2">
            <Flag className="h-4 w-4" />
            {t('quiz.giveUp') || 'Give Up'}
          </Button>
        </div>
        {/* Timer bar */}
        <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden max-w-4xl mx-auto">
          <motion.div
            className="h-full bg-primary rounded-full"
            initial={{ width: '100%' }}
            animate={{ width: `${timerPercent}%` }}
            transition={{ duration: 1, ease: "linear" }}
          />
        </div>
      </div>

      {/* Title */}
      <h2 className="font-display text-xl md:text-2xl font-bold text-foreground mb-4 text-center">
        {quiz.title}
      </h2>

      {/* Input */}
      <div className="relative mb-6 max-w-md mx-auto">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          value={guess}
          onChange={(e) => handleGuess(e.target.value)}
          placeholder={t('quiz.typeAnswer') || 'Type your answer...'}
          className="pl-12 h-14 text-lg bg-card border-border/50 rounded-xl"
          autoFocus
        />
      </div>

      {/* Quiz Table */}
      <div className="rounded-xl overflow-hidden border border-border/50">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/50">
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground w-12">#</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">{t('quiz.answer') || 'Answer'}</th>
              {items[0]?.display_value && (
                <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground w-20">{t('quiz.value') || 'Value'}</th>
              )}
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const isFound = foundIds.has(item.id);
              const hintRevealed = revealedHints.has(item.id);

              return (
                <tr
                  key={item.id}
                  className={`border-t border-border/30 transition-colors ${
                    isFound
                      ? 'bg-primary/15'
                      : 'bg-card'
                  }`}
                >
                  <td className="px-4 py-3 text-sm font-medium text-muted-foreground">
                    {idx + 1}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">
                    {isFound ? (
                      <span className="text-foreground flex items-center gap-2">
                        <span className="text-primary font-bold">✓</span>
                        {item.answer}
                      </span>
                    ) : hintRevealed && item.hint ? (
                      <span className="text-muted-foreground italic text-xs">{item.hint}</span>
                    ) : (
                      <span className="text-muted-foreground/30">—</span>
                    )}
                  </td>
                  {item.display_value && (
                    <td className="px-4 py-3 text-sm text-right text-muted-foreground">
                      {isFound ? item.display_value : '—'}
                    </td>
                  )}
                  <td className="px-4 py-2">
                    {!isFound && item.hint && !hintRevealed && (
                      <button
                        onClick={() => handleHint(item.id)}
                        className="p-1 text-muted-foreground hover:text-primary transition-colors"
                        title={t('quiz.hint') || 'Hint'}
                      >
                        <Lightbulb className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default QuizGame;
