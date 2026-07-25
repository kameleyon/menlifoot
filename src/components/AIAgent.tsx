import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, X, Send, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import { useLanguage } from "@/contexts/LanguageContext";

interface Message {
  id: number;
  type: "user" | "bot";
  content: string;
}

const AIAgent = () => {
  const { t, language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
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

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: messages.length + 1,
      type: "user",
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    const userInput = input;
    setInput("");
    setIsLoading(true);

    try {
      // Build conversation history for context
      const conversationHistory = messages
        .filter(m => m.id > 1) // Skip initial greeting
        .map(m => ({
          role: m.type === "user" ? "user" : "assistant",
          content: m.content
        }));

      const { data, error } = await supabase.functions.invoke('soccer-chat', {
        body: {
          messages: [
            ...conversationHistory,
            { role: "user", content: userInput }
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

  return (
    <>
      {/* Chat Toggle Button */}
      <motion.div
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 4 }}
        className="fixed bottom-6 right-6 z-50"
      >
        <button
          className="h-14 w-14 rounded-full bg-gradient-to-br from-gold to-gold-dark shadow-lg hover:scale-110 transition-transform duration-300 flex items-center justify-center"
          onClick={() => setIsOpen(true)}
          aria-label="Open AI Chat"
        >
          <MessageSquare className="h-6 w-6 text-background" />
        </button>
      </motion.div>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <div
            className="fixed bottom-6 right-6 z-50 w-[360px] max-w-[calc(100vw-48px)] glass-card overflow-hidden shadow-2xl"
          >
            {/* Header */}
            <div className="bg-gradient-card p-4 border-b border-border/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img 
                      src="/logo.png" 
                      alt="Menlifoot Expert" 
                      className="w-10 h-10 rounded-full object-cover border-2 border-primary/50"
                    />
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-card" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-foreground">{t('ai.title')}</span>
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <span className="text-xs text-muted-foreground">{t('ai.subtitle')}</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <div className="h-80 overflow-y-auto p-4 space-y-4 bg-background/50">
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
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
            </div>

            {/* Input */}
            <div className="p-4 border-t border-border/50 bg-card">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSend()}
                  placeholder={t('ai.placeholder')}
                  disabled={isLoading}
                  className="flex-1 bg-surface-elevated rounded-full px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                />
                <Button
                  variant="gold"
                  size="icon"
                  className="h-10 w-10 rounded-full"
                  onClick={handleSend}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default AIAgent;
