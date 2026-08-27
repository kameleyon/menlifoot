-- Nightly refresh of the UCL Fantasy player pool.
--
-- Runs at 00:00 UTC, which is ~01:00 CET — comfortably after European
-- kick-offs finish (~22:45 CET), so a matchday's stats land the same night.
-- pg_cron runs in the database timezone (UTC on Supabase); do not assume local.
--
-- Reuses the service_role key that email_infra already stored in vault, so this
-- needs no new secret. pg_net / pg_cron / supabase_vault are installed there too.
--
-- To revert: SELECT cron.unschedule('ucl-sync-players');

do $$
declare
  has_key boolean;
begin
  select exists (select 1 from vault.decrypted_secrets where name = 'email_queue_service_role_key')
    into has_key;

  if not has_key then
    raise warning
      'ucl-sync-players cron NOT scheduled: vault secret "email_queue_service_role_key" is missing. '
      'Store it, then re-run this migration or schedule the job manually.';
    return;
  end if;

  -- Idempotent: drop any previous definition before rescheduling.
  perform cron.unschedule('ucl-sync-players')
  where exists (select 1 from cron.job where jobname = 'ucl-sync-players');

  perform cron.schedule(
    'ucl-sync-players',
    '0 0 * * *',
    $job$
    select net.http_post(
      url := 'https://pgxeinqbqyyqvzoevogd.supabase.co/functions/v1/ucl-sync-players',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret from vault.decrypted_secrets
          where name = 'email_queue_service_role_key'
        )
      ),
      body := '{"mode":"auto"}'::jsonb,
      timeout_milliseconds := 120000
    );
    $job$
  );
end $$;
