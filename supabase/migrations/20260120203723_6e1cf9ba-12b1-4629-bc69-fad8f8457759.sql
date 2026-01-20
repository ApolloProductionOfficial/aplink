-- Add voice notification settings to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS voice_preference TEXT DEFAULT 'female' CHECK (voice_preference IN ('female', 'male')),
ADD COLUMN IF NOT EXISTS voice_speed NUMERIC(2,1) DEFAULT 1.0 CHECK (voice_speed >= 0.7 AND voice_speed <= 1.3);