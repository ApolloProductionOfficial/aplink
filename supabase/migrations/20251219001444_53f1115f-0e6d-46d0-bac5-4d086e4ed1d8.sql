-- Drop existing policies on meeting_participants
DROP POLICY IF EXISTS "Anyone can insert participants" ON public.meeting_participants;
DROP POLICY IF EXISTS "Anyone can update participants" ON public.meeting_participants;
DROP POLICY IF EXISTS "View participants" ON public.meeting_participants;

-- Create strict policies

-- 1. Only authenticated users can insert their own records
CREATE POLICY "Users can insert their own participant record"
ON public.meeting_participants
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 2. Users can only update their own records (e.g., left_at timestamp)
CREATE POLICY "Users can update their own participant record"
ON public.meeting_participants
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 3. Users can view their own records, admins can view all
CREATE POLICY "Users view own records, admins view all"
ON public.meeting_participants
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id 
  OR is_admin()
);

-- 4. Admins can delete records
CREATE POLICY "Admins can delete participant records"
ON public.meeting_participants
FOR DELETE
TO authenticated
USING (is_admin());