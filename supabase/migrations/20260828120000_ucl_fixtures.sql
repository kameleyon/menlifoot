-- UCL league-phase fixtures, matchdays and club strength.
--
-- This is the keystone for the rater: fixture difficulty was previously null
-- for every player, which left the `fixtures` sub-score permanently dead. With
-- a schedule and a per-club strength tier we can compute difficulty in SQL —
-- deterministically, no model involved — and that same data drives captain
-- picks, "who plays next" suggestions and chip advice.
--
-- Note the shape differs from the Premier League: the league phase is 8
-- matchdays across the whole season (Tue/Wed/Thu), not a weekly cycle.

-- ------------------------------------------------------------------ clubs ---
create table if not exists public.ucl_teams (
  name        text primary key,
  short_name  text,
  code        text,
  -- 1 = weakest in the field, 5 = strongest. Used as the opponent's difficulty.
  strength    smallint not null default 3 check (strength between 1 and 5),
  updated_at  timestamptz not null default now()
);

alter table public.ucl_teams enable row level security;
drop policy if exists "ucl teams readable" on public.ucl_teams;
create policy "ucl teams readable" on public.ucl_teams for select using (true);

-- -------------------------------------------------------------- matchdays ---
create table if not exists public.ucl_matchdays (
  matchday    smallint primary key check (matchday between 1 and 8),
  deadline    timestamptz,
  starts_on   date,
  ends_on     date,
  updated_at  timestamptz not null default now()
);

alter table public.ucl_matchdays enable row level security;
drop policy if exists "ucl matchdays readable" on public.ucl_matchdays;
create policy "ucl matchdays readable" on public.ucl_matchdays for select using (true);

-- --------------------------------------------------------------- fixtures ---
create table if not exists public.ucl_fixtures (
  id          uuid primary key default gen_random_uuid(),
  matchday    smallint not null check (matchday between 1 and 8),
  kickoff     timestamptz,
  home_team   text not null,
  away_team   text not null,
  home_score  smallint,
  away_score  smallint,
  status      text not null default 'scheduled'
                check (status in ('scheduled', 'live', 'finished', 'postponed')),
  updated_at  timestamptz not null default now(),
  constraint ucl_fixtures_unique unique (matchday, home_team, away_team)
);

create index if not exists ucl_fixtures_matchday_idx on public.ucl_fixtures (matchday, kickoff);
create index if not exists ucl_fixtures_kickoff_idx on public.ucl_fixtures (kickoff);

alter table public.ucl_fixtures enable row level security;
drop policy if exists "ucl fixtures readable" on public.ucl_fixtures;
create policy "ucl fixtures readable" on public.ucl_fixtures for select using (true);

-- Every scheduled fixture seen from each club's side. Makes "next opponent"
-- a plain lookup instead of a home/away case expression at every call site.
create or replace view public.ucl_team_fixtures as
  select f.id, f.matchday, f.kickoff, f.status,
         f.home_team as team, f.away_team as opponent, true as is_home
  from public.ucl_fixtures f
  union all
  select f.id, f.matchday, f.kickoff, f.status,
         f.away_team as team, f.home_team as opponent, false as is_home
  from public.ucl_fixtures f;

/**
 * Recompute next_opponent / next_difficulty for every player from the next
 * scheduled fixture their club plays.
 *
 * Difficulty is the opponent's strength tier, softened by half a tier at home
 * and hardened by half away, then clamped to 1-5. Deterministic on purpose —
 * this is arithmetic, not something to ask a model for.
 */
create or replace function public.refresh_player_fixtures()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  touched integer;
begin
  with next_fix as (
    select distinct on (tf.team)
           tf.team, tf.opponent, tf.is_home, tf.kickoff
    from public.ucl_team_fixtures tf
    where tf.status = 'scheduled'
      and (tf.kickoff is null or tf.kickoff > now())
    order by tf.team, tf.kickoff nulls last
  ),
  scored as (
    select nf.team,
           nf.opponent,
           greatest(1, least(5, round(
             coalesce(opp.strength, 3) + case when nf.is_home then -0.5 else 0.5 end
           )::int)) as difficulty
    from next_fix nf
    left join public.ucl_teams opp on opp.name = nf.opponent
  )
  update public.ucl_players p
     set next_opponent   = s.opponent,
         next_difficulty = s.difficulty,
         updated_at      = now()
    from scored s
   where p.team = s.team
     and (p.next_opponent is distinct from s.opponent
          or p.next_difficulty is distinct from s.difficulty);

  get diagnostics touched = row_count;
  return touched;
end $$;

-- ------------------------------------------------------------ stats sweep ---
-- Points and form only change after a matchday is played, so they get their own
-- weekly job rather than riding the nightly availability refresh. Kept separate
-- so a stats sweep failing never stops injury news from updating.
create table if not exists public.ucl_stats_runs (
  id               uuid primary key default gen_random_uuid(),
  started_at       timestamptz not null default now(),
  finished_at      timestamptz,
  matchday         smallint,
  status           text not null default 'running'
                     check (status in ('running', 'success', 'partial', 'failed')),
  players_updated  integer not null default 0,
  error            text
);

alter table public.ucl_stats_runs enable row level security;
