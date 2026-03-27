-- ============================================
-- MIGRATION: Backfill organization_members for orphaned users
-- ============================================
-- Users created via admin panel (POST /api/admin/users) have tenant_id set
-- but were never inserted into organization_members. This causes them to be
-- invisible on the equipe page (/admin/configuracoes/equipe).
--
-- This migration creates organization_members records for all users who have
-- a tenant_id but no corresponding membership record.
-- ============================================

INSERT INTO public.organization_members (organization_id, user_id, role, accepted_at)
SELECT
  u.tenant_id,
  u.id,
  CASE WHEN u.is_admin THEN 'admin' ELSE 'member' END,
  COALESCE(u.created_at, now())
FROM public.users u
LEFT JOIN public.organization_members om
  ON om.organization_id = u.tenant_id AND om.user_id = u.id
WHERE u.tenant_id IS NOT NULL
  AND om.id IS NULL
ON CONFLICT (organization_id, user_id) DO NOTHING;
