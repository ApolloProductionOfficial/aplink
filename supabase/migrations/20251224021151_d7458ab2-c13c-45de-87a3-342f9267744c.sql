-- Fix security: require authentication for error_logs insertion
DROP POLICY IF EXISTS "Anyone can insert error logs" ON public.error_logs;

CREATE POLICY "Authenticated users can insert error logs"
ON public.error_logs
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);