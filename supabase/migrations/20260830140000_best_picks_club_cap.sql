-- Cap the best-picks list at two players per club, per position.
--
-- Without it the list collapses onto whichever club has the best profile and an
-- easy fixture: one run returned Manchester City for all four positions and
-- both slots. That is not advice a manager can act on - fantasy games cap a
-- squad at three players from any one club - and it hides every other good
-- option behind a single team's fixture.
create or replace function public.ucl_best_picks(
  lim int default 5,
  p_competition text default 'UCL'
)
returns table (
  id uuid, name text, display_name text, team text, "position" text,
  price numeric, form numeric, next_opponent text, next_difficulty smallint,
  jersey_number smallint, clean_sheet_rate numeric, avg_goals_scored numeric,
  goals integer, assists integer, minutes integer,
  score numeric, rank_in_position bigint
)
language sql stable security definer set search_path = public
as $$
  with scored as (
    select p.id, p.name, p.display_name, p.team, p.position, p.price, p.form,
           p.next_opponent, p.next_difficulty, p.jersey_number,
           p.goals, p.assists, p.minutes,
           t.clean_sheet_rate, t.avg_goals_scored,
           (
             0.45 * case
                      when p.position in ('GK', 'DEF') then coalesce(t.clean_sheet_rate, 0.35)
                      else least(1.0, coalesce(t.avg_goals_scored, 1.4) / 3.0)
                    end
             + 0.35 * case when p.next_difficulty is null then 0.5
                           else (5 - p.next_difficulty) / 4.0 end
             + 0.20 * case when p.form is null then 0.5
                           else least(1.0, p.form / 8.0) end
             + 0.08 * case
                        when p.jersey_number is null then 0.35
                        when p.jersey_number <= 11 then 1.0
                        when p.jersey_number <= 23 then 0.75
                        when p.jersey_number <= 31 then 0.5
                        else 0.15
                      end
           )::numeric(6, 4) as score
    from public.ucl_players p
    left join public.ucl_teams t
           on t.name = p.team and t.competition = p.competition
    where p.availability = 'available'
      and p.competition = p_competition
  ),
  per_club as (
    select s.*,
           row_number() over (
             partition by s.position, s.team
             order by s.score desc, s.jersey_number nulls last, s.name
           ) as rank_in_club
    from scored s
  ),
  ranked as (
    select c.*,
           row_number() over (
             partition by c.position
             order by c.score desc, c.jersey_number nulls last, c.name
           ) as rank_in_position
    from per_club c
    where c.rank_in_club <= 2
  )
  select r.id, r.name, r.display_name, r.team, r.position, r.price, r.form,
         r.next_opponent, r.next_difficulty, r.jersey_number,
         r.clean_sheet_rate, r.avg_goals_scored, r.goals, r.assists, r.minutes,
         r.score, r.rank_in_position
  from ranked r
  where r.rank_in_position <= greatest(lim, 1)
  order by r.position, r.rank_in_position;
$$;

revoke execute on function public.ucl_best_picks(int, text) from public, anon, authenticated;
grant execute on function public.ucl_best_picks(int, text) to service_role;
