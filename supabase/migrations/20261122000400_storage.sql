-- ============================================================================
-- FOMO · 0004 · Storage (fotos)
--  avatars       público   avatars/{user_id}/{arquivo}
--  post-media    PRIVADO   post-media/{user_id}/{post_id}/{arquivo}  → URL assinada
--  event-covers  público   event-covers/{user_id}/{arquivo}
-- Fotos de posts são privadas porque posts podem ser "só seguidores": a leitura
-- segue exatamente a mesma regra do post (can_view_item).
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', true, 2 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp']),
  ('post-media', 'post-media', false, 8 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp']),
  ('event-covers', 'event-covers', true, 4 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ── avatars
-- buckets públicos servem a URL pública sem política de SELECT (evita listagem do bucket)
create policy "avatars_write_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ── post-media
create policy "post_media_upload_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "post_media_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "post_media_read" on storage.objects for select to anon, authenticated
  using (
    bucket_id = 'post-media' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.post_media pm join public.posts p on p.id = pm.post_id
        where pm.storage_path = storage.objects.name
          and p.moderation_status = 'visible'
          and public.can_view_item(auth.uid(), p.author_id, p.visibility)
      )
    )
  );

-- ── event-covers
create policy "event_covers_write_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'event-covers' and (storage.foldername(name))[1] = auth.uid()::text);
