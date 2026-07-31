import { Link } from 'react-router-dom';
import AppShell from '@/components/mobile/AppShell';

const Stub = ({ kicker, title, note }: { kicker: string; title: string; note: string }) => (
  <AppShell>
    <div className="px-5 pt-14">
      <div className="flex flex-col gap-1.5 pb-6">
        <span className="font-sans text-[9px] font-semibold uppercase tracking-[0.18em] text-primary">{kicker}</span>
        <span className="font-display text-[30px] uppercase leading-none">{title}</span>
      </div>
      <div className="rounded-2xl border border-dashed border-white/[0.14] p-6 font-sans text-[12px] leading-[1.6] text-foreground/50">
        {note}
      </div>
      <Link to="/" className="mt-6 inline-block rounded-full border border-white/[0.16] px-5 py-3 font-sans text-[12px] font-semibold text-foreground/75">← Home</Link>
    </div>
  </AppShell>
);

export const Listen = () => <Stub kicker="Menlifoot original" title="Podcast" note="Podcast player + episode list — building in this rebrand phase, wired to the podcasts table." />;
export const Shop = () => <Stub kicker="Now open" title="Store" note="Launch-drop store, product grid and cart — building in this rebrand phase (visual placeholder products)." />;
export const Me = () => <Stub kicker="Account" title="Me" note="Profile, saved articles, Menlifoot+ — building in this rebrand phase." />;
export const Ask = () => <Stub kicker="Trained on our archive" title="Ask Menli" note="The AI assistant (already live) gets its dedicated screen in this rebrand phase." />;
