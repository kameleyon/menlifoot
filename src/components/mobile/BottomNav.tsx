import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Headphones, Palmtree, ShoppingBag, User } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthModal } from '@/components/AuthModal';
import { useStoreCart } from '@/contexts/StoreCartContext';

const TABS = [
  { key: 'nav.home', to: '/', Icon: Home },
  { key: 'nav.listen', to: '/listen', Icon: Headphones },
  { key: 'nav.grenadiers', to: '/grenadiers', Icon: Palmtree },
  { key: 'nav.shop', to: '/shop', Icon: ShoppingBag },
  { key: 'nav.me', to: '/me', Icon: User },
];

const BottomNav = () => {
  const { pathname } = useLocation();
  const { t } = useLanguage();
  const { user, isAdmin, isEditor } = useAuth();
  const { open: openAuth } = useAuthModal();
  const { count } = useStoreCart();
  const navigate = useNavigate();
  const isActive = (to: string) => (to === '/' ? pathname === '/' : pathname.startsWith(to));

  // "Me" opens the auth modal when logged out; otherwise goes to the profile (or admin panel).
  const onMe = () => {
    if (!user) return openAuth('signin');
    navigate(isAdmin || isEditor ? '/admin' : '/me');
  };

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-[520px] border-t border-white/[0.08] bg-[#0a0a0b]/90 px-1.5 pb-7 pt-3 backdrop-blur-xl">
      {TABS.map((tab) => {
        const active = isActive(tab.to) || (tab.key === 'nav.me' && (pathname.startsWith('/admin') || pathname.startsWith('/me')));
        const Icon = tab.Icon;
        const inner = (
          <>
            <span className="relative">
              <Icon className={`h-[22px] w-[22px] transition-colors ${active ? 'text-primary' : 'text-primary/70'}`} strokeWidth={active ? 2.4 : 2} />
              {tab.key === 'nav.shop' && count > 0 && <span className="absolute -right-2 -top-1.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-primary px-1 font-sans text-[8.5px] font-bold text-[#070708]">{count}</span>}
            </span>
            <span className={`font-sans text-[9.5px] font-semibold uppercase tracking-[0.12em] transition-colors ${active ? 'text-primary' : 'text-primary/60'}`}>
              {t(tab.key)}
            </span>
          </>
        );
        const cls = 'flex flex-1 flex-col items-center gap-1';
        return tab.key === 'nav.me' ? (
          <button key={tab.to} onClick={onMe} className={cls}>{inner}</button>
        ) : (
          <Link key={tab.to} to={tab.to} className={cls}>{inner}</Link>
        );
      })}
    </nav>
  );
};

export default BottomNav;
