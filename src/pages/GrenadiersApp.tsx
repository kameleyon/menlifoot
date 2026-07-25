import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppShell from '@/components/mobile/AppShell';
import { HaitiPlayer, HaitiConvocation, fullName, positionGroup, POSITION_ORDER, PositionGroup } from '@/types/grenadiers';

interface SelStat { player_id: string; matches_played: number | null; goals: number | null; }

type Match = { tournament: string | null; opponent: string | null; date: string | null; result: string | null };
const POS_LABEL: Record<PositionGroup, string> = { Gardiens: 'Goalkeepers', Défenseurs: 'Defenders', Milieux: 'Midfielders', Attaquants: 'Forwards', Autres: 'Others' };
const resultColor = (r: string | null) => {
  const c = (r ?? '').toUpperCase();
  if (c.includes('(V)') || c.includes('(W)')) return { bg: 'rgba(88,190,120,.16)', fg: '#7fd69a', res: 'W' };
  if (c.includes('(N)') || c.includes('(D)') && c.includes('–')) return { bg: 'rgba(255,255,255,.1)', fg: 'rgba(244,242,238,.7)', res: 'D' };
  if (c.includes('(N)')) return { bg: 'rgba(255,255,255,.1)', fg: 'rgba(244,242,238,.7)', res: 'D' };
  return { bg: 'rgba(226,72,63,.16)', fg: '#e2726b', res: 'L' };
};

