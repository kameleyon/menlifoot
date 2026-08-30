-- Signals that let the rating stop over-trusting a two-game sample.
--
-- starts: a player who is not starting cannot score, however good he is.
-- points_per_game / ict_index: FPL's own per-appearance and involvement
-- measures, which are steadier than a 30-day form figure this early.
alter table public.ucl_players
  add column if not exists starts          smallint,
  add column if not exists points_per_game numeric(5, 2),
  add column if not exists ict_index       numeric(6, 1),
  add column if not exists ep_next         numeric(5, 2);
