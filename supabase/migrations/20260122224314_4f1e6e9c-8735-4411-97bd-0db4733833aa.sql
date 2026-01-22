-- Fix security vulnerabilities: Add contact verification to prevent unauthorized data access
-- The issue is that contacts INSERT policy has no restrictions, allowing any user to add any other user as a contact

-- 1. Drop the existing vulnerable INSERT policy for contacts
DROP POLICY IF EXISTS "Users can add their own contacts" ON public.contacts;

-- 2. Create a secure INSERT policy that requires the contact to have given some form of consent
-- For now, we'll add a validation that prevents adding yourself and ensures user_id matches auth.uid()
CREATE POLICY "Users can add contacts with proper validation" 
ON public.contacts 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id AND 
  user_id != contact_user_id
);

-- 3. Update profiles SELECT policy to limit sensitive field exposure
-- Create a more restrictive view policy that hides telegram_id for non-mutual contacts
DROP POLICY IF EXISTS "Users can view profiles of their contacts and own" ON public.profiles;

-- Policy 1: Users can always view their own full profile
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

-- Policy 2: Users can view limited profile info of contacts (mutual or one-way)
-- This allows viewing but the actual restriction of telegram_id should be handled at API/view level
-- For now, allow viewing if the target user has also added them back (mutual contacts)
CREATE POLICY "Users can view mutual contacts profiles" 
ON public.profiles 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM contacts c1
    JOIN contacts c2 ON c1.contact_user_id = c2.user_id AND c1.user_id = c2.contact_user_id
    WHERE c1.user_id = auth.uid() AND c1.contact_user_id = profiles.user_id
  )
);

-- 4. Update user_presence SELECT policy to only allow viewing for mutual contacts
DROP POLICY IF EXISTS "Users can view presence of their contacts" ON public.user_presence;

-- Users can view their own presence
CREATE POLICY "Users can view their own presence" 
ON public.user_presence 
FOR SELECT 
USING (auth.uid() = user_id);

-- Users can view presence only for mutual contacts (both added each other)
CREATE POLICY "Users can view mutual contacts presence" 
ON public.user_presence 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM contacts c1
    JOIN contacts c2 ON c1.contact_user_id = c2.user_id AND c1.user_id = c2.contact_user_id
    WHERE c1.user_id = auth.uid() AND c1.contact_user_id = user_presence.user_id
  )
);

-- 5. Add index to optimize mutual contacts lookup
CREATE INDEX IF NOT EXISTS idx_contacts_mutual_lookup 
ON public.contacts (user_id, contact_user_id);

CREATE INDEX IF NOT EXISTS idx_contacts_reverse_lookup 
ON public.contacts (contact_user_id, user_id);