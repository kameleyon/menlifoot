import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Clock, Search, Flag, Lightbulb } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

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
      <div className="sticky top-0 z-30 mb-6 border-b border-white/[0.07] bg-[#070708]/95 py-3 backdrop-blur-md lg:top-[60px]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Clock className="h-5 w-5 text-primary" />
            <span className={`font-display text-[24px] leading-none ${timeLeft < 60 ? 'text-destructive animate-pulse' : 'text-primary'}`}>
              {minutes}:{seconds.toString().padStart(2, '0')}
            </span>
          </div>
          <div className="font-sans text-[13px]">
            <span className="font-display text-[19px] text-primary">{foundIds.size}</span>
            <span className="text-foreground/40"> / {items.length}</span>
          </div>
          <button onClick={handleGiveUp} className="flex items-center gap-2 rounded-full border border-white/[0.15] px-4 py-2 font-sans text-[11px] font-semibold uppercase tracking-[0.06em] text-foreground/75 transition-colors hover:border-primary/50 hover:text-primary">
            <Flag className="h-[14px] w-[14px]" />
            {t('quiz.giveUp') || 'Give Up'}
          </button>
        </div>
        {/* Timer bar */}
        <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/[0.08]">
          <motion.div
            className="h-full rounded-full bg-primary"
            initial={{ width: '100%' }}
            animate={{ width: `${timerPercent}%` }}
            transition={{ duration: 1, ease: "linear" }}
          />
        </div>
      </div>

      {/* Title */}
      <h2 className="mb-5 text-center font-display text-[20px] uppercase leading-[1.1] lg:text-[26px]">
        {quiz.title}
      </h2>

      {/* Input */}
      <div className="relative mx-auto mb-6 max-w-md">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-foreground/40" />
        <Input
          ref={inputRef}
          type="text"
          value={guess}
          onChange={(e) => handleGuess(e.target.value)}
          placeholder={t('quiz.typeAnswer') || 'Type your answer...'}
          className="h-14 rounded-xl border-white/[0.1] bg-[#101012] pl-12 text-[15px] focus-visible:border-primary/60 focus-visible:ring-0"
          autoFocus
        />
      </div>

      {/* Quiz Table */}
      <div className="overflow-hidden rounded-2xl border border-white/[0.07]">
        <table className="w-full">
          <thead>
            <tr className="bg-white/[0.03]">
              <th className="w-12 px-4 py-3 text-left font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/40">#</th>
              <th className="px-4 py-3 text-left font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/40">{t('quiz.answer') || 'Answer'}</th>
              {items[0]?.display_value && (
                <th className="w-20 px-4 py-3 text-right font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/40">{t('quiz.value') || 'Value'}</th>
              )}
              <th className="w-10 px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const isFound = foundIds.has(item.id);
              const hintRevealed = revealedHints.has(item.id);

              return (
                <tr key={item.id} className={`border-t border-white/[0.05] transition-colors ${isFound ? 'bg-primary/[0.08]' : ''}`}>
                  <td className="px-4 py-3 font-sans text-[13px] text-foreground/40">{idx + 1}</td>
                  <td className="px-4 py-3 font-sans text-[13px] font-medium">
                    {isFound ? (
                      <span className="flex items-center gap-2 text-foreground">
                        <span className="font-bold text-primary">✓</span>
                        {item.answer}
                      </span>
                    ) : hintRevealed && item.hint ? (
                      <span className="text-[12px] italic text-foreground/50">{item.hint}</span>
                    ) : (
                      <span className="text-foreground/25">—</span>
                    )}
                  </td>
                  {item.display_value && (
                    <td className="px-4 py-3 text-right font-sans text-[13px] text-foreground/50">
                      {isFound ? item.display_value : '—'}
                    </td>
                  )}
                  <td className="px-4 py-2">
                    {!isFound && item.hint && !hintRevealed && (
                      <button
                        onClick={() => handleHint(item.id)}
                        className="p-1 text-foreground/40 transition-colors hover:text-primary"
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
