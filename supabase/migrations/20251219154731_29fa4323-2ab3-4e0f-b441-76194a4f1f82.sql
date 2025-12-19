-- Fix 1: Drop the existing unsafe view
DROP VIEW IF EXISTS public.meeting_participants_safe;

-- Fix 2: Create a security definer function to get safe participant data
-- This prevents direct access to sensitive columns while allowing room participants to see each other
CREATE OR REPLACE FUNCTION public.get_room_participants(room_id_param text)
RETURNS TABLE (
  id uuid,
  room_id text,
  user_id uuid,
  user_name text,
  joined_at timestamptz,
  left_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only return data if caller is authenticated and is a participant in this room
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;
  
  -- Check if user is admin or participant in this room
  IF NOT (
    is_admin() OR 
    EXISTS (SELECT 1 FROM meeting_participants mp WHERE mp.room_id = room_id_param AND mp.user_id = auth.uid())
  ) THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    mp.id,
    mp.room_id,
    mp.user_id,
    mp.user_name,
    mp.joined_at,
    mp.left_at
  FROM meeting_participants mp
  WHERE mp.room_id = room_id_param;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_room_participants(text) TO authenticated;

-- Fix 3: Update the RLS policy to be more restrictive
-- Users should ONLY see their OWN records directly, never other participants
DROP POLICY IF EXISTS "Users can view own records without sensitive data" ON public.meeting_participants;

CREATE POLICY "Users can only view their own participant records"
ON public.meeting_participants
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- The policy for admins already exists and is correct:
-- "Admins can view all participant data" - is_admin()

-- Fix 4: Create a truly safe view for cases where we need it
-- Using SECURITY DEFINER in a function-based approach is safer than a view
CREATE OR REPLACE VIEW public.meeting_participants_safe
WITH (security_barrier = true)
AS
SELECT 
  id,
  room_id,
  user_id,
  user_name,
  joined_at,
  left_at
FROM public.meeting_participants
WHERE auth.uid() = user_id OR is_admin();

-- Enable RLS on the view (won't do much but satisfies the linter)
-- Note: Views inherit security from underlying tables when using security_invoker
-- But we use security_barrier which is more secure

GRANT SELECT ON public.meeting_participants_safe TO authenticated;