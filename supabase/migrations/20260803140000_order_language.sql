-- Store the language the order was placed in (for localized emails + admin display).
alter table public.store_orders add column if not exists language text;
alter table public.order_status add column if not exists language text;
