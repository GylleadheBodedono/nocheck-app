-- ============================================
-- NoCheck - Schema Completo (Consolidado)
-- ============================================
-- Este arquivo cria TODA a estrutura do banco de dados do zero.
-- Gerado a partir da consolidacao das migrations 001-021.
-- Execute no Supabase SQL Editor em um banco limpo.
-- ============================================

-- ============================================
-- FUNCOES AUXILIARES (precisam existir antes das policies)
-- ============================================

-- Trigger generico para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Verificar se usuario e admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND is_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Retorna o store_id primario do usuario (via user_stores)
CREATE OR REPLACE FUNCTION user_store_id()
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT us.store_id FROM public.user_stores us
    WHERE us.user_id = auth.uid() AND us.is_primary = true
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Retorna TODAS as lojas do usuario (multi-loja)
CREATE OR REPLACE FUNCTION user_store_ids()
RETURNS SETOF INTEGER AS $$
BEGIN
  RETURN QUERY
  SELECT us.store_id FROM public.user_stores us
  WHERE us.user_id = auth.uid()
  UNION
  SELECT u.store_id FROM public.users u
  WHERE u.id = auth.uid() AND u.store_id IS NOT NULL
  UNION
  SELECT usr.store_id FROM public.user_store_roles usr
  WHERE usr.user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Retorna setores do usuario
CREATE OR REPLACE FUNCTION user_sector_ids()
RETURNS SETOF INTEGER AS $$
BEGIN
  RETURN QUERY
  SELECT sector_id FROM public.user_sectors
  WHERE user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Retorna lojas onde usuario e gerente
CREATE OR REPLACE FUNCTION user_managed_store_ids()
RETURNS SETOF INTEGER AS $$
BEGIN
  RETURN QUERY
  SELECT store_id FROM public.store_managers
  WHERE user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verifica se usuario e gerente da loja especifica
