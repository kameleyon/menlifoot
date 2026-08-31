-- Point every player at their club's next MATCH, not at the next round.
--
-- The old version chose one target matchday for the whole competition and gave
-- every club its fixture inside it. That is wrong for most of the time a round
-- is open, because a round is not a moment:
--
--   * A Champions League round runs Tuesday to Thursday. On Wednesday the
--     clubs who played Tuesday were still advertising Tuesday's opponent as
--     "next", so their captaincy and fixture scores were computed against a
--     game that had already finished.
--   * The Premier League is the same shape, Friday to Monday.
--   * A club with no fixture in the target round got null even when it had a
--     perfectly good match in the round after.
--
-- Picking the earliest scheduled kick-off per club instead makes the answer
-- per-club and per-match, which is what "next opponent" claims to mean and
-- what the transfer and captain advice reads. Clubs roll forward
-- independently as their own game finishes, so a round in progress no longer
-- freezes half the pool on a played fixture.
create or replace function public.refresh_player_fixtures(p_competition text default 'UCL')
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  touched integer;
begin
  -- Clear first, so a club with nothing left to play stops carrying the
  -- opponent it last faced.
  update public.ucl_players
     set next_opponent = null, next_difficulty = null
   where competition = p_competition
     and (next_opponent is not null or next_difficulty is not null);

  with tiers as (
    select t.name, t.strength,
           case when t.avg_goals_scored is null then null
                else ntile(5) over (order by t.avg_goals_scored asc) end as attack_tier,
           case when t.avg_goals_conceded is null then null
                else ntile(5) over (order by t.avg_goals_conceded desc) end as defence_tier
    from public.ucl_teams t
    where t.competition = p_competition
  ),
  upcoming as (
    select f.competition, f.kickoff, f.status,
           f.home_team as team, f.away_team as opponent, true as is_home,
           f.home_difficulty as official
    from public.ucl_fixtures f
    union all
    select f.competition, f.kickoff, f.status,
           f.away_team as team, f.home_team as opponent, false as is_home,
           f.away_difficulty as official
    from public.ucl_fixtures f
  ),
  next_fix as (
    -- One row per club: the earliest kick-off still to come. A fixture with no
    -- kick-off time yet sorts last rather than being dropped, so a club whose
    -- only remaining match is unscheduled still gets an opponent.
    select distinct on (u.team) u.team, u.opponent, u.is_home, u.official
    from upcoming u
    where u.competition = p_competition
      and u.status = 'scheduled'
      and (u.kickoff is null or u.kickoff > now())
    order by u.team, u.kickoff asc nulls last
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
end $function$;
