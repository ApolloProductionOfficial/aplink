-- Fix: Prevent anonymous inserts by requiring user_id to be NOT NULL
-- First, delete any existing records with NULL user_id (if any)
DELETE FROM public.meeting_participants WHERE user_id IS NULL;

-- Make user_id NOT NULL to prevent anonymous inserts
ALTER TABLE public.meeting_participants 
ALTER COLUMN user_id SET NOT NULL;