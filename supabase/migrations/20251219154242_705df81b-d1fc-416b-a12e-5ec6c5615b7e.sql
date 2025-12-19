-- Drop restrictive policies and recreate as permissive
DROP POLICY IF EXISTS "Users can view their own contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can add their own contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can delete their own contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can update their own contacts" ON public.contacts;

-- Create permissive policies (default)
CREATE POLICY "Users can view their own contacts"
ON public.contacts
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can add their own contacts"
ON public.contacts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own contacts"
ON public.contacts
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own contacts"
ON public.contacts
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add unique constraint to prevent duplicate contacts
ALTER TABLE public.contacts DROP CONSTRAINT IF EXISTS unique_user_contact;
ALTER TABLE public.contacts ADD CONSTRAINT unique_user_contact UNIQUE (user_id, contact_user_id);