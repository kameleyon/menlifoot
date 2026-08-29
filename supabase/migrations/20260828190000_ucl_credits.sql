-- Credit wallet for the Fantasy UCL analysis features.
--
-- Balance lives in its own row rather than being summed from the ledger on every
-- read: spending happens on a request path that must stay fast, and a running
-- sum over an ever-growing ledger gets slower forever. The ledger is kept
-- alongside it as the audit trail, so any disputed balance can be reconstructed.

create table if not exists public.user_credits (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  balance    integer not null default 0 check (balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_ledger (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  -- Positive grants and top-ups, negative spends.
  delta      integer not null,
  reason     text not null,
  metadata   jsonb,
  created_at timestamptz not null default now()
);

create index if not exists credit_ledger_user_idx
  on public.credit_ledger (user_id, created_at desc);

-- A user may read their own wallet and history; only the spend/grant functions
-- below (security definer) may write, so a client cannot mint itself credits.
alter table public.user_credits enable row level security;
drop policy if exists "own credits readable" on public.user_credits;
create policy "own credits readable" on public.user_credits
  for select to authenticated using (auth.uid() = user_id);

alter table public.credit_ledger enable row level security;
drop policy if exists "own ledger readable" on public.credit_ledger;
create policy "own ledger readable" on public.credit_ledger
  for select to authenticated using (auth.uid() = user_id);

-- --------------------------------------------------------------- granting ---
create or replace function public.grant_credits(
  p_user_id uuid,
  p_amount  integer,
  p_reason  text,
  p_metadata jsonb default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance integer;
begin
  if p_amount <= 0 then
    raise exception 'grant amount must be positive';
  end if;

  insert into public.user_credits (user_id, balance)
  values (p_user_id, p_amount)
  on conflict (user_id) do update
    set balance = public.user_credits.balance + excluded.balance,
        updated_at = now()
  returning balance into new_balance;

  insert into public.credit_ledger (user_id, delta, reason, metadata)
  values (p_user_id, p_amount, p_reason, p_metadata);

  return new_balance;
end $$;

-- --------------------------------------------------------------- spending ---
/**
 * Spend credits for the calling user, atomically.
 *
 * The conditional UPDATE is the whole safety property: balance is decremented
 * only if it is still large enough, in one statement, so two simultaneous
 * requests cannot both pass a "do I have enough?" check and overdraw. Returns
 * the new balance, or -1 when there were not enough credits.
 */
create or replace function public.spend_credits(
  p_amount   integer,
  p_reason   text,
  p_metadata jsonb default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid         uuid := auth.uid();
  new_balance integer;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if p_amount <= 0 then
    raise exception 'spend amount must be positive';
  end if;

  update public.user_credits
     set balance = balance - p_amount,
         updated_at = now()
   where user_id = uid
     and balance >= p_amount
  returning balance into new_balance;

  if new_balance is null then
    return -1;
  end if;

  insert into public.credit_ledger (user_id, delta, reason, metadata)
  values (uid, -p_amount, p_reason, p_metadata);

  return new_balance;
end $$;

-- ------------------------------------------------------- signup grant ------
-- 10 credits, enough for one complete analysis of a squad (optimise 1,
-- captain 1, chips 1, fixtures 2, three transfers 3 = 8) with a little spare.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');

  perform public.grant_credits(new.id, 10, 'signup');

  return new;
end $$;

-- Backfill anyone who registered before credits existed.
insert into public.user_credits (user_id, balance)
select u.id, 10
from auth.users u
where not exists (select 1 from public.user_credits c where c.user_id = u.id)
on conflict (user_id) do nothing;

insert into public.credit_ledger (user_id, delta, reason)
select c.user_id, 10, 'signup_backfill'
from public.user_credits c
where not exists (
  select 1 from public.credit_ledger l
  where l.user_id = c.user_id and l.reason in ('signup', 'signup_backfill')
);
