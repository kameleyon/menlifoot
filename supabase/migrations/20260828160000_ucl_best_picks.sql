/**
 * Best players to own for the upcoming matchday.
 *
 * Deterministic and computed in SQL: no model call, so the panel is instant and
 * costs nothing to open, and the same inputs always produce the same list.
 *
 * Position decides what a "good fixture" means, exactly as fixture difficulty
 * does: a keeper or defender wants an opponent that rarely scores, a forward
 * wants one that concedes. Where the schedule is not yet published the fixture
 * term falls to neutral and the ranking leans on club quality, which is real
 * data we hold rather than a guess.
 */
create or replace function public.ucl_best_picks(lim int default 5)
returns table (
  id uuid,
  name text,
  display_name text,
  team text,
  "position" text,
  price numeric,
  form numeric,
  next_opponent text,
  next_difficulty smallint,
  jersey_number smallint,
  clean_sheet_rate numeric,
  avg_goals_scored numeric,
  score numeric,
  rank_in_position bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with scored as (
    select p.id, p.name, p.display_name, p.team, p.position, p.price, p.form,
           p.next_opponent, p.next_difficulty, p.jersey_number,
           t.clean_sheet_rate, t.avg_goals_scored,
           (
             -- Club quality, read through the lens of the player's position.
             0.45 * case
                      when p.position in ('GK', 'DEF')
                        then coalesce(t.clean_sheet_rate, 0.35)
                      else least(1.0, coalesce(t.avg_goals_scored, 1.4) / 3.0)
                    end
             -- An easier fixture is better; neutral while the schedule is unknown.
             + 0.35 * case
                        when p.next_difficulty is null then 0.5
                        else (5 - p.next_difficulty) / 4.0
                      end
             -- Recent form, neutral until the season produces any.
             + 0.20 * case
                        when p.form is null then 0.5
                        else least(1.0, p.form / 8.0)
                      end
             -- Squad number as a first-team proxy. Deliberately small: it only
             -- breaks ties between club-mates who are otherwise identical,
             -- which without per-player data is every club-mate. Without it the
             -- list sorted alphabetically and put academy players top.
             + 0.08 * case
                        when p.jersey_number is null then 0.35
                        when p.jersey_number <= 11 then 1.0
                        when p.jersey_number <= 23 then 0.75
                        when p.jersey_number <= 31 then 0.5
                        else 0.15
                      end
           )::numeric(6, 4) as score
    from public.ucl_players p
    left join public.ucl_teams t on t.name = p.team
    where p.availability = 'available'
  ),
  ranked as (
    select s.*,
           row_number() over (partition by s.position order by s.score desc, s.name) as rank_in_position
    from scored s
  )
  select r.id, r.name, r.display_name, r.team, r.position, r.price, r.form,
         r.next_opponent, r.next_difficulty, r.jersey_number,
         r.clean_sheet_rate, r.avg_goals_scored,
         r.score, r.rank_in_position
  from ranked r
  where r.rank_in_position <= greatest(lim, 1)
  order by r.position, r.rank_in_position;
$$;
