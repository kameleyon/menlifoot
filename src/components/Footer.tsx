import { useState } from "react";
import { motion } from "framer-motion";
import { Twitter, Instagram, Youtube, Send, Facebook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import AboutUsDialog from "@/components/legal/AboutUsDialog";
import PrivacyPolicyDialog from "@/components/legal/PrivacyPolicyDialog";
import TermsOfServiceDialog from "@/components/legal/TermsOfServiceDialog";
import CookiePolicyDialog from "@/components/legal/CookiePolicyDialog";
import EditorialDialog from "@/components/EditorialDialog";

const Footer = () => {
  const { t } = useLanguage();
  const [aboutOpen, setAboutOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [cookieOpen, setCookieOpen] = useState(false);
  const [editorialOpen, setEditorialOpen] = useState(false);

  const footerLinks = {
    [t('footer.company')]: [
      { key: 'aboutUs', label: t('footer.aboutUs'), action: () => setAboutOpen(true) },
      // { key: 'helpCenter', label: t('footer.helpCenter'), href: '#' },
      { key: 'privacyPolicy', label: t('footer.privacyPolicy'), action: () => setPrivacyOpen(true) },
      { key: 'termsOfService', label: t('footer.termsOfService'), action: () => setTermsOpen(true) },
      { key: 'cookiePolicy', label: t('footer.cookiePolicy'), action: () => setCookieOpen(true) },
    ],
    [t('footer.content')]: [
      { key: 'podcast', label: t('footer.podcast'), href: '/podcasts' },
      { key: 'articles', label: t('nav.articles'), href: '/articles' },
      { key: 'editorial', label: t('footer.editorial') || 'Editorial', action: () => setEditorialOpen(true) },
    ],
  };

  const socialLinks = [
    { icon: Facebook, href: "https://facebook.com/MenlifootAyiti", label: "Facebook" },
    { icon: Instagram, href: "https://instagram.com/menlifoot", label: "Instagram" },
    { icon: Twitter, href: "https://twitter.com/menlifoot", label: "Twitter" },
    { icon: () => (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
      </svg>
    ), href: "https://tiktok.com/@menlifoot", label: "TikTok" },
    { icon: Youtube, href: "https://youtube.com/@menlifoot3136", label: "YouTube" },
  ];

  return (
    <>
      <footer className="relative pt-20 pb-8 border-t border-border/30">
        <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent pointer-events-none" />
        
        <div className="container mx-auto px-4 md:px-6 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 mb-16">
            {/* Brand */}
            <div className="lg:col-span-2">
              <motion.a
                href="#home"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                className="inline-flex items-center gap-2"
              >
                <motion.img 
                  src="/logo.png" 
                  alt="Menlifoot" 
                  className="h-10 w-10"
                  whileHover={{ scale: 1.2 }}
                />
                <span className="font-display text-3xl font-light tracking-wide text-gradient-gold uppercase">
                  MENLIFOOT
                </span>
              </motion.a>
              <p className="text-muted-foreground mt-4 mb-6 max-w-sm">
                {t('footer.tagline')}
              </p>
              
              {/* Newsletter - Temporarily disabled
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder={t('footer.emailPlaceholder')}
                  className="flex-1 bg-surface-elevated rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <Button variant="gold" size="icon">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              */}
            </div>

            {/* Links */}
            {Object.entries(footerLinks).map(([title, links]) => (
              <div key={title}>
                <h4 className="font-medium text-foreground mb-4">{title}</h4>
                <ul className="space-y-3">
                  {links.map((link) => (
                    <li key={link.key}>
                      {'action' in link && link.action ? (
                        <button
                          onClick={link.action}
                          className="text-muted-foreground hover:text-primary transition-colors text-sm text-left"
                        >
                          {link.label}
                        </button>
                      ) : (
                        <a
                          href={'href' in link ? link.href : '#'}
                          className="text-muted-foreground hover:text-primary transition-colors text-sm"
                        >
                          {link.label}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Bottom */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8 border-t border-border/30">
            <p className="text-sm text-muted-foreground">
              © 2024 Menlifoot. {t('footer.rights')}
            </p>
            <div className="flex items-center gap-3">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className="w-10 h-10 rounded-full bg-surface-elevated flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                >
                  <social.icon className="h-5 w-5" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>

      {/* Legal Dialogs */}
      <AboutUsDialog open={aboutOpen} onOpenChange={setAboutOpen} />
      <PrivacyPolicyDialog open={privacyOpen} onOpenChange={setPrivacyOpen} />
      <TermsOfServiceDialog open={termsOpen} onOpenChange={setTermsOpen} />
      <CookiePolicyDialog open={cookieOpen} onOpenChange={setCookieOpen} />
      <EditorialDialog open={editorialOpen} onOpenChange={setEditorialOpen} />
    </>
  );
};

export default Footer;
