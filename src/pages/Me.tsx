import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage, Language } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import AppShell from '@/components/mobile/AppShell';
import { ChevronRight, Trophy, Coins, ShieldCheck, Clock, ShoppingBag, Settings, LogOut } from 'lucide-react';
import { getCreditBalance, startTopUp, COMPETITION_LABEL } from '@/lib/uclFantasy';

/**
 * One line of activity.
 *
 * A list, not a card: saved, liked and commented items are things a reader
 * scans to find one they remember, and a 62px thumbnail of an article they
 * have already read costs a row of vertical space without helping them find
 * it. The same row serves all three sections, which were three copies of the
 * same markup before.
 */
const ActivityRow = ({
  category,
  title,
  onClick,
}: {
  category: string;
  title: string;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className="flex w-full items-center gap-3 border-b border-white/[0.05] py-2.5 text-left transition-colors last:border-b-0 hover:bg-white/[0.03]"
  >
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="font-sans text-[9px] font-semibold uppercase tracking-[0.14em] text-primary/85">
        {category}
      </span>
      <span className="truncate font-sans text-[12.5px] font-medium leading-[1.3]">{title}</span>
    </div>
    <ChevronRight className="h-3.5 w-3.5 flex-none text-foreground/25" />
  </button>
);

const LANGS: { code: Language; label: string }[] = [
  { code: 'en', label: 'EN' }, { code: 'fr', label: 'FR' }, { code: 'es', label: 'ES' }, { code: 'ht', label: 'HT' },
];

interface OrderItem { name: string; quantity: number; personalization?: string | null }
interface MyOrder {
  reference: string; createdAt: string; total: string; items: OrderItem[];
  status: string; trackingNumber: string | null; carrier: string | null; carrierName: string | null;
}

// Fulfillment status → { label key, color }. Mirrors the shop admin statuses.
const STATUS = (t: (k: string) => string): Record<string, { label: string; cls: string }> => ({
  new: { label: t('order.processing'), cls: 'bg-white/10 text-foreground/70' },
  in_process: { label: t('order.preparing'), cls: 'bg-blue-500/20 text-blue-300' },
  shipped: { label: t('order.shipped'), cls: 'bg-primary/20 text-primary' },
  delivered: { label: t('order.delivered'), cls: 'bg-green-500/20 text-green-300' },
  canceled: { label: t('order.canceled'), cls: 'bg-red-500/20 text-red-300' },
});

const trackUrl = (carrier: string | null, num: string | null) => {
  if (!num) return null;
  const t = encodeURIComponent(num);
  switch (carrier) {
    case 'canada_post': return `https://www.canadapost-postescanada.ca/track-reperage/en#/details/${t}`;
    case 'ups': return `https://www.ups.com/track?tracknum=${t}`;
    case 'fedex': return `https://www.fedex.com/fedextrack/?trknbr=${t}`;
    case 'usps': return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${t}`;
    case 'dhl': return `https://www.dhl.com/us-en/home/tracking/tracking-parcel.html?submit=1&tracking-id=${t}`;
    case 'amazon': return `https://track.amazon.com/tracking/${t}`;
    default: return null;
  }
};

const Me = () => {
  const navigate = useNavigate();
  const { t, language, setLanguage } = useLanguage();
  const { user, signOut, isAdmin, isEditor } = useAuth();
  const { toast } = useToast();
  const email = user?.email ?? null;
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  // Verify the current password before any sensitive account change (prevents session-hijack takeover).
  const reauth = async (): Promise<boolean> => {
    if (!email) return false;
    if (!currentPassword) { toast({ title: t('me.needCurrentPw'), variant: 'destructive' }); return false; }
    const { error } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
    if (error) { toast({ title: t('me.wrongPw'), variant: 'destructive' }); return false; }
    return true;
  };

  const updateEmail = async () => {
    if (!newEmail.trim() || savingEmail) return;
    if (!(await reauth())) return;
    setSavingEmail(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    setSavingEmail(false);
    toast({ title: error ? error.message : t('me.emailUpdated'), variant: error ? 'destructive' : undefined });
    if (!error) { setNewEmail(''); setCurrentPassword(''); }
  };
  const updatePassword = async () => {
    if (savingPw) return;
    if (newPassword.length < 6) { toast({ title: t('me.pwShort'), variant: 'destructive' }); return; }
    if (!(await reauth())) return;
    setSavingPw(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPw(false);
    toast({ title: error ? error.message : t('me.passwordUpdated'), variant: error ? 'destructive' : undefined });
    if (!error) { setNewPassword(''); setCurrentPassword(''); }
  };
  const [orders, setOrders] = useState<MyOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  type Art = { id: string; title: string; thumbnail_url: string | null; category: string | null };
  const [saved, setSaved] = useState<Art[]>([]);
  const [liked, setLiked] = useState<Art[]>([]);
  const [commented, setCommented] = useState<(Art & { body: string })[]>([]);

  useEffect(() => {
    if (!user) { setLoadingOrders(false); return; }
    (async () => {
      const { data } = await supabase.functions.invoke('my-orders');
      setOrders(((data as { orders?: MyOrder[] })?.orders) ?? []);
      setLoadingOrders(false);

      // deno-lint-ignore no-explicit-any
      const db = supabase as any;
      // Fetch article details for a set of ids, preserving the given order.
      const fetchArts = async (ids: string[]): Promise<Art[]> => {
        if (!ids.length) return [];
        const uniq = [...new Set(ids)];
        const a = await db.from('articles').select('id,title,thumbnail_url,category').in('id', uniq).eq('is_published', true);
        const byId = new Map((a.data ?? []).map((x: any) => [x.id, x]));
        return ids.map((id) => byId.get(id) as Art).filter(Boolean);
      };

      const [bm, lk, cm] = await Promise.all([
        db.from('article_bookmarks').select('article_id').eq('user_id', user.id).order('created_at', { ascending: false }),
        db.from('article_likes').select('article_id').eq('user_id', user.id).order('created_at', { ascending: false }),
        db.from('article_comments').select('article_id, body, created_at').eq('user_id', user.id).order('created_at', { ascending: false }),
      ]);

      setSaved(await fetchArts((bm.data ?? []).map((r: any) => r.article_id)));
      setLiked(await fetchArts((lk.data ?? []).map((r: any) => r.article_id)));
      const cmRows = (cm.data ?? []) as { article_id: string; body: string }[];
      const cmArts = await fetchArts(cmRows.map((r) => r.article_id));
      const artById = new Map(cmArts.map((a) => [a.id, a]));
      setCommented(cmRows.map((r) => { const a = artById.get(r.article_id); return a ? { ...a, body: r.body } : null; }).filter(Boolean) as (Art & { body: string })[]);
    })();
  }, [user]);

  const memberSince = user?.created_at ? new Date(user.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : null;

  const name = email ? email.split('@')[0] : 'Guest';
  const statusMap = STATUS(t);
  // Credits gate the Champions League tools only, so this is shown next to the
  // fantasy links rather than as an account-wide balance.
  const [credits, setCredits] = useState<number | null>(null);
  const [toppingUp, setToppingUp] = useState(false);

  useEffect(() => {
    if (!user) { setCredits(null); return; }
    let cancelled = false;
    getCreditBalance()
      .then((n) => { if (!cancelled) setCredits(n); })
      // A balance that will not load must not take the page down with it; the
      // fantasy links still work without it.
      .catch(() => { if (!cancelled) setCredits(null); });
    return () => { cancelled = true; };
  }, [user]);

  /**
   * Which panel is open, or none.
   *
   * Nothing is open on arrival. Defaulting to Activity meant a member landed
   * on a wall of their own saved and liked articles before reaching anything
   * they came for, and the tab looked pre-pressed for no reason they chose.
   * Clicking the open tab again closes it.
   */
  type Tab = 'activity' | 'orders' | 'preferences';
  const [tab, setTab] = useState<Tab | null>(null);
  /**
   * `label` names the section; `short` is what fits in the pill.
   *
   * Measured rather than guessed: the column is 640px wide and the row inside
   * it 600px, and the five full labels come to roughly that - close enough
   * that the real font tipped them over and wrapped "ORDER HISTORY" across two
   * lines. The short set leaves about a third of the row spare, which survives
   * a wider font and a longer translation.
   */
  const TABS: { id: Tab; label: string; short: string; Icon: typeof Clock }[] = [
    { id: 'activity', label: t('me.activity'), short: t('me.activity'), Icon: Clock },
    { id: 'orders', label: t('me.orders'), short: t('me.ordersShort'), Icon: ShoppingBag },
    { id: 'preferences', label: t('me.preferences'), short: t('me.preferencesShort'), Icon: Settings },
  ];

  return (
    <AppShell>
      <div className="mx-auto max-w-[640px] pt-14">
        {/* Profile */}
        <div className="flex items-center gap-4 px-5 pb-[22px]">
          <div className="h-16 w-16 rounded-full border border-white/10" style={{ background: 'repeating-linear-gradient(135deg,#1c1c20 0 6px,#141417 6px 12px)' }} />
          <div className="flex flex-col gap-1">
            <span className="font-display text-[22px] uppercase">{name}</span>
            <span className="font-sans text-[11.5px] text-foreground/45">{email ? `${t('me.member')} · ${email}` : t('me.notSignedIn')}</span>
            {memberSince && <span className="font-sans text-[11px] text-foreground/35">{t('me.memberSince')} {memberSince}</span>}
          </div>
        </div>

        {/* ── Fantasy ──
            First thing under the profile. This is the only route into the
            squad tools: they are not in the top nav, so a signed-in reader had
            no way to reach them at all. */}
        {email && (
          <div className="border-t border-white/[0.06] px-5 py-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 flex-none text-primary" />
                <span className="font-sans text-[13.5px] font-medium">{t('me.fantasy')}</span>
              </div>

              {/* The balance is the top-up button. A separate TOP UP beside it
                  said the same thing twice and took a whole row to do it, when
                  the only reason to look at a balance is to decide whether to
                  add to it. */}
              <button
                disabled={toppingUp}
                onClick={async () => {
                  setToppingUp(true);
                  try {
                    window.location.href = await startTopUp('starter');
                  } catch (err) {
                    toast({
                      title: t('ucl.error'),
                      description: err instanceof Error ? err.message : String(err),
                      variant: 'destructive',
                    });
                    setToppingUp(false);
                  }
                }}
                title={t('me.topUp')}
                className="flex flex-none items-center gap-1.5 rounded-full border border-primary/40 bg-primary/[0.10] px-2.5 py-1 transition-colors hover:bg-primary/20 disabled:opacity-50"
              >
                <Coins className="h-3.5 w-3.5 text-primary" />
                <span className="font-display text-[13px] leading-none text-primary">
                  {toppingUp ? '...' : (credits ?? '-')}
                </span>
                <span className="font-sans text-[9.5px] font-semibold uppercase tracking-[0.08em] text-primary/70">
                  {t('me.creditsShort')}
                </span>
              </button>
            </div>

            {/* One line, always. Every pill carries its icon and the words drop
                away below the small breakpoint: four labels in French or
                Haitian Creole will not sit across a phone, and an icon that
                stays put beats a label that wraps into a second row. */}
            {/* One line that always fits, so nothing scrolls out of reach.
                Icons alone on a phone - five of them are 194px, comfortable on
                any handset - and short labels from sm up, where the row is
                600px and the short set needs about 430. Letting it scroll
                instead was worse than the wrapping it fixed: the admin and sign
                out pills simply left the screen. */}
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              {TABS.map((tb) => {
                const Icon = tb.Icon;
                return (
                  <button
                    key={tb.id}
                    onClick={() => setTab((cur) => (cur === tb.id ? null : tb.id))}
                    title={tb.label}
                    aria-label={tb.label}
                    className={`flex flex-none items-center gap-1 whitespace-nowrap rounded-full p-1.5 sm:gap-1.5 sm:px-2.5 sm:py-1 font-sans text-[10px] font-semibold uppercase tracking-[0.06em] transition-colors ${
                      tab === tb.id
                        ? 'bg-primary text-primary-foreground'
                        : 'border border-white/[0.14] text-foreground/60 hover:border-primary/50 hover:text-primary'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 flex-none" />
                    <span className="hidden sm:inline">{tb.short}</span>
                  </button>
                );
              })}

              {/* Admin belongs in this row: it is the same kind of thing as the
                  tabs, somewhere else to go rather than the point of the page.
                  Gold so staff find it at a glance, small so it cannot outweigh
                  the squads again. */}
              <button
                onClick={() => {
                  if (isAdmin || isEditor) {
                    navigate('/admin');
                    return;
                  }
                  toast({
                    title: t('me.adminDenied'),
                    description: t('me.adminDeniedBody'),
                    variant: 'destructive',
                  });
                }}
                title={t('me.adminPanel')}
                aria-label={t('me.adminPanel')}
                className="flex flex-none items-center gap-1 whitespace-nowrap rounded-full bg-primary p-1.5 sm:gap-1.5 sm:px-2.5 sm:py-1 font-sans text-[10px] font-semibold uppercase tracking-[0.06em] text-black transition-opacity hover:opacity-90"
              >
                <ShieldCheck className="h-3.5 w-3.5 flex-none" />
                <span className="hidden sm:inline">{t('me.adminShort')}</span>
              </button>

              {/* Sign out sits with admin because both are ways out of this
                  page rather than things on it. Same pill, same rule about the
                  label collapsing on a phone. */}
              <button
                onClick={async () => {
                  await signOut();
                  window.location.href = '/';
                }}
                title={t('me.signOut')}
                aria-label={t('me.signOut')}
                className="flex flex-none items-center gap-1 whitespace-nowrap rounded-full bg-primary p-1.5 sm:gap-1.5 sm:px-2.5 sm:py-1 font-sans text-[10px] font-semibold uppercase tracking-[0.06em] text-black transition-opacity hover:opacity-90"
              >
                <LogOut className="h-3.5 w-3.5 flex-none" />
                <span className="hidden sm:inline">{t('me.signOut')}</span>
              </button>
            </div>

            {/* Solid gold, and the biggest thing on the page. These are what
                the page is for, and as faint outlines nobody saw them. */}
            {/* Stacked on a phone, side by side from sm up. Two cards sharing
                a narrow screen left each one too cramped to read as the main
                thing on the page, which is what they are. */}
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {(['UCL', 'EPL'] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => navigate(c === 'UCL' ? '/fantasy' : '/epl')}
                  className="relative flex items-center gap-3 overflow-hidden rounded-2xl bg-primary px-4 py-4 text-left transition-transform hover:-translate-y-0.5"
                >
                  {/* The crest is decoration, not information - the card already
                      says which competition it is in words. So it sits behind
                      the text at low opacity and is hidden from screen readers
                      rather than read out as a second label. */}
                  {/* A soft wash off the top-left, so flat gold does not read
                      as a solid block. */}
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/25 to-transparent"
                  />

                  <div className="relative flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="font-sans text-[9.5px] font-bold uppercase tracking-[0.14em] text-black/60">
                      {COMPETITION_LABEL[c]}
                    </span>
                    <span className="font-display text-[17px] uppercase leading-tight text-black">
                      {t('me.checkSquad')}
                    </span>
                    {/* Rating and breakdown never cost anything in either
                        competition - only the advice about a squad does - so
                        what this opens really is free, and saying so is what
                        gets it pressed. */}
                    <span className="mt-1 inline-flex w-fit items-center rounded-full bg-black/20 px-2 py-0.5 font-sans text-[9px] font-bold uppercase tracking-[0.12em] text-black/80">
                      {t('me.forFree')}
                    </span>
                  </div>

                  {/* The crest gets its own space rather than hiding behind the
                      words, where it was unreadable and in the way at once. */}
                  <img
                    src={c === 'UCL' ? '/ucllogo.png' : '/epllogo.png'}
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    className="pointer-events-none relative h-14 w-14 flex-none object-contain opacity-75 mix-blend-multiply"
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Activity tab ── */}
        {email && tab === 'activity' && (<>
        {/* Saved articles */}
        <div className="border-t border-white/[0.06] px-5 py-4">
          <div className="flex items-center justify-between">
            <span className="font-sans text-[13.5px] font-medium">{t('me.savedArticles')}</span>
            <span className="font-sans text-[12px] text-foreground/40">{saved.length}</span>
          </div>
          {saved.length === 0 ? (
            <p className="mt-3 font-sans text-[12px] text-foreground/40">{t('me.noSaved')}</p>
          ) : (
            <div className="mt-2 flex flex-col">
              {saved.map((a) => (
                <ActivityRow
                  key={a.id}
                  category={a.category ?? 'Analysis'}
                  title={a.title}
                  onClick={() => navigate(`/articles/${a.id}`)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Liked articles */}
        <div className="border-t border-white/[0.06] px-5 py-4">
          <div className="flex items-center justify-between">
            <span className="font-sans text-[13.5px] font-medium">{t('me.liked')}</span>
            <span className="font-sans text-[12px] text-foreground/40">{liked.length}</span>
          </div>
          {liked.length === 0 ? (
            <p className="mt-3 font-sans text-[12px] text-foreground/40">{t('me.noLiked')}</p>
          ) : (
            <div className="mt-2 flex flex-col">
              {liked.map((a) => (
                <ActivityRow
                  key={a.id}
                  category={a.category ?? 'Analysis'}
                  title={a.title}
                  onClick={() => navigate(`/articles/${a.id}`)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Your comments */}
        <div className="border-t border-white/[0.06] px-5 py-4">
          <div className="flex items-center justify-between">
            <span className="font-sans text-[13.5px] font-medium">{t('me.comments')}</span>
            <span className="font-sans text-[12px] text-foreground/40">{commented.length}</span>
          </div>
          {commented.length === 0 ? (
            <p className="mt-3 font-sans text-[12px] text-foreground/40">{t('me.noComments')}</p>
          ) : (
            <div className="mt-3 flex flex-col gap-2.5">
              {commented.map((c, i) => (
                <button key={i} onClick={() => navigate(`/articles/${c.id}`)} className="flex flex-col gap-1 rounded-xl border border-white/[0.06] bg-[#101012] p-3 text-left transition-opacity hover:opacity-80">
                  <span className="line-clamp-1 font-sans text-[11px] font-semibold uppercase tracking-[0.06em] text-primary/85">{c.title}</span>
                  <span className="line-clamp-2 font-sans text-[12.5px] text-foreground/70">“{c.body}”</span>
                </button>
              ))}
            </div>
          )}
        </div>

        </>)}

        {/* ── Orders tab ── */}
        {email && tab === 'orders' && (
        <div className="border-t border-white/[0.06] px-5 py-4">
          <span className="font-sans text-[13.5px] font-medium">{t('me.orders')}</span>
          {loadingOrders ? (
            <p className="mt-3 font-sans text-[12px] text-foreground/40">…</p>
          ) : orders.length === 0 ? (
            <p className="mt-3 font-sans text-[12px] text-foreground/40">{t('me.noOrders')}</p>
          ) : (
            <div className="mt-3 flex flex-col gap-3">
              {orders.map((o) => {
                const s = statusMap[o.status] ?? statusMap.new;
                const url = o.status === 'shipped' ? trackUrl(o.carrier, o.trackingNumber) : null;
                return (
                  <div key={o.reference} className="rounded-xl border border-white/[0.07] bg-[#101012] p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] text-primary">{o.reference}</span>
                      <span className={`rounded-full px-2 py-[3px] font-sans text-[10px] font-semibold ${s.cls}`}>{s.label}</span>
                    </div>
                    <div className="mt-1.5 font-sans text-[11px] text-foreground/40">
                      {new Date(o.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })} · {o.total}
                    </div>
                    <ul className="mt-2 flex flex-col gap-0.5">
                      {o.items.map((it, i) => (
                        <li key={i} className="font-sans text-[12.5px] text-foreground/75">
                          {it.quantity}× {it.name}
                          {it.personalization && <span className="text-primary/85"> · {it.personalization}</span>}
                        </li>
                      ))}
                    </ul>
                    {o.status === 'shipped' && o.trackingNumber && (
                      <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="text-foreground/50">{t('order.tracking')}:</span>
                        {url ? (
                          <a href={url} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline">{o.trackingNumber}</a>
                        ) : (
                          <span className="font-medium text-foreground/80">{o.trackingNumber}</span>
                        )}
                        {(o.carrierName || o.carrier) && <span className="text-foreground/40">({o.carrierName || o.carrier})</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        )}

        {/* ── Preferences tab ── */}
        {email && tab === 'preferences' && (
          <div className="border-t border-white/[0.06] px-5 py-4">
            <span className="font-sans text-[13.5px] font-medium sr-only">{t('me.preferences')}</span>
            <div className="mt-3.5 flex flex-col gap-4">
              {/* Current password (required to change email/password) */}
              <div className="flex flex-col gap-1.5">
                <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.1em] text-foreground/45">{t('me.currentPassword')}</span>
                <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password"
                  className="rounded-xl border border-white/[0.12] bg-[#101012] px-3.5 py-2.5 font-sans text-[13.5px] text-foreground placeholder:text-foreground/30 focus:border-primary/50 focus:outline-none" />
                <span className="font-sans text-[10.5px] text-foreground/35">{t('me.currentPasswordHint')}</span>
              </div>
              {/* Email */}
              <div className="flex flex-col gap-1.5">
                <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.1em] text-foreground/45">{t('me.email')}</span>
                <div className="flex gap-2">
                  <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder={email}
                    className="flex-1 rounded-xl border border-white/[0.12] bg-[#101012] px-3.5 py-2.5 font-sans text-[13.5px] text-foreground placeholder:text-foreground/30 focus:border-primary/50 focus:outline-none" />
                  <button onClick={updateEmail} disabled={savingEmail || !newEmail.trim()} className="rounded-xl px-4 font-sans text-[12px] font-bold uppercase tracking-wide text-[#070708] disabled:opacity-40" style={{ background: 'linear-gradient(135deg,#e9c877,#c08a2a)' }}>{t('me.update')}</button>
                </div>
              </div>
              {/* Password */}
              <div className="flex flex-col gap-1.5">
                <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.1em] text-foreground/45">{t('me.newPassword')}</span>
                <div className="flex gap-2">
                  <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" autoComplete="new-password"
                    className="flex-1 rounded-xl border border-white/[0.12] bg-[#101012] px-3.5 py-2.5 font-sans text-[13.5px] text-foreground placeholder:text-foreground/30 focus:border-primary/50 focus:outline-none" />
                  <button onClick={updatePassword} disabled={savingPw || !newPassword} className="rounded-xl px-4 font-sans text-[12px] font-bold uppercase tracking-wide text-[#070708] disabled:opacity-40" style={{ background: 'linear-gradient(135deg,#e9c877,#c08a2a)' }}>{t('me.update')}</button>
                </div>
              </div>
              {/* Language */}
              <div className="flex items-center justify-between">
                <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.1em] text-foreground/45">{t('me.language')}</span>
                <span className="flex gap-1.5">
                  {LANGS.map((l) => (
                    <button key={l.code} onClick={() => setLanguage(l.code)} className={`rounded px-1.5 py-0.5 font-sans text-[11px] font-semibold transition-colors ${l.code === language ? 'bg-primary text-[#070708]' : 'text-foreground/35 hover:text-foreground'}`}>{l.label}</button>
                  ))}
                </span>
              </div>
            </div>
          </div>
        )}
        {/* Language (for signed-out visitors) */}
        {!email && (
          <div className="flex w-full items-center justify-between border-t border-white/[0.06] px-5 py-4">
            <span className="font-sans text-[13.5px] font-medium">{t('me.language')}</span>
            <span className="flex gap-1.5">
              {LANGS.map((l) => (
                <button key={l.code} onClick={() => setLanguage(l.code)} className={`rounded px-1.5 py-0.5 font-sans text-[11px] font-semibold transition-colors ${l.code === language ? 'bg-primary text-[#070708]' : 'text-foreground/35 hover:text-foreground'}`}>{l.label}</button>
              ))}
            </span>
          </div>
        )}

        {/* Sign in / out */}
        {/* Signed out, this is the only way in, so it keeps the full width.
            Signed in, leaving is a pill up in the row with admin. */}
        {!email && (
          <button
            onClick={() => navigate('/auth')}
            className="flex w-full items-center justify-between border-t border-b border-black/10 bg-primary px-5 py-4 text-left transition-opacity hover:opacity-90"
          >
            <span className="font-sans text-[13.5px] font-semibold text-black">{t('me.signIn')}</span>
            <span className="font-sans text-[12px] text-black/70">→</span>
          </button>
        )}
      </div>
    </AppShell>
  );
};

export default Me;
