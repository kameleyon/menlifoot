-- Return availability when resolving a name, so an imported squad can show
-- which players are injured. Without it the pitch had no way to know, and a
-- manager could be looking at an XI with an unavailable starter in it.
-- The return type changes, and Postgres refuses to replace a function whose
-- signature differs - it fails rather than swapping it, so the drop is required
-- or the old version silently stays in place.
drop function if exists public.match_ucl_player(text, text, int, text);

create or replace function public.match_ucl_player(
  q text,
  pos text default null,
  lim int default 5,
  p_competition text default 'UCL'
)
returns table (
  id uuid, name text, display_name text, team text, team_code text,
  "position" text, price numeric, photo_url text,
  availability text, availability_note text, score real
)
language sql stable security definer set search_path = public
as $$
  with scored as (
    select p.*,
           greatest(
             similarity(p.normalized_name, lower(btrim(q))),
             similarity(lower(btrim(coalesce(p.display_name, ''))), lower(btrim(q)))
           ) as sim
    from public.ucl_players p
    where p.competition = p_competition
      and (pos is null or p.position = pos)
  )
  select s.id, s.name, s.display_name, s.team, s.team_code, s.position, s.price,
         s.photo_url, s.availability, s.availability_note, s.sim as score
  from scored s
  where s.sim > 0.25
  order by s.sim desc, s.total_points desc, s.minutes desc nulls last
  limit greatest(lim, 1);
$$;
