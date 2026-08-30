-- Return the headshot when resolving a name, so an imported squad shows faces
-- like a built one does. Without it the screenshot path produced slots with a
-- player_id but no photo, and the pitch fell back to initials.
drop function if exists public.match_ucl_player(text, text, int, text);

create or replace function public.match_ucl_player(
  q text,
  pos text default null,
  lim int default 5,
  p_competition text default 'UCL'
)
returns table (
  id uuid, name text, display_name text, team text, team_code text,
  "position" text, price numeric, photo_url text, score real
)
language sql stable security definer set search_path = public
as $$
  select p.id, p.name, p.display_name, p.team, p.team_code, p.position, p.price,
         p.photo_url,
         similarity(p.normalized_name, lower(btrim(q))) as score
  from public.ucl_players p
  where p.competition = p_competition
    and (pos is null or p.position = pos)
    and similarity(p.normalized_name, lower(btrim(q))) > 0.25
  order by score desc, p.total_points desc
  limit greatest(lim, 1);
$$;
