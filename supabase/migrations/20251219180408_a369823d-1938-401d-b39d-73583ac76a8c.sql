-- Create a separate admin-only table for sensitive geo data
CREATE TABLE public.participant_geo_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL,
  ip_address TEXT,
  city TEXT,
  country TEXT,
  country_code TEXT,
  region TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.participant_geo_data ENABLE ROW LEVEL SECURITY;

-- Only admins can view geo data
CREATE POLICY "Only admins can view geo data"
ON public.participant_geo_data
FOR SELECT
USING (is_admin());

-- Only admins can insert geo data (via edge function with service role)
CREATE POLICY "Service role can insert geo data"
ON public.participant_geo_data
FOR INSERT
WITH CHECK (true);

-- Only admins can delete geo data
CREATE POLICY "Only admins can delete geo data"
ON public.participant_geo_data
FOR DELETE
USING (is_admin());

-- Migrate existing geo data to new table
INSERT INTO public.participant_geo_data (participant_id, ip_address, city, country, country_code, region)
SELECT id, ip_address, city, country, country_code, region
FROM public.meeting_participants
WHERE ip_address IS NOT NULL OR city IS NOT NULL OR country IS NOT NULL;

-- Remove sensitive columns from meeting_participants
ALTER TABLE public.meeting_participants 
DROP COLUMN IF EXISTS ip_address,
DROP COLUMN IF EXISTS city,
DROP COLUMN IF EXISTS country,
DROP COLUMN IF EXISTS country_code,
DROP COLUMN IF EXISTS region;