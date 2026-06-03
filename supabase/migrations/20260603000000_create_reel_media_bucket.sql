-- Bucket privado para thumbnails de reels re-hosteados (espeja story-media).
-- Las URLs de scontent.cdninstagram.com son firmadas y expiran; re-hostear da
-- una URL estable servida desde el CDN de Supabase (sin re-fetch a Meta, sin 502),
-- y elimina el goteo del optimizer on-demand de next/image en la grilla de reels.
-- La columna public.reels.media_storage_path ya existia (sin uso) en Dev y Prod.
insert into storage.buckets (id, name, public)
values ('reel-media', 'reel-media', false)
on conflict (id) do nothing;

-- Lectura: solo miembros del workspace. El path es `${workspace_id}/${ig_media_id}.jpg`,
-- asi que foldername[1] = workspace_id. Espejo exacto de workspace_members_read_story_media.
drop policy if exists workspace_members_read_reel_media on storage.objects;
create policy workspace_members_read_reel_media on storage.objects
for select
using (
  bucket_id = 'reel-media'
  and (storage.foldername(name))[1] in (
    select workspace_id::text from workspace_members where user_id = auth.uid()
  )
);
