-- Photo storage: one bucket, objects namespaced by owning user id so RLS can
-- scope writes without a join back to things/properties.
-- Path convention: {user_id}/things/{thing_id}.{ext} and {user_id}/properties/{property_id}.{ext}

insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

create policy "photos: public read" on storage.objects
  for select using (bucket_id = 'photos');

create policy "photos: owner write" on storage.objects
  for insert with check (
    bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "photos: owner update" on storage.objects
  for update using (
    bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "photos: owner delete" on storage.objects
  for delete using (
    bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text
  );
