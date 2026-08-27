-- UCL Fantasy squad rater.
--
-- ucl_players is a reference table refreshed nightly by the ucl-sync-players
-- edge function (UEFA feed first, Perplexity fallback). It is the source of
-- truth the rater reasons over, so the LLM never has to recall player stats.
--
-- Names arriving from screenshot OCR are abbreviated and often misread
-- ("B.Fernandes", "N.Williams"), so pg_trgm + match_ucl_player() do the
-- fuzzy resolution in SQL rather than asking the model to guess ids.

create extension if not exists pg_trgm;

-- ---------------------------------------------------------------- players ---
create table if not exists public.ucl_players (
  id                uuid primary key default gen_random_uuid(),
  uefa_id           text unique,
  name              text not null,
  -- lowercased, unaccented, punctuation-stripped; written by the sync fn
  normalized_name   text not null,
  display_name      text not null,
  team              text not null,
  team_code         text,
  position          text not null check (position in ('GK', 'DEF', 'MID', 'FWD')),
  price             numeric(4, 1),
  total_points      integer not null default 0,
  form              numeric(5, 2),
  minutes           integer not null default 0,
  goals             integer not null default 0,
  assists           integer not null default 0,
  clean_sheets      integer not null default 0,
  saves             integer not null default 0,
  yellow_cards      integer not null default 0,
  red_cards         integer not null default 0,
  availability      text not null default 'available'
                      check (availability in ('available', 'doubtful', 'injured', 'suspended', 'unavailable')),
  availability_note text,
  next_opponent     text,
  -- 1 = easiest run of fixtures, 5 = hardest
  next_difficulty   smallint check (next_difficulty between 1 and 5),
  selected_by_pct   numeric(5, 2),
  source            text not null default 'uefa',
  updated_at        timestamptz not null default now()
);

-- Merge key for BOTH sync paths. uefa_id cannot serve as the conflict target
-- because Perplexity-sourced rows have none, and upserting on a null column
-- inserts a fresh duplicate every night.
create unique index if not exists ucl_players_name_team_uidx
  on public.ucl_players (normalized_name, team);

create index if not exists ucl_players_norm_trgm_idx
  on public.ucl_players using gin (normalized_name gin_trgm_ops);
create index if not exists ucl_players_position_idx on public.ucl_players (position);
create index if not exists ucl_players_team_idx on public.ucl_players (team_code);

-- Public read: the manual pitch builder needs to search players anonymously.
-- Writes are service-role only (the sync function), so no write policies exist.
alter table public.ucl_players enable row level security;
drop policy if exists "ucl players readable" on public.ucl_players;
create policy "ucl players readable" on public.ucl_players for select using (true);

-- Best-effort fuzzy resolution of an OCR'd name to a player row.
-- Position is an optional narrowing hint from the screenshot's pitch layout.
create or replace function public.match_ucl_player(q text, pos text default null, lim int default 5)
returns table (
  id uuid,
  name text,
  display_name text,
  team text,
  team_code text,
  -- quoted: POSITION is a reserved keyword in a RETURNS TABLE column list
  "position" text,
  price numeric,
  score real
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.name, p.display_name, p.team, p.team_code, p.position, p.price,
         similarity(p.normalized_name, lower(btrim(q))) as score
  from public.ucl_players p
  where (pos is null or p.position = pos)
    and similarity(p.normalized_name, lower(btrim(q))) > 0.25
  order by score desc, p.total_points desc
  limit greatest(lim, 1);
$$;

-- ------------------------------------------------------------- sync runs ---
create table if not exists public.ucl_sync_runs (
  id               uuid primary key default gen_random_uuid(),
  started_at       timestamptz not null default now(),
  finished_at      timestamptz,
  source           text,
  status           text not null default 'running'
                     check (status in ('running', 'success', 'partial', 'failed')),
  players_upserted integer not null default 0,
  error            text
);

create index if not exists ucl_sync_runs_started_idx
  on public.ucl_sync_runs (started_at desc);

-- Observability only; nothing public reads it.
alter table public.ucl_sync_runs enable row level security;

-- ---------------------------------------------------------------- ratings ---
-- Holds captured emails, so RLS is on with NO policies: service-role writes
-- and reads only. The edge function returns the rating to the client directly
-- rather than letting the browser query this table back.
create table if not exists public.ucl_squad_ratings (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users (id) on delete set null,
  email             text,
  email_captured_at timestamptz,
  squad             jsonb not null,
  rating            smallint check (rating between 0 and 100),
  breakdown         jsonb,
  suggestions       jsonb,
  source            text not null default 'manual' check (source in ('screenshot', 'manual')),
  language          text not null default 'en',
  created_at        timestamptz not null default now()
);

create index if not exists ucl_squad_ratings_created_idx
  on public.ucl_squad_ratings (created_at desc);
create index if not exists ucl_squad_ratings_email_idx
  on public.ucl_squad_ratings (lower(email)) where email is not null;

alter table public.ucl_squad_ratings enable row level security;
