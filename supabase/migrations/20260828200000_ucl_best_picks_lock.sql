-- Fixture analysis is a paid feature, so the RPC stops being callable directly
-- by the browser. It is reached only through the ucl-best-picks edge function,
-- which spends the credits first and then calls it with the service role.
--
-- Revoking from anon/authenticated alone is not enough: Postgres grants EXECUTE
-- on new functions to PUBLIC by default, and PostgREST's roles inherit it.
revoke execute on function public.ucl_best_picks(int) from public;
revoke execute on function public.ucl_best_picks(int) from anon;
revoke execute on function public.ucl_best_picks(int) from authenticated;
grant execute on function public.ucl_best_picks(int) to service_role;
