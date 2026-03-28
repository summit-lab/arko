-- Create the storage bucket for workspace logos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'workspace-logos',
  'workspace-logos',
  true,
  2097152, -- 2MB limit
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: Allow authenticated users to upload to their workspace folder
CREATE POLICY "workspace_members_upload_logo"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'workspace-logos'
  AND (storage.foldername(name))[1] IN (
    SELECT w.id::text FROM workspaces w
    INNER JOIN workspace_members wm ON wm.workspace_id = w.id
    WHERE wm.user_id = auth.uid()
  )
);

-- RLS: Allow anyone to read logos (public bucket)
CREATE POLICY "public_read_logos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'workspace-logos');

-- RLS: Allow workspace members to update/replace their logo
CREATE POLICY "workspace_members_update_logo"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'workspace-logos'
  AND (storage.foldername(name))[1] IN (
    SELECT w.id::text FROM workspaces w
    INNER JOIN workspace_members wm ON wm.workspace_id = w.id
    WHERE wm.user_id = auth.uid()
  )
);

-- RLS: Allow workspace members to delete their logo
CREATE POLICY "workspace_members_delete_logo"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'workspace-logos'
  AND (storage.foldername(name))[1] IN (
    SELECT w.id::text FROM workspaces w
    INNER JOIN workspace_members wm ON wm.workspace_id = w.id
    WHERE wm.user_id = auth.uid()
  )
);
