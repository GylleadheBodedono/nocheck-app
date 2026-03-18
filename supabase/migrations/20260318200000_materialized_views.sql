-- ============================================
-- MIGRATION: Materialized Views para KPIs
-- Pre-agrega metricas por tenant/store/dia
-- Refresh via funcao SECURITY DEFINER (RLS nao se aplica a MVs)
-- ============================================

-- ── 1. mv_daily_kpis — Metricas diarias de checklists e planos ──
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_kpis AS
SELECT
  ck.tenant_id,
  ck.store_id,
  ck.report_date,
  ck.total_checklists,
  ck.completed,
  ck.in_progress,
  COALESCE(ap_created.cnt, 0) AS plans_created,
  COALESCE(ap_resolved.cnt, 0) AS plans_resolved
FROM (
  SELECT
    c.tenant_id,
    c.store_id,
    DATE(c.created_at) AS report_date,
    COUNT(*) AS total_checklists,
    COUNT(*) FILTER (WHERE c.status = 'completed') AS completed,
    COUNT(*) FILTER (WHERE c.status = 'in_progress') AS in_progress
  FROM checklists c
  GROUP BY c.tenant_id, c.store_id, DATE(c.created_at)
) ck
LEFT JOIN (
  SELECT ap.tenant_id, ap.store_id, DATE(ap.created_at) AS d, COUNT(*) AS cnt
  FROM action_plans ap
  GROUP BY ap.tenant_id, ap.store_id, DATE(ap.created_at)
) ap_created ON ap_created.tenant_id = ck.tenant_id
  AND ap_created.store_id = ck.store_id
  AND ap_created.d = ck.report_date
LEFT JOIN (
  SELECT ap.tenant_id, ap.store_id, DATE(ap.updated_at) AS d, COUNT(*) AS cnt
  FROM action_plans ap
  WHERE ap.status = 'concluido'
  GROUP BY ap.tenant_id, ap.store_id, DATE(ap.updated_at)
) ap_resolved ON ap_resolved.tenant_id = ck.tenant_id
  AND ap_resolved.store_id = ck.store_id
  AND ap_resolved.d = ck.report_date;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_daily_kpis
  ON mv_daily_kpis(tenant_id, store_id, report_date);

-- ── 2. mv_compliance_summary — Taxa de conformidade semanal ──
-- Conta total de respostas vs action_plans (nao-conformidades) por semana
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_compliance_summary AS
SELECT
  ck.tenant_id,
  ck.store_id,
  ck.template_id,
  ck.week,
  ck.total_responses,
  COALESCE(nc.non_conformities, 0) AS non_conformities,
  ROUND(
    1.0 - COALESCE(nc.non_conformities, 0)::numeric / NULLIF(ck.total_responses, 0),
    4
  ) AS compliance_rate
FROM (
  SELECT
    c.tenant_id,
    c.store_id,
    c.template_id,
    DATE_TRUNC('week', c.created_at) AS week,
    COUNT(cr.id) AS total_responses
  FROM checklist_responses cr
  JOIN checklists c ON cr.checklist_id = c.id
  GROUP BY c.tenant_id, c.store_id, c.template_id, DATE_TRUNC('week', c.created_at)
) ck
LEFT JOIN (
  SELECT
    ap.tenant_id,
    ap.store_id,
    ap.template_id,
    DATE_TRUNC('week', ap.created_at) AS week,
    COUNT(*) AS non_conformities
  FROM action_plans ap
  GROUP BY ap.tenant_id, ap.store_id, ap.template_id, DATE_TRUNC('week', ap.created_at)
) nc ON nc.tenant_id = ck.tenant_id
  AND nc.store_id = ck.store_id
  AND nc.template_id = ck.template_id
  AND nc.week = ck.week;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_compliance_summary
  ON mv_compliance_summary(tenant_id, store_id, template_id, week);

-- ── 3. Funcao de refresh (SECURITY DEFINER — bypassa RLS) ──
CREATE OR REPLACE FUNCTION refresh_materialized_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_kpis;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_compliance_summary;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 4. Funcoes wrapper com filtro de tenant ──

-- get_daily_kpis: retorna KPIs diarios para um tenant e periodo
CREATE OR REPLACE FUNCTION get_daily_kpis(
  p_tenant_id UUID,
  p_from DATE,
  p_to DATE
)
RETURNS TABLE (
  tenant_id UUID,
  store_id INTEGER,
  report_date DATE,
  total_checklists BIGINT,
  completed BIGINT,
  in_progress BIGINT,
  plans_created BIGINT,
  plans_resolved BIGINT
) AS $$
  SELECT *
  FROM mv_daily_kpis mv
  WHERE mv.tenant_id = p_tenant_id
    AND mv.report_date BETWEEN p_from AND p_to;
$$ LANGUAGE sql SECURITY DEFINER;

-- get_compliance_summary: retorna conformidade semanal para um tenant e periodo
CREATE OR REPLACE FUNCTION get_compliance_summary(
  p_tenant_id UUID,
  p_from DATE,
  p_to DATE
)
RETURNS TABLE (
  tenant_id UUID,
  store_id INTEGER,
  template_id INTEGER,
  week TIMESTAMPTZ,
  total_responses BIGINT,
  non_conformities BIGINT,
  compliance_rate NUMERIC
) AS $$
  SELECT *
  FROM mv_compliance_summary mv
  WHERE mv.tenant_id = p_tenant_id
    AND mv.week >= DATE_TRUNC('week', p_from::timestamptz)
    AND mv.week <= DATE_TRUNC('week', p_to::timestamptz);
$$ LANGUAGE sql SECURITY DEFINER;

-- ── 5. Agendar refresh via pg_cron (se disponivel) ──
-- Em Supabase hosted, pg_cron pode nao estar disponivel em todos os planos.
-- Nesse caso, usar a Edge Function refresh-views com um cron externo.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'refresh-kpis',
      '0 */6 * * *',
      'SELECT refresh_materialized_views()'
    );
    RAISE NOTICE 'pg_cron: scheduled refresh-kpis every 6 hours';
  ELSE
    RAISE NOTICE 'pg_cron not available — use Edge Function or external cron for refresh';
  END IF;
END $$;
