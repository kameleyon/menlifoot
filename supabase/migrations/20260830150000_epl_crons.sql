-- Premier League refresh schedule.
--
--   epl-sync all           01:00 daily  - fixtures, results, squads, injuries
--   fantasy-player-stats   04:00 Mon+Fri - per-player goals/assists/minutes/xG
--
-- Player stats run twice weekly rather than nightly: the leaderboards only move
-- after matches, EPL rounds land at the weekend and midweek, and the free plan
-- allows 1,000 requests a day that the squad and fixture sweeps also draw on.
--
-- To revert:
--   SELECT cron.unschedule('epl-sync');
--   SELECT cron.unschedule('fantasy-player-stats');
do $$
declare
  base text := 'https://pgxeinqbqyyqvzoevogd.supabase.co/functions/v1/';
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'email_queue_service_role_key') then
    raise warning 'EPL crons NOT scheduled: vault secret missing.';
    return;
  end if;

  perform cron.unschedule('epl-sync') where exists (select 1 from cron.job where jobname = 'epl-sync');
  perform cron.unschedule('fantasy-player-stats')
    where exists (select 1 from cron.job where jobname = 'fantasy-player-stats');

  perform cron.schedule('epl-sync', '0 1 * * *', format($job$
    select net.http_post(
      url := %L,
      headers := jsonb_build_object('Content-Type','application/json',
        'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets
                                      where name = 'email_queue_service_role_key')),
      body := '{"mode":"all"}'::jsonb,
      timeout_milliseconds := 300000);
  $job$, base || 'epl-sync'));

  perform cron.schedule('fantasy-player-stats', '0 4 * * 1,5', format($job$
    select net.http_post(
      url := %L,
      headers := jsonb_build_object('Content-Type','application/json',
        'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets
                                      where name = 'email_queue_service_role_key')),
      body := '{"season":2026}'::jsonb,
      timeout_milliseconds := 300000);
  $job$, base || 'fantasy-player-stats'));
end $$;
