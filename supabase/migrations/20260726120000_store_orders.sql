-- Store orders: created at checkout (pending), completed by the Stripe webhook after payment.
create table if not exists public.store_orders (
  id                 uuid primary key default gen_random_uuid(),
  stripe_session_id  text unique,
  status             text not null default 'pending',   -- pending | paid | submitted | failed
  email              text,
  currency           text not null default 'usd',
  amount_total       integer,                            -- cents, incl. shipping
  line_items         jsonb not null,                     -- [{product_id, variant_id, quantity, title, price}]
  shipping_address   jsonb,                              -- {first_name,last_name,email,phone,country,region,address1,address2,city,zip}
  printify_order_id  text,
  error              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.store_orders enable row level security;
-- No public policies: only the service_role (edge functions) may read/write. RLS-on with no policy = deny to anon/authenticated.

create index if not exists store_orders_session_idx on public.store_orders(stripe_session_id);
