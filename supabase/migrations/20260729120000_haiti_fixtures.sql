-- Upcoming fixtures / calendar for the Haiti national teams (senior + youth).
create table if not exists public.haiti_fixtures (
  id uuid primary key default gen_random_uuid(),
  team text not null,               -- 'senior' | 'u20' | 'u19' | 'u17'
  competition text not null,
  opponent text,                    -- null for a competition window / TBD
  match_date date,                  -- null for a window
  date_label text,                  -- shown when match_date is null (e.g. 'Nov 2026')
  home boolean,                     -- null if unknown
  venue text,
  note text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.haiti_fixtures enable row level security;
drop policy if exists "fixtures readable" on public.haiti_fixtures;
create policy "fixtures readable" on public.haiti_fixtures for select using (true);

-- Seed with the real upcoming schedule (verified July 2026). Idempotent-ish: only seed if empty.
insert into public.haiti_fixtures (team, competition, opponent, match_date, date_label, home, venue, note, sort_order)
select * from (values
  ('u20','Concacaf U-20 Championship','El Salvador','2026-07-31'::date,null,null,'Puebla, Mexico','Group A',10),
  ('u20','Concacaf U-20 Championship',null,null,'Aug 4–5, 2026',null,'Mexico','Quarterfinals (if qualified)',20),
  ('senior','Concacaf Nations League','Trinidad & Tobago','2026-09-24'::date,null,true,null,'League A · Group A',30),
  ('senior','Concacaf Nations League','Costa Rica','2026-09-27'::date,null,false,null,'League A · Group A',40),
  ('senior','Concacaf Nations League','Dominican Republic','2026-10-01'::date,null,false,null,'League A · Group A',50),
  ('senior','Concacaf Nations League','TBD','2026-10-04'::date,null,true,null,'League A · Group A (4th match)',60),
  ('senior','Concacaf Nations League',null,null,'Nov 2026',null,null,'Quarterfinals (home & away)',70),
  ('senior','Nations League Finals',null,null,'Mar 2027',null,'SoFi Stadium, Los Angeles','If qualified',80),
  ('senior','Concacaf Gold Cup 2027',null,null,'Jun–Jul 2027',null,null,'Via Nations League qualification',90),
  ('u17','Concacaf U-17 qualifiers',null,null,'2027',null,null,'Next cycle · dates TBC',100)
) as v(team,competition,opponent,match_date,date_label,home,venue,note,sort_order)
where not exists (select 1 from public.haiti_fixtures);
