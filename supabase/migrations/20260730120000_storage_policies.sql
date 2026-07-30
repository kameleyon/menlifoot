-- Storage RLS policies (lost during the DB restore). Without these, every upload fails with
-- "new row violates row-level security policy". Admins/editors manage content images; public read.

-- INSERT (upload)
drop policy if exists "content images insert" on storage.objects;
create policy "content images insert" on storage.objects for insert to authenticated
with check (
  bucket_id in ('article-images', 'articles') and
  exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role::text in ('admin', 'editor'))
);

-- UPDATE (replace / upsert)
drop policy if exists "content images update" on storage.objects;
create policy "content images update" on storage.objects for update to authenticated
using (
  bucket_id in ('article-images', 'articles') and
  exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role::text in ('admin', 'editor'))
);

-- DELETE
drop policy if exists "content images delete" on storage.objects;
create policy "content images delete" on storage.objects for delete to authenticated
using (
  bucket_id in ('article-images', 'articles') and
  exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role::text in ('admin', 'editor'))
);

-- Public read (these buckets are public)
drop policy if exists "public read images" on storage.objects;
create policy "public read images" on storage.objects for select
using (bucket_id in ('article-images', 'articles', 'avatars', 'email-assets'));
