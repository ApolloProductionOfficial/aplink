-- Enable full replica identity for realtime to work properly
ALTER TABLE meeting_transcripts REPLICA IDENTITY FULL;

-- Add table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE meeting_transcripts;