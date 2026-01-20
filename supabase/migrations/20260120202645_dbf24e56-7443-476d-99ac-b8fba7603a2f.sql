-- Add duration to meeting_transcripts for call statistics
ALTER TABLE public.meeting_transcripts ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;

-- Add recording_url column for cloud recordings
ALTER TABLE public.meeting_transcripts ADD COLUMN IF NOT EXISTS recording_url TEXT;

-- Create call_statistics view for efficient querying
CREATE OR REPLACE VIEW public.call_statistics AS
SELECT 
  owner_user_id,
  COUNT(*) as total_calls,
  COALESCE(SUM(duration_seconds), 0) as total_duration_seconds,
  COALESCE(AVG(duration_seconds), 0) as avg_duration_seconds,
  COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as calls_last_week,
  COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as calls_last_month
FROM public.meeting_transcripts
GROUP BY owner_user_id;

-- Create top_contacts view based on quick_call_history
CREATE OR REPLACE VIEW public.top_contacts AS
SELECT 
  user_id,
  target_username,
  target_user_id,
  COUNT(*) as call_count,
  MAX(created_at) as last_called_at
FROM public.quick_call_history
WHERE status = 'notified'
GROUP BY user_id, target_username, target_user_id
ORDER BY call_count DESC;

-- Create storage bucket for call recordings
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('call-recordings', 'call-recordings', false, 104857600, ARRAY['audio/webm', 'audio/mp3', 'audio/mpeg', 'audio/ogg', 'audio/wav'])
ON CONFLICT (id) DO NOTHING;

-- RLS policies for call-recordings bucket
CREATE POLICY "Users can upload their own recordings"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'call-recordings' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own recordings"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'call-recordings' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own recordings"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'call-recordings' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);