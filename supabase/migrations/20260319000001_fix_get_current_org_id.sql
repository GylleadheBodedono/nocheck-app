-- ============================================
-- FIX: get_current_org_id() deve priorizar tenant_id do usuario
-- em vez de pegar o primeiro organization_members (que pode ser a org errada)
-- SECURITY DEFINER bypassa RLS para evitar recursao infinita
-- ============================================

CREATE OR REPLACE FUNCTION public.get_current_org_id()
RETURNS UUID
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'org_id')::UUID,
    (SELECT u.tenant_id FROM users u WHERE u.id = auth.uid()),
    (SELECT om.organization_id
     FROM organization_members om
     WHERE om.user_id = auth.uid()
     ORDER BY om.role = 'owner' DESC, om.accepted_at ASC
     LIMIT 1)
  );
$$ LANGUAGE sql;

-- RPC para billing: bypassa RLS ao buscar dados da org
CREATE OR REPLACE FUNCTION public.get_org_billing(p_org_id UUID)
RETURNS TABLE(
  id UUID, name TEXT, plan TEXT, stripe_customer_id TEXT,
  stripe_subscription_id TEXT, trial_ends_at TIMESTAMPTZ,
  features TEXT[], max_users INT, max_stores INT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
AS $$
  SELECT o.id, o.name, o.plan, o.stripe_customer_id,
         o.stripe_subscription_id, o.trial_ends_at,
         o.features, o.max_users, o.max_stores
  FROM organizations o
  WHERE o.id = p_org_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_org_billing(UUID) TO authenticated;

-- RPC para retornar o tenant_id do usuario autenticado (bypassa RLS)
CREATE OR REPLACE FUNCTION public.get_my_tenant_id()
RETURNS UUID
STABLE
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
AS $$
  SELECT u.tenant_id FROM users u WHERE u.id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_my_tenant_id() TO authenticated;
