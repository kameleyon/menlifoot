-- Align Premier League club names on the ones the fantasy game uses.
--
-- Squads and club stats came from the sports provider ("Newcastle United"),
-- fixtures now come from the game ("Newcastle"). The two never joined, so eight
-- clubs had no fixture at all and their players were rated with no opponent and
-- no difficulty - Elanga and Bruno Fernandes among them.
--
-- The map is written out rather than fuzzy-matched on purpose: "Man City" and
-- "Man Utd" share their distinctive token, and a near-miss there would rate a
-- squad against the wrong club's fixture.
do $$
declare
  pair text[];
  pairs text[][] := array[
    array['AFC Bournemouth', 'Bournemouth'],
    array['Brighton & Hove Albion', 'Brighton'],
    array['Leeds United', 'Leeds'],
    array['Manchester City', 'Man City'],
    array['Manchester United', 'Man Utd'],
    array['Newcastle United', 'Newcastle'],
    array['Nottingham Forest', 'Nott''m Forest'],
    array['Tottenham Hotspur', 'Spurs'],
    array['Wolverhampton Wanderers', 'Wolves'],
    array['West Ham United', 'West Ham']
  ];
begin
  foreach pair slice 1 in array pairs loop
    -- Only rename when the game actually uses the target name, so a club the
    -- provider spells differently in a future season is left untouched.
    if exists (select 1 from public.ucl_fixtures
               where competition = 'EPL' and (home_team = pair[2] or away_team = pair[2])) then
      update public.ucl_players
         set team = pair[2]
       where competition = 'EPL' and team = pair[1]
         and not exists (
           select 1 from public.ucl_players x
           where x.competition = 'EPL' and x.team = pair[2]
             and x.normalized_name = public.ucl_players.normalized_name
         );
      delete from public.ucl_players
       where competition = 'EPL' and team = pair[1];

      update public.ucl_teams
         set name = pair[2]
       where competition = 'EPL' and name = pair[1]
         and not exists (
           select 1 from public.ucl_teams y where y.competition = 'EPL' and y.name = pair[2]
         );
      delete from public.ucl_teams where competition = 'EPL' and name = pair[1];
    end if;
  end loop;
end $$;

select public.refresh_player_fixtures('EPL');
