-- pg_net is not used by the app and cannot be moved out of public schema.
-- Drop it to satisfy the linter warning about extensions in public.
DROP EXTENSION IF EXISTS pg_net;