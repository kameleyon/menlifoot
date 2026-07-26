import { createContext, useContext, useState, ReactNode, FormEvent } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';

type Mode = 'signin' | 'signup';

interface AuthModalCtx {
  open: (mode?: Mode) => void;
  close: () => void;
}
const Ctx = createContext<AuthModalCtx | undefined>(undefined);

export const useAuthModal = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuthModal must be used within AuthModalProvider');
  return ctx;
};

export const AuthModalProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('signin');
  const open = (m: Mode = 'signin') => { setMode(m); setIsOpen(true); };
  const close = () => setIsOpen(false);

  return (
    <Ctx.Provider value={{ open, close }}>
      {children}
      <AuthModal isOpen={isOpen} setOpen={setIsOpen} mode={mode} setMode={setMode} />
    </Ctx.Provider>
  );
};

interface Props {
  isOpen: boolean;
  setOpen: (v: boolean) => void;
  mode: Mode;
  setMode: (m: Mode) => void;
}

const AuthModal = ({ isOpen, setOpen, mode, setMode }: Props) => {
  const { t } = useLanguage();
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: t('auth.needEmail'), variant: 'destructive' });
      return;
    }
    setBusy(true);
    const fn = mode === 'signin' ? signIn : signUp;
    const { error } = await fn(email.trim(), password);
    setBusy(false);
    if (error) {
      toast({ title: error.message, variant: 'destructive' });
      return;
    }
    if (mode === 'signup') {
      toast({ title: t('auth.checkEmail') });
    }
    setOpen(false);
    setEmail(''); setPassword('');
  };

  const tabCls = (active: boolean) =>
    `flex-1 pb-2.5 text-center font-sans text-[13px] font-semibold uppercase tracking-[0.08em] transition-colors ${
      active ? 'border-b-2 border-primary text-primary' : 'border-b-2 border-transparent text-foreground/45'
    }`;

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent className="max-w-[400px] border-white/[0.08] bg-[#0d0d0f] p-0">
        <div className="p-7">
          <div className="mb-1 flex items-center gap-2.5">
            <img src="/logo.png" alt="" className="h-7 w-auto" />
            <span className="font-display text-[22px] uppercase leading-none text-gradient-gold">Menlifoot</span>
          </div>
          <p className="mb-6 font-sans text-[13px] text-foreground/55">
            {mode === 'signin' ? t('auth.welcome') : t('auth.createTitle')}
          </p>

          <div className="mb-6 flex">
            <button type="button" className={tabCls(mode === 'signin')} onClick={() => setMode('signin')}>{t('auth.signin')}</button>
            <button type="button" className={tabCls(mode === 'signup')} onClick={() => setMode('signup')}>{t('auth.signup')}</button>
          </div>

          <form onSubmit={submit} className="flex flex-col gap-3.5">
            <label className="flex flex-col gap-1.5">
              <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.1em] text-foreground/50">{t('auth.email')}</span>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email"
                className="rounded-xl border border-white/[0.1] bg-[#070708] px-4 py-3 font-sans text-[14px] text-foreground outline-none focus:border-primary/60"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.1em] text-foreground/50">{t('auth.password')}</span>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                className="rounded-xl border border-white/[0.1] bg-[#070708] px-4 py-3 font-sans text-[14px] text-foreground outline-none focus:border-primary/60"
              />
            </label>
            <button
              type="submit" disabled={busy}
              className="mt-2 rounded-xl py-3.5 font-sans text-[13px] font-bold uppercase tracking-[0.06em] text-[#070708] transition-opacity disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg,#e9c877,#c08a2a)' }}
            >
              {busy ? '…' : mode === 'signin' ? t('auth.signinBtn') : t('auth.signupBtn')}
            </button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};
