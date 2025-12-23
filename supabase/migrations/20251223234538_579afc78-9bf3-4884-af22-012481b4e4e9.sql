-- Drop the problematic policy that exposes share tokens to everyone
DROP POLICY IF EXISTS "Anyone can view active links by token" ON public.shared_meeting_links;

-- Create a more secure policy - only allow viewing via edge function with service role
-- Regular users should only see their own share links
CREATE POLICY "Users can only view their own share links"
ON public.shared_meeting_links
FOR SELECT
USING (auth.uid() = created_by);

-- Enable leaked password protection is done via Supabase dashboard, not SQL

-- Tighten site_analytics INSERT policy to require user_id
DROP POLICY IF EXISTS "Users can only insert their own analytics" ON public.site_analytics;

CREATE POLICY "Users can only insert their own analytics"
ON public.site_analytics
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());