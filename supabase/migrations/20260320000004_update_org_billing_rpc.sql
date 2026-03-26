-- Atualizar RPC get_org_billing para incluir colunas de pending plan
DROP FUNCTION IF EXISTS public.get_org_billing(UUID);
CREATE OR REPLACE FUNCTION public.get_org_billing(p_org_id UUID)
RETURNS TABLE(
  id UUID, name TEXT, plan TEXT, stripe_customer_id TEXT,
  stripe_subscription_id TEXT, trial_ends_at TIMESTAMPTZ,
  features TEXT[], max_users INT, max_stores INT,
  pending_plan TEXT, current_period_end TIMESTAMPTZ, cancel_at_period_end BOOLEAN
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
AS $$
  SELECT o.id, o.name, o.plan, o.stripe_customer_id,
         o.stripe_subscription_id, o.trial_ends_at,
         o.features, o.max_users, o.max_stores,
         o.pending_plan, o.current_period_end, o.cancel_at_period_end
  FROM organizations o
  WHERE o.id = p_org_id;
$$;
