-- Create table for tracking meeting participants with IP geolocation
CREATE TABLE public.meeting_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  ip_address TEXT,
  city TEXT,
  country TEXT,
  country_code TEXT,
  region TEXT,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  left_at TIMESTAMP WITH TIME ZONE
);

-- Create table for meeting transcripts
CREATE TABLE public.meeting_transcripts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id TEXT NOT NULL,
  room_name TEXT NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  transcript TEXT,
  summary TEXT,
  key_points JSONB,
  participants JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.meeting_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_transcripts ENABLE ROW LEVEL SECURITY;

-- Allow public read/write for now (since no auth required for APLink)
CREATE POLICY "Anyone can view participants" ON public.meeting_participants FOR SELECT USING (true);
CREATE POLICY "Anyone can insert participants" ON public.meeting_participants FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update participants" ON public.meeting_participants FOR UPDATE USING (true);

CREATE POLICY "Anyone can view transcripts" ON public.meeting_transcripts FOR SELECT USING (true);
CREATE POLICY "Anyone can insert transcripts" ON public.meeting_transcripts FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update transcripts" ON public.meeting_transcripts FOR UPDATE USING (true);

-- Enable realtime for participants
ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_participants;