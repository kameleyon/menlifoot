-- Make the fantasy tables competition-aware so the same machinery serves the
-- Champions League and the Premier League.
--
-- A parallel set of epl_* tables was the alternative. This is better: an Arsenal
-- player is in both competitions, the scoring, optimiser, best-picks and sync
-- logic are identical, and duplicating them would mean every future fix has to
-- be made twice. The tables keep their ucl_ names because renaming live tables
-- under a running feature is a bigger risk than a slightly dated prefix.
--
-- Everything already in place is Champions League, hence the default.

alter table public.ucl_players    add column if not exists competition text not null default 'UCL';
alter table public.ucl_teams      add column if not exists competition text not null default 'UCL';
alter table public.ucl_fixtures   add column if not exists competition text not null default 'UCL';
alter table public.ucl_matchdays  add column if not exists competition text not null default 'UCL';

-- The merge keys must include the competition: the same player and the same
-- club legitimately appear in both, with different fixtures and prices.
drop index if exists public.ucl_players_name_team_uidx;
create unique index if not exists ucl_players_comp_name_team_uidx
  on public.ucl_players (competition, normalized_name, team);

alter table public.ucl_teams drop constraint if exists ucl_teams_pkey cascade;
alter table public.ucl_teams add primary key (competition, name);

alter table public.ucl_fixtures drop constraint if exists ucl_fixtures_unique;
alter table public.ucl_fixtures
  add constraint ucl_fixtures_unique unique (competition, matchday, home_team, away_team);

alter table public.ucl_matchdays drop constraint if exists ucl_matchdays_pkey cascade;
alter table public.ucl_matchdays add primary key (competition, matchday);
-- The Premier League runs 38 rounds, not the league phase's 8.
alter table public.ucl_matchdays drop constraint if exists ucl_matchdays_matchday_check;
alter table public.ucl_fixtures  drop constraint if exists ucl_fixtures_matchday_check;
alter table public.ucl_matchdays add check (matchday between 1 and 38);
alter table public.ucl_fixtures  add check (matchday between 1 and 38);

create index if not exists ucl_players_competition_idx on public.ucl_players (competition);
create index if not exists ucl_fixtures_competition_idx on public.ucl_fixtures (competition, matchday, kickoff);

-- Season-long per-player numbers, the input the form sub-score was missing.
-- Sourced from the league leaderboards, which are free and keyed by name.
alter table public.ucl_players
  add column if not exists xg              numeric(6, 2),
  add column if not exists xa              numeric(6, 2),
  add column if not exists appearances     integer,
  add column if not exists stats_source    text,
  add column if not exists stats_updated_at timestamptz;
