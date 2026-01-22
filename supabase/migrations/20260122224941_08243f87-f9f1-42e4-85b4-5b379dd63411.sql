-- Create contact_requests table for friend request system
CREATE TABLE public.contact_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL,
  to_user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  UNIQUE(from_user_id, to_user_id)
);

-- Enable RLS
ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can view their incoming and outgoing requests
CREATE POLICY "Users can view their requests" 
ON public.contact_requests 
FOR SELECT 
USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- Users can create requests (not to themselves)
CREATE POLICY "Users can create requests" 
ON public.contact_requests 
FOR INSERT 
WITH CHECK (auth.uid() = from_user_id AND from_user_id != to_user_id);

-- Only the recipient can update status
CREATE POLICY "Recipients can respond to requests" 
ON public.contact_requests 
FOR UPDATE 
USING (auth.uid() = to_user_id)
WITH CHECK (auth.uid() = to_user_id);

-- Sender can delete pending requests (cancel)
CREATE POLICY "Senders can cancel pending requests" 
ON public.contact_requests 
FOR DELETE 
USING (auth.uid() = from_user_id AND status = 'pending');

-- Create indexes for performance
CREATE INDEX idx_contact_requests_from ON public.contact_requests (from_user_id);
CREATE INDEX idx_contact_requests_to ON public.contact_requests (to_user_id);
CREATE INDEX idx_contact_requests_status ON public.contact_requests (status) WHERE status = 'pending';

-- Trigger function to create mutual contacts when request is accepted
CREATE OR REPLACE FUNCTION public.handle_contact_request_accepted()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    -- Set responded_at
    NEW.responded_at := now();
    
    -- Create contact for the sender
    INSERT INTO public.contacts (user_id, contact_user_id)
    VALUES (NEW.from_user_id, NEW.to_user_id)
    ON CONFLICT DO NOTHING;
    
    -- Create reverse contact for the recipient
    INSERT INTO public.contacts (user_id, contact_user_id)
    VALUES (NEW.to_user_id, NEW.from_user_id)
    ON CONFLICT DO NOTHING;
  END IF;
  
  IF NEW.status = 'declined' AND OLD.status = 'pending' THEN
    NEW.responded_at := now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the trigger
CREATE TRIGGER on_contact_request_status_change
BEFORE UPDATE ON public.contact_requests
FOR EACH ROW
EXECUTE FUNCTION public.handle_contact_request_accepted();

-- Add unique constraint to contacts table to prevent duplicates
ALTER TABLE public.contacts 
ADD CONSTRAINT contacts_user_contact_unique UNIQUE (user_id, contact_user_id);