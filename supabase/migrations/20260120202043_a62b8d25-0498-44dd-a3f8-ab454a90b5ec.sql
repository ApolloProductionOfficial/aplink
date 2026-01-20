-- Create table for quick call history
CREATE TABLE public.quick_call_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_username TEXT NOT NULL,
  target_user_id UUID,
  room_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'initiated',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.quick_call_history ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own quick call history" 
ON public.quick_call_history 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own quick call history" 
ON public.quick_call_history 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own quick call history" 
ON public.quick_call_history 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_quick_call_history_user_id ON public.quick_call_history(user_id);
CREATE INDEX idx_quick_call_history_created_at ON public.quick_call_history(created_at DESC);