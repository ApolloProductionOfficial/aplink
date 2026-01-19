-- Remove foreign key constraint from call_requests.created_by
ALTER TABLE public.call_requests DROP CONSTRAINT IF EXISTS call_requests_created_by_fkey;

-- Make created_by nullable or allow any UUID (not requiring auth.users reference)
ALTER TABLE public.call_requests ALTER COLUMN created_by DROP NOT NULL;