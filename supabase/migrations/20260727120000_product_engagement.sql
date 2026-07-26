-- Product engagement: likes (public counts) + favorites (private wishlist).
-- product_id is the Printify product id (text).

create table if not exists public.product_likes (
  product_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (product_id, user_id)
);
alter table public.product_likes enable row level security;
drop policy if exists "product likes readable" on public.product_likes;
create policy "product likes readable" on public.product_likes for select using (true);
drop policy if exists "product like insert own" on public.product_likes;
create policy "product like insert own" on public.product_likes for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "product like delete own" on public.product_likes;
create policy "product like delete own" on public.product_likes for delete to authenticated using (auth.uid() = user_id);

create table if not exists public.product_favorites (
  product_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (product_id, user_id)
);
alter table public.product_favorites enable row level security;
drop policy if exists "product fav read own" on public.product_favorites;
create policy "product fav read own" on public.product_favorites for select to authenticated using (auth.uid() = user_id);
drop policy if exists "product fav insert own" on public.product_favorites;
create policy "product fav insert own" on public.product_favorites for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "product fav delete own" on public.product_favorites;
create policy "product fav delete own" on public.product_favorites for delete to authenticated using (auth.uid() = user_id);
