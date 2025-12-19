-- Fix 1: The view with security_invoker inherits RLS from base table, but scanner still complains
-- Let's recreate without security_invoker since the underlying table has proper RLS
DROP VIEW IF EXISTS public.meeting_participants_safe;

-- Create a function instead of view for safer access
CREATE OR REPLACE FUNCTION public.get_safe_participants_for_room(room_id_param text)
RETURNS TABLE (
  id uuid,
  room_id text,
  user_id uuid,
  user_name text,
  joined_at timestamptz,
  left_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    mp.id,
    mp.room_id,
    mp.user_id,
    mp.user_name,
    mp.joined_at,
    mp.left_at
  FROM meeting_participants mp
  WHERE mp.room_id = room_id_param
    AND (
      mp.user_id = auth.uid() 
      OR EXISTS (SELECT 1 FROM meeting_participants mp2 WHERE mp2.room_id = room_id_param AND mp2.user_id = auth.uid())
      OR is_admin()
    )
$$;

GRANT EXECUTE ON FUNCTION public.get_safe_participants_for_room(text) TO authenticated;

-- Fix 2: user_roles - Add restrictive policies (only admin can manage roles)
CREATE POLICY "Only admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (is_admin());

CREATE POLICY "Only admins can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (is_admin());

CREATE POLICY "Only admins can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (is_admin());

-- Fix 3: profiles - Add DELETE policy (users can delete own profile)
CREATE POLICY "Users can delete their own profile"
ON public.profiles
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Fix 4: user_presence - Add DELETE policy (users can delete own presence)
CREATE POLICY "Users can delete their own presence"
ON public.user_presence
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Fix 5: news - Add admin-only policies for content management
CREATE POLICY "Only admins can insert news"
ON public.news
FOR INSERT
TO authenticated
WITH CHECK (is_admin());

CREATE POLICY "Only admins can update news"
ON public.news
FOR UPDATE
TO authenticated
USING (is_admin());

CREATE POLICY "Only admins can delete news"
ON public.news
FOR DELETE
TO authenticated
USING (is_admin());