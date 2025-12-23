-- Create table for shared meeting links
CREATE TABLE public.shared_meeting_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meeting_transcripts(id) ON DELETE CASCADE,
  share_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Enable RLS
ALTER TABLE public.shared_meeting_links ENABLE ROW LEVEL SECURITY;

-- Owner can create share links for their meetings
CREATE POLICY "Owner can create share links"
ON public.shared_meeting_links
FOR INSERT
WITH CHECK (
  auth.uid() = created_by 
  AND EXISTS (
    SELECT 1 FROM public.meeting_transcripts 
    WHERE id = meeting_id AND owner_user_id = auth.uid()
  )
);

-- Owner can view their share links
CREATE POLICY "Owner can view share links"
ON public.shared_meeting_links
FOR SELECT
USING (auth.uid() = created_by);

-- Owner can delete their share links
CREATE POLICY "Owner can delete share links"
ON public.shared_meeting_links
FOR DELETE
USING (auth.uid() = created_by);

-- Anyone can view active share links by token (for public access)
CREATE POLICY "Anyone can view active links by token"
ON public.shared_meeting_links
FOR SELECT
USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

-- Create index for fast token lookup
CREATE INDEX idx_shared_meeting_links_token ON public.shared_meeting_links(share_token);
CREATE INDEX idx_shared_meeting_links_meeting ON public.shared_meeting_links(meeting_id);