-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Enable RLS on both tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- User roles policies (only admins can see roles, but the security definer function bypasses this)
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

-- Security definer function to check roles (bypasses RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'
  )
$$;

-- Add user_id column to meeting_participants to link to authenticated users
ALTER TABLE public.meeting_participants 
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add owner_user_id column to meeting_transcripts to track who owns the room
ALTER TABLE public.meeting_transcripts 
ADD COLUMN owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Update meeting_participants RLS policies
DROP POLICY IF EXISTS "Anyone can view participants" ON public.meeting_participants;
DROP POLICY IF EXISTS "Anyone can insert participants" ON public.meeting_participants;
DROP POLICY IF EXISTS "Anyone can update participants" ON public.meeting_participants;

-- Admins can view all, users can view their own participation
CREATE POLICY "View participants"
ON public.meeting_participants FOR SELECT
USING (
  public.is_admin() OR 
  user_id = auth.uid() OR 
  user_id IS NULL
);

CREATE POLICY "Anyone can insert participants"
ON public.meeting_participants FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update participants"
ON public.meeting_participants FOR UPDATE
USING (true);

-- Update meeting_transcripts RLS policies  
DROP POLICY IF EXISTS "Anyone can view transcripts" ON public.meeting_transcripts;
DROP POLICY IF EXISTS "Anyone can insert transcripts" ON public.meeting_transcripts;
DROP POLICY IF EXISTS "Anyone can update transcripts" ON public.meeting_transcripts;

-- Admins can view all, users can view transcripts where they participated
CREATE POLICY "View transcripts"
ON public.meeting_transcripts FOR SELECT
USING (
  public.is_admin() OR
  owner_user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.meeting_participants mp
    WHERE mp.room_id = meeting_transcripts.room_id
    AND mp.user_id = auth.uid()
  )
);

CREATE POLICY "Anyone can insert transcripts"
ON public.meeting_transcripts FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update transcripts"
ON public.meeting_transcripts FOR UPDATE
USING (true);

-- Create function to handle new user signup (creates profile automatically)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, email)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$;

-- Trigger for automatic profile creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger for profiles updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();