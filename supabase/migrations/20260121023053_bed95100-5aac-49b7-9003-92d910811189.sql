-- Add bot_language column to profiles table for syncing with Telegram bot language
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bot_language text DEFAULT 'ru';

-- Add comment
COMMENT ON COLUMN public.profiles.bot_language IS 'Bot language preference (ru/en/uk)';