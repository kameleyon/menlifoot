-- Player headshot, so the pitch shows faces rather than initials.
--
-- Two sources: the FPL game publishes an official photo keyed on its own player
-- code, and the sports provider returns a headshot_url on its player rows.
alter table public.ucl_players
  add column if not exists photo_url text;
