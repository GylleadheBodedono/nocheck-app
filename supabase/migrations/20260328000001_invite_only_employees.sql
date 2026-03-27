-- ============================================
-- MIGRATION: Invite-Only Employee Registration
-- ============================================
-- 1. Rewrite handle_new_user() to skip org creation for funcionarios
-- 2. Create validate_invite_token() RPC (public, SECURITY DEFINER)
-- 3. Create accept_invite() RPC (authenticated, SECURITY DEFINER)
-- 4. Add unique index to prevent duplicate pending invites
-- ============================================

-- ── 1. Rewrite handle_new_user() ──
-- Funcionarios (employees) no longer get their own org.
-- They will be linked to an org via the invite acceptance flow.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
  user_name TEXT;
  org_slug TEXT;
  u_type TEXT;
BEGIN
  user_name := COALESCE(
    NEW.raw_user_meta_data ->> 'full_name',
    split_part(NEW.email, '@', 1)
  );

  u_type := COALESCE(NEW.raw_user_meta_data ->> 'user_type', 'empresa');

  INSERT INTO public.users (id, email, full_name, phone, cpf, user_type)
  VALUES (
    NEW.id,
    NEW.email,
    user_name,
    NEW.raw_user_meta_data ->> 'phone',
    NEW.raw_user_meta_data ->> 'cpf',
    u_type
  )
  ON CONFLICT (id) DO NOTHING;

  -- Platform admins don't get their own org
  IF (NEW.raw_user_meta_data ->> 'is_platform_admin')::boolean IS TRUE THEN
    RETURN NEW;
  END IF;

  -- Funcionarios don't get their own org — they join via invite
  IF u_type = 'funcionario' THEN
    RETURN NEW;
  END IF;

  -- Only empresa users get an auto-created org
  org_slug := lower(regexp_replace(user_name, '[^a-zA-Z0-9]', '-', 'g'));
  org_slug := org_slug || '-' || substr(gen_random_uuid()::text, 1, 6);

  INSERT INTO public.organizations (name, slug, plan, max_users, max_stores, features, trial_ends_at)
  VALUES (
    user_name,
    org_slug,
    'trial',
    3,
    1,
    ARRAY['basic_orders','basic_reports'],
    now() + interval '14 days'
  )
  RETURNING id INTO new_org_id;

  INSERT INTO public.organization_members (organization_id, user_id, role, accepted_at)
  VALUES (new_org_id, NEW.id, 'owner', now());

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── 2. validate_invite_token() — public RPC ──
-- Allows unauthenticated users to validate an invite token
-- Returns invite details if valid, empty if not

CREATE OR REPLACE FUNCTION public.validate_invite_token(invite_token UUID)
RETURNS TABLE(
  id UUID,
  email TEXT,
  role TEXT,
  tenant_id UUID,
  org_name TEXT,
  expires_at TIMESTAMPTZ
) AS $$
  SELECT i.id, i.email, i.role, i.tenant_id, o.name AS org_name, i.expires_at
  FROM public.invites i
  JOIN public.organizations o ON o.id = i.tenant_id
  WHERE i.token = invite_token
    AND i.accepted_at IS NULL
    AND i.expires_at > now()
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.validate_invite_token(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.validate_invite_token(UUID) TO authenticated;

-- ── 3. accept_invite() — authenticated RPC ──
-- Accepts an invite: creates org membership, sets tenant_id on user, marks invite accepted.
-- Uses SECURITY DEFINER to bypass RLS (new employee has no org_id in JWT yet).

CREATE OR REPLACE FUNCTION public.accept_invite(invite_token UUID, accepting_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  inv RECORD;
  user_email TEXT;
BEGIN
  -- Fetch valid invite
  SELECT * INTO inv FROM public.invites
  WHERE token = invite_token
    AND accepted_at IS NULL
    AND expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite invalido ou expirado';
  END IF;

  -- Verify email matches
  SELECT email INTO user_email FROM auth.users WHERE id = accepting_user_id;

  IF lower(inv.email) != lower(user_email) THEN
    RAISE EXCEPTION 'Email nao corresponde ao convite';
  END IF;

  -- Create membership in the org
  INSERT INTO public.organization_members (organization_id, user_id, role, invited_by, invited_email, accepted_at)
  VALUES (inv.tenant_id, accepting_user_id, inv.role, inv.invited_by, inv.email, now())
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  -- Set tenant_id on the user record
  UPDATE public.users SET tenant_id = inv.tenant_id WHERE id = accepting_user_id;

  -- Mark invite as accepted
  UPDATE public.invites SET accepted_at = now() WHERE id = inv.id;

  RETURN jsonb_build_object(
    'success', true,
    'org_id', inv.tenant_id,
    'role', inv.role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.accept_invite(UUID, UUID) TO authenticated;

-- ── 4. Unique index: prevent duplicate pending invites per email per org ──
CREATE UNIQUE INDEX IF NOT EXISTS idx_invites_pending_email_tenant
  ON public.invites (tenant_id, lower(email))
  WHERE accepted_at IS NULL;

-- ── 5. Additional grants for auth admin ──
GRANT SELECT, UPDATE ON public.invites TO supabase_auth_admin;
