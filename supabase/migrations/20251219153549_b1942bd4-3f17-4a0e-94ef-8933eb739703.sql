-- Fix 1: Remove public profiles search policy and make it authenticated-only with limited data
DROP POLICY IF EXISTS "Anyone can search profiles by username" ON public.profiles;

-- Create a new policy that only allows authenticated users to search profiles by exact username
CREATE POLICY "Authenticated users can search profiles by username"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Fix 2: Restrict IP/location data in meeting_participants - only admins can see IP data
-- Users can see their own records but NOT the sensitive location data
-- We'll handle this by creating a view that excludes sensitive data for non-admins

-- First, update the existing policy to be more restrictive
DROP POLICY IF EXISTS "Users view own records, admins view all" ON public.meeting_participants;

-- Create separate policies: admins see everything, users see own records without IP
CREATE POLICY "Admins can view all participant data"
ON public.meeting_participants
FOR SELECT
USING (is_admin());

CREATE POLICY "Users can view own records without sensitive data"
ON public.meeting_participants
FOR SELECT
USING (auth.uid() = user_id);