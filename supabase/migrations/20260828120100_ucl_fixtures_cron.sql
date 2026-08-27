-- Schedules for fixtures and post-matchday stats.
--
-- Three jobs on three cadences, because the underlying data moves at three
-- different speeds:
--   ucl-sync-players   00:00 daily  — injuries and suspensions (already live)
--   ucl-sync-fixtures  02:00 daily  — schedule + scores; also picks up the rest
--                                     of the league-phase calendar as UEFA
--                                     publishes it after the draw
--   ucl-sync-stats     03:00 Friday — player points and form. Matchdays run
--                                     Tue/Wed/Thu, so one Friday sweep catches
--                                     the whole round. Deliberately NOT nightly:
--                                     a search model re-summarising 984 players
--                                     every night burns credit and invites drift.
--
-- To revert:
--   SELECT cron.unschedule('ucl-sync-fixtures');
--   SELECT cron.unschedule('ucl-sync-stats');

do $$
declare
  has_key boolean;
  fn_url  text := 'https://pgxeinqbqyyqvzoevogd.supabase.co/functions/v1/ucl-sync-fixtures';
begin
  select exists (select 1 from vault.decrypted_secrets where name = 'email_queue_service_role_key')
    into has_key;

  if not has_key then
    raise warning 'UCL fixture crons NOT scheduled: vault secret is missing.';
    return;
  end if;

  perform cron.unschedule('ucl-sync-fixtures')
  where exists (select 1 from cron.job where jobname = 'ucl-sync-fixtures');
  perform cron.unschedule('ucl-sync-stats')
  where exists (select 1 from cron.job where jobname = 'ucl-sync-stats');

  perform cron.schedule('ucl-sync-fixtures', '0 2 * * *', format($job$
    select net.http_post(
      url := %L,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret from vault.decrypted_secrets
          where name = 'email_queue_service_role_key')),
      body := '{"mode":"fixtures"}'::jsonb,
      timeout_milliseconds := 300000);
  $job$, fn_url));

  perform cron.schedule('ucl-sync-stats', '0 3 * * 5', format($job$
    select net.http_post(
      url := %L,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret from vault.decrypted_secrets
          where name = 'email_queue_service_role_key')),
      body := '{"mode":"stats"}'::jsonb,
      timeout_milliseconds := 300000);
  $job$, fn_url));
end $$;
