-- Add auto_record_enabled setting to profiles
ALTER TABLE public.profiles
ADD COLUMN auto_record_enabled boolean NOT NULL DEFAULT true;