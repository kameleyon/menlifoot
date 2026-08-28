-- Club crest and Elo rating.
--
-- Both are nullable on purpose. The provider carries crests for roughly two
-- thirds of the league-phase field and Elo for 21 of 36, so the UI falls back
-- to an initials chip and strength falls back to the ranked estimate rather
-- than the whole field dropping to whatever the weakest source can supply.
alter table public.ucl_teams
  add column if not exists logo_url text,
  add column if not exists elo_rating numeric(7, 1);
