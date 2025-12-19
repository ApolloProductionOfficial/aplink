-- Drop and recreate INSERT policy with authenticated role
DROP POLICY IF EXISTS "Users can insert their own presence" ON public.user_presence;

CREATE POLICY "Users can insert their own presence"
ON public.user_presence
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Also fix UPDATE policy to use authenticated role
DROP POLICY IF EXISTS "Users can update their own presence" ON public.user_presence;

CREATE POLICY "Users can update their own presence"
ON public.user_presence
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Fix SELECT policy to use authenticated role  
DROP POLICY IF EXISTS "Users can view presence of their contacts" ON public.user_presence;

CREATE POLICY "Users can view presence of their contacts"
ON public.user_presence
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id 
  OR EXISTS (
    SELECT 1 FROM contacts 
    WHERE contacts.user_id = auth.uid() 
    AND contacts.contact_user_id = user_presence.user_id
  )
);