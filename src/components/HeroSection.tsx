import { motion } from "framer-motion";
import { Play, Music2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import heroPodcast from "@/assets/hero-podcast.png";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePodcasts } from "@/hooks/usePodcasts";
import { useState } from "react";

const HeroSection = () => {
  const { t } = useLanguage();
  const { latestPodcast, loading } = usePodcasts();
  const navigate = useNavigate();
  const [autoplay, setAutoplay] = useState(false);

  const handleListenNow = () => {
    if (latestPodcast) {
      // Enable autoplay and scroll to the embedded player
      setAutoplay(true);
      const playerElement = document.getElementById('hero-podcast-player');
      playerElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      navigate('/podcasts');
    }
  };

  const handleBrowseEpisodes = () => {
    navigate('/podcasts');
  };

  return (
    <section
      id="home"
      className="relative min-h-screen flex items-center justify-center overflow-x-hidden pt-20 px-4 sm:px-0"
    >
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-dark" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="flex flex-col lg:flex-row-reverse items-center gap-12 lg:gap-20">
          {/* Text Content */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 2.8 }}
            className="flex-1 text-center lg:text-left"
          >
            <motion.span
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 3 }}
              className="inline-block px-4 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary text-xs uppercase tracking-wider mb-6"
            >
              {t('hero.newEpisode')}
            </motion.span>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 3.1 }}
              className="font-display text-5xl md:text-7xl lg:text-8xl font-bold mb-4"
            >
              <span className="text-gradient-gold">MENLIFOOT</span>
              <br />
              <span className="text-foreground/90">{t('hero.podcast')}</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 3.3 }}
              className="text-muted-foreground text-base sm:text-lg md:text-xl max-w-xs sm:max-w-lg mx-auto lg:mx-0 mb-8 px-2 sm:px-0"
            >
              {t('hero.podcastDescription')}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 3.5 }}
              className="flex flex-wrap items-center justify-center lg:justify-start gap-3 sm:gap-4"
            >
              <Button variant="gold" size="default" className="gap-2 text-sm sm:text-base" onClick={handleListenNow}>
                <Play className="h-4 w-4 sm:h-5 sm:w-5" />
                {t('hero.listenNow')}
              </Button>
              <Button variant="outline" size="default" className="text-sm sm:text-base" onClick={handleBrowseEpisodes}>
                {t('hero.browseEpisodes')}
              </Button>
            </motion.div>

            {/* Embedded Player */}
            {latestPodcast && (
              <motion.div
                id="hero-podcast-player"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 3.7 }}
                className="mt-10 max-w-[320px] sm:max-w-md mx-auto lg:mx-0"
              >
                {latestPodcast.platform === 'spotify' ? (
                  <iframe
                    src={autoplay ? `${latestPodcast.embed_url}${latestPodcast.embed_url.includes('?') ? '&' : '?'}autoplay=1` : latestPodcast.embed_url}
                    width="100%"
                    height="152"
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    loading="lazy"
                    className="rounded-xl"
                    title={latestPodcast.title}
                  />
                ) : latestPodcast.platform === 'youtube' ? (
                  (() => {
                    const isShort = latestPodcast.original_url?.includes('/shorts/');
                    const embedSrc = autoplay ? `${latestPodcast.embed_url}${latestPodcast.embed_url.includes('?') ? '&' : '?'}autoplay=1` : latestPodcast.embed_url;
                    return (
                      <div className={`${isShort ? 'aspect-[9/16] max-w-[200px]' : 'aspect-video'} rounded-xl overflow-hidden`}>
                        <iframe
                          src={embedSrc}
                          width="100%"
                          height="100%"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          loading="lazy"
                          className="rounded-xl"
                          title={latestPodcast.title}
                        />
                      </div>
                    );
                  })()
                ) : null}
              </motion.div>
            )}
            
            {!latestPodcast && !loading && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 3.7 }}
                className="mt-10 glass-card p-3 sm:p-4 max-w-[280px] sm:max-w-md mx-auto lg:mx-0"
              >
                <div className="flex items-center gap-2 sm:gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-gold flex items-center justify-center flex-shrink-0">
                    <Music2 className="h-5 w-5 sm:h-6 sm:w-6 text-primary-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-foreground truncate">
                      {t('hero.episodeTitle')}
                    </p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">
                      {t('hero.episodeInfo')}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>

          {/* Hero Image */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 3 }}
            className="flex-1 relative"
          >
            <div className="relative">
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              >
                <img
                  src={heroPodcast}
                  alt="MVP Podcast - Soccer ball with headphones"
                  className="w-full max-w-lg mx-auto drop-shadow-2xl"
                />
              </motion.div>
              {/* Subtle glow effect */}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-8 bg-primary/30 blur-2xl rounded-full" />
            </div>
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 4 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex justify-center pt-2"
        >
          <div className="w-1 h-2 rounded-full bg-primary" />
        </motion.div>
      </motion.div>
    </section>
  );
};

export default HeroSection;
