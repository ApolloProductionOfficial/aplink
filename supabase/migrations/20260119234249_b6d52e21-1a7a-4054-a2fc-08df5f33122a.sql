-- Fix infinite recursion in call_requests policy
-- The issue is self-referencing: cp.call_request_id = cp.id (should be = call_requests.id)

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view their own call requests" ON public.call_requests;

-- Create a security definer function to check if user is a participant
CREATE OR REPLACE FUNCTION public.is_call_participant(call_id uuid, check_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.call_participants cp
    WHERE cp.call_request_id = call_id AND cp.user_id = check_user_id
  )
$$;

-- Recreate the policy using the function
CREATE POLICY "Users can view their own call requests" 
ON public.call_requests 
FOR SELECT 
USING (
  created_by = auth.uid() 
  OR public.is_call_participant(id, auth.uid())
);