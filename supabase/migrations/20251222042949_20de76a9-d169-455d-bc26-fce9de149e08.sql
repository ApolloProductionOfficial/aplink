-- Remove any public SELECT policy on site_analytics
-- Keep only admin access for viewing analytics

-- First, let's see what policies exist and drop any public ones
DROP POLICY IF EXISTS "Public can view analytics" ON public.site_analytics;
DROP POLICY IF EXISTS "Anyone can view analytics" ON public.site_analytics;
DROP POLICY IF EXISTS "site_analytics_public_select" ON public.site_analytics;

-- The "Admins can view all analytics" policy should already exist, but let's ensure it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'site_analytics' 
    AND policyname = 'Admins can view all analytics'
  ) THEN
    EXECUTE 'CREATE POLICY "Admins can view all analytics" ON public.site_analytics FOR SELECT USING (is_admin())';
  END IF;
END $$;