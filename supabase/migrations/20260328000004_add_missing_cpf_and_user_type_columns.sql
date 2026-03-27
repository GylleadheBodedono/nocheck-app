-- ============================================
-- FIX: Add missing cpf and user_type columns to users table
-- ============================================
-- The beta branch was created before migration 20260327000004 which adds
-- these columns. The handle_new_user() trigger references them, causing
-- "Database error saving new user" (column "cpf" does not exist).
-- ============================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS cpf TEXT,
  ADD COLUMN IF NOT EXISTS user_type TEXT DEFAULT 'empresa'
    CHECK (user_type IN ('empresa', 'funcionario'));
