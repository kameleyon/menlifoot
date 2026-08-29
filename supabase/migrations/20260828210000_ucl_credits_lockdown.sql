-- grant_credits mints credits, so it must never be reachable from the browser.
--
-- It was defined SECURITY DEFINER with no check on the caller, and Postgres
-- grants EXECUTE on new functions to PUBLIC by default - so any signed-in user
-- could call it through PostgREST and award themselves an unlimited balance.
-- Verified: a test account granted itself 1000 credits before this change.
--
-- Only the webhook (service_role) ever grants. spend_credits stays callable by
-- authenticated users on purpose: it is guarded by its own auth.uid() check, so
-- a user can only ever spend their own balance, and the conditional UPDATE
-- prevents overdrawing.
revoke execute on function public.grant_credits(uuid, integer, text, jsonb) from public;
revoke execute on function public.grant_credits(uuid, integer, text, jsonb) from anon;
revoke execute on function public.grant_credits(uuid, integer, text, jsonb) from authenticated;
grant execute on function public.grant_credits(uuid, integer, text, jsonb) to service_role;

revoke execute on function public.spend_credits(integer, text, jsonb) from public;
revoke execute on function public.spend_credits(integer, text, jsonb) from anon;
grant execute on function public.spend_credits(integer, text, jsonb) to authenticated, service_role;
