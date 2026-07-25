import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import PlayerCard from '@/components/grenadiers/PlayerCard';
import PlayerDetailDialog from '@/components/grenadiers/PlayerDetailDialog';
import StatsTable from '@/components/grenadiers/StatsTable';
import ConvocationsTable from '@/components/grenadiers/ConvocationsTable';
import {
  HaitiPlayer, HaitiStat, HaitiConvocation,
  positionGroup, POSITION_ORDER, PositionGroup,
} from '@/types/grenadiers';

// Tables are not in the generated Supabase types; query with a loose client.
const db = supabase as unknown as {
  from: (t: string) => {
    select: (c: string) => { order: (col: string, o?: { ascending?: boolean; nullsFirst?: boolean }) => Promise<{ data: unknown; error: unknown }> };
  };
};

const POS_KEY: Record<PositionGroup, string> = {
  Gardiens: 'gren.posGk', Défenseurs: 'gren.posDef', Milieux: 'gren.posMid', Attaquants: 'gren.posAtt', Autres: 'gren.posOther',
};

const Grenadiers = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [players, setPlayers] = useState<HaitiPlayer[]>([]);
  const [stats, setStats] = useState<HaitiStat[]>([]);
  const [convocations, setConvocations] = useState<HaitiConvocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<HaitiPlayer | null>(null);

  useEffect(() => {
    (async () => {
      const [p, s, c] = await Promise.all([
        db.from('haiti_players').select('*').order('jersey_number', { ascending: true, nullsFirst: false }),
        db.from('haiti_stats').select('*').order('season', { ascending: false }),
        db.from('haiti_convocations').select('*').order('match_date', { ascending: false }),
      ]);
      if (p.data) setPlayers(p.data as HaitiPlayer[]);
      if (s.data) setStats(s.data as HaitiStat[]);
      if (c.data) setConvocations(c.data as HaitiConvocation[]);
      setLoading(false);
    })();
  }, []);

  const playersById = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p])), [players]);

  const grouped = useMemo(() => {
    const g: Record<PositionGroup, HaitiPlayer[]> = { Gardiens: [], Défenseurs: [], Milieux: [], Attaquants: [], Autres: [] };
    for (const p of players) g[positionGroup(p.position)].push(p);
    return g;
  }, [players]);

  const selectedStats = useMemo(
    () => (selected ? stats.filter((s) => s.player_id === selected.id) : []),
    [selected, stats],
  );
  const selectedConvs = useMemo(
    () => (selected ? convocations.filter((c) => c.player_id === selected.id) : []),
    [selected, convocations],
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 pb-20 pt-24 md:px-6 md:pt-28">
        <Button variant="ghost" onClick={() => navigate('/')} className="mb-6 text-muted-foreground hover:text-primary">
          <ArrowLeft className="mr-2 h-4 w-4" /> {t('gren.back')}
        </Button>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-10 text-center"
        >
          <h1 className="font-display text-4xl font-light uppercase tracking-wider text-gradient-gold md:text-6xl">
            Les Grenadiers
          </h1>
          <p className="mt-2 text-sm uppercase tracking-[0.25em] text-muted-foreground">
            {t('gren.subtitle')}&nbsp;🇭🇹
          </p>
          {!loading && (
            <p className="mt-3 text-sm text-foreground/70">
              {players.length} {t('gren.players')} · {stats.length} {t('gren.statLines')} · {convocations.length} {t('gren.callupsWord')}
            </p>
          )}
        </motion.div>

        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-52 rounded-xl" />
            ))}
          </div>
        ) : (
          <Tabs defaultValue="effectif" className="w-full">
            <TabsList className="mx-auto mb-8 flex w-full max-w-md">
              <TabsTrigger value="effectif" className="flex-1">{t('gren.tabSquad')}</TabsTrigger>
              <TabsTrigger value="stats" className="flex-1">{t('gren.tabStats')}</TabsTrigger>
              <TabsTrigger value="convocations" className="flex-1">{t('gren.tabCallups')}</TabsTrigger>
            </TabsList>

            {/* Effectif */}
            <TabsContent value="effectif" className="space-y-10">
              {POSITION_ORDER.filter((grp) => grouped[grp].length > 0).map((grp) => (
                <section key={grp}>
                  <h2 className="mb-4 font-display text-lg uppercase tracking-wide text-primary/80">{t(POS_KEY[grp])}</h2>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    {grouped[grp].map((p) => (
                      <PlayerCard key={p.id} player={p} onClick={() => setSelected(p)} />
                    ))}
                  </div>
                </section>
              ))}
            </TabsContent>

            {/* Stats */}
            <TabsContent value="stats">
              <StatsTable stats={stats} playersById={playersById} />
            </TabsContent>

            {/* Convocations */}
            <TabsContent value="convocations">
              <ConvocationsTable convocations={convocations} />
            </TabsContent>
          </Tabs>
        )}
      </main>

      <Footer />

      <PlayerDetailDialog
        player={selected}
        stats={selectedStats}
        convocations={selectedConvs}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </div>
  );
};

export default Grenadiers;
