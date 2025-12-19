-- Drop the problematic view
DROP VIEW IF EXISTS public.meeting_participants_safe;

-- Recreate with security_invoker = true (recommended approach)
-- This makes the view use the caller's permissions, not the owner's
CREATE VIEW public.meeting_participants_safe 
WITH (security_invoker = true)
AS
SELECT 
  id,
  room_id,
  user_id,
  user_name,
  joined_at,
  left_at
FROM public.meeting_participants;

-- Grant access
GRANT SELECT ON public.meeting_participants_safe TO authenticated;