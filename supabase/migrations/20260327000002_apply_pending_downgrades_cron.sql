-- Habilita extensoes necessarias para o cron
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Funcao que aplica downgrades de plano agendados cujo periodo expirou.
-- Mesma logica do endpoint /api/cron/apply-pending-downgrades e do updateOrgPlan.
CREATE OR REPLACE FUNCTION public.apply_pending_downgrades()
RETURNS TABLE(org_id uuid, org_name text, old_plan text, new_plan text) AS $$
BEGIN
  RETURN QUERY
  UPDATE organizations o
  SET
    plan               = o.pending_plan,
    features           = pc.features,
    max_users          = pc.max_users,
    max_stores         = pc.max_stores,
    pending_plan       = null,
    previous_plan      = null,
    current_period_end = null,
    updated_at         = now()
  FROM pricing_configs pc
  WHERE pc.id = o.pending_plan
    AND o.pending_plan IS NOT NULL
    AND o.cancel_at_period_end = false
    AND o.current_period_end <= now()
  RETURNING o.id, o.name, o.plan AS new_plan, o.pending_plan AS old_plan;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Agenda execucao diaria as 03:00 UTC
-- Para recriar em producao: SELECT cron.schedule('apply-pending-downgrades', '0 3 * * *', 'SELECT public.apply_pending_downgrades();');
SELECT cron.schedule(
  'apply-pending-downgrades',
  '0 3 * * *',
  'SELECT public.apply_pending_downgrades();'
);
