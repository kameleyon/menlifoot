-- Official per-fixture difficulty, where the game publishes one.
--
-- FPL rates every fixture from each side's perspective. That beats the tier we
-- derive from goals for and against, because it is the number the game itself
-- shows managers - so the advice matches what they see in their own app.
alter table public.ucl_fixtures
  add column if not exists home_difficulty smallint check (home_difficulty between 1 and 5),
  add column if not exists away_difficulty smallint check (away_difficulty between 1 and 5);

/**
 * Recompute next_opponent / next_difficulty per player.
 *
 * Prefers the official per-fixture rating when the competition publishes one,
 * and falls back to the position-aware tier derived from club attack/defence
 * for competitions that do not.
 */
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
    select distinct on (tf.team) tf.team, tf.opponent, tf.is_home, tf.official
    from (
      select f.competition, f.status, f.kickoff,
             f.home_team as team, f.away_team as opponent, true as is_home,
             f.home_difficulty as official
      from public.ucl_fixtures f
      union all
      select f.competition, f.status, f.kickoff,
             f.away_team as team, f.home_team as opponent, false as is_home,
             f.away_difficulty as official
      from public.ucl_fixtures f
    ) tf
    where tf.competition = p_competition
      and tf.status = 'scheduled'
      and (tf.kickoff is null or tf.kickoff > now())
    order by tf.team, tf.kickoff nulls last
  )
  update public.ucl_players p
     set next_opponent = nf.opponent,
         next_difficulty = coalesce(
           nf.official,
           greatest(1, least(5, round(
             coalesce(
               case when p.position in ('GK', 'DEF') then opp.attack_tier
                    else opp.defence_tier end,
               opp.strength, 3
             ) + case when nf.is_home then -0.5 else 0.5 end
           )::int))
         ),
         updated_at = now()
    from next_fix nf
    left join tiers opp on opp.name = nf.opponent
   where p.team = nf.team
     and p.competition = p_competition;

  get diagnostics touched = row_count;
  return touched;
end $$;
