import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Send, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import { useLanguage } from "@/contexts/LanguageContext";

interface Message {
  id: number;
  type: "user" | "bot";
  content: string;
}

const ChatSection = () => {
  const { t, language } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      type: "bot",
      content: t('ai.greeting'),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Update initial greeting message when language changes
  useEffect(() => {
    setMessages(prev => prev.map(msg => 
      msg.id === 1 && msg.type === "bot" 
        ? { ...msg, content: t('ai.greeting') }
        : msg
    ));
  }, [language, t]);

  const suggestivePrompts = [
    { en: "Who will win the Champions League?", fr: "Qui va gagner la Ligue des Champions?", es: "¿Quién ganará la Champions League?", ht: "Ki moun ki pral genyen Lig Chanpyon an?" },
    { en: "Best players in the world right now?", fr: "Les meilleurs joueurs du monde actuellement?", es: "¿Mejores jugadores del mundo ahora?", ht: "Pi bon jwè nan mond lan kounye a?" },
    { en: "World Cup 2026 predictions", fr: "Prédictions Coupe du Monde 2026", es: "Predicciones Mundial 2026", ht: "Prediksyon Koup di Mond 2026" },
    { en: "Latest transfer rumors", fr: "Dernières rumeurs de transferts", es: "Últimos rumores de fichajes", ht: "Dènye rimè transfè" },
    { en: "Who is the GOAT: Messi or Ronaldo?", fr: "Qui est le GOAT: Messi ou Ronaldo?", es: "¿Quién es el GOAT: Messi o Ronaldo?", ht: "Ki moun ki GOAT la: Messi oswa Ronaldo?" },
    { en: "Upcoming big matches this week", fr: "Grands matchs à venir cette semaine", es: "Grandes partidos esta semana", ht: "Gwo match k ap vini semèn sa a" },
  ];

  const handleSend = async (messageText?: string) => {
    const textToSend = messageText || input.trim();
    if (!textToSend || isLoading) return;

    const userMessage: Message = {
      id: messages.length + 1,
      type: "user",
      content: textToSend,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const conversationHistory = messages
        .filter(m => m.id > 1)
        .map(m => ({
          role: m.type === "user" ? "user" : "assistant",
          content: m.content
        }));

      const { data, error } = await supabase.functions.invoke('soccer-chat', {
        body: {
          messages: [
            ...conversationHistory,
            { role: "user", content: textToSend }
          ]
        }
      });

      if (error) throw error;

      setMessages((prev) => [
        ...prev,
        {
          id: prev.length + 1,
          type: "bot",
          content: data.reply,
        },
      ]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: prev.length + 1,
          type: "bot",
          content: "My bad, something went wrong. Try again! ⚽",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const getLocalizedPrompt = (prompt: typeof suggestivePrompts[0]) => {
    return prompt[language as keyof typeof prompt] || prompt.en;
  };

  return (
    <section id="chat" className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6">
            <Sparkles className="h-4 w-4" />
            {t('chat.poweredBy')}
          </div>
          <h2 className="text-4xl md:text-5xl font-light tracking-wider mb-4 text-gradient-gold uppercase" style={{ fontFamily: "'Oswald', sans-serif" }}>
            {t('chat.askThe')} <span>{t('chat.expertName')}</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {t('chat.description')}
          </p>
        </motion.div>

        {/* Chat Container */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="glass-card overflow-hidden max-w-4xl mx-auto"
        >
          {/* Chat Header */}
          <div className="bg-gradient-card p-4 border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="relative">
                <img 
                  src="/logo.png" 
                  alt="Menlifoot Expert" 
                  className="w-12 h-12 rounded-full object-cover border-2 border-primary/50"
                />
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-card" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-foreground">{t('ai.title')}</span>
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <span className="text-sm text-muted-foreground">{t('ai.subtitle')}</span>
              </div>
            </div>
          </div>

          {/* Messages Area */}
          <div className="h-96 overflow-y-auto p-6 space-y-4 bg-background/30">
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    message.type === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-surface-elevated text-foreground rounded-bl-md"
                  }`}
                >
                  {message.type === "bot" ? (
                    <div className="text-sm leading-relaxed prose prose-sm prose-invert max-w-none [&_p]:m-0 [&_ul]:my-1 [&_li]:my-0 [&_strong]:text-primary">
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm leading-relaxed">{message.content}</p>
                  )}
                </div>
              </motion.div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-surface-elevated rounded-2xl rounded-bl-md px-4 py-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              </div>
            )}
          </div>

          {/* Suggestive Prompts */}
          <div className="p-4 border-t border-border/30 bg-background/50">
            <p className="text-xs text-muted-foreground mb-3">{t('chat.tryAsking')}</p>
            <div className="flex flex-wrap gap-2">
              {suggestivePrompts.map((prompt, index) => (
                <button
                  key={index}
                  onClick={() => handleSend(getLocalizedPrompt(prompt))}
                  disabled={isLoading}
                  className="px-3 py-1.5 text-xs rounded-full bg-surface-elevated hover:bg-primary/20 text-foreground/80 hover:text-foreground transition-colors border border-border/50 hover:border-primary/30 disabled:opacity-50"
                >
                  {getLocalizedPrompt(prompt)}
                </button>
              ))}
            </div>
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-border/50 bg-card">
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSend()}
                placeholder={t('ai.placeholder')}
                disabled={isLoading}
                className="flex-1 bg-surface-elevated rounded-full px-5 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
              />
              <Button
                variant="gold"
                size="icon"
                className="h-12 w-12 rounded-full"
                onClick={() => handleSend()}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default ChatSection;