CREATE OR REPLACE FUNCTION is_store_manager(check_store_id INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.store_managers
    WHERE user_id = auth.uid() AND store_id = check_store_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verifica se usuario e gerente (flag em users)
CREATE OR REPLACE FUNCTION user_is_manager()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE((SELECT is_manager FROM public.users WHERE id = auth.uid()), false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Retorna function_id do usuario
CREATE OR REPLACE FUNCTION user_function_id()
RETURNS INTEGER AS $$
BEGIN
  RETURN (SELECT function_id FROM public.users WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Retorna sector_id do usuario
CREATE OR REPLACE FUNCTION user_sector_id()
RETURNS INTEGER AS $$
BEGIN
  RETURN (SELECT sector_id FROM public.users WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- TABELAS BASE
-- ============================================

-- LOJAS
CREATE TABLE IF NOT EXISTS public.stores (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  cnpj TEXT,
  address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  require_gps BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SETORES (por loja)
CREATE TABLE IF NOT EXISTS public.sectors (
  id SERIAL PRIMARY KEY,
  store_id INTEGER NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  icon TEXT DEFAULT 'clipboard',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, name)
);

CREATE INDEX IF NOT EXISTS idx_sectors_store ON public.sectors(store_id);

-- FUNCOES (global)
CREATE TABLE IF NOT EXISTS public.functions (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  icon TEXT DEFAULT 'briefcase',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CONFIGURACOES DO APP
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TABELAS DE USUARIOS
-- ============================================

-- USUARIOS
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  store_id INTEGER REFERENCES public.stores(id) ON DELETE SET NULL,
  function_id INTEGER REFERENCES public.functions(id) ON DELETE SET NULL,
  sector_id INTEGER REFERENCES public.sectors(id) ON DELETE SET NULL,
  is_manager BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_store ON public.users(store_id);
CREATE INDEX IF NOT EXISTS idx_users_function ON public.users(function_id);
CREATE INDEX IF NOT EXISTS idx_users_sector ON public.users(sector_id);

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- USER_STORES (juncao usuario <-> loja, multi-loja)
CREATE TABLE IF NOT EXISTS public.user_stores (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  store_id INTEGER NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  sector_id INTEGER REFERENCES public.sectors(id) ON DELETE SET NULL,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, store_id)
);

CREATE INDEX IF NOT EXISTS idx_user_stores_user ON public.user_stores(user_id);
CREATE INDEX IF NOT EXISTS idx_user_stores_store ON public.user_stores(store_id);

-- USER_STORE_ROLES (legado, mantido para compatibilidade)
CREATE TABLE IF NOT EXISTS public.user_store_roles (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  store_id INTEGER NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('estoquista', 'aprendiz', 'supervisor', 'gerente')),
  assigned_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, store_id, role)
);

CREATE INDEX IF NOT EXISTS idx_user_store_roles_user ON public.user_store_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_store_roles_store ON public.user_store_roles(store_id);

-- USER_SECTORS (legado, mantido para compatibilidade)
CREATE TABLE IF NOT EXISTS public.user_sectors (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  sector_id INTEGER NOT NULL REFERENCES public.sectors(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  assigned_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, sector_id)
);

CREATE INDEX IF NOT EXISTS idx_user_sectors_user ON public.user_sectors(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sectors_sector ON public.user_sectors(sector_id);

-- STORE_MANAGERS (legado, mantido para compatibilidade)
CREATE TABLE IF NOT EXISTS public.store_managers (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  store_id INTEGER NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  can_view_all_checklists BOOLEAN DEFAULT true,
  can_view_reports BOOLEAN DEFAULT true,
  can_manage_users BOOLEAN DEFAULT false,
  assigned_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, store_id)
);

CREATE INDEX IF NOT EXISTS idx_store_managers_user ON public.store_managers(user_id);
CREATE INDEX IF NOT EXISTS idx_store_managers_store ON public.store_managers(store_id);

-- ============================================
-- TABELAS DE TEMPLATES
-- ============================================

-- CHECKLIST_TEMPLATES
CREATE TABLE IF NOT EXISTS public.checklist_templates (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT CHECK (category IN ('recebimento', 'limpeza', 'abertura', 'fechamento', 'outros')),
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  allowed_start_time TIME DEFAULT NULL,
  allowed_end_time TIME DEFAULT NULL,
  justification_deadline_hours INTEGER DEFAULT NULL,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER templates_updated_at
  BEFORE UPDATE ON public.checklist_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- TEMPLATE_SECTIONS (subgrupos de campos)
CREATE TABLE IF NOT EXISTS public.template_sections (
  id BIGSERIAL PRIMARY KEY,
  template_id BIGINT NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_template_sections_template_id ON public.template_sections(template_id);

-- TEMPLATE_FIELDS
CREATE TABLE IF NOT EXISTS public.template_fields (
  id SERIAL PRIMARY KEY,
  template_id INTEGER NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  section_id BIGINT REFERENCES public.template_sections(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN (
    'text', 'number', 'photo', 'dropdown', 'signature',
    'datetime', 'checkbox_multiple', 'gps', 'barcode', 'calculated',
    'yes_no', 'rating'
  )),
  is_required BOOLEAN DEFAULT true,
  sort_order INTEGER,
  options JSONB,
  validation JSONB,
  calculation JSONB,
  placeholder TEXT,
  help_text TEXT
);

CREATE INDEX IF NOT EXISTS idx_template_fields_template ON public.template_fields(template_id);
CREATE INDEX IF NOT EXISTS idx_template_fields_order ON public.template_fields(template_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_template_fields_section_id ON public.template_fields(section_id);

-- TEMPLATE_VISIBILITY (quem ve qual template em qual loja/setor/funcao)
CREATE TABLE IF NOT EXISTS public.template_visibility (
  id SERIAL PRIMARY KEY,
  template_id INTEGER NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  store_id INTEGER NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  sector_id INTEGER REFERENCES public.sectors(id) ON DELETE CASCADE,
  function_id INTEGER REFERENCES public.functions(id) ON DELETE CASCADE,
  roles TEXT[] DEFAULT ARRAY[]::text[],
  assigned_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT template_visibility_unique_combo
    UNIQUE NULLS NOT DISTINCT (template_id, store_id, sector_id, function_id)
);

CREATE INDEX IF NOT EXISTS idx_template_visibility_template ON public.template_visibility(template_id);
CREATE INDEX IF NOT EXISTS idx_template_visibility_store ON public.template_visibility(store_id);
CREATE INDEX IF NOT EXISTS idx_template_visibility_sector ON public.template_visibility(sector_id);
CREATE INDEX IF NOT EXISTS idx_template_visibility_function ON public.template_visibility(function_id);

-- FIELD_CONDITIONS (condicoes de nao-conformidade por campo)
CREATE TABLE IF NOT EXISTS public.field_conditions (
  id SERIAL PRIMARY KEY,
  field_id INTEGER NOT NULL REFERENCES public.template_fields(id) ON DELETE CASCADE,
  condition_type TEXT NOT NULL CHECK (condition_type IN (
    'equals','not_equals','less_than','greater_than','between','in_list','not_in_list','empty'
  )),
  condition_value JSONB NOT NULL,
  severity TEXT NOT NULL DEFAULT 'media' CHECK (severity IN ('baixa','media','alta','critica')),
  default_assignee_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  deadline_days INTEGER NOT NULL DEFAULT 7,
  description_template TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fc_field ON public.field_conditions(field_id);

-- ============================================
-- TABELAS DE CHECKLISTS
-- ============================================

-- CHECKLISTS PREENCHIDOS
CREATE TABLE IF NOT EXISTS public.checklists (
  id SERIAL PRIMARY KEY,
  template_id INTEGER NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  store_id INTEGER NOT NULL REFERENCES public.stores(id),
  sector_id INTEGER REFERENCES public.sectors(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'em_andamento', 'concluido', 'validado', 'incompleto')),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  validated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  validated_at TIMESTAMPTZ,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  accuracy DOUBLE PRECISION,
  sync_status TEXT DEFAULT 'synced' CHECK (sync_status IN ('pending', 'syncing', 'synced', 'conflict')),
  local_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checklists_template ON public.checklists(template_id);
CREATE INDEX IF NOT EXISTS idx_checklists_store ON public.checklists(store_id);
CREATE INDEX IF NOT EXISTS idx_checklists_sector ON public.checklists(sector_id);
CREATE INDEX IF NOT EXISTS idx_checklists_created_by ON public.checklists(created_by);
CREATE INDEX IF NOT EXISTS idx_checklists_status ON public.checklists(status);
CREATE INDEX IF NOT EXISTS idx_checklists_created_at ON public.checklists(created_at DESC);

CREATE TRIGGER checklists_updated_at
  BEFORE UPDATE ON public.checklists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Prevenir duplicatas: apenas UM em_andamento por template+store+user por dia
CREATE UNIQUE INDEX IF NOT EXISTS idx_checklists_one_em_andamento_per_day
  ON public.checklists (template_id, store_id, created_by, (DATE(created_at AT TIME ZONE 'America/Sao_Paulo')))
  WHERE status = 'em_andamento';

-- CHECKLIST_SECTIONS (progresso de secoes por checklist)
CREATE TABLE IF NOT EXISTS public.checklist_sections (
  id BIGSERIAL PRIMARY KEY,
  checklist_id BIGINT NOT NULL REFERENCES public.checklists(id) ON DELETE CASCADE,
  section_id BIGINT NOT NULL REFERENCES public.template_sections(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'concluido')),
  completed_at TIMESTAMPTZ,
  UNIQUE(checklist_id, section_id)
);

CREATE INDEX IF NOT EXISTS idx_checklist_sections_checklist_id ON public.checklist_sections(checklist_id);
CREATE INDEX IF NOT EXISTS idx_checklist_sections_section_id ON public.checklist_sections(section_id);

-- CHECKLIST_RESPONSES (respostas dos campos)
CREATE TABLE IF NOT EXISTS public.checklist_responses (
  id SERIAL PRIMARY KEY,
  checklist_id INTEGER NOT NULL REFERENCES public.checklists(id) ON DELETE CASCADE,
  field_id INTEGER NOT NULL REFERENCES public.template_fields(id) ON DELETE CASCADE,
  value_text TEXT,
  value_number NUMERIC,
  value_json JSONB,
  answered_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  answered_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT checklist_responses_checklist_field_unique UNIQUE (checklist_id, field_id)
);

CREATE INDEX IF NOT EXISTS idx_responses_checklist ON public.checklist_responses(checklist_id);
CREATE INDEX IF NOT EXISTS idx_responses_field ON public.checklist_responses(field_id);

-- ATTACHMENTS (fotos, assinaturas)
CREATE TABLE IF NOT EXISTS public.attachments (
  id SERIAL PRIMARY KEY,
  response_id INTEGER NOT NULL REFERENCES public.checklist_responses(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  storage_provider TEXT DEFAULT 'google_drive' CHECK (storage_provider IN ('google_drive', 'supabase')),
  storage_path TEXT NOT NULL,
  storage_url TEXT,
  uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attachments_response ON public.attachments(response_id);

-- CHECKLIST_JUSTIFICATIONS (justificativas para checklists incompletos)
CREATE TABLE IF NOT EXISTS public.checklist_justifications (
  id SERIAL PRIMARY KEY,
  checklist_id INTEGER NOT NULL REFERENCES public.checklists(id) ON DELETE CASCADE,
  field_id INTEGER NOT NULL REFERENCES public.template_fields(id) ON DELETE CASCADE,
  justification_text TEXT NOT NULL,
  justified_by UUID REFERENCES public.users(id),
  justified_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(checklist_id, field_id)
);

CREATE INDEX IF NOT EXISTS idx_justifications_checklist ON public.checklist_justifications(checklist_id);

-- ============================================
-- TABELAS DE VALIDACAO CRUZADA
-- ============================================

CREATE TABLE IF NOT EXISTS public.cross_validations (
  id SERIAL PRIMARY KEY,
  store_id INTEGER NOT NULL REFERENCES public.stores(id),
  sector_id INTEGER REFERENCES public.sectors(id) ON DELETE SET NULL,
  numero_nota TEXT NOT NULL,
  estoquista_checklist_id INTEGER REFERENCES public.checklists(id) ON DELETE SET NULL,
  aprendiz_checklist_id INTEGER REFERENCES public.checklists(id) ON DELETE SET NULL,
  valor_estoquista NUMERIC,
  valor_aprendiz NUMERIC,
  diferenca NUMERIC,
  status TEXT CHECK (status IN ('pendente', 'sucesso', 'falhou', 'notas_diferentes', 'expirado')),
  linked_validation_id INTEGER REFERENCES public.cross_validations(id) ON DELETE SET NULL,
  match_reason TEXT,
  is_primary BOOLEAN DEFAULT true,
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_validations_store ON public.cross_validations(store_id);
CREATE INDEX IF NOT EXISTS idx_validations_nota ON public.cross_validations(numero_nota);
CREATE INDEX IF NOT EXISTS idx_validations_status ON public.cross_validations(status);
CREATE INDEX IF NOT EXISTS idx_validations_linked ON public.cross_validations(linked_validation_id);
CREATE INDEX IF NOT EXISTS idx_validations_store_sector_status ON public.cross_validations(store_id, sector_id, status);

-- ============================================
-- TABELAS DE PLANOS DE ACAO
-- ============================================

CREATE TABLE IF NOT EXISTS public.action_plans (
  id SERIAL PRIMARY KEY,
  -- Origem (auto-gerado ou manual)
  checklist_id INTEGER REFERENCES public.checklists(id) ON DELETE SET NULL,
  field_id INTEGER REFERENCES public.template_fields(id) ON DELETE SET NULL,
  field_condition_id INTEGER REFERENCES public.field_conditions(id) ON DELETE SET NULL,
  response_id INTEGER REFERENCES public.checklist_responses(id) ON DELETE SET NULL,
  -- Contexto
  template_id INTEGER REFERENCES public.checklist_templates(id) ON DELETE SET NULL,
  store_id INTEGER REFERENCES public.stores(id) ON DELETE CASCADE,
  sector_id INTEGER REFERENCES public.sectors(id) ON DELETE SET NULL,
  -- Detalhes do plano
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL DEFAULT 'media' CHECK (severity IN ('baixa','media','alta','critica')),
  status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','em_andamento','concluido','vencido','cancelado')),
  -- Atribuicao
  assigned_to UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Datas
  deadline DATE NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  -- Reincidencia
  is_reincidencia BOOLEAN NOT NULL DEFAULT false,
  reincidencia_count INTEGER NOT NULL DEFAULT 0,
  parent_action_plan_id INTEGER REFERENCES public.action_plans(id) ON DELETE SET NULL,
  -- Valor que disparou o plano
  non_conformity_value TEXT,
  -- Metadata
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ap_assigned ON public.action_plans(assigned_to);
CREATE INDEX IF NOT EXISTS idx_ap_store ON public.action_plans(store_id);
CREATE INDEX IF NOT EXISTS idx_ap_status ON public.action_plans(status);
CREATE INDEX IF NOT EXISTS idx_ap_field ON public.action_plans(field_id);
CREATE INDEX IF NOT EXISTS idx_ap_deadline ON public.action_plans(deadline);
CREATE INDEX IF NOT EXISTS idx_ap_checklist ON public.action_plans(checklist_id);
CREATE INDEX IF NOT EXISTS idx_ap_template ON public.action_plans(template_id);

-- ACTION_PLAN_STORES (juncao plano <-> lojas, multi-loja)
CREATE TABLE IF NOT EXISTS public.action_plan_stores (
  id SERIAL PRIMARY KEY,
  action_plan_id INTEGER NOT NULL REFERENCES public.action_plans(id) ON DELETE CASCADE,
  store_id INTEGER NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(action_plan_id, store_id)
);

CREATE INDEX IF NOT EXISTS idx_action_plan_stores_plan ON public.action_plan_stores(action_plan_id);
CREATE INDEX IF NOT EXISTS idx_action_plan_stores_store ON public.action_plan_stores(store_id);

-- ACTION_PLAN_UPDATES (comentarios/atualizacoes)
CREATE TABLE IF NOT EXISTS public.action_plan_updates (
  id SERIAL PRIMARY KEY,
  action_plan_id INTEGER NOT NULL REFERENCES public.action_plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  update_type TEXT NOT NULL CHECK (update_type IN ('comment','status_change','evidence','reassign')),
  content TEXT,
  old_status TEXT,
  new_status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_apu_plan ON public.action_plan_updates(action_plan_id);

-- ACTION_PLAN_EVIDENCE (fotos/documentos)
CREATE TABLE IF NOT EXISTS public.action_plan_evidence (
  id SERIAL PRIMARY KEY,
  action_plan_id INTEGER NOT NULL REFERENCES public.action_plans(id) ON DELETE CASCADE,
  update_id INTEGER REFERENCES public.action_plan_updates(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  storage_path TEXT NOT NULL,
  storage_url TEXT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ape_plan ON public.action_plan_evidence(action_plan_id);

-- ============================================
-- NOTIFICACOES E LOGS
-- ============================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'action_plan_created','action_plan_assigned','action_plan_deadline',
    'action_plan_overdue','action_plan_completed','action_plan_comment',
    'reincidencia_detected','validation_divergence'
  )),
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_user ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notif_created ON public.notifications(created_at);

CREATE TABLE IF NOT EXISTS public.activity_log (
  id SERIAL PRIMARY KEY,
  store_id INTEGER REFERENCES public.stores(id),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  checklist_id INTEGER REFERENCES public.checklists(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_store ON public.activity_log(store_id);
CREATE INDEX IF NOT EXISTS idx_activity_user ON public.activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON public.activity_log(created_at DESC);

-- ============================================
-- TRIGGERS DE USER_STORES
-- ============================================

-- Setor deve pertencer a loja
CREATE OR REPLACE FUNCTION public.check_user_store_sector()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sector_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.sectors
      WHERE id = NEW.sector_id AND store_id = NEW.store_id
    ) THEN
      RAISE EXCEPTION 'Setor % nao pertence a loja %', NEW.sector_id, NEW.store_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_stores_check_sector ON public.user_stores;
CREATE TRIGGER user_stores_check_sector
  BEFORE INSERT OR UPDATE ON public.user_stores
  FOR EACH ROW EXECUTE FUNCTION public.check_user_store_sector();

-- Apenas um is_primary = true por usuario
CREATE OR REPLACE FUNCTION public.ensure_single_primary_store()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_primary = true THEN
    UPDATE public.user_stores
    SET is_primary = false
    WHERE user_id = NEW.user_id AND id != NEW.id AND is_primary = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_stores_single_primary ON public.user_stores;
CREATE TRIGGER user_stores_single_primary
  BEFORE INSERT OR UPDATE ON public.user_stores
  FOR EACH ROW EXECUTE FUNCTION public.ensure_single_primary_store();

-- Sync users.store_id / sector_id com loja primaria
CREATE OR REPLACE FUNCTION public.sync_user_primary_store()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_primary = true THEN
    UPDATE public.users
    SET store_id = NEW.store_id,
        sector_id = NEW.sector_id
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_stores_sync_primary ON public.user_stores;
CREATE TRIGGER user_stores_sync_primary
  AFTER INSERT OR UPDATE ON public.user_stores
  FOR EACH ROW
  WHEN (NEW.is_primary = true)
  EXECUTE FUNCTION public.sync_user_primary_store();

-- Quando loja primaria e deletada, promover outra ou limpar
CREATE OR REPLACE FUNCTION public.sync_user_primary_store_delete()
RETURNS TRIGGER AS $$
DECLARE
  next_store_id INTEGER;
BEGIN
  IF OLD.is_primary = true THEN
    SELECT id INTO next_store_id
    FROM public.user_stores
    WHERE user_id = OLD.user_id AND id != OLD.id
    ORDER BY created_at
    LIMIT 1;

    IF next_store_id IS NOT NULL THEN
      UPDATE public.user_stores
      SET is_primary = true
      WHERE id = next_store_id;
    ELSE
      UPDATE public.users
      SET store_id = NULL, sector_id = NULL
      WHERE id = OLD.user_id;
    END IF;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_stores_sync_primary_delete ON public.user_stores;
CREATE TRIGGER user_stores_sync_primary_delete
  AFTER DELETE ON public.user_stores
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_primary_store_delete();

-- ============================================
-- TRIGGER: Criar usuario apos signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_store_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.functions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_visibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.field_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_justifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cross_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_plan_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_plan_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_plan_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLITICAS RLS
-- ============================================

-- STORES
CREATE POLICY "stores_select" ON public.stores
  FOR SELECT USING (is_active = true OR is_admin());
CREATE POLICY "stores_admin" ON public.stores
  FOR ALL USING (is_admin());

-- USERS
CREATE POLICY "users_select_self" ON public.users
  FOR SELECT USING (id = auth.uid() OR is_admin());
CREATE POLICY "users_update_self" ON public.users
  FOR UPDATE USING (id = auth.uid() OR is_admin());
CREATE POLICY "users_admin_insert" ON public.users
  FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "users_admin_delete" ON public.users
  FOR DELETE USING (is_admin());

-- USER_STORES
CREATE POLICY "user_stores_select" ON public.user_stores
  FOR SELECT USING (user_id = auth.uid() OR is_admin());
CREATE POLICY "user_stores_admin" ON public.user_stores
  FOR ALL USING (is_admin());

-- USER_STORE_ROLES
CREATE POLICY "roles_select" ON public.user_store_roles
  FOR SELECT USING (user_id = auth.uid() OR is_admin());
CREATE POLICY "roles_admin" ON public.user_store_roles
  FOR ALL USING (is_admin());

-- USER_SECTORS
CREATE POLICY "user_sectors_select" ON public.user_sectors
  FOR SELECT USING (user_id = auth.uid() OR is_admin());
CREATE POLICY "user_sectors_admin" ON public.user_sectors
  FOR ALL USING (is_admin());

-- STORE_MANAGERS
CREATE POLICY "store_managers_select" ON public.store_managers
  FOR SELECT USING (user_id = auth.uid() OR is_admin());
CREATE POLICY "store_managers_admin" ON public.store_managers
  FOR ALL USING (is_admin());

-- SECTORS
CREATE POLICY "sectors_select" ON public.sectors
  FOR SELECT USING (
    is_active = true
    OR is_admin()
    OR store_id IN (SELECT user_store_ids())
  );
CREATE POLICY "sectors_admin" ON public.sectors
  FOR ALL USING (is_admin());

-- FUNCTIONS
CREATE POLICY "functions_select" ON public.functions
  FOR SELECT USING (is_active = true OR is_admin());
CREATE POLICY "functions_admin" ON public.functions
  FOR ALL USING (is_admin());

-- CHECKLIST_TEMPLATES
CREATE POLICY "templates_select" ON public.checklist_templates
  FOR SELECT USING (
    is_admin() OR
    id IN (
      SELECT tv.template_id FROM public.template_visibility tv
      WHERE tv.store_id IN (SELECT user_store_ids())
    )
  );
CREATE POLICY "templates_admin" ON public.checklist_templates
  FOR ALL USING (is_admin());

-- TEMPLATE_SECTIONS
CREATE POLICY "template_sections_select" ON public.template_sections
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "template_sections_insert" ON public.template_sections
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "template_sections_update" ON public.template_sections
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "template_sections_delete" ON public.template_sections
  FOR DELETE TO authenticated USING (true);

-- TEMPLATE_FIELDS
CREATE POLICY "fields_select" ON public.template_fields
  FOR SELECT USING (
    is_admin() OR
    template_id IN (
      SELECT tv.template_id FROM public.template_visibility tv
      WHERE tv.store_id IN (SELECT user_store_ids())
    )
  );
CREATE POLICY "fields_admin" ON public.template_fields
  FOR ALL USING (is_admin());

-- TEMPLATE_VISIBILITY
CREATE POLICY "visibility_select" ON public.template_visibility
  FOR SELECT USING (store_id IN (SELECT user_store_ids()) OR is_admin());
CREATE POLICY "visibility_admin" ON public.template_visibility
  FOR ALL USING (is_admin());

-- FIELD_CONDITIONS
CREATE POLICY "fc_select" ON public.field_conditions FOR SELECT TO authenticated USING (true);
CREATE POLICY "fc_insert" ON public.field_conditions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true));
CREATE POLICY "fc_update" ON public.field_conditions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true));
CREATE POLICY "fc_delete" ON public.field_conditions FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true));

-- CHECKLISTS
CREATE POLICY "checklists_select" ON public.checklists
  FOR SELECT USING (
    is_admin()
    OR (user_is_manager() AND store_id IN (SELECT user_store_ids()))
    OR created_by = auth.uid()
  );
CREATE POLICY "checklists_insert" ON public.checklists
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND store_id IN (SELECT user_store_ids())
    AND NOT user_is_manager()
  );
CREATE POLICY "checklists_update" ON public.checklists
  FOR UPDATE USING (
    is_admin()
    OR (created_by = auth.uid() AND store_id IN (SELECT user_store_ids()))
  );
CREATE POLICY "checklists_delete" ON public.checklists
  FOR DELETE USING (is_admin());

-- CHECKLIST_SECTIONS
CREATE POLICY "checklist_sections_select" ON public.checklist_sections
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "checklist_sections_insert" ON public.checklist_sections
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "checklist_sections_update" ON public.checklist_sections
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "checklist_sections_delete" ON public.checklist_sections
  FOR DELETE TO authenticated USING (true);

-- CHECKLIST_RESPONSES
CREATE POLICY "responses_select" ON public.checklist_responses
  FOR SELECT USING (
    is_admin()
    OR checklist_id IN (
      SELECT id FROM public.checklists
      WHERE (user_is_manager() AND store_id IN (SELECT user_store_ids()))
         OR created_by = auth.uid()
    )
  );
CREATE POLICY "responses_insert" ON public.checklist_responses
  FOR INSERT WITH CHECK (
    checklist_id IN (
      SELECT id FROM public.checklists
      WHERE created_by = auth.uid() AND store_id IN (SELECT user_store_ids())
    )
  );
CREATE POLICY "responses_update" ON public.checklist_responses
  FOR UPDATE USING (
    is_admin()
    OR checklist_id IN (
      SELECT id FROM public.checklists
      WHERE created_by = auth.uid() AND store_id IN (SELECT user_store_ids())
    )
  );

-- ATTACHMENTS
CREATE POLICY "attachments_select" ON public.attachments
  FOR SELECT USING (
    is_admin()
    OR response_id IN (
      SELECT r.id FROM public.checklist_responses r
      JOIN public.checklists c ON r.checklist_id = c.id
      WHERE (user_is_manager() AND c.store_id IN (SELECT user_store_ids()))
         OR c.created_by = auth.uid()
    )
  );
CREATE POLICY "attachments_insert" ON public.attachments
  FOR INSERT WITH CHECK (
    response_id IN (
      SELECT r.id FROM public.checklist_responses r
      JOIN public.checklists c ON r.checklist_id = c.id
      WHERE c.created_by = auth.uid() AND c.store_id IN (SELECT user_store_ids())
    )
  );

-- CHECKLIST_JUSTIFICATIONS
CREATE POLICY "Users can insert justifications for their checklists"
  ON public.checklist_justifications FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.checklists c
      WHERE c.id = checklist_id AND c.created_by = auth.uid()
    )
  );
CREATE POLICY "Users can view justifications for accessible checklists"
  ON public.checklist_justifications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.checklists c
      WHERE c.id = checklist_id
        AND (c.created_by = auth.uid() OR public.is_admin())
    )
  );

