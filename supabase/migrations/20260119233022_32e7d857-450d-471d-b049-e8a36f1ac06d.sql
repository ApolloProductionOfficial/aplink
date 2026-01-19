-- Create table for AI analysis history
CREATE TABLE public.ai_analysis_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  analysis TEXT NOT NULL,
  recommendations JSONB,
  code_examples JSONB,
  error_count INTEGER NOT NULL DEFAULT 0,
  pattern_count INTEGER NOT NULL DEFAULT 0,
  trigger_type TEXT NOT NULL DEFAULT 'manual',
  run_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.ai_analysis_history ENABLE ROW LEVEL SECURITY;

-- Only admins can view/manage AI analysis history
CREATE POLICY "Admins can view AI analysis history"
ON public.ai_analysis_history
FOR SELECT
USING (public.is_admin());

CREATE POLICY "Admins can insert AI analysis history"
ON public.ai_analysis_history
FOR INSERT
WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete AI analysis history"
ON public.ai_analysis_history
FOR DELETE
USING (public.is_admin());