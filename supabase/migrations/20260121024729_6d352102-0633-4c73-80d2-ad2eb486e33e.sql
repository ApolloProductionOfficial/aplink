-- Create table to store custom bot welcome settings
CREATE TABLE public.bot_welcome_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id text,              -- Telegram file_id of the media (cached, reusable)
  caption_ru text,           -- Localized caption for /start (RU)
  caption_en text,           -- Localized caption for /start (EN)
  caption_uk text,           -- Localized caption for /start (UK)
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- We only allow one row in this table (global settings)
ALTER TABLE public.bot_welcome_settings ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins full access" ON public.bot_welcome_settings
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- Service role (edge functions) can read
CREATE POLICY "Service role can read" ON public.bot_welcome_settings
  FOR SELECT
  USING (true);

-- Insert default row (empty, will be updated by first /setwelcome)
INSERT INTO public.bot_welcome_settings (id) VALUES (gen_random_uuid());