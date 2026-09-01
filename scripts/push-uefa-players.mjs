/**
 * Pull the UEFA Fantasy player feed and push it to ucl-sync-players.
 *
 * Run from a machine or CI runner that UEFA will talk to:
 *
 *     node scripts/push-uefa-players.mjs
 *
 * Why this exists instead of the edge function fetching it directly: Akamai
 * accepts a browser and refuses Supabase's egress. Every season id fails at the
 * connection layer from the edge runtime - not a 403, not a 404, no HTTP
 * response at all - while the identical request returns 200 from a browser and
 * from Node here. curl is refused too, so it is the client that is being
 * judged, not the URL.
 *
 * The feed is authoritative for the things nothing else has: current game
 * prices, points, and ownership. Without it the Champions League pool has no
 * prices, which leaves the budget, the value dimension and autofill with
 * nothing to work from.
 *
 * All the mapping, merging and stale-row cleanup stay in the edge function.
 * This script only performs the HTTP request the edge function cannot.
 */
import fs from 'node:fs';

/** UEFA increments this each season; read it off any feed URL the site loads. */
const SEASON = 90;
const FEED =
  `https://gaming.uefa.com/en/uclfantasy/services/feeds/players/players_${SEASON}_en_1.json`;

/** Only what mapUefaPlayer reads, so a 2.9MB feed does not cross the wire whole. */
const FIELDS = [
  'id', 'pDName', 'pFName', 'latinName', 'tName', 'tId', 'cCode', 'skill', 'value',
  'totPts', 'minsPlyd', 'gS', 'assist', 'cS', 'gC', 'yC', 'rC', 'saves', 'selPer',
  'isActive', 'pStatus', 'qStatus', 'rating',
];

// Environment first so CI can supply secrets, falling back to .env for a local
// run. The .env read is optional: a CI runner has no such file.
let dotenv = '';
try {
  dotenv = fs.readFileSync('.env', 'utf8');
} catch {
  dotenv = '';
}
const read = (key) => {
  if (process.env[key]) return process.env[key];
  const m = dotenv.match(new RegExp(`^${key}\\s*=\\s*(.+)$`, 'm'));
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : undefined;
};

const supabaseUrl = read('VITE_SUPABASE_URL');
const supabaseKey = read('VITE_SUPABASE_PUBLISHABLE_KEY') || read('VITE_SUPABASE_ANON_KEY');
if (!supabaseUrl || !supabaseKey) {
  console.error('Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (environment or .env)');
  process.exit(1);
}

/**
 * Fetch the feed, with a bounded wait and one retry.
 *
 * Akamai does not answer refused clients, it drops them, so the failure mode
 * is a hang rather than a status code - a GitHub run sat for 81 seconds and
 * reported nothing useful. The timeout turns that into a message, and the
 * retry covers an ordinary blip without hiding a block: a blocked network
 * fails both attempts identically.
 */
const REQUEST_TIMEOUT_MS = 20_000;

async function fetchFeed() {
  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const abort = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(FEED, {
        signal: abort,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          Accept: 'application/json',
          Referer: 'https://gaming.uefa.com/en/uclfantasy',
        },
      });
      return res;
    } catch (err) {
      lastError = err;
      console.error(`attempt ${attempt}: ${err?.name ?? 'Error'} - ${err?.message ?? err}`);
    }
  }
  console.error(
    [
      '',
      'Could not reach the UEFA feed. This is what a blocked client looks like:',
      'UEFA answers a browser and an ordinary connection, and drops requests from',
      'data centres - Supabase edge functions, and GitHub-hosted runners.',
      'Run this from a machine on an ordinary connection, or point a self-hosted',
      'runner at it. The feed itself is fine; the caller is being refused.',
    ].join('\n'),
  );
  throw lastError ?? new Error('uefa feed unreachable');
}

const feed = await fetchFeed();
if (!feed.ok) {
  console.error(`UEFA feed returned HTTP ${feed.status}. If this is a 404 the season id has ` +
    `moved on - open the fantasy site and read the number out of any feeds/ URL it loads.`);
  process.exit(1);
}

const json = await feed.json();
const players = json?.data?.value?.playerList ?? [];
if (players.length === 0) {
  console.error('feed parsed but held no playerList; refusing to push an empty pool');
  process.exit(1);
}

const slim = players.map((p) =>
  Object.fromEntries(FIELDS.filter((f) => f in p).map((f) => [f, p[f]])),
);
console.log(`UEFA season ${SEASON}: ${players.length} players`);

const res = await fetch(`${supabaseUrl}/functions/v1/ucl-sync-players`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ mode: 'uefa', payload: { playerList: slim } }),
});
const body = await res.text();
console.log(`sync HTTP ${res.status}: ${body}`);
process.exit(res.ok ? 0 : 1);
