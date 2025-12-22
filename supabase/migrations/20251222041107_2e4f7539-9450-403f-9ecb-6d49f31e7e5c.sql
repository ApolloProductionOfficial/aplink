-- Fix 1: participant_geo_data - Restrict INSERT to only own participants or admins
DROP POLICY IF EXISTS "Insert geo data for valid participants only" ON public.participant_geo_data;

CREATE POLICY "Insert geo data for own participants only" 
ON public.participant_geo_data 
FOR INSERT 
WITH CHECK (
  -- Only allow inserting geo data for participants that belong to the current user OR if admin
  is_admin() OR EXISTS (
    SELECT 1 FROM meeting_participants mp 
    WHERE mp.id = participant_geo_data.participant_id 
    AND mp.user_id = auth.uid()
  )
);

-- Fix 2: site_analytics - Restrict INSERT to only own analytics
DROP POLICY IF EXISTS "Only authenticated users can insert analytics" ON public.site_analytics;

CREATE POLICY "Users can only insert their own analytics" 
ON public.site_analytics 
FOR INSERT 
WITH CHECK (
  -- user_id must match current user OR be NULL (for anonymous tracking)
  auth.uid() IS NOT NULL AND (user_id IS NULL OR user_id = auth.uid())
);