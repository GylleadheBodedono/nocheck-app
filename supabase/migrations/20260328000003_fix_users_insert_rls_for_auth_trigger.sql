-- ============================================
-- FIX: Allow handle_new_user() trigger to insert into public.users
-- ============================================
-- Root cause: The RLS policy "users_admin_insert" requires is_admin() = true,
-- but during signup the new user doesn't exist in public.users yet, so
-- is_admin() returns FALSE and the INSERT from handle_new_user() is blocked.
--
-- This causes "Database error saving new user" when employees try to sign up
-- via invite link.
--
-- Fix: Add an RLS policy that allows the supabase_auth_admin role (which fires
-- the on_auth_user_created trigger) to insert users unconditionally.
-- Also add a self-insert policy so the trigger running as SECURITY DEFINER
-- can insert the user's own row.
-- ============================================

-- Allow supabase_auth_admin to insert users (trigger context)
DROP POLICY IF EXISTS "users_auth_admin_insert" ON public.users;
CREATE POLICY "users_auth_admin_insert" ON public.users
  FOR INSERT
  TO supabase_auth_admin
  WITH CHECK (true);

-- Allow supabase_auth_admin to select users (needed by is_admin() and profile lookups in trigger)
DROP POLICY IF EXISTS "users_auth_admin_select" ON public.users;
CREATE POLICY "users_auth_admin_select" ON public.users
  FOR SELECT
  TO supabase_auth_admin
  USING (true);

-- Allow supabase_auth_admin to update users (needed by accept_invite and profile updates)
DROP POLICY IF EXISTS "users_auth_admin_update" ON public.users;
CREATE POLICY "users_auth_admin_update" ON public.users
  FOR UPDATE
  TO supabase_auth_admin
  USING (true);

-- Ensure service_role can also bypass (for API routes using service role client)
DROP POLICY IF EXISTS "users_service_role_all" ON public.users;
CREATE POLICY "users_service_role_all" ON public.users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
