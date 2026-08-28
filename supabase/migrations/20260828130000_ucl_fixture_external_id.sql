-- Upstream match id, so a stored fixture can be looked up in the provider's
-- archive for lineups and events once those ingests ship.
alter table public.ucl_fixtures
  add column if not exists external_id text;

create unique index if not exists ucl_fixtures_external_id_uidx
  on public.ucl_fixtures (external_id) where external_id is not null;
