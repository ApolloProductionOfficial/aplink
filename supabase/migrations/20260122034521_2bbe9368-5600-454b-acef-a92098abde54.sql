-- Allow admins to upload bot welcome media to avatars bucket
CREATE POLICY "Admins can upload bot media"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = 'bot'
  AND is_admin()
);

-- Allow admins to update bot media
CREATE POLICY "Admins can update bot media"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = 'bot'
  AND is_admin()
);

-- Allow admins to delete bot media
CREATE POLICY "Admins can delete bot media"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = 'bot'
  AND is_admin()
);