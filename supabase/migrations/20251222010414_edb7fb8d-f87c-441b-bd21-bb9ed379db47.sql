-- Allow guest participants by making user_id nullable
ALTER TABLE public.meeting_participants
  ALTER COLUMN user_id DROP NOT NULL;

-- In case an old FK to auth.users still exists, drop it (guests won't have auth.users rows)
ALTER TABLE public.meeting_participants
  DROP CONSTRAINT IF EXISTS meeting_participants_user_id_fkey;