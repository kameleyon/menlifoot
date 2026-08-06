import { useState } from 'react';
import { Languages } from 'lucide-react';
import { useLanguage, Language } from '@/contexts/LanguageContext';

const LANGS: { code: Language; full: string }[] = [
  { code: 'en', full: 'English' },
  { code: 'fr', full: 'Français' },
  { code: 'es', full: 'Español' },
  { code: 'ht', full: 'Kreyòl' },
];

/** Round translation button + popover for the mobile headers (matches the 38px icon buttons). */
const MobileLangMenu = () => {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Language"
        className="flex h-[38px] w-[38px] items-center justify-center rounded-full border border-white/[0.12] text-foreground/70 transition-colors hover:border-primary/60 hover:text-primary"
      >
        <Languages className="h-[19px] w-[19px]" strokeWidth={2} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-36 overflow-hidden rounded-xl border border-white/[0.1] bg-[#0d0d0f] py-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.6)]">
            {LANGS.map((l) => (
              <button
                key={l.code}
                onClick={() => { setLanguage(l.code); setOpen(false); }}
                className={`block w-full px-4 py-2 text-left font-sans text-[12.5px] transition-colors ${
                  l.code === language ? 'bg-primary/10 text-primary' : 'text-foreground/70 hover:bg-white/[0.04] hover:text-primary'
                }`}
              >
                {l.full}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default MobileLangMenu;
