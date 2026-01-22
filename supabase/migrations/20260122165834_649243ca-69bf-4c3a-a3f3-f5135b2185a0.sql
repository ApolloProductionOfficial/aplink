-- Allow service_role to insert anonymous analytics (user_id = null)
CREATE POLICY "Service role can insert anonymous analytics"
ON public.site_analytics FOR INSERT
WITH CHECK (
  (auth.jwt() ->> 'role') = 'service_role'
);

-- Update existing policy to allow null user_id for service_role inserts
-- (The existing policy requires auth.uid() = user_id, which blocks anonymous tracking)