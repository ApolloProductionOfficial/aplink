-- Add unique username column to profiles
ALTER TABLE public.profiles 
ADD COLUMN username text UNIQUE;

-- Create index for faster username lookups
CREATE INDEX idx_profiles_username ON public.profiles (username);

-- Add constraint for username format (lowercase, alphanumeric, underscores, 3-20 chars)
ALTER TABLE public.profiles 
ADD CONSTRAINT username_format CHECK (
  username IS NULL OR (
    username ~ '^[a-z0-9_]{3,20}$'
  )
);

-- Allow users to view profiles by username (for contact search)
CREATE POLICY "Anyone can search profiles by username"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);