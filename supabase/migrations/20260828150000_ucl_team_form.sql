-- Attacking and defensive profile per club, used for position-aware fixture
-- difficulty. All free from the provider's team-stats route.
alter table public.ucl_teams
  add column if not exists avg_goals_scored   numeric(5, 3),
  add column if not exists avg_goals_conceded numeric(5, 3),
  add column if not exists clean_sheet_rate   numeric(5, 3),
  add column if not exists form_string        text,
  add column if not exists matches_played     integer;

/**
 * Recompute next_opponent / next_difficulty per player.
 *
 * Difficulty is position-aware, because a hard fixture means different things
 * to different players: a striker cares how well the opponent DEFENDS, a
 * keeper or defender cares how well the opponent ATTACKS. Scoring both off one
 * team-strength number told defenders that a leaky, dangerous side was an easy
 * game.
 *
 * Tiers come from ntile(5) across the field so the 1-5 scale always spreads,
 * whatever the absolute goal rates look like. Clubs with no stats fall back to
 * their strength rating.
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
  with tiers as (
    select t.name,
           t.strength,
           -- 5 = scores the most, so hardest for a keeper or defender to face
           case when t.avg_goals_scored is null then null
                else ntile(5) over (order by t.avg_goals_scored asc) end as attack_tier,
           -- 5 = concedes the least, so hardest for a midfielder or forward
           case when t.avg_goals_conceded is null then null
                else ntile(5) over (order by t.avg_goals_conceded desc) end as defence_tier
    from public.ucl_teams t
  ),
  next_fix as (
    select distinct on (tf.team)
           tf.team, tf.opponent, tf.is_home
    from public.ucl_team_fixtures tf
    where tf.status = 'scheduled'
      and (tf.kickoff is null or tf.kickoff > now())
    order by tf.team, tf.kickoff nulls last
  )
  update public.ucl_players p
     set next_opponent   = nf.opponent,
         next_difficulty = greatest(1, least(5, round(
           coalesce(
             case when p.position in ('GK', 'DEF') then opp.attack_tier
                  else opp.defence_tier end,
             opp.strength,
             3
           ) + case when nf.is_home then -0.5 else 0.5 end
         )::int)),
         updated_at = now()
    from next_fix nf
    left join tiers opp on opp.name = nf.opponent
   where p.team = nf.team;

  get diagnostics touched = row_count;
  return touched;
end $$;
