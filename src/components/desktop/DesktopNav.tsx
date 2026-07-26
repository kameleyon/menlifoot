import { Link, useLocation, useNavigate } from 'react-router-dom';
import { User, ShoppingBag } from 'lucide-react';
import { useLanguage, Language } from '@/contexts/LanguageContext';
import wordmark from '@/assets/wordmark.png';

const LINKS = [
  { key: 'nav.home', to: '/' },
  { key: 'nav.grenadiers', to: '/grenadiers' },
  { key: 'nav.listen', to: '/listen' },
  { key: 'nav.shop', to: '/shop' },
  { key: 'nav.quiz', to: '/quizzes' },
  { key: 'nav.editorial', to: '/articles' },
];
const LANGS: { code: Language; label: string }[] = [
  { code: 'en', label: 'EN' }, { code: 'fr', label: 'FR' }, { code: 'es', label: 'ES' }, { code: 'ht', label: 'HT' },
];

const DesktopNav = () => {
  const { pathname } = useLocation();
  const { t, language, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const active = (to: string) => (to === '/' ? pathname === '/' : pathname.startsWith(to));

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#070708]/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-6 px-10 py-4">
        <Link to="/" className="flex-none"><img src={wordmark} alt="Menlifoot" className="h-7 w-auto" /></Link>
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
          <div className="flex items-center gap-0.5">
            {LANGS.map((l) => (
              <button key={l.code} onClick={() => setLanguage(l.code)}
                className={`rounded px-1.5 py-0.5 font-sans text-[10px] font-semibold transition-colors ${l.code === language ? 'bg-primary text-[#070708]' : 'text-foreground/40 hover:text-foreground'}`}>{l.label}</button>
            ))}
          </div>
          <Link to="/shop" className="text-foreground/60 hover:text-primary"><ShoppingBag className="h-[18px] w-[18px]" /></Link>
          <Link to="/me" className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-foreground/70 hover:border-primary/60 hover:text-primary"><User className="h-[17px] w-[17px]" /></Link>
        </div>
      </div>
    </header>
  );
};

export default DesktopNav;
