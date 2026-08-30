-- Match on the display name as well as the full name.
--
-- A screenshot shows "Gabriel", but the pool stores the full "Gabriel
-- Magalhaes", so trigram similarity scored a fringe "Joseph Gabriel" higher
-- than the player actually meant. Screenshots always show short names, so the
-- short name has to be searchable.
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
         s.photo_url, s.sim as score
  from scored s
  where s.sim > 0.25
  -- Ties break toward the player who actually plays: a fringe squad member and
  -- a first-teamer can share a surname, and the screenshot means the latter.
  order by s.sim desc, s.total_points desc, s.minutes desc nulls last
  limit greatest(lim, 1);
$$;
