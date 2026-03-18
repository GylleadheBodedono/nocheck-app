-- ============================================
-- MIGRATION 002: Adicionar tenant_id em tabelas existentes
-- Adiciona coluna tenant_id + RLS tenant em todas as tabelas de negocio
-- ============================================

-- UUID fixo do Grupo Do No (usado no seed)
-- Sera populado pelo seed.sql apos esta migration
-- Por enquanto, criamos as colunas como NULLABLE e depois setamos NOT NULL

-- ── STORES ──
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_stores_tenant ON public.stores(tenant_id);

-- ── USERS ──
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON public.users(tenant_id);

-- ── SECTORS ──
ALTER TABLE public.sectors ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_sectors_tenant ON public.sectors(tenant_id);

-- ── FUNCTIONS ──
ALTER TABLE public.functions ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_functions_tenant ON public.functions(tenant_id);

-- ── USER_STORES ──
ALTER TABLE public.user_stores ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_user_stores_tenant ON public.user_stores(tenant_id);

-- ── USER_STORE_ROLES ──
ALTER TABLE public.user_store_roles ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_user_store_roles_tenant ON public.user_store_roles(tenant_id);

-- ── USER_SECTORS ──
ALTER TABLE public.user_sectors ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_user_sectors_tenant ON public.user_sectors(tenant_id);

-- ── STORE_MANAGERS ──
ALTER TABLE public.store_managers ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_store_managers_tenant ON public.store_managers(tenant_id);

-- ── CHECKLIST_TEMPLATES ──
ALTER TABLE public.checklist_templates ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_checklist_templates_tenant ON public.checklist_templates(tenant_id);

-- ── TEMPLATE_SECTIONS ──
ALTER TABLE public.template_sections ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_template_sections_tenant ON public.template_sections(tenant_id);

-- ── TEMPLATE_FIELDS ──
ALTER TABLE public.template_fields ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_template_fields_tenant ON public.template_fields(tenant_id);

-- ── TEMPLATE_VISIBILITY ──
ALTER TABLE public.template_visibility ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_template_visibility_tenant ON public.template_visibility(tenant_id);

-- ── FIELD_CONDITIONS ──
ALTER TABLE public.field_conditions ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_field_conditions_tenant ON public.field_conditions(tenant_id);

-- ── CHECKLISTS ──
ALTER TABLE public.checklists ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_checklists_tenant ON public.checklists(tenant_id);

-- ── CHECKLIST_SECTIONS ──
ALTER TABLE public.checklist_sections ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_checklist_sections_tenant ON public.checklist_sections(tenant_id);

-- ── CHECKLIST_RESPONSES ──
ALTER TABLE public.checklist_responses ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_checklist_responses_tenant ON public.checklist_responses(tenant_id);

-- ── ATTACHMENTS ──
ALTER TABLE public.attachments ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_attachments_tenant ON public.attachments(tenant_id);

-- ── CHECKLIST_JUSTIFICATIONS ──
ALTER TABLE public.checklist_justifications ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_checklist_justifications_tenant ON public.checklist_justifications(tenant_id);

-- ── CROSS_VALIDATIONS ──
ALTER TABLE public.cross_validations ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_cross_validations_tenant ON public.cross_validations(tenant_id);

-- ── ACTION_PLANS ──
ALTER TABLE public.action_plans ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_action_plans_tenant ON public.action_plans(tenant_id);

-- ── ACTION_PLAN_STORES ──
ALTER TABLE public.action_plan_stores ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_action_plan_stores_tenant ON public.action_plan_stores(tenant_id);

-- ── ACTION_PLAN_UPDATES ──
ALTER TABLE public.action_plan_updates ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_action_plan_updates_tenant ON public.action_plan_updates(tenant_id);

-- ── ACTION_PLAN_EVIDENCE ──
ALTER TABLE public.action_plan_evidence ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_action_plan_evidence_tenant ON public.action_plan_evidence(tenant_id);

-- ── NOTIFICATIONS ──
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant ON public.notifications(tenant_id);

-- ── ACTIVITY_LOG ──
ALTER TABLE public.activity_log ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_activity_log_tenant ON public.activity_log(tenant_id);

-- ── APP_SETTINGS ──
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_app_settings_tenant ON public.app_settings(tenant_id);

-- ============================================
-- TENANT ISOLATION POLICIES
-- Adicionadas ALEM das policies originais (store-based)
-- As policies sao PERMISSIVE = OR logic
-- Tenant policy garante isolamento entre orgs
-- Policy original garante isolamento dentro da org (por store/user)
-- ============================================

-- Pattern: tenant_{tabela}_{cmd}
-- Cada tabela recebe SELECT/INSERT/UPDATE/DELETE por tenant

DO $$
DECLARE
  tables TEXT[] := ARRAY[
    'stores', 'users', 'sectors', 'functions',
    'user_stores', 'user_store_roles', 'user_sectors', 'store_managers',
    'checklist_templates', 'template_sections', 'template_fields', 'template_visibility',
    'field_conditions', 'checklists', 'checklist_sections', 'checklist_responses',
    'attachments', 'checklist_justifications', 'cross_validations',
    'action_plans', 'action_plan_stores', 'action_plan_updates', 'action_plan_evidence',
    'notifications', 'activity_log', 'app_settings'
  ];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Drop existing tenant policies if any (idempotent)
    EXECUTE format('DROP POLICY IF EXISTS "tenant_%s_select" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_%s_insert" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_%s_update" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_%s_delete" ON public.%I', t, t);

    -- Create tenant isolation policies
    EXECUTE format(
      'CREATE POLICY "tenant_%s_select" ON public.%I FOR SELECT USING (tenant_id = get_current_org_id())',
      t, t
    );
    EXECUTE format(
      'CREATE POLICY "tenant_%s_insert" ON public.%I FOR INSERT WITH CHECK (tenant_id = get_current_org_id())',
      t, t
    );
    EXECUTE format(
      'CREATE POLICY "tenant_%s_update" ON public.%I FOR UPDATE USING (tenant_id = get_current_org_id())',
      t, t
    );
    EXECUTE format(
      'CREATE POLICY "tenant_%s_delete" ON public.%I FOR DELETE USING (tenant_id = get_current_org_id())',
      t, t
    );
  END LOOP;
END $$;
