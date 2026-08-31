-- Align UEFA's club names with the fixture table's.
--
-- The player pool now comes from UEFA's own fantasy feed, which is
-- authoritative for prices, points and ownership but writes clubs short:
-- "Paris", "Atleti", "Man Utd", "B. Dortmund". The fixture calendar comes from
-- the match archive, which writes them long: "Paris Saint-Germain", "Atletico
-- Madrid", "Manchester United", "Borussia Dortmund". Twenty-five of the
-- thirty-six clubs disagreed, so only 286 of 935 players could be linked to a
-- fixture - and a player with no fixture has no opponent, no difficulty, and
-- drops out of the fixture dimension of the rating entirely.
--
-- Written out by hand rather than matched fuzzily, for the same reason the
-- Premier League map was: trigram similarity is happy to pair "Man City" with
-- "Manchester United", and a wrong club is far worse than an unmatched one. It
-- would rate a player against a fixture someone else is playing.
--
-- Applied to the player pool, since the fixture names are also what the
-- calendar renders and what the crest lookup keys on.
update public.ucl_players p
   set team = m.fixture_name,
       updated_at = now()
  from (values
    ('AEK Athens',      'PAE AEK'),
    ('Atleti',          'Atletico Madrid'),
    ('B. Dortmund',     'Borussia Dortmund'),
    ('Bayern München',  'Bayern Munich'),
    ('Bodø/Glimt',      'FK Bodø/Glimt'),
    ('Club Brugge',     'Club Brugge KV'),
    ('Como',            'Como 1907'),
    ('Fenerbahçe',      'Fenerbahçe SK'),
    ('Feyenoord',       'Feyenoord Rotterdam'),
    ('Galatasaray',     'Galatasaray SK'),
    ('Inter',           'Inter Milan'),
    ('LASK',            'LASK Linz'),
    ('Leipzig',         'RB Leipzig'),
    ('Man City',        'Manchester City'),
    ('Man Utd',         'Manchester United'),
    ('Paris',           'Paris Saint-Germain'),
    ('Porto',           'FC Porto'),
    ('Roma',            'AS Roma'),
    ('S. Bratislava',   'ŠK Slovan Bratislava'),
    ('Sabah',           'Sabah FK'),
    ('Shakhtar',        'FK Shakhtar Donetsk'),
    ('Slavia Praha',    'SK Slavia Praha'),
    ('Sporting CP',     'Sporting Clube de Portugal'),
    ('Stuttgart',       'VfB Stuttgart'),
    ('Viking',          'Viking FK')
  ) as m(uefa_name, fixture_name)
 where p.competition = 'UCL'
   and p.team = m.uefa_name;
