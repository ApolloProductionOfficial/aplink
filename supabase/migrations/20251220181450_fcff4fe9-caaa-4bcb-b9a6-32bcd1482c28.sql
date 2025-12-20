-- Create table for storing 2FA backup codes
CREATE TABLE public.backup_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  code_hash text NOT NULL,
  used boolean NOT NULL DEFAULT false,
  used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.backup_codes ENABLE ROW LEVEL SECURITY;

-- Users can only view their own backup codes
CREATE POLICY "Users can view their own backup codes"
ON public.backup_codes
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own backup codes
CREATE POLICY "Users can insert their own backup codes"
ON public.backup_codes
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update (mark as used) their own backup codes
CREATE POLICY "Users can update their own backup codes"
ON public.backup_codes
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own backup codes
CREATE POLICY "Users can delete their own backup codes"
ON public.backup_codes
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_backup_codes_user_id ON public.backup_codes(user_id);
CREATE INDEX idx_backup_codes_lookup ON public.backup_codes(user_id, used);