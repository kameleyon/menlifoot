-- Les Grenadiers (Haiti national team) datasets: players, stats, call-ups
-- Public read (RLS select=true, grants to anon/authenticated), same pattern as existing tables.

-- Players
create table if not exists public.haiti_players (
  id                 text primary key,
  first_name         text,
  last_name          text,
  position           text,
  jersey_number      integer,
  birth_date         date,
  birth_place        text,
  selection          text,
  current_club       text,
  club_country       text,
  clubs_history      text,
  market_value_eur   bigint,
  agent              text,
  agent_contact      text,
  instagram          text,
  twitter            text,
  tiktok             text,
  youtube            text,
  website            text,
  contract_start     date,
  contract_end       date,
  salary_eur         bigint,
  recent_injuries    text,
  status             text,
  merch_personal_url text,
  merch_club_url     text,
  notes              text,
  created_at         timestamptz not null default now()
);

-- Stats (per season / competition)
create table if not exists public.haiti_stats (
  id                bigint generated always as identity primary key,
  player_id         text references public.haiti_players(id) on delete cascade,
  season            text,
  competition       text,
  category          text,
  club_or_selection text,
  matches_played    integer,
  starts            integer,
  minutes           integer,
  goals             integer,
  assists           text,
  yellow_cards      integer,
  red_cards         integer,
  shots_per_match   numeric,
  dribbles          integer,
  duels_won_pct     numeric,
  avg_rating        numeric,
  source            text,
  notes             text
);
create index if not exists haiti_stats_player_id_idx on public.haiti_stats(player_id);

-- Call-ups (per match)
create table if not exists public.haiti_convocations (
  id               text primary key,
  player_id        text references public.haiti_players(id) on delete cascade,
  first_name       text,
  last_name        text,
  tournament       text,
  competition_type text,
  phase            text,
  opponent         text,
  match_date       date,
  location         text,
  result           text,
  callup_status    text,
  present_absent   text,
  absence_reason   text,
  goals            integer,
  assists          integer,
  minutes          integer,
  yellow_card      integer,
  red_card         integer,
  match_rating     numeric,
  notes            text
);
create index if not exists haiti_convocations_player_id_idx on public.haiti_convocations(player_id);

-- RLS: public read only
alter table public.haiti_players       enable row level security;
alter table public.haiti_stats         enable row level security;
alter table public.haiti_convocations  enable row level security;

drop policy if exists "Anyone can view haiti players"       on public.haiti_players;
drop policy if exists "Anyone can view haiti stats"         on public.haiti_stats;
drop policy if exists "Anyone can view haiti convocations"  on public.haiti_convocations;

create policy "Anyone can view haiti players"      on public.haiti_players      for select using (true);
create policy "Anyone can view haiti stats"        on public.haiti_stats        for select using (true);
create policy "Anyone can view haiti convocations" on public.haiti_convocations for select using (true);

grant select on public.haiti_players      to anon, authenticated;
grant select on public.haiti_stats        to anon, authenticated;
grant select on public.haiti_convocations to anon, authenticated;
