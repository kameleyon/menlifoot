-- Refresh the Premier League pool hourly instead of every six hours.
--
-- Most of what this feed carries barely moves between syncs: prices drift over
-- days, and points, minutes and per-game rates only change when a match ends.
-- Availability is the exception. A player ruled out at a Friday press
-- conference is the single input that can turn a captaincy from the best pick
-- in the squad into zero, and on a six-hour cycle that news could sit unseen
-- until after a deadline had passed.
--
-- Hourly costs nothing worth counting. bootstrap-static is one unauthenticated
-- request against an endpoint built for a few million managers refreshing it
-- on matchday, so there is no rate limit to respect and no key to burn.
--
-- The Champions League side cannot follow suit: UEFA refuses this runtime, so
-- it is pushed in from a GitHub runner instead. See
-- .github/workflows/uefa-fantasy-sync.yml.
select cron.alter_job(
  (select jobid from cron.job where jobname = 'fpl-sync'),
  schedule := '7 * * * *'
);
