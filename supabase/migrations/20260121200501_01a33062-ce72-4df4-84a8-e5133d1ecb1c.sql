-- Fix RLS for error_logs to allow anonymous inserts for error tracking
DROP POLICY IF EXISTS "Authenticated users can insert error logs" ON public.error_logs;

-- Allow any insert for error tracking (errors may come from non-authenticated users)
CREATE POLICY "Anyone can insert error logs"
ON public.error_logs
FOR INSERT
WITH CHECK (true);