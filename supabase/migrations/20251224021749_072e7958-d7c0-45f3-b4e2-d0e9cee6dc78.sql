-- Fix: Allow admins to create share links for any meeting
DROP POLICY IF EXISTS "Owner can create share links" ON public.shared_meeting_links;

CREATE POLICY "Owner or admin can create share links"
ON public.shared_meeting_links
FOR INSERT
WITH CHECK (
  -- Admin can create for any meeting
  is_admin()
  OR
  -- Owner can create for their own meetings
  (
    auth.uid() = created_by 
    AND EXISTS (
      SELECT 1 FROM meeting_transcripts mt
      WHERE mt.id = meeting_id 
      AND mt.owner_user_id = auth.uid()
    )
  )
);

-- Also allow admins to update and delete share links
DROP POLICY IF EXISTS "Owner can delete share links" ON public.shared_meeting_links;
CREATE POLICY "Owner or admin can delete share links"
ON public.shared_meeting_links
FOR DELETE
USING (auth.uid() = created_by OR is_admin());

-- Add UPDATE policy for admins
CREATE POLICY "Owner or admin can update share links"
ON public.shared_meeting_links
FOR UPDATE
USING (auth.uid() = created_by OR is_admin());