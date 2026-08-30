-- Which round is in play, as the game itself reports it.
--
-- Deriving it from deadlines gets the wrong answer mid-round: once gameweek 2's
-- deadline has passed, the next unexpired deadline is gameweek 3, so the
-- calendar skipped straight past the round being played.
alter table public.ucl_matchdays
  add column if not exists is_current boolean not null default false;
