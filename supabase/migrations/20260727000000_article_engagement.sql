-- Article engagement additions: bookmarks + comments.
-- (article_likes, articles.view_count, and increment_article_view already exist.)

-- Bookmarks (private to each user)
create table if not exists public.article_bookmarks (
  article_id uuid not null references public.articles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (article_id, user_id)
);
alter table public.article_bookmarks enable row level security;
drop policy if exists "bookmark own read" on public.article_bookmarks;
create policy "bookmark own read" on public.article_bookmarks for select to authenticated using (auth.uid() = user_id);
drop policy if exists "bookmark insert own" on public.article_bookmarks;
create policy "bookmark insert own" on public.article_bookmarks for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "bookmark delete own" on public.article_bookmarks;
create policy "bookmark delete own" on public.article_bookmarks for delete to authenticated using (auth.uid() = user_id);

-- Comments (public read; authed users post/delete their own)
create table if not exists public.article_comments (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
alter table public.article_comments enable row level security;
drop policy if exists "comments readable" on public.article_comments;
create policy "comments readable" on public.article_comments for select using (true);
drop policy if exists "comment insert own" on public.article_comments;
create policy "comment insert own" on public.article_comments for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "comment delete own" on public.article_comments;
create policy "comment delete own" on public.article_comments for delete to authenticated using (auth.uid() = user_id);
create index if not exists article_comments_article_idx on public.article_comments(article_id, created_at desc);
