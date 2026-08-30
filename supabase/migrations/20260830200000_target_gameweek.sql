/**
 * Point every player at the next ACTIONABLE gameweek.
 *
 * The old version took each club's next scheduled kick-off, which is wrong
 * mid-round: with gameweek 2 underway, Arsenal and Aston Villa still had a
 * Monday fixture pending, so they were rated on a game whose deadline had
 * already passed while every other club was rated on gameweek 3. No transfer,
 * captain change or chip can affect a round that has locked, so advice about it
 * is worse than useless - two clubs were being judged on one week and eighteen
 * on another, in the same squad.
 *
 * The target is the earliest gameweek whose deadline is still ahead, falling
 * back to the earliest with an unstarted fixture. A club with no fixture in
 * that round (a blank) correctly gets no opponent and no difficulty, so the
 * fixture term stays neutral rather than inventing a game.
 */
create or replace function public.refresh_player_fixtures(p_competition text default 'UCL')
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  touched integer;
  target  smallint;
begin
  select md.matchday into target
  from public.ucl_matchdays md
  where md.competition = p_competition
    and md.deadline is not null
    and md.deadline > now()
  order by md.deadline
  limit 1;

  if target is null then
    select min(f.matchday) into target
    from public.ucl_fixtures f
    where f.competition = p_competition
      and f.status = 'scheduled'
      and (f.kickoff is null or f.kickoff > now());
  end if;

  if target is null then
    return 0;
  end if;

  -- Clear first, so a club with a blank in the target round does not keep a
  -- stale opponent from the round just played.
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
  target_fix as (
    select tf.team, tf.opponent, tf.is_home, tf.official
    from (
      select f.competition, f.matchday, f.kickoff,
             f.home_team as team, f.away_team as opponent, true as is_home,
             f.home_difficulty as official
      from public.ucl_fixtures f
      union all
      select f.competition, f.matchday, f.kickoff,
             f.away_team as team, f.home_team as opponent, false as is_home,
             f.away_difficulty as official
      from public.ucl_fixtures f
    ) tf
    where tf.competition = p_competition
      and tf.matchday = target
  )
  update public.ucl_players p
     set next_opponent = tfx.opponent,
         next_difficulty = coalesce(
           tfx.official,
           greatest(1, least(5, round(
             coalesce(
               case when p.position in ('GK', 'DEF') then opp.attack_tier
                    else opp.defence_tier end,
               opp.strength, 3
             ) + case when tfx.is_home then -0.5 else 0.5 end
           )::int))
         ),
         updated_at = now()
    from target_fix tfx
    left join tiers opp on opp.name = tfx.opponent
   where p.team = tfx.team
     and p.competition = p_competition;

  get diagnostics touched = row_count;
  return touched;
end $$;

/** The round the advice applies to, so the UI and API agree on one answer. */
create or replace function public.target_gameweek(p_competition text default 'UCL')
returns smallint
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select md.matchday from public.ucl_matchdays md
      where md.competition = p_competition and md.deadline > now()
      order by md.deadline limit 1),
    (select min(f.matchday) from public.ucl_fixtures f
      where f.competition = p_competition and f.status = 'scheduled'
        and (f.kickoff is null or f.kickoff > now()))
  );
$$;
