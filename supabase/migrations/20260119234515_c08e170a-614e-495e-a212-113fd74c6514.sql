-- Create table for data backups before critical operations
CREATE TABLE public.data_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  operation_type text NOT NULL, -- e.g., 'cleanup_errors', 'cleanup_participants', 'diagnostics_fix'
  table_name text NOT NULL,
  records_count integer NOT NULL DEFAULT 0,
  backup_data jsonb NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  restored_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days')
);

-- Enable RLS
ALTER TABLE public.data_backups ENABLE ROW LEVEL SECURITY;

-- Only admins can view and manage backups
CREATE POLICY "Admins can manage backups" 
ON public.data_backups 
FOR ALL 
USING (public.is_admin());

-- Add index for faster queries
CREATE INDEX idx_data_backups_operation ON public.data_backups(operation_type, created_at DESC);
CREATE INDEX idx_data_backups_expires ON public.data_backups(expires_at);

-- Function to create backup before deletion
CREATE OR REPLACE FUNCTION public.create_backup_before_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  backup_id uuid;
  op_type text;
BEGIN
  -- Determine operation type based on table
  op_type := 'delete_' || TG_TABLE_NAME;
  
  -- Insert backup record with the deleted row
  INSERT INTO public.data_backups (operation_type, table_name, records_count, backup_data)
  VALUES (op_type, TG_TABLE_NAME, 1, to_jsonb(OLD))
  RETURNING id INTO backup_id;
  
  RETURN OLD;
END;
$$;

-- Add trigger for error_logs cleanup
CREATE TRIGGER backup_before_error_log_delete
BEFORE DELETE ON public.error_logs
FOR EACH ROW
EXECUTE FUNCTION public.create_backup_before_delete();

-- Add trigger for meeting_participants cleanup  
CREATE TRIGGER backup_before_participant_delete
BEFORE DELETE ON public.meeting_participants
FOR EACH ROW
EXECUTE FUNCTION public.create_backup_before_delete();

-- Add trigger for translation_history cleanup
CREATE TRIGGER backup_before_translation_delete
BEFORE DELETE ON public.translation_history
FOR EACH ROW
EXECUTE FUNCTION public.create_backup_before_delete();

-- Function to cleanup expired backups (older than 30 days)
CREATE OR REPLACE FUNCTION public.cleanup_expired_backups()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.data_backups
  WHERE expires_at < now();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;