-- Squad number, used to separate first-team players from academy squad fillers.
--
-- Without per-player minutes or form there is nothing to rank team-mates by, so
-- every player at a club scored identically and the best-picks list fell back to
-- alphabetical order - recommending youth players ahead of internationals. A
-- squad number is a weak signal but a real one: 1-31 is broadly first-team,
-- 40+ is broadly academy.
alter table public.ucl_players
  add column if not exists jersey_number smallint;
