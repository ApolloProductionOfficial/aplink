-- Drop existing permissive policies on meeting_transcripts
DROP POLICY IF EXISTS "Anyone can insert transcripts" ON public.meeting_transcripts;
DROP POLICY IF EXISTS "Anyone can update transcripts" ON public.meeting_transcripts;
DROP POLICY IF EXISTS "View transcripts" ON public.meeting_transcripts;

-- 1. Only meeting owner can insert transcripts
CREATE POLICY "Owner can insert transcripts"
ON public.meeting_transcripts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = owner_user_id);

-- 2. Only owner or admin can update transcripts
CREATE POLICY "Owner or admin can update transcripts"
ON public.meeting_transcripts
FOR UPDATE
TO authenticated
USING (
  auth.uid() = owner_user_id 
  OR is_admin()
);

-- 3. Only admin can delete transcripts
CREATE POLICY "Admins can delete transcripts"
ON public.meeting_transcripts
FOR DELETE
TO authenticated
USING (is_admin());

-- 4. View: owner, participants, or admin
CREATE POLICY "View own or participated transcripts"
ON public.meeting_transcripts
FOR SELECT
TO authenticated
USING (
  is_admin() 
  OR owner_user_id = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM meeting_participants mp
    WHERE mp.room_id = meeting_transcripts.room_id 
    AND mp.user_id = auth.uid()
  )
);