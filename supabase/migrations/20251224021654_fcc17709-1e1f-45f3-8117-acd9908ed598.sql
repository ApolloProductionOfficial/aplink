-- 1. Create function to validate backup codes without exposing hashes
CREATE OR REPLACE FUNCTION public.validate_backup_code(code_input text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  code_found boolean := false;
  code_id uuid;
BEGIN
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  -- Find matching unused backup code for this user
  SELECT bc.id INTO code_id
  FROM backup_codes bc
  WHERE bc.user_id = auth.uid()
    AND bc.used = false
    AND bc.code_hash = crypt(code_input, bc.code_hash)
  LIMIT 1;

  IF code_id IS NOT NULL THEN
    -- Mark code as used
    UPDATE backup_codes
    SET used = true, used_at = now()
    WHERE id = code_id;
    
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- 2. Create function to clean up old translation history (90 days retention)
CREATE OR REPLACE FUNCTION public.cleanup_old_translation_history()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM translation_history
  WHERE created_at < now() - interval '90 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- 3. Fix shared_meeting_links INSERT policy - allow service role and fix check
DROP POLICY IF EXISTS "Owner can create share links" ON public.shared_meeting_links;

CREATE POLICY "Owner can create share links"
ON public.shared_meeting_links
FOR INSERT
WITH CHECK (
  auth.uid() = created_by 
  AND EXISTS (
    SELECT 1 FROM meeting_transcripts mt
    WHERE mt.id = meeting_id 
    AND mt.owner_user_id = auth.uid()
  )
);