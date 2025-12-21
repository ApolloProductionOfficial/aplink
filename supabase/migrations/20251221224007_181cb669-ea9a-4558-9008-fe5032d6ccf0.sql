-- Create translation history table
CREATE TABLE public.translation_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  room_id TEXT,
  original_text TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  source_language TEXT,
  target_language TEXT NOT NULL,
  voice_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.translation_history ENABLE ROW LEVEL SECURITY;

-- Users can view their own translation history
CREATE POLICY "Users can view their own translations"
ON public.translation_history
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own translations
CREATE POLICY "Users can insert their own translations"
ON public.translation_history
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own translations
CREATE POLICY "Users can delete their own translations"
ON public.translation_history
FOR DELETE
USING (auth.uid() = user_id);

-- Admins can view all translations
CREATE POLICY "Admins can view all translations"
ON public.translation_history
FOR SELECT
USING (is_admin());

-- Create index for faster queries
CREATE INDEX idx_translation_history_user_id ON public.translation_history(user_id);
CREATE INDEX idx_translation_history_created_at ON public.translation_history(created_at DESC);