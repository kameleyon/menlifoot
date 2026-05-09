import { useState, useEffect } from "react";
import { Menu, X, Languages, ChevronDown, ShoppingCart } from "lucide-react";
import menlifootBall from "@/assets/menlifoot-ball.png";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useCart } from "@/contexts/CartContext";
import { useLanguage, Language } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import ProfileMenu from "./ProfileMenu";
import EditorialDialog from "./EditorialDialog";

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [isEditorialOpen, setIsEditorialOpen] = useState(false);
  const { totalItems, openCart } = useCart();
  const { language, setLanguage, t } = useLanguage();
  const { isAdmin, isEditor } = useAuth();
  
  // Show admin button only for users with editor or admin roles
  const canAccessAdmin = isAdmin || isEditor;

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close language menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setIsLangMenuOpen(false);
    if (isLangMenuOpen) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [isLangMenuOpen]);

  const navLinks = [
    { name: t('nav.home'), href: "/" },
    { name: t('nav.podcast'), href: "/podcasts" },
    { name: t('nav.articles'), href: "/articles" },
    { name: t('nav.quiz'), href: "/quizzes" },
    { name: t('nav.askMenlifoot'), href: "#chat" },
    { name: t('nav.editorial'), href: "editorial", isDialog: true },
    { name: t('nav.store'), href: "#store" },
  ];

  const languages: { code: Language; name: string }[] = [
    { code: 'en', name: 'English' },
    { code: 'fr', name: 'Français' },
    { code: 'es', name: 'Español' },
    { code: 'ht', name: 'Kreyòl' },
  ];

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, delay: 2.5 }}
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
        isScrolled
          ? "bg-background/90 backdrop-blur-xl border-b border-border/50"
          : "bg-transparent"
      }`}
    >
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <motion.img 
              src={menlifootBall} 
              alt="Menlifoot" 
              className="h-10 w-10 md:h-12 md:w-12 object-contain"
              whileHover={{ scale: 1.1 }}
              transition={{ duration: 0.3 }}
            />
            <span className="font-display text-2xl md:text-3xl font-light tracking-wide text-gradient-gold uppercase">
              MENLIFOOT
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              link.isDialog ? (
                <button
                  key={link.name}
                  onClick={() => setIsEditorialOpen(true)}
                  className="text-sm font-medium text-foreground/70 hover:text-primary transition-colors duration-200"
                >
                  {link.name}
                </button>
              ) : link.href.startsWith('/') ? (
                <Link
                  key={link.name}
                  to={link.href}
                  className="text-sm font-medium text-foreground/70 hover:text-primary transition-colors duration-200"
                >
                  {link.name}
                </Link>
              ) : (
                <a
                  key={link.name}
                  href={link.href}
                  className="text-sm font-medium text-foreground/70 hover:text-primary transition-colors duration-200"
                >
                  {link.name}
                </a>
              )
            ))}
          </div>

          {/* Profile & Language & Actions */}
          <div className="flex items-center gap-2">
            {/* Profile Menu */}
            <ProfileMenu />

            {/* Language Selector - visible on all screens */}
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                className="text-foreground/70 hover:text-primary hover:bg-primary/10 gap-1.5"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsLangMenuOpen(!isLangMenuOpen);
                }}
              >
                <Languages className="h-4 w-4" />
                <span className="text-xs uppercase hidden sm:inline">{language}</span>
                <ChevronDown className={`h-3 w-3 transition-transform hidden sm:inline ${isLangMenuOpen ? 'rotate-180' : ''}`} />
              </Button>
              
              <AnimatePresence>
                {isLangMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="absolute top-full right-0 mt-2 w-36 glass-card py-2 shadow-xl z-50"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {languages.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => {
                          setLanguage(lang.code);
                          setIsLangMenuOpen(false);
                        }}
                        className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                          language === lang.code
                            ? 'text-primary bg-primary/10'
                            : 'text-foreground/70 hover:text-primary hover:bg-primary/5'
                        }`}
                      >
                        {lang.name}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={openCart}
              aria-label="Open cart"
              className="relative text-foreground/70 hover:text-primary hover:bg-primary/10"
            >
              <ShoppingCart className="h-5 w-5" />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                  {totalItems}
                </span>
              )}
            </Button>
            {canAccessAdmin && (
              <Link to="/admin">
                <Button
                  variant="nav"
                  size="sm"
                  className="hidden md:flex"
                >
                  Admin
                </Button>
              </Link>
            )}

            {/* Mobile Menu Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-foreground"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="md:hidden bg-background/95 backdrop-blur-xl border-b border-border"
          >
            <div className="container mx-auto px-4 py-4 space-y-2">
              {navLinks.map((link) => (
                link.isDialog ? (
                  <button
                    key={link.name}
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      setIsEditorialOpen(true);
                    }}
                    className="block py-3 text-foreground/80 hover:text-primary transition-colors w-full text-left"
                  >
                    {link.name}
                  </button>
                ) : link.href.startsWith('/') ? (
                  <Link
                    key={link.name}
                    to={link.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block py-3 text-foreground/80 hover:text-primary transition-colors"
                  >
                    {link.name}
                  </Link>
                ) : (
                  <a
                    key={link.name}
                    href={link.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block py-3 text-foreground/80 hover:text-primary transition-colors"
                  >
                    {link.name}
                  </a>
                )
              ))}
              
              {/* Admin Link in Mobile Menu - only show for admins/editors */}
              {canAccessAdmin && (
                <Link 
                  to="/admin" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block py-3 text-foreground/80 hover:text-primary transition-colors border-t border-border/50 mt-2 pt-4"
                >
                  Admin
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Editorial Dialog */}
      <EditorialDialog open={isEditorialOpen} onOpenChange={setIsEditorialOpen} />
    </motion.nav>
  );
};

export default Navbar;
