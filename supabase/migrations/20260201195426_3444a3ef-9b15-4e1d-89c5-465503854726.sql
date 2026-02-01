-- Change default value of auto_record_enabled to false (opt-in instead of opt-out)
ALTER TABLE public.profiles ALTER COLUMN auto_record_enabled SET DEFAULT false;