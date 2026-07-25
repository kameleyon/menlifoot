import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import AppShell from '@/components/mobile/AppShell';

interface Msg { role: 'user' | 'bot'; content: string; }

const PROMPT_KEYS = ['ask.p1', 'ask.p2', 'ask.p3'];

const Ask = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [thread, setThread] = useState<Msg[]>(() => [{ role: 'bot', content: t('ask.intro') }]);
  const [input, setInput] = useState('');
  const [asking, setAsking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || asking) return;
    const next = [...thread, { role: 'user' as const, content: q }];
    setThread(next);
    setInput('');
    setAsking(true);
    try {
      const history = next.map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }));
      const { data, error } = await supabase.functions.invoke('soccer-chat', { body: { messages: history } });
      if (error) throw error;
      setThread((p) => [...p, { role: 'bot', content: (data as { reply?: string })?.reply ?? 'Try again.' }]);
    } catch {
      setThread((p) => [...p, { role: 'bot', content: t('ask.error') }]);
    } finally {
      setAsking(false);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }));
    }
  };

  return (
    <AppShell>
      <div className="flex min-h-[100dvh] flex-col pt-12">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-white/[0.07] px-4 pb-[18px]">
          <button onClick={() => navigate(-1)} className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-white/[0.12] font-display text-[15px]">←</button>
          <div className="flex flex-col gap-[3px]">
            <span className="font-sans text-[14px] font-semibold">{t('ask.title')}</span>
            <span className="font-sans text-[10.5px] text-foreground/40">{t('ask.sub')}</span>
          </div>
        </div>

        {/* Thread */}
        <div ref={scrollRef} className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-5 pb-[150px] pt-5">
          {thread.map((m, i) => (
            <div key={i}
              className={`max-w-[82%] rounded-2xl border px-[15px] py-[13px] font-sans text-[13px] leading-[1.6] ${
                m.role === 'user'
                  ? 'self-end border-primary/40 bg-primary/10 text-foreground'
                  : 'self-start border-white/[0.08] bg-[#101012] text-foreground/85'
              }`}>
              {m.role === 'user' ? m.content : (
                <div className="[&_a]:text-primary [&_a]:underline [&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1 [&_h1]:mb-1 [&_h1]:font-display [&_h1]:text-[15px] [&_h2]:mb-1 [&_h2]:mt-2 [&_h2]:font-display [&_h2]:text-[14px] [&_h3]:mt-2 [&_h3]:font-semibold [&_li]:ml-4 [&_li]:list-disc [&_ol_li]:list-decimal [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:mb-2">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              )}
            </div>
          ))}
          {asking && (
            <div className="flex h-5 items-end gap-1 self-start px-1">
              {[0, 0.15, 0.3].map((d) => (
                <span key={d} className="h-3.5 w-[3px] rounded-sm bg-primary" style={{ animation: `mlbar .9s ease-in-out ${d}s infinite` }} />
              ))}
            </div>
          )}
        </div>

        {/* Prompt chips */}
        {thread.length <= 1 && (
          <div className="fixed bottom-[128px] left-1/2 z-30 flex w-full max-w-[520px] -translate-x-1/2 flex-wrap gap-2 px-5">
            {PROMPT_KEYS.map((p) => (
              <button key={p} onClick={() => send(t(p))} className="rounded-full border border-white/[0.13] px-[13px] py-[9px] font-sans text-[11.5px] font-medium text-foreground/70 transition-colors hover:border-primary/60 hover:text-primary">{t(p)}</button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="fixed bottom-[76px] left-1/2 z-30 w-full max-w-[520px] -translate-x-1/2 px-4" style={{ background: 'linear-gradient(to top,#070708 60%,rgba(7,7,8,0))', paddingTop: 12, paddingBottom: 12 }}>
          <div className="flex items-center gap-2.5 rounded-full border border-white/10 bg-[#131316] px-3.5 py-[11px]">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send(input)}
              placeholder={t('ask.placeholder')}
              className="flex-1 bg-transparent font-sans text-[13px] text-foreground placeholder:text-foreground/35 focus:outline-none"
            />
            <button onClick={() => send(input)} className="flex h-8 w-8 items-center justify-center rounded-full font-display text-[14px] text-[#070708]" style={{ background: 'linear-gradient(135deg,#e9c877,#c08a2a)' }}>↑</button>
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export default Ask;
