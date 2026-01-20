-- Fix security definer views by setting security_invoker = true
DROP VIEW IF EXISTS public.call_statistics;
DROP VIEW IF EXISTS public.top_contacts;

CREATE VIEW public.call_statistics 
WITH (security_invoker = true) AS
SELECT 
  owner_user_id,
  COUNT(*) as total_calls,
  COALESCE(SUM(duration_seconds), 0) as total_duration_seconds,
  COALESCE(AVG(duration_seconds), 0) as avg_duration_seconds,
  COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as calls_last_week,
  COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as calls_last_month
FROM public.meeting_transcripts
GROUP BY owner_user_id;

CREATE VIEW public.top_contacts 
WITH (security_invoker = true) AS
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