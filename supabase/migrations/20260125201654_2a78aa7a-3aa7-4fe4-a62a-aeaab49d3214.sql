-- Create storage bucket for voice messages
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('voice-messages', 'voice-messages', true, 10485760, ARRAY['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg'])
ON CONFLICT (id) DO NOTHING;

-- RLS policy - anyone can upload voice messages
CREATE POLICY "Anyone can upload voice messages"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'voice-messages');

-- Anyone can read voice messages
CREATE POLICY "Anyone can read voice messages"
ON storage.objects FOR SELECT
USING (bucket_id = 'voice-messages');

-- Anyone can delete their own voice messages (optional cleanup)
CREATE POLICY "Users can delete voice messages"
ON storage.objects FOR DELETE
USING (bucket_id = 'voice-messages');