-- Summer 2026 transfer window: four Grenadiers moved club.
--
-- Matched on id rather than name: there are two players called Pierre in the
-- squad (002 Alexandre Pierre, already at Sochaux, and 016 Woodensky Pierre),
-- and Louicius is joining the very club Alexandre Pierre plays for, so a
-- name-based update would have hit the wrong row.
--
-- clubs_history keeps the existing "Club (years)" format: the previous club
-- open-ended "présent" is closed off at 2026 and the new club appended.

-- 016 Woodensky Pierre — Violette AC (HT) -> Forge FC (CA)
update public.haiti_players
   set current_club  = 'Forge FC',
       club_country  = 'Canada',
       clubs_history = 'Real Hope FA (2024-2025) | Violette AC (2021-2023, 2025-2026) | Forge FC (2026-présent)'
 where id = '016';

-- 014 Don Deedson Louicius — FC Dallas (US) -> FC Sochaux-Montbéliard (FR)
update public.haiti_players
   set current_club  = 'FC Sochaux-Montbéliard',
       club_country  = 'France',
       clubs_history = 'Hobro (2019-2023) | OB (2023-2025) | FC Dallas (2025-2026) | Sochaux (2026-présent)'
 where id = '014';

-- 024 Ruben Providence — Almere City (NL) -> Bodrum FK (TR)
update public.haiti_players
   set current_club  = 'Bodrum FK',
       club_country  = 'Turquie',
       clubs_history = 'Roma (2021-2023) | TSV Hartberg (2022-2024) | Almere City (2024-2026) | Bodrum FK (2026-présent)'
 where id = '024';

-- 006 Jean-Kévin Duverne — FC Nantes, on loan at Gent (BE) -> Omonia Nicosie (CY)
update public.haiti_players
   set current_club  = 'Omonia Nicosie',
       club_country  = 'Chypre',
       clubs_history = 'Lens (2014-2019) | Brest (2019-2023) | Nantes (2023-2026) | Kortrijk (prêt 2025) | Gent (prêt 2025-2026) | Omonia Nicosie (2026-présent)'
 where id = '006';
