-- Official FPL game data: prices, points, form, ownership, injuries, deadlines.
--
-- Every 6 hours rather than daily. Prices move on their own schedule as
-- managers transfer players in and out, injury news breaks at any hour, and a
-- price shown on the squad builder that is a day stale is worse than useless
-- when a manager is planning transfers against a deadline.
--
-- To revert: SELECT cron.unschedule('fpl-sync');
do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'email_queue_service_role_key') then
    raise warning 'fpl-sync NOT scheduled: vault secret missing.';
    return;
  end if;

  perform cron.unschedule('fpl-sync') where exists (select 1 from cron.job where jobname = 'fpl-sync');

  perform cron.schedule('fpl-sync', '30 */6 * * *', $job$
    select net.http_post(
      url := 'https://pgxeinqbqyyqvzoevogd.supabase.co/functions/v1/fpl-sync',
      headers := jsonb_build_object('Content-Type','application/json',
        'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets
                                      where name = 'email_queue_service_role_key')),
      body := '{}'::jsonb,
      timeout_milliseconds := 300000);
  $job$);
end $$;
