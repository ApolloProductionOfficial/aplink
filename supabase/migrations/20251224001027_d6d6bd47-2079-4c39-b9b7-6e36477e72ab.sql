-- Create error_logs table to store error statistics
CREATE TABLE public.error_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  error_type TEXT NOT NULL,
  error_message TEXT NOT NULL,
  source TEXT,
  severity TEXT NOT NULL DEFAULT 'warning',
  details JSONB,
  url TEXT,
  user_agent TEXT,
  user_id UUID,
  notified BOOLEAN NOT NULL DEFAULT false
);

-- Enable RLS
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view error logs
CREATE POLICY "Admins can view all error logs"
ON public.error_logs
FOR SELECT
USING (is_admin());

-- Only admins can delete error logs
CREATE POLICY "Admins can delete error logs"
ON public.error_logs
FOR DELETE
USING (is_admin());

-- Anyone can insert error logs (for frontend error tracking)
CREATE POLICY "Anyone can insert error logs"
ON public.error_logs
FOR INSERT
WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_error_logs_created_at ON public.error_logs (created_at DESC);
CREATE INDEX idx_error_logs_error_type ON public.error_logs (error_type);
CREATE INDEX idx_error_logs_severity ON public.error_logs (severity);