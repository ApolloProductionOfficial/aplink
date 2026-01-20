-- Add Do Not Disturb settings to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS dnd_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS dnd_start_time TIME DEFAULT '22:00',
ADD COLUMN IF NOT EXISTS dnd_end_time TIME DEFAULT '08:00',
ADD COLUMN IF NOT EXISTS dnd_auto_reply TEXT DEFAULT 'Пользователь сейчас недоступен. Попробуйте позже.';

-- Add reminder time to scheduled_calls
ALTER TABLE public.scheduled_calls 
ADD COLUMN IF NOT EXISTS reminder_minutes INTEGER DEFAULT 15;