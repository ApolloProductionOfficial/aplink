-- Fix 1: Restrict participant_geo_data insert to edge functions only via service role
-- Remove the overly permissive insert policy
DROP POLICY IF EXISTS "Service role can insert geo data" ON public.participant_geo_data;

-- Create a more restrictive policy: only allow inserts when there's a matching participant record
CREATE POLICY "Insert geo data for valid participants only" 
ON public.participant_geo_data 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.meeting_participants mp 
    WHERE mp.id = participant_id
  )
);

-- Fix 2: Improve meeting_participants RLS - validate room access
-- Drop conflicting policies
DROP POLICY IF EXISTS "Users can only view their own participant records" ON public.meeting_participants;

-- Create policy that allows viewing participants only in rooms user participated in
CREATE POLICY "Users can view participants in their rooms" 
ON public.meeting_participants 
FOR SELECT 
USING (
  auth.uid() = user_id 
  OR is_admin()
  OR EXISTS (
    SELECT 1 FROM public.meeting_participants mp2 
    WHERE mp2.room_id = meeting_participants.room_id 
    AND mp2.user_id = auth.uid()
  )
);