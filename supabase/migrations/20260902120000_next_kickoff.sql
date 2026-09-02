-- Record when each player's next match actually kicks off.
--
-- A Champions League matchday is not a moment, it is Tuesday to Thursday, and
-- UEFA's own rules turn that into a tactic: "Start with players who play on
-- Tuesday. If they don't get a good score, sub them off before Wednesday's
-- matches." A bench player who plays later than a starter is therefore a live
-- option on that starter, and one who plays earlier is not.
--
-- None of that can be modelled from the opponent alone, which is all the pool
-- carried. The kick-off time is what orders the squad within a round.
alter table public.ucl_players
  add column if not exists next_kickoff timestamptz;

create or replace function public.refresh_player_fixtures(p_competition text default 'UCL')
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  touched integer;
begin
  update public.ucl_players
     set next_opponent = null, next_difficulty = null, next_kickoff = null
   where competition = p_competition
     and (next_opponent is not null or next_difficulty is not null
          or next_kickoff is not null);

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
    select distinct on (u.team) u.team, u.opponent, u.is_home, u.official, u.kickoff
    from upcoming u
    where u.competition = p_competition
      and u.status = 'scheduled'
      and (u.kickoff is null or u.kickoff > now())
    order by u.team, u.kickoff asc nulls last
  )
  update public.ucl_players p
     set next_opponent = nf.opponent,
         next_kickoff = nf.kickoff,
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
