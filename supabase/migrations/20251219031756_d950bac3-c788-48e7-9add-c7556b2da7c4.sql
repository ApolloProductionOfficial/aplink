-- 1. Remove email column from profiles (it's already in auth.users)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS email;

-- 2. Drop old permissive policy for user_presence
DROP POLICY IF EXISTS "Anyone can view presence" ON public.user_presence;

-- 3. Create new restrictive policy - users can only see presence of their contacts
CREATE POLICY "Users can view presence of their contacts"
ON public.user_presence
FOR SELECT
USING (
  auth.uid() = user_id -- can see own presence
  OR EXISTS (
    SELECT 1 FROM public.contacts
    WHERE contacts.user_id = auth.uid()
    AND contacts.contact_user_id = user_presence.user_id
  )
);