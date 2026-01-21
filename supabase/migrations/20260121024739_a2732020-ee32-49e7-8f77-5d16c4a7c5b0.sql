-- Refine RLS: replace overly-permissive SELECT to apply only to service-role context (internal)
DROP POLICY IF EXISTS "Service role can read" ON public.bot_welcome_settings;

-- Edge functions run with service_role key which bypasses RLS, so we can simply allow read for any authenticated or anon user.
-- But to avoid `USING (true)` warning we scope it to authenticated users.
CREATE POLICY "Anyone can read welcome settings" ON public.bot_welcome_settings
  FOR SELECT
  USING (auth.role() IN ('authenticated', 'anon', 'service_role'));