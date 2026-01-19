-- Add Telegram fields to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS telegram_id bigint UNIQUE,
ADD COLUMN IF NOT EXISTS telegram_username text;

-- Create call_requests table for individual and group calls
CREATE TABLE public.call_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_name text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  is_group_call boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'ended', 'expired')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '2 minutes')
);

-- Create call_participants table
CREATE TABLE public.call_participants (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  call_request_id uuid REFERENCES public.call_requests(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  telegram_id bigint,
  status text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'accepted', 'declined', 'joined')),
  invited_at timestamp with time zone NOT NULL DEFAULT now(),
  responded_at timestamp with time zone
);

-- Create telegram_activity_log table
CREATE TABLE public.telegram_activity_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  telegram_id bigint,
  action text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX idx_call_requests_created_by ON public.call_requests(created_by);
CREATE INDEX idx_call_requests_status ON public.call_requests(status);
CREATE INDEX idx_call_requests_expires_at ON public.call_requests(expires_at);
CREATE INDEX idx_call_participants_call_request_id ON public.call_participants(call_request_id);
CREATE INDEX idx_call_participants_user_id ON public.call_participants(user_id);
CREATE INDEX idx_call_participants_telegram_id ON public.call_participants(telegram_id);
CREATE INDEX idx_telegram_activity_log_user_id ON public.telegram_activity_log(user_id);
CREATE INDEX idx_telegram_activity_log_telegram_id ON public.telegram_activity_log(telegram_id);
CREATE INDEX idx_telegram_activity_log_action ON public.telegram_activity_log(action);
CREATE INDEX idx_telegram_activity_log_created_at ON public.telegram_activity_log(created_at);
CREATE INDEX idx_profiles_telegram_id ON public.profiles(telegram_id);

-- Enable RLS
ALTER TABLE public.call_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_activity_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for call_requests
CREATE POLICY "Users can view their own call requests"
ON public.call_requests FOR SELECT
USING (created_by = auth.uid() OR EXISTS (
  SELECT 1 FROM public.call_participants cp 
  WHERE cp.call_request_id = id AND cp.user_id = auth.uid()
));

CREATE POLICY "Users can create call requests"
ON public.call_requests FOR INSERT
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update their own call requests"
ON public.call_requests FOR UPDATE
USING (created_by = auth.uid());

CREATE POLICY "Admins can view all call requests"
ON public.call_requests FOR SELECT
USING (public.is_admin());

-- RLS policies for call_participants
CREATE POLICY "Users can view their own participation"
ON public.call_participants FOR SELECT
USING (user_id = auth.uid() OR EXISTS (
  SELECT 1 FROM public.call_requests cr 
  WHERE cr.id = call_request_id AND cr.created_by = auth.uid()
));

CREATE POLICY "Call creators can add participants"
ON public.call_participants FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.call_requests cr 
  WHERE cr.id = call_request_id AND cr.created_by = auth.uid()
));

CREATE POLICY "Participants can update their own status"
ON public.call_participants FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all participants"
ON public.call_participants FOR SELECT
USING (public.is_admin());

-- RLS policies for telegram_activity_log
CREATE POLICY "Users can insert their own activity"
ON public.telegram_activity_log FOR INSERT
WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can view their own activity"
ON public.telegram_activity_log FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all activity"
ON public.telegram_activity_log FOR SELECT
USING (public.is_admin());

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_participants;