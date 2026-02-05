-- NôCheck v2.0 - Schema Inicial
-- Execute este SQL no Supabase SQL Editor

-- ============================================
-- 1. LOJAS (8 unidades do Grupo Do Nô)
-- ============================================
CREATE TABLE IF NOT EXISTS public.stores (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  cnpj TEXT,
  address TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lojas são criadas via seed_data.sql ou interface admin
-- O sistema é genérico - pode ser usado por qualquer empresa

-- ============================================
-- 2. USUÁRIOS
-- ============================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 3. CARGOS POR LOJA
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_store_roles (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  store_id INTEGER NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('estoquista', 'aprendiz', 'supervisor', 'gerente')),
  assigned_by UUID REFERENCES public.users(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, store_id, role)
);

CREATE INDEX idx_user_store_roles_user ON public.user_store_roles(user_id);
CREATE INDEX idx_user_store_roles_store ON public.user_store_roles(store_id);

-- ============================================
-- 4. TEMPLATES DE CHECKLIST
-- ============================================
CREATE TABLE IF NOT EXISTS public.checklist_templates (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT CHECK (category IN ('recebimento', 'limpeza', 'abertura', 'fechamento', 'outros')),
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER templates_updated_at
  BEFORE UPDATE ON public.checklist_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 5. CAMPOS DO TEMPLATE
-- ============================================
CREATE TABLE IF NOT EXISTS public.template_fields (
  id SERIAL PRIMARY KEY,
  template_id INTEGER NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN (
    'text', 'number', 'photo', 'dropdown', 'signature',
    'datetime', 'checkbox_multiple', 'gps', 'barcode', 'calculated'
  )),
  is_required BOOLEAN DEFAULT true,
  sort_order INTEGER,
  options JSONB,           -- Para dropdowns: ["Opção 1", "Opção 2"]
  validation JSONB,        -- {min: 0, max: 100, pattern: "regex"}
  calculation JSONB,       -- {formula: "field_1 * field_2", depends_on: [1, 2]}
  placeholder TEXT,
  help_text TEXT
);

CREATE INDEX idx_template_fields_template ON public.template_fields(template_id);
CREATE INDEX idx_template_fields_order ON public.template_fields(template_id, sort_order);

-- ============================================
-- 6. VISIBILIDADE (quem vê qual template em qual loja)
-- ============================================
CREATE TABLE IF NOT EXISTS public.template_visibility (
  id SERIAL PRIMARY KEY,
  template_id INTEGER NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
  store_id INTEGER NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  roles TEXT[] NOT NULL,   -- ['estoquista', 'aprendiz']
  assigned_by UUID REFERENCES public.users(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(template_id, store_id)
);

CREATE INDEX idx_template_visibility_template ON public.template_visibility(template_id);
CREATE INDEX idx_template_visibility_store ON public.template_visibility(store_id);

-- ============================================
-- 7. CHECKLISTS PREENCHIDOS
-- ============================================
CREATE TABLE IF NOT EXISTS public.checklists (
  id SERIAL PRIMARY KEY,
  template_id INTEGER NOT NULL REFERENCES public.checklist_templates(id),
  store_id INTEGER NOT NULL REFERENCES public.stores(id),
  status TEXT DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'em_andamento', 'concluido', 'validado')),
  created_by UUID NOT NULL REFERENCES public.users(id),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  validated_by UUID REFERENCES public.users(id),
  validated_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'synced' CHECK (sync_status IN ('pending', 'syncing', 'synced', 'conflict')),
  local_id TEXT,           -- ID local para sync offline
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_checklists_template ON public.checklists(template_id);
CREATE INDEX idx_checklists_store ON public.checklists(store_id);
CREATE INDEX idx_checklists_created_by ON public.checklists(created_by);
CREATE INDEX idx_checklists_status ON public.checklists(status);
CREATE INDEX idx_checklists_created_at ON public.checklists(created_at DESC);

CREATE TRIGGER checklists_updated_at
  BEFORE UPDATE ON public.checklists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 8. RESPOSTAS DOS CAMPOS
-- ============================================
CREATE TABLE IF NOT EXISTS public.checklist_responses (
  id SERIAL PRIMARY KEY,
  checklist_id INTEGER NOT NULL REFERENCES public.checklists(id) ON DELETE CASCADE,
  field_id INTEGER NOT NULL REFERENCES public.template_fields(id),
  value_text TEXT,
  value_number NUMERIC,
  value_json JSONB,        -- Para checkbox múltiplo, GPS, etc.
  answered_by UUID REFERENCES public.users(id),
  answered_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_responses_checklist ON public.checklist_responses(checklist_id);
CREATE INDEX idx_responses_field ON public.checklist_responses(field_id);

-- ============================================
-- 9. ANEXOS (fotos, assinaturas)
-- ============================================
CREATE TABLE IF NOT EXISTS public.attachments (
  id SERIAL PRIMARY KEY,
  response_id INTEGER NOT NULL REFERENCES public.checklist_responses(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT,          -- 'image/jpeg', 'image/png'
  file_size INTEGER,
  storage_provider TEXT DEFAULT 'google_drive' CHECK (storage_provider IN ('google_drive', 'supabase')),
  storage_path TEXT NOT NULL,
  storage_url TEXT,
  uploaded_by UUID REFERENCES public.users(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_attachments_response ON public.attachments(response_id);

-- ============================================
-- 10. LOG DE ATIVIDADES
-- ============================================
CREATE TABLE IF NOT EXISTS public.activity_log (
  id SERIAL PRIMARY KEY,
  store_id INTEGER REFERENCES public.stores(id),
  user_id UUID REFERENCES public.users(id),
  checklist_id INTEGER REFERENCES public.checklists(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_store ON public.activity_log(store_id);
CREATE INDEX idx_activity_user ON public.activity_log(user_id);
CREATE INDEX idx_activity_created ON public.activity_log(created_at DESC);

-- ============================================
-- 11. VALIDAÇÕES CRUZADAS (estoquista vs aprendiz)
-- ============================================
CREATE TABLE IF NOT EXISTS public.cross_validations (
  id SERIAL PRIMARY KEY,
  store_id INTEGER NOT NULL REFERENCES public.stores(id),
  numero_nota TEXT NOT NULL,
  estoquista_checklist_id INTEGER REFERENCES public.checklists(id) ON DELETE SET NULL,
  aprendiz_checklist_id INTEGER REFERENCES public.checklists(id) ON DELETE SET NULL,
  valor_estoquista NUMERIC,
  valor_aprendiz NUMERIC,
  diferenca NUMERIC,
  status TEXT CHECK (status IN ('pendente', 'sucesso', 'falhou')),
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_validations_store ON public.cross_validations(store_id);
CREATE INDEX idx_validations_nota ON public.cross_validations(numero_nota);
CREATE INDEX idx_validations_status ON public.cross_validations(status);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_store_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_visibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cross_validations ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLÍTICAS RLS
-- ============================================

-- Função auxiliar para verificar se é admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND is_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função auxiliar para obter lojas do usuário
CREATE OR REPLACE FUNCTION user_store_ids()
RETURNS SETOF INTEGER AS $$
BEGIN
  RETURN QUERY
  SELECT store_id FROM public.user_store_roles
  WHERE user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- STORES: Todos podem ver lojas ativas
CREATE POLICY "stores_select" ON public.stores
  FOR SELECT USING (is_active = true OR is_admin());

CREATE POLICY "stores_admin" ON public.stores
  FOR ALL USING (is_admin());

-- USERS: Usuário vê a si mesmo, admin vê todos
CREATE POLICY "users_select_self" ON public.users
  FOR SELECT USING (id = auth.uid() OR is_admin());

CREATE POLICY "users_update_self" ON public.users
  FOR UPDATE USING (id = auth.uid() OR is_admin());

CREATE POLICY "users_admin_insert" ON public.users
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "users_admin_delete" ON public.users
  FOR DELETE USING (is_admin());

-- USER_STORE_ROLES: Usuário vê seus cargos, admin vê todos
CREATE POLICY "roles_select" ON public.user_store_roles
  FOR SELECT USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "roles_admin" ON public.user_store_roles
  FOR ALL USING (is_admin());

-- CHECKLIST_TEMPLATES: Admin pode tudo
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

-- TEMPLATE_FIELDS: Segue visibilidade do template
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

-- TEMPLATE_VISIBILITY: Admin pode tudo
CREATE POLICY "visibility_select" ON public.template_visibility
  FOR SELECT USING (store_id IN (SELECT user_store_ids()) OR is_admin());

CREATE POLICY "visibility_admin" ON public.template_visibility
  FOR ALL USING (is_admin());

-- CHECKLISTS: Usuário vê checklists de suas lojas
CREATE POLICY "checklists_select" ON public.checklists
  FOR SELECT USING (store_id IN (SELECT user_store_ids()) OR is_admin());

CREATE POLICY "checklists_insert" ON public.checklists
  FOR INSERT WITH CHECK (
    store_id IN (SELECT user_store_ids()) AND
    created_by = auth.uid()
  );

CREATE POLICY "checklists_update" ON public.checklists
  FOR UPDATE USING (
    (created_by = auth.uid() AND store_id IN (SELECT user_store_ids())) OR
    is_admin()
  );

CREATE POLICY "checklists_delete" ON public.checklists
  FOR DELETE USING (is_admin());

-- CHECKLIST_RESPONSES: Segue permissão do checklist
CREATE POLICY "responses_select" ON public.checklist_responses
  FOR SELECT USING (
    checklist_id IN (
      SELECT id FROM public.checklists
      WHERE store_id IN (SELECT user_store_ids())
    ) OR is_admin()
  );

CREATE POLICY "responses_insert" ON public.checklist_responses
  FOR INSERT WITH CHECK (
    checklist_id IN (
      SELECT id FROM public.checklists
      WHERE store_id IN (SELECT user_store_ids()) AND created_by = auth.uid()
    )
  );

CREATE POLICY "responses_update" ON public.checklist_responses
  FOR UPDATE USING (
    checklist_id IN (
      SELECT id FROM public.checklists
      WHERE store_id IN (SELECT user_store_ids()) AND created_by = auth.uid()
    ) OR is_admin()
  );

-- ATTACHMENTS: Segue permissão da response
CREATE POLICY "attachments_select" ON public.attachments
  FOR SELECT USING (
    response_id IN (
      SELECT r.id FROM public.checklist_responses r
      JOIN public.checklists c ON r.checklist_id = c.id
      WHERE c.store_id IN (SELECT user_store_ids())
    ) OR is_admin()
  );

CREATE POLICY "attachments_insert" ON public.attachments
  FOR INSERT WITH CHECK (
    response_id IN (
      SELECT r.id FROM public.checklist_responses r
      JOIN public.checklists c ON r.checklist_id = c.id
      WHERE c.store_id IN (SELECT user_store_ids()) AND c.created_by = auth.uid()
    )
  );

-- ACTIVITY_LOG: Usuário vê logs de suas lojas
CREATE POLICY "activity_select" ON public.activity_log
  FOR SELECT USING (store_id IN (SELECT user_store_ids()) OR is_admin());

CREATE POLICY "activity_insert" ON public.activity_log
  FOR INSERT WITH CHECK (true); -- Qualquer usuário autenticado pode criar logs

-- CROSS_VALIDATIONS: Usuário vê validações de suas lojas
CREATE POLICY "validations_select" ON public.cross_validations
  FOR SELECT USING (store_id IN (SELECT user_store_ids()) OR is_admin());

CREATE POLICY "validations_insert" ON public.cross_validations
  FOR INSERT WITH CHECK (store_id IN (SELECT user_store_ids()));

CREATE POLICY "validations_update" ON public.cross_validations
  FOR UPDATE USING (store_id IN (SELECT user_store_ids()) OR is_admin());

-- ============================================
-- FUNÇÃO PARA CRIAR USUÁRIO APÓS SIGNUP
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

-- Trigger para criar perfil automaticamente
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- TEMPLATES INICIAIS (Recebimento)
-- ============================================

-- Template: Recebimento - Estoquista
INSERT INTO public.checklist_templates (name, description, category, created_by)
VALUES (
  'Recebimento - Estoquista',
  'Checklist para recebimento de mercadorias pelo estoquista',
  'recebimento',
  NULL
) ON CONFLICT DO NOTHING;

-- Campos do template Estoquista
DO $$
DECLARE
  template_id_var INTEGER;
BEGIN
  SELECT id INTO template_id_var FROM public.checklist_templates WHERE name = 'Recebimento - Estoquista' LIMIT 1;

  IF template_id_var IS NOT NULL THEN
    INSERT INTO public.template_fields (template_id, name, field_type, is_required, sort_order, options, placeholder, help_text)
    VALUES
      (template_id_var, 'Fornecedor', 'dropdown', true, 1,
        '["Ambev", "Coca-Cola", "JBS", "BRF", "Nestlé", "Unilever", "PepsiCo", "Heineken", "Schincariol", "Outros"]'::jsonb,
        NULL, 'Selecione o fornecedor da entrega'),
      (template_id_var, 'Número da Nota Fiscal', 'text', true, 2, NULL, 'Ex: 123456', 'Digite o número da NF'),
      (template_id_var, 'Valor Total da Nota', 'number', true, 3, NULL, 'R$ 0,00', 'Valor total em reais'),
      (template_id_var, 'Confirme o Valor Total', 'number', true, 4, NULL, 'R$ 0,00', 'Digite novamente para confirmar'),
      (template_id_var, 'Foto da Nota Fiscal', 'photo', true, 5, '{"minPhotos": 1, "maxPhotos": 3}'::jsonb, NULL, 'Tire foto clara da NF'),
      (template_id_var, 'Contei todos os volumes?', 'dropdown', true, 6, '["Sim", "Não"]'::jsonb, NULL, NULL),
      (template_id_var, 'Conferi os produtos?', 'dropdown', true, 7, '["Sim", "Não"]'::jsonb, NULL, NULL),
      (template_id_var, 'Observações', 'text', false, 8, NULL, 'Observações opcionais...', NULL),
      (template_id_var, 'Localização', 'gps', true, 9, NULL, NULL, 'Captura automática'),
      (template_id_var, 'Assinatura do Estoquista', 'signature', true, 10, NULL, NULL, 'Assine para confirmar')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Template: Recebimento - Aprendiz
INSERT INTO public.checklist_templates (name, description, category, created_by)
VALUES (
  'Recebimento - Aprendiz',
  'Checklist para lançamento no Teknisa pelo aprendiz',
  'recebimento',
  NULL
) ON CONFLICT DO NOTHING;

-- Campos do template Aprendiz
DO $$
DECLARE
  template_id_var INTEGER;
BEGIN
  SELECT id INTO template_id_var FROM public.checklist_templates WHERE name = 'Recebimento - Aprendiz' LIMIT 1;

  IF template_id_var IS NOT NULL THEN
    INSERT INTO public.template_fields (template_id, name, field_type, is_required, sort_order, placeholder, help_text)
    VALUES
      (template_id_var, 'Número da Nota Fiscal', 'text', true, 1, 'Ex: 123456', 'MESMO número que o estoquista'),
      (template_id_var, 'Número do Lançamento Teknisa', 'text', true, 2, 'Ex: TK-789012', 'Código gerado no Teknisa'),
      (template_id_var, 'Valor Lançado no Teknisa', 'number', true, 3, 'R$ 0,00', 'Valor que você lançou'),
      (template_id_var, 'Confirme o Valor Lançado', 'number', true, 4, 'R$ 0,00', 'Digite novamente para confirmar'),
      (template_id_var, 'Observações do Lançamento', 'text', false, 5, 'Observações opcionais...', NULL),
      (template_id_var, 'Assinatura do Aprendiz', 'signature', true, 6, NULL, 'Assine para confirmar')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Atribuir visibilidade dos templates para todas as lojas
DO $$
DECLARE
  estoquista_id INTEGER;
  aprendiz_id INTEGER;
  store_rec RECORD;
BEGIN
  SELECT id INTO estoquista_id FROM public.checklist_templates WHERE name = 'Recebimento - Estoquista' LIMIT 1;
  SELECT id INTO aprendiz_id FROM public.checklist_templates WHERE name = 'Recebimento - Aprendiz' LIMIT 1;

  FOR store_rec IN SELECT id FROM public.stores LOOP
    -- Visibilidade Estoquista
    IF estoquista_id IS NOT NULL THEN
      INSERT INTO public.template_visibility (template_id, store_id, roles)
      VALUES (estoquista_id, store_rec.id, ARRAY['estoquista', 'supervisor', 'gerente'])
      ON CONFLICT (template_id, store_id) DO NOTHING;
    END IF;

    -- Visibilidade Aprendiz
    IF aprendiz_id IS NOT NULL THEN
      INSERT INTO public.template_visibility (template_id, store_id, roles)
      VALUES (aprendiz_id, store_rec.id, ARRAY['aprendiz', 'supervisor', 'gerente'])
      ON CONFLICT (template_id, store_id) DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- ============================================
-- GRANTS PARA O SERVICE ROLE
-- ============================================
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- FIM DO SCHEMA INICIAL
