import { useEffect, useState } from 'react';

// Full-screen intro video that autoplays (muted) when the app opens, once per session.
const IntroSplash = () => {
  const [show, setShow] = useState(() => {
    try { return !sessionStorage.getItem('mnf_intro_seen'); } catch { return true; }
  });
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (!show) return;
    try { sessionStorage.setItem('mnf_intro_seen', '1'); } catch { /* ignore */ }
    // Safety: never trap the user if the video stalls or 'ended' never fires.
    const t = setTimeout(dismiss, 9000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  const dismiss = () => {
    setFading(true);
    setTimeout(() => setShow(false), 400);
  };

  if (!show) return null;

  return (
    <div
      onClick={dismiss}
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-[#070708] transition-opacity duration-500 ${fading ? 'opacity-0' : 'opacity-100'}`}
    >
      <video
        src="/intro.mp4"
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={dismiss}
        onError={dismiss}
        className="h-full w-full object-contain"
      />
      <button
        onClick={(e) => { e.stopPropagation(); dismiss(); }}
        className="absolute bottom-7 right-6 rounded-full border border-white/20 bg-black/30 px-4 py-2 font-sans text-[11px] font-semibold uppercase tracking-[0.08em] text-white/75 backdrop-blur-sm transition-colors hover:text-white"
      >
        Skip
      </button>
    </div>
  );
};

export default IntroSplash;
