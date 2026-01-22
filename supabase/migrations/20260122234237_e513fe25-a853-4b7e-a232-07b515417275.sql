-- Create table for LiveKit stats history
CREATE TABLE public.livekit_stats_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  active_rooms integer NOT NULL DEFAULT 0,
  total_participants integer NOT NULL DEFAULT 0,
  total_publishers integer NOT NULL DEFAULT 0,
  active_recordings integer NOT NULL DEFAULT 0,
  estimated_ram_mb integer NOT NULL DEFAULT 0,
  estimated_bandwidth_mbps numeric(10,2) NOT NULL DEFAULT 0,
  room_names text[] DEFAULT '{}'::text[]
);

-- Index for fast 24h queries
CREATE INDEX idx_livekit_stats_history_recorded_at 
  ON public.livekit_stats_history(recorded_at DESC);

-- Enable RLS
ALTER TABLE public.livekit_stats_history ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can view stats history"
  ON public.livekit_stats_history
  FOR SELECT
  USING (is_admin());

CREATE POLICY "Service role can insert stats"
  ON public.livekit_stats_history
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can delete old stats"
  ON public.livekit_stats_history
  FOR DELETE
  USING (is_admin());

-- Auto-cleanup function for records older than 7 days
CREATE OR REPLACE FUNCTION public.cleanup_old_livekit_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.livekit_stats_history 
  WHERE recorded_at < now() - interval '7 days';
  RETURN NEW;
END;
$$;

-- Trigger to auto-cleanup on insert
CREATE TRIGGER trigger_cleanup_livekit_stats
  AFTER INSERT ON public.livekit_stats_history
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.cleanup_old_livekit_stats();