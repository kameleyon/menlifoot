import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage, Language } from '@/contexts/LanguageContext';
import AppShell from '@/components/mobile/AppShell';

const LANGS: { code: Language; label: string }[] = [
  { code: 'en', label: 'EN' }, { code: 'fr', label: 'FR' }, { code: 'es', label: 'ES' }, { code: 'ht', label: 'HT' },
];

const Me = () => {
  const navigate = useNavigate();
  const { t, language, setLanguage } = useLanguage();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  const name = email ? email.split('@')[0] : 'Guest';
  const stats = [
    { n: '12', l: t('me.saved') },
    { n: '48', l: t('me.read') },
    { n: '6', l: t('me.streak') },
  ];
  const rows = [
    { label: t('me.savedArticles'), value: '12' },
    { label: t('me.history'), value: '' },
    { label: t('me.notifications'), value: 'On' },
  ];

  const cycleLang = () => {
    const i = LANGS.findIndex((l) => l.code === language);
    setLanguage(LANGS[(i + 1) % LANGS.length].code);
  };

  return (
    <AppShell>
      <div className="pt-14">
        {/* Profile */}
        <div className="flex items-center gap-4 px-5 pb-[22px]">
          <div className="h-16 w-16 rounded-full border border-white/10" style={{ background: 'repeating-linear-gradient(135deg,#1c1c20 0 6px,#141417 6px 12px)' }} />
          <div className="flex flex-col gap-1.5">
            <span className="font-display text-[22px] uppercase">{name}</span>
            <span className="font-sans text-[11.5px] text-foreground/45">{email ? `${t('me.member')} · ${email}` : `${t('me.notSignedIn')} · Montréal`}</span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2.5 px-5 pb-[22px]">
          {stats.map((s) => (
            <div key={s.l} className="flex flex-col gap-1.5 rounded-xl border border-white/[0.07] bg-[#101012] px-3 py-3.5">
              <span className="font-display text-[20px] text-primary">{s.n}</span>
              <span className="font-sans text-[9px] font-medium uppercase tracking-[0.1em] text-foreground/45">{s.l}</span>
            </div>
          ))}
        </div>

        {/* Rows */}
        {rows.map((r) => (
          <button key={r.label} className="flex w-full items-center justify-between border-t border-white/[0.06] px-5 py-4 text-left transition-colors hover:bg-white/[0.03]">
            <span className="font-sans text-[13.5px] font-medium">{r.label}</span>
            <span className="font-sans text-[12px] text-foreground/40">{r.value}</span>
          </button>
        ))}
        {/* Language switcher */}
        <button onClick={cycleLang} className="flex w-full items-center justify-between border-t border-white/[0.06] px-5 py-4 text-left transition-colors hover:bg-white/[0.03]">
          <span className="font-sans text-[13.5px] font-medium">{t('me.language')}</span>
          <span className="flex gap-1.5">
            {LANGS.map((l) => (
              <span key={l.code} className={`rounded px-1.5 py-0.5 font-sans text-[11px] font-semibold ${l.code === language ? 'bg-primary text-[#070708]' : 'text-foreground/35'}`}>{l.label}</span>
            ))}
          </span>
        </button>
        <button onClick={() => navigate(email ? '/me' : '/auth')} className="flex w-full items-center justify-between border-t border-white/[0.06] px-5 py-4 text-left transition-colors hover:bg-white/[0.03]">
          <span className="font-sans text-[13.5px] font-medium">{email ? t('me.signOut') : t('me.signIn')}</span>
          <span className="font-sans text-[12px] text-foreground/40">→</span>
        </button>

        {/* Menlifoot+ */}
        <div className="mx-5 mt-[26px] flex flex-col gap-2.5 rounded-2xl border border-primary/[0.28] p-[18px]" style={{ background: 'linear-gradient(135deg,rgba(200,154,60,.12),rgba(200,154,60,.02))' }}>
          <span className="font-sans text-[14px] font-semibold">{t('me.plus')}</span>
          <span className="font-sans text-[12px] leading-[1.5] text-foreground/60">{t('me.plusDesc')}</span>
          <span className="mt-1 self-start rounded-full px-4 py-2.5 font-sans text-[12px] font-bold text-[#070708]" style={{ background: 'linear-gradient(135deg,#e9c877,#c08a2a)' }}>{t('me.plusPrice')}</span>
        </div>
      </div>
    </AppShell>
  );
};

export default Me;
