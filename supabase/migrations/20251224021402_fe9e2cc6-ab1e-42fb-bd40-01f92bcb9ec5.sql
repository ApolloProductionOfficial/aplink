-- Fix site_analytics INSERT policy to verify user_id matches authenticated user
DROP POLICY IF EXISTS "Users can only insert their own analytics" ON public.site_analytics;

CREATE POLICY "Users can only insert their own analytics"
ON public.site_analytics
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);