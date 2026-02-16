import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Youtube, Music2, Clock, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

interface Podcast {
  id: string;
  title: string;
  description: string | null;
  platform: string;
  embed_url: string;
  original_url: string;
  episode_number: number | null;
  duration: string | null;
  published_at: string | null;
}

const Podcasts = () => {
  const [podcasts, setPodcasts] = useState<Podcast[]>([]);
  const [selectedPodcast, setSelectedPodcast] = useState<Podcast | null>(null);
  const [loading, setLoading] = useState(true);
  const [platformFilter, setPlatformFilter] = useState<'all' | 'youtube' | 'spotify'>('all');
  const navigate = useNavigate();
  const { t } = useLanguage();

  const filteredPodcasts = podcasts.filter(
    (podcast) => platformFilter === 'all' || podcast.platform === platformFilter
  );

  useEffect(() => {
    fetchPodcasts();
  }, []);

  const fetchPodcasts = async () => {
    const { data, error } = await supabase
      .from('podcasts')
      .select('*')
      .order('published_at', { ascending: false });

    if (!error && data) {
      setPodcasts(data);
      if (data.length > 0) {
        setSelectedPodcast(data[0]);
      }
    }
    setLoading(false);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="absolute inset-0 bg-gradient-dark pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent pointer-events-none" />

      <div className="relative z-10 container mx-auto px-4 pt-24 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-6xl mx-auto"
        >
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Button
              variant="ghost"
              onClick={() => navigate('/')}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('common.back')}
            </Button>
          </div>

          <div className="text-center mb-12">
            <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">
              <span className="text-gradient-gold">MENLIFOOT</span>{' '}
              <span className="text-foreground/90">{t('hero.podcast')}</span>
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              {t('hero.podcastDescription')}
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-muted-foreground">Loading episodes...</div>
            </div>
          ) : podcasts.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-muted-foreground text-lg">
                No episodes yet. Check back soon!
              </p>
            </div>
          ) : (
            <div className="grid lg:grid-cols-3 gap-8">
              {/* Player Section */}
              <div className="lg:col-span-2">
                {selectedPodcast && (
                  <motion.div
                    key={selectedPodcast.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="glass-card p-6"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      {selectedPodcast.episode_number && (
                        <span className="px-3 py-1 bg-primary/20 text-primary rounded-full text-sm font-medium">
                          Episode {selectedPodcast.episode_number}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-sm text-muted-foreground">
                        {selectedPodcast.platform === 'youtube' ? (
                          <Youtube className="h-4 w-4" />
                        ) : (
                          <Music2 className="h-4 w-4" />
                        )}
                        {selectedPodcast.platform}
                      </span>
                    </div>

                    <h2 className="font-display text-2xl font-semibold mb-3">
                      {selectedPodcast.title}
                    </h2>

                    {selectedPodcast.description && (
                      <p className="text-muted-foreground mb-6">
                        {selectedPodcast.description}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-6">
                      {selectedPodcast.duration && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {selectedPodcast.duration}
                        </span>
                      )}
                      {selectedPodcast.published_at && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {formatDate(selectedPodcast.published_at)}
                        </span>
                      )}
                    </div>

                    {/* Embed Player */}
                    {(() => {
                      const isShort = selectedPodcast.original_url?.includes('/shorts/') || false;
                      return (
                        <div className={`${isShort ? 'aspect-[9/16] max-w-[320px] mx-auto' : 'aspect-video'} rounded-lg overflow-hidden bg-surface`}>
                          {selectedPodcast.platform === 'youtube' ? (
                            <iframe
                              src={selectedPodcast.embed_url}
                              title={selectedPodcast.title}
                              className="w-full h-full"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                          ) : (
                            <iframe
                              src={selectedPodcast.embed_url}
                              title={selectedPodcast.title}
                              className="w-full h-full"
                              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                              loading="lazy"
                            />
                          )}
                        </div>
                      );
                    })()}
                  </motion.div>
                )}
              </div>

              {/* Episodes List */}
              <div className="lg:col-span-1">
                <div className="glass-card p-4">
                  <h3 className="font-display text-lg font-semibold mb-3 px-2">
                    All Episodes ({filteredPodcasts.length})
                  </h3>
                  
                  {/* Platform Filter */}
                  <div className="flex gap-2 mb-4 px-2">
                    <button
                      onClick={() => setPlatformFilter('all')}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        platformFilter === 'all'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-surface text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setPlatformFilter('youtube')}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${
                        platformFilter === 'youtube'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-surface text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Youtube className="h-3 w-3" />
                      YouTube
                    </button>
                    <button
                      onClick={() => setPlatformFilter('spotify')}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${
                        platformFilter === 'spotify'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-surface text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Music2 className="h-3 w-3" />
                      Spotify
                    </button>
                  </div>
                  <div className="space-y-2 max-h-[600px] overflow-y-auto">
                    {filteredPodcasts.map((podcast) => (
                      <button
                        key={podcast.id}
                        onClick={() => setSelectedPodcast(podcast)}
                        className={`w-full text-left p-3 rounded-lg transition-all ${
                          selectedPodcast?.id === podcast.id
                            ? 'bg-primary/20 border border-primary/30'
                            : 'hover:bg-surface border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded bg-gradient-gold flex items-center justify-center flex-shrink-0">
                            {podcast.platform === 'youtube' ? (
                              <Youtube className="h-5 w-5 text-primary-foreground" />
                            ) : (
                              <Music2 className="h-5 w-5 text-primary-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {podcast.episode_number && (
                                <span className="text-xs text-primary">
                                  EP {podcast.episode_number}
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-medium text-foreground truncate">
                              {podcast.title}
                            </p>
                            {podcast.duration && (
                              <p className="text-xs text-muted-foreground">
                                {podcast.duration}
                              </p>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      <Footer />
    </div>
  );
};

export default Podcasts;
