-- Atualizar RPC get_org_billing para incluir contagem de users e stores
-- (SECURITY DEFINER bypassa RLS, garantindo contagem correta)
DROP FUNCTION IF EXISTS public.get_org_billing(UUID);
CREATE OR REPLACE FUNCTION public.get_org_billing(p_org_id UUID)
RETURNS TABLE(
  id UUID, name TEXT, plan TEXT, stripe_customer_id TEXT,
  stripe_subscription_id TEXT, trial_ends_at TIMESTAMPTZ,
  features TEXT[], max_users INT, max_stores INT,
  pending_plan TEXT, previous_plan TEXT, current_period_end TIMESTAMPTZ, cancel_at_period_end BOOLEAN,
  current_users BIGINT, current_stores BIGINT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
AS $$
  SELECT o.id, o.name, o.plan, o.stripe_customer_id,
         o.stripe_subscription_id, o.trial_ends_at,
         o.features, o.max_users, o.max_stores,
         o.pending_plan, o.previous_plan, o.current_period_end, o.cancel_at_period_end,
         (SELECT count(*) FROM users u WHERE u.tenant_id = p_org_id AND u.is_active = true) AS current_users,
         (SELECT count(*) FROM stores s WHERE s.tenant_id = p_org_id) AS current_stores
  FROM organizations o
  WHERE o.id = p_org_id;
$$;