const GrenadiersApp = () => {
  const [players, setPlayers] = useState<HaitiPlayer[]>([]);
  const [convs, setConvs] = useState<HaitiConvocation[]>([]);
  const [sel, setSel] = useState<SelStat[]>([]);
  const [tab, setTab] = useState<'records' | 'results' | 'squad'>('records');
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    (async () => {
      const p = await (supabase as any).from('haiti_players').select('*').order('jersey_number', { ascending: true, nullsFirst: false });
      if (p.data) setPlayers(p.data as HaitiPlayer[]);
      const c = await (supabase as any).from('haiti_convocations').select('*').order('match_date', { ascending: false });
      if (c.data) setConvs(c.data as HaitiConvocation[]);
      const s = await (supabase as any).from('haiti_stats').select('player_id,matches_played,goals,category').eq('category', 'Sélection');
      if (s.data) setSel(s.data as SelStat[]);
    })();
  }, []);

  const playersById = useMemo(() => Object.fromEntries(players.map((p) => [p.id, p])), [players]);

  const matches: Match[] = useMemo(() => {
    const seen = new Set<string>(); const out: Match[] = [];
    for (const c of convs) {
      const k = `${c.tournament}|${c.opponent}|${c.match_date}|${c.result}`;
      if (c.match_date && !seen.has(k)) { seen.add(k); out.push({ tournament: c.tournament, opponent: c.opponent, date: c.match_date, result: c.result }); }
    }
    return out;
  }, [convs]);
  const lastMatch = matches[0];

  const topScorers = useMemo(() => sel.filter((s) => (s.goals ?? 0) > 0).sort((a, b) => (b.goals ?? 0) - (a.goals ?? 0)).slice(0, 5), [sel]);
  const topCaps = useMemo(() => sel.filter((s) => (s.matches_played ?? 0) > 0).sort((a, b) => (b.matches_played ?? 0) - (a.matches_played ?? 0)).slice(0, 5), [sel]);

  const squad = useMemo(() => {
    const g: Record<PositionGroup, HaitiPlayer[]> = { Gardiens: [], Défenseurs: [], Milieux: [], Attaquants: [], Autres: [] };
    for (const p of players) g[positionGroup(p.position)].push(p);
    return g;
  }, [players]);

  const capsOf = (id: string) => sel.find((s) => s.player_id === id)?.matches_played ?? null;
  const nm = (id: string) => (playersById[id] ? fullName(playersById[id]) : id);

  return (
    <AppShell>
      <div className="pt-14">
        {/* Header */}
        <div className="flex flex-col gap-[11px] px-5 pb-[18px]">
          <span className="font-sans text-[9px] font-semibold uppercase tracking-[0.18em] text-primary">National team · {players.length} players</span>
          <span className="font-display text-[34px] uppercase leading-[0.95]">Les Grenadiers</span>
          <span className="font-sans text-[12.5px] leading-[1.5] text-foreground/55">Results, call-ups and a profile for every player in the Haitian selection — clubs, caps, goals, market value.</span>
          <button onClick={() => setFollowing((f) => !f)} className="mt-[3px] self-start rounded-full px-[18px] py-[11px] font-sans text-[11px] font-bold uppercase tracking-[0.08em]"
            style={following ? { border: '1px solid rgba(255,255,255,.16)', color: 'rgba(244,242,238,.7)' } : { border: '1px solid transparent', background: 'linear-gradient(135deg,#e9c877,#c08a2a)', color: '#070708' }}>
            {following ? 'Following' : 'Follow team'}
          </button>
        </div>

        {/* Last match */}
        {lastMatch && (
          <div className="mx-5 mb-[18px] flex flex-col gap-3 rounded-2xl border border-primary/[0.28] p-[18px]" style={{ background: 'linear-gradient(135deg,rgba(200,154,60,.12),rgba(200,154,60,.02))' }}>
            <div className="flex items-center justify-between">
              <span className="font-sans text-[9px] font-semibold uppercase tracking-[0.16em] text-primary">Last match</span>
              <span className="font-mono text-[10px] text-foreground/50">{lastMatch.date ? new Date(lastMatch.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : ''}</span>
            </div>
            <span className="font-display text-[26px] uppercase leading-[1.02]">Haiti {(lastMatch.result ?? '').replace(/\s*\(.\)/, '')} {lastMatch.opponent}</span>
            <div className="flex flex-col gap-[5px]">
              <span className="font-sans text-[12px] font-medium text-foreground/70">{lastMatch.tournament}</span>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 px-5 pb-3.5">
          {(['records', 'results', 'squad'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className="flex-none rounded-full px-3.5 py-2 font-sans text-[11px] font-semibold uppercase tracking-[0.08em] capitalize"
              style={tab === t ? { background: '#f4f2ee', color: '#070708' } : { border: '1px solid rgba(255,255,255,.14)', color: 'rgba(244,242,238,.7)' }}>{t}</button>
          ))}
        </div>

        {/* Records */}
        {tab === 'records' && (
          <div className="flex flex-col">
            <div className="px-5 pb-2.5 pt-1.5 font-sans text-[9px] font-semibold uppercase tracking-[0.16em] text-foreground/40">All-time goals</div>
            {topScorers.map((l) => (
              <div key={l.player_id} className="flex items-center gap-3.5 border-t border-white/[0.05] px-5 py-3">
                <span className="w-[30px] flex-none text-center font-display text-[20px] text-primary">{l.goals}</span>
                <div className="flex flex-1 flex-col gap-1"><span className="font-sans text-[13px] font-medium">{nm(l.player_id)}</span><span className="font-sans text-[10.5px] text-foreground/40">Sélection · {l.matches_played ?? '—'} caps</span></div>
              </div>
            ))}
            <div className="px-5 pb-2.5 pt-[22px] font-sans text-[9px] font-semibold uppercase tracking-[0.16em] text-foreground/40">Most caps</div>
            {topCaps.map((l) => (
              <div key={l.player_id} className="flex items-center gap-3.5 border-t border-white/[0.05] px-5 py-3">
                <span className="w-[30px] flex-none text-center font-display text-[20px] text-foreground/70">{l.matches_played}</span>
                <div className="flex flex-1 flex-col gap-1"><span className="font-sans text-[13px] font-medium">{nm(l.player_id)}</span><span className="font-sans text-[10.5px] text-foreground/40">Sélection · {l.goals ?? 0} goals</span></div>
              </div>
            ))}
          </div>
        )}

        {/* Results */}
        {tab === 'results' && (
          <div className="flex flex-col">
            {matches.slice(0, 12).map((r, i) => {
              const rc = resultColor(r.result);
              return (
                <div key={i} className="flex items-center gap-3.5 border-t border-white/[0.06] px-5 py-3.5">
                  <span className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full font-sans text-[11px] font-bold" style={{ background: rc.bg, color: rc.fg }}>{rc.res}</span>
                  <div className="flex flex-1 flex-col gap-1.5"><span className="font-sans text-[13px] font-medium">Haiti {(r.result ?? '').replace(/\s*\(.\)/, '')} {r.opponent}</span><span className="font-sans text-[10.5px] text-foreground/40">{r.tournament}</span></div>
                  <span className="font-mono text-[10px] text-foreground/40">{r.date ? new Date(r.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' }) : ''}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Squad */}
        {tab === 'squad' && (
          <div className="flex flex-col">
            {POSITION_ORDER.filter((g) => squad[g].length).map((g) => (
              <div key={g} className="flex flex-col">
                <div className="px-5 pb-2 pt-3.5 font-sans text-[9px] font-semibold uppercase tracking-[0.16em] text-foreground/40">{POS_LABEL[g]}</div>
                {squad[g].map((p) => (
                  <div key={p.id} className="flex items-center gap-3.5 border-t border-white/[0.05] px-5 py-[11px]">
                    <span className="w-[26px] flex-none text-center font-display text-[15px] text-primary">{p.jersey_number ?? '·'}</span>
                    <div className="h-[34px] w-[34px] flex-none rounded-full" style={{ background: 'repeating-linear-gradient(135deg,#1c1c20 0 6px,#141417 6px 12px)' }} />
                    <div className="flex flex-1 flex-col gap-1"><span className="font-sans text-[13px] font-medium">{fullName(p)}</span><span className="font-sans text-[10.5px] text-foreground/40">{p.current_club ?? '—'}</span></div>
                    <span className="font-mono text-[10px] text-foreground/35">{capsOf(p.id) != null ? `${capsOf(p.id)} caps` : ''}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default GrenadiersApp;
