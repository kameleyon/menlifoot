-- Scope the fantasy functions by competition.
--
-- The old signatures are dropped rather than overloaded: adding a defaulted
-- parameter would leave two candidates for a one-argument call and Postgres
-- would reject it as ambiguous. Defaults keep every existing Champions League
-- caller working unchanged.

drop function if exists public.match_ucl_player(text, text, int);
drop function if exists public.refresh_player_fixtures();
drop function if exists public.ucl_best_picks(int);

-- ------------------------------------------------------- name resolution ---
create or replace function public.match_ucl_player(
  q text,
  pos text default null,
  lim int default 5,
  p_competition text default 'UCL'
)
returns table (
  id uuid, name text, display_name text, team text, team_code text,
  "position" text, price numeric, score real
)
language sql stable security definer set search_path = public
as $$
  select p.id, p.name, p.display_name, p.team, p.team_code, p.position, p.price,
         similarity(p.normalized_name, lower(btrim(q))) as score
  from public.ucl_players p
  where p.competition = p_competition
    and (pos is null or p.position = pos)
    and similarity(p.normalized_name, lower(btrim(q))) > 0.25
  order by score desc, p.total_points desc
  limit greatest(lim, 1);
$$;

-- ---------------------------------------------------- fixture difficulty ---
create or replace function public.refresh_player_fixtures(p_competition text default 'UCL')
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  touched integer;
begin
  with tiers as (
    select t.name, t.strength,
           case when t.avg_goals_scored is null then null
                else ntile(5) over (order by t.avg_goals_scored asc) end as attack_tier,
           case when t.avg_goals_conceded is null then null
                else ntile(5) over (order by t.avg_goals_conceded desc) end as defence_tier
    from public.ucl_teams t
    where t.competition = p_competition
  ),
  next_fix as (
    select distinct on (tf.team) tf.team, tf.opponent, tf.is_home
    from (
      select f.competition, f.status, f.kickoff,
             f.home_team as team, f.away_team as opponent, true as is_home
      from public.ucl_fixtures f
      union all
      select f.competition, f.status, f.kickoff,
             f.away_team as team, f.home_team as opponent, false as is_home
      from public.ucl_fixtures f
    ) tf
    where tf.competition = p_competition
      and tf.status = 'scheduled'
      and (tf.kickoff is null or tf.kickoff > now())
    order by tf.team, tf.kickoff nulls last
  )
  update public.ucl_players p
     set next_opponent = nf.opponent,
         next_difficulty = greatest(1, least(5, round(
           coalesce(
             case when p.position in ('GK', 'DEF') then opp.attack_tier
                  else opp.defence_tier end,
             opp.strength, 3
           ) + case when nf.is_home then -0.5 else 0.5 end
         )::int)),
         updated_at = now()
    from next_fix nf
    left join tiers opp on opp.name = nf.opponent
   where p.team = nf.team
     and p.competition = p_competition;

  get diagnostics touched = row_count;
  return touched;
end $$;

-- --------------------------------------------------------- best picks -----
create or replace function public.ucl_best_picks(
  lim int default 5,
  p_competition text default 'UCL'
)
returns table (
  id uuid, name text, display_name text, team text, "position" text,
  price numeric, form numeric, next_opponent text, next_difficulty smallint,
  jersey_number smallint, clean_sheet_rate numeric, avg_goals_scored numeric,
  goals integer, assists integer, minutes integer,
  score numeric, rank_in_position bigint
)
language sql stable security definer set search_path = public
as $$
  with scored as (
    select p.id, p.name, p.display_name, p.team, p.position, p.price, p.form,
           p.next_opponent, p.next_difficulty, p.jersey_number,
           p.goals, p.assists, p.minutes,
           t.clean_sheet_rate, t.avg_goals_scored,
           (
             0.45 * case
                      when p.position in ('GK', 'DEF') then coalesce(t.clean_sheet_rate, 0.35)
                      else least(1.0, coalesce(t.avg_goals_scored, 1.4) / 3.0)
                    end
             + 0.35 * case when p.next_difficulty is null then 0.5
                           else (5 - p.next_difficulty) / 4.0 end
             + 0.20 * case when p.form is null then 0.5
                           else least(1.0, p.form / 8.0) end
             + 0.08 * case
                        when p.jersey_number is null then 0.35
                        when p.jersey_number <= 11 then 1.0
                        when p.jersey_number <= 23 then 0.75
                        when p.jersey_number <= 31 then 0.5
                        else 0.15
                      end
           )::numeric(6, 4) as score
    from public.ucl_players p
    left join public.ucl_teams t
           on t.name = p.team and t.competition = p.competition
    where p.availability = 'available'
      and p.competition = p_competition
  ),
  ranked as (
    select s.*, row_number() over (
             partition by s.position order by s.score desc, s.jersey_number nulls last, s.name
           ) as rank_in_position
    from scored s
  )
  select r.id, r.name, r.display_name, r.team, r.position, r.price, r.form,
         r.next_opponent, r.next_difficulty, r.jersey_number,
         r.clean_sheet_rate, r.avg_goals_scored, r.goals, r.assists, r.minutes,
         r.score, r.rank_in_position
  from ranked r
  where r.rank_in_position <= greatest(lim, 1)
  order by r.position, r.rank_in_position;
$$;

-- Best picks stays paid-only for UCL, so it remains service_role only.
revoke execute on function public.ucl_best_picks(int, text) from public, anon, authenticated;
grant execute on function public.ucl_best_picks(int, text) to service_role;
