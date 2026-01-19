-- Create scheduled_calls table for call scheduling
CREATE TABLE public.scheduled_calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID NOT NULL,
  room_name TEXT NOT NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  participants_telegram_ids BIGINT[] DEFAULT '{}',
  description TEXT,
  reminder_sent BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scheduled_calls ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own scheduled calls" 
ON public.scheduled_calls 
FOR SELECT 
USING (auth.uid() = created_by OR is_admin());

CREATE POLICY "Users can create scheduled calls" 
ON public.scheduled_calls 
FOR INSERT 
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own scheduled calls" 
ON public.scheduled_calls 
FOR UPDATE 
USING (auth.uid() = created_by OR is_admin());

CREATE POLICY "Users can delete their own scheduled calls" 
ON public.scheduled_calls 
FOR DELETE 
USING (auth.uid() = created_by OR is_admin());

-- Enable Realtime for call_requests and scheduled_calls
ALTER PUBLICATION supabase_realtime ADD TABLE public.scheduled_calls;