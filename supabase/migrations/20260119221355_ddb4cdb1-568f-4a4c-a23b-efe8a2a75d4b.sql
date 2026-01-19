-- Create diagnostics_history table
CREATE TABLE public.diagnostics_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  trigger_type TEXT NOT NULL DEFAULT 'manual', -- manual, scheduled, cron
  summary JSONB NOT NULL,
  results JSONB NOT NULL,
  fixes JSONB DEFAULT '[]',
  telegram_sent BOOLEAN DEFAULT false,
  run_by TEXT -- user email or 'system'
);

-- Enable RLS
ALTER TABLE public.diagnostics_history ENABLE ROW LEVEL SECURITY;

-- Only admins can view diagnostics history
CREATE POLICY "Admins can view diagnostics history"
ON public.diagnostics_history
FOR SELECT
USING (is_admin());

-- System can insert (edge functions use service role)
CREATE POLICY "Service role can insert diagnostics history"
ON public.diagnostics_history
FOR INSERT
WITH CHECK (true);

-- Add index for faster queries
CREATE INDEX idx_diagnostics_history_created_at ON public.diagnostics_history(created_at DESC);