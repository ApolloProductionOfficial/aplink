-- Add media_url column to store the uploaded media URL from admin panel
ALTER TABLE public.bot_welcome_settings 
ADD COLUMN IF NOT EXISTS media_url text DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.bot_welcome_settings.media_url IS 'URL of the welcome media file uploaded via admin panel';