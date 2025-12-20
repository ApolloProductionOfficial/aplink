-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Users can view participants in their rooms" ON public.meeting_participants;

-- Create a security definer function to check room participation safely
CREATE OR REPLACE FUNCTION public.is_room_participant(check_room_id text, check_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.meeting_participants
    WHERE room_id = check_room_id
      AND user_id = check_user_id
  )
$$;

-- Recreate the policy using the security definer function
CREATE POLICY "Users can view participants in their rooms"
ON public.meeting_participants
FOR SELECT
USING (
  auth.uid() = user_id 
  OR is_admin() 
  OR is_room_participant(room_id, auth.uid())
);