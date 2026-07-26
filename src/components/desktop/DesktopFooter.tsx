import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { SocialLinks } from '@/components/SocialLinks';

const DesktopFooter = () => {
  const { t } = useLanguage();
  return (
    <footer className="border-t border-white/[0.07] bg-[#0a0a0b]">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-8 px-10 py-12">
        <div className="flex flex-wrap items-start justify-between gap-8">
          <div className="flex flex-col gap-3">
            <span className="text-gradient-gold font-display text-[26px] uppercase leading-none tracking-wide">Menlifoot</span>
            <span className="max-w-[280px] font-sans text-[12px] leading-[1.6] text-foreground/45">Soccer media — analysis, interviews, the MVP Podcast, and Les Grenadiers coverage.</span>
            <SocialLinks className="mt-2" size={19} />
          </div>
          <div className="flex gap-16">
            <div className="flex flex-col gap-3">
              <span className="font-sans text-[9px] font-semibold uppercase tracking-[0.18em] text-foreground/40">Menlifoot</span>
              <Link to="/" className="font-sans text-[12.5px] text-foreground/70 hover:text-primary">{t('nav.home')}</Link>
              <Link to="/grenadiers" className="font-sans text-[12.5px] text-foreground/70 hover:text-primary">{t('nav.grenadiers')}</Link>
              <Link to="/listen" className="font-sans text-[12.5px] text-foreground/70 hover:text-primary">{t('nav.listen')}</Link>
              <Link to="/shop" className="font-sans text-[12.5px] text-foreground/70 hover:text-primary">{t('nav.shop')}</Link>
            </div>
            <div className="flex flex-col gap-3">
              <span className="font-sans text-[9px] font-semibold uppercase tracking-[0.18em] text-foreground/40">More</span>
              <Link to="/ask" className="font-sans text-[12.5px] text-foreground/70 hover:text-primary">{t('home.askTitle')}</Link>
              <Link to="/quizzes" className="font-sans text-[12.5px] text-foreground/70 hover:text-primary">Quiz</Link>
              <Link to="/me" className="font-sans text-[12.5px] text-foreground/70 hover:text-primary">{t('nav.me')}</Link>
            </div>
          </div>
        </div>
        <div className="border-t border-white/[0.06] pt-6 font-sans text-[11px] text-foreground/35">© 2026 Menlifoot · menlifoot.ca</div>
      </div>
    </footer>
  );
};

export default DesktopFooter;