-- CROSS_VALIDATIONS
CREATE POLICY "validations_select" ON public.cross_validations
  FOR SELECT USING (store_id IN (SELECT user_store_ids()) OR is_admin());
CREATE POLICY "validations_insert" ON public.cross_validations
  FOR INSERT WITH CHECK (store_id IN (SELECT user_store_ids()));
CREATE POLICY "validations_update" ON public.cross_validations
  FOR UPDATE USING (store_id IN (SELECT user_store_ids()) OR is_admin());

-- ACTION_PLANS
CREATE POLICY "ap_select" ON public.action_plans FOR SELECT TO authenticated
  USING (
    assigned_to = auth.uid()
    OR created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
  );
CREATE POLICY "ap_insert" ON public.action_plans FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ap_update" ON public.action_plans FOR UPDATE TO authenticated
  USING (
    assigned_to = auth.uid()
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
  );
CREATE POLICY "ap_delete" ON public.action_plans FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true));

-- ACTION_PLAN_STORES
CREATE POLICY "Admins can manage action_plan_stores"
  ON public.action_plan_stores FOR ALL
  USING (public.is_admin());

-- ACTION_PLAN_UPDATES
CREATE POLICY "apu_select" ON public.action_plan_updates FOR SELECT TO authenticated USING (true);
CREATE POLICY "apu_insert" ON public.action_plan_updates FOR INSERT TO authenticated WITH CHECK (true);

-- ACTION_PLAN_EVIDENCE
CREATE POLICY "ape_select" ON public.action_plan_evidence FOR SELECT TO authenticated USING (true);
CREATE POLICY "ape_insert" ON public.action_plan_evidence FOR INSERT TO authenticated WITH CHECK (true);

-- NOTIFICATIONS
CREATE POLICY "notif_select" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "notif_insert" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "notif_update" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "notif_delete" ON public.notifications FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ACTIVITY_LOG
CREATE POLICY "activity_select" ON public.activity_log
  FOR SELECT USING (store_id IN (SELECT user_store_ids()) OR is_admin());
CREATE POLICY "activity_insert" ON public.activity_log
  FOR INSERT WITH CHECK (true);

-- ============================================
-- STORAGE (bucket de imagens)
-- ============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'checklist-images',
  'checklist-images',
  true,
  2097152, -- 2MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'checklist-images');

CREATE POLICY "Anyone can view checklist images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'checklist-images');

CREATE POLICY "Users can delete own images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'checklist-images');

-- ============================================
-- REALTIME
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- ============================================
-- GRANTS
-- ============================================
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- ============================================
-- FIM DO SCHEMA
-- ============================================
