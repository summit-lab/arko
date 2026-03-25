-- ============================================================
-- Migration 16: Fix infinite recursion in profiles RLS
-- The "Admin can view all profiles" policy was doing a direct
-- SELECT on profiles to check admin role, causing infinite
-- recursion (42P17). Solution: use a SECURITY DEFINER function.
-- ============================================================

-- 1. Create SECURITY DEFINER function to check admin without RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- 2. Drop the recursive policy
DROP POLICY IF EXISTS "Admin can view all profiles" ON public.profiles;

-- 3. Recreate using the SECURITY DEFINER function (no recursion)
CREATE POLICY "Admin can view all profiles"
  ON public.profiles
  FOR SELECT
  USING (public.is_admin());

-- 4. Update invitations policies to use is_admin() for consistency
DROP POLICY IF EXISTS "admin_select_invitations" ON public.invitations;
DROP POLICY IF EXISTS "admin_update_invitations" ON public.invitations;
DROP POLICY IF EXISTS "admin_insert_invitations" ON public.invitations;

CREATE POLICY "admin_select_invitations" ON public.invitations
  FOR SELECT USING (public.is_admin());

CREATE POLICY "admin_update_invitations" ON public.invitations
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "admin_insert_invitations" ON public.invitations
  FOR INSERT WITH CHECK (public.is_admin());

-- 5. Change default plan from 'free' to 'pro' (no free plan in Arko)
ALTER TABLE public.workspaces ALTER COLUMN plan SET DEFAULT 'pro';

-- 6. Admin can view all workspaces and meta_connections (for /admin/clients)
CREATE POLICY "Admin can view all workspaces"
  ON public.workspaces
  FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admin can view all meta_connections"
  ON public.meta_connections
  FOR SELECT
  USING (public.is_admin());
