import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { User, ShoppingBag, Languages, ChevronDown } from 'lucide-react';
import { useLanguage, Language } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthModal } from '@/components/AuthModal';
import { useStoreCart } from '@/contexts/StoreCartContext';
import wordmark from '@/assets/wordmark.png';

const LINKS = [
  { key: 'nav.home', to: '/' },
  { key: 'nav.grenadiers', to: '/grenadiers' },
  { key: 'nav.listen', to: '/listen' },
  { key: 'nav.shop', to: '/shop' },
  { key: 'nav.quiz', to: '/quizzes' },
  { key: 'nav.editorial', to: '/articles' },
];
const LANGS: { code: Language; label: string; full: string }[] = [
  { code: 'en', label: 'EN', full: 'English' },
  { code: 'fr', label: 'FR', full: 'Français' },
  { code: 'es', label: 'ES', full: 'Español' },
  { code: 'ht', label: 'HT', full: 'Kreyòl' },
];

const DesktopNav = () => {
  const { pathname } = useLocation();
  const { t, language, setLanguage } = useLanguage();
  const { user, isAdmin, isEditor } = useAuth();
  const { open: openAuth } = useAuthModal();
  const { count } = useStoreCart();
  const navigate = useNavigate();
  const [langOpen, setLangOpen] = useState(false);
  const active = (to: string) => (to === '/' ? pathname === '/' : pathname.startsWith(to));

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#070708]/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-6 px-10 py-4">
        <Link to="/" className="flex flex-none items-center gap-1">
          <img src={wordmark} alt="Menlifoot" className="h-7 w-auto" />
          <img src="/logo.png" alt="" className="h-[30px] w-auto" />
        </Link>
        <nav className="flex gap-6">
          {LINKS.map((l) => (
            <Link key={l.to} to={l.to}
              className={`whitespace-nowrap border-b-2 pb-[3px] font-sans text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors ${
                active(l.to) ? 'border-primary text-primary' : 'border-transparent text-foreground/60 hover:text-foreground'
              }`}>{t(l.key)}</Link>
          ))}
        </nav>
        <div className="flex flex-none items-center gap-3">
          <button onClick={() => navigate('/ask')} className="whitespace-nowrap rounded-full px-[15px] py-[9px] font-sans text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#070708]" style={{ background: 'linear-gradient(135deg,#e9c877,#c08a2a)' }}>{t('home.askTitle')}</button>

          {/* Language dropdown */}
          <div className="relative">
            <button onClick={() => setLangOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-full border border-white/[0.12] px-3 py-[7px] text-foreground/70 transition-colors hover:border-primary/50 hover:text-primary">
              <Languages className="h-[15px] w-[15px]" />
              <span className="font-sans text-[10.5px] font-semibold uppercase tracking-[0.08em]">{language}</span>
              <ChevronDown className={`h-3 w-3 transition-transform ${langOpen ? 'rotate-180' : ''}`} />
            </button>
            {langOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setLangOpen(false)} />
                <div className="absolute right-0 top-full z-50 mt-2 w-36 overflow-hidden rounded-xl border border-white/[0.1] bg-[#0d0d0f] py-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.6)]">
                  {LANGS.map((l) => (
                    <button key={l.code} onClick={() => { setLanguage(l.code); setLangOpen(false); }}
                      className={`block w-full px-4 py-2 text-left font-sans text-[12.5px] transition-colors ${
                        l.code === language ? 'bg-primary/10 text-primary' : 'text-foreground/70 hover:bg-white/[0.04] hover:text-primary'
                      }`}>{l.full}</button>
                  ))}
                </div>
              </>
            )}
          </div>

          <Link to="/shop?cart=1" aria-label={t('nav.shop')} className="relative text-foreground/60 hover:text-primary">
            <ShoppingBag className="h-[18px] w-[18px]" />
            {count > 0 && <span className="absolute -right-2 -top-2 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-primary px-1 font-sans text-[9px] font-bold text-[#070708]">{count}</span>}
          </Link>
          <button onClick={() => (user ? navigate(isAdmin || isEditor ? '/admin' : '/me') : openAuth('signin'))} aria-label={t('auth.signin')} className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-foreground/70 hover:border-primary/60 hover:text-primary"><User className="h-[17px] w-[17px]" /></button>
        </div>
      </div>
    </header>
  );
};

export default DesktopNav;
