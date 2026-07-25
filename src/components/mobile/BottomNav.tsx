import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';

const TABS = [
  { key: 'nav.home', to: '/' },
  { key: 'nav.listen', to: '/listen' },
  { key: 'nav.grenadiers', to: '/grenadiers' },
  { key: 'nav.shop', to: '/shop' },
  { key: 'nav.me', to: '/me' },
];

const BottomNav = () => {
  const { pathname } = useLocation();
  const { t } = useLanguage();
  const isActive = (to: string) => (to === '/' ? pathname === '/' : pathname.startsWith(to));

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-[520px] border-t border-white/[0.08] bg-[#0a0a0b]/90 px-1.5 pb-7 pt-3 backdrop-blur-xl">
      {TABS.map((tab) => {
        const active = isActive(tab.to);
        return (
          <Link
            key={tab.to}
            to={tab.to}
            className="flex flex-1 flex-col items-center gap-1.5"
          >
            <span className={`h-[5px] w-[5px] rounded-full transition-colors ${active ? 'bg-primary' : 'bg-transparent'}`} />
            <span
              className={`font-sans text-[9.5px] font-semibold uppercase tracking-[0.12em] transition-colors ${
                active ? 'text-primary' : 'text-foreground/45'
              }`}
            >
              {t(tab.key)}
            </span>
          </Link>
        );
      })}
    </nav>
  );
};

export default BottomNav;
