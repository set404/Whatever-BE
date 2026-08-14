-- Lets a restaurant have a photo and a link (menu/website/maps listing). Both optional.
alter table public.restaurants add column image_url text;
alter table public.restaurants add column website_url text;

-- Bucket for restaurant photos. Created here (not just declared in config.toml,
-- which is local-CLI-only convenience) so it also exists once this migration is
-- pushed to a real hosted project. Public: these are just restaurant snapshots,
-- not sensitive, so the app can store/render the plain public URL instead of
-- managing signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'restaurant-images',
  'restaurant-images',
  true,
  5242880, -- 5 MiB
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

-- Public read comes for free with a public bucket (Storage serves objects
-- directly, bypassing RLS, when the bucket's `public` flag is true). Writes
-- still go through RLS on storage.objects, so uploads need an explicit policy.
create policy "Authenticated users can upload restaurant images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'restaurant-images');
