import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import wordmark from '@/assets/wordmark.png';

const LINKS = [
  { key: 'nav.home', to: '/' },
  { key: 'nav.grenadiers', to: '/grenadiers' },
  { key: 'nav.listen', to: '/listen' },
  { key: 'nav.shop', to: '/shop' },
];

const DesktopNav = () => {
  const { pathname } = useLocation();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const active = (to: string) => (to === '/' ? pathname === '/' : pathname.startsWith(to));

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#070708]/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1180px] items-center justify-between px-10 py-5">
        <Link to="/"><img src={wordmark} alt="Menlifoot" className="h-[18px] w-auto" /></Link>
        <nav className="flex gap-8">
          {LINKS.map((l) => (
            <Link key={l.to} to={l.to}
              className={`border-b-2 pb-[3px] font-sans text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors ${
                active(l.to) ? 'border-primary text-primary' : 'border-transparent text-foreground/60 hover:text-foreground'
              }`}>{t(l.key)}</Link>
          ))}
        </nav>
        <div className="flex items-center gap-3.5">
          <button onClick={() => navigate('/ask')} className="rounded-full border border-primary/45 px-[15px] py-[9px] font-sans text-[10.5px] font-bold uppercase tracking-[0.12em] text-primary">{t('home.askTitle')}</button>
          <Link to="/shop" className="font-sans text-[11.5px] font-medium text-foreground/55">{t('shop.bag')}</Link>
          <Link to="/me" className="h-8 w-8 rounded-full border border-white/10" style={{ background: 'repeating-linear-gradient(135deg,#1c1c20 0 6px,#141417 6px 12px)' }} />
        </div>
      </div>
    </header>
  );
};

export default DesktopNav;
