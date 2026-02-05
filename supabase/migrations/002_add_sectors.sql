-- NôCheck v2.1 - Adição de Setores
-- Execute este SQL no Supabase SQL Editor APÓS o 001_initial_schema.sql

-- ============================================
-- 1. TABELA DE SETORES
-- ============================================
-- Cada loja pode ter múltiplos setores (Cozinha, Estoque, Salão, etc.)

CREATE TABLE IF NOT EXISTS public.sectors (
  id SERIAL PRIMARY KEY,
  store_id INTEGER NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1', -- Cor para identificação visual
  icon TEXT DEFAULT 'clipboard', -- Ícone do setor
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, name)
);

CREATE INDEX idx_sectors_store ON public.sectors(store_id);

-- ============================================
-- 2. USUÁRIOS EM SETORES
-- ============================================
-- Substitui a lógica de roles por setor
-- Um usuário pode pertencer a múltiplos setores em uma loja

CREATE TABLE IF NOT EXISTS public.user_sectors (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  sector_id INTEGER NOT NULL REFERENCES public.sectors(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member', -- 'member' = preenche, 'viewer' = só vê
  assigned_by UUID REFERENCES public.users(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, sector_id)
);

CREATE INDEX idx_user_sectors_user ON public.user_sectors(user_id);
CREATE INDEX idx_user_sectors_sector ON public.user_sectors(sector_id);

-- ============================================
-- 3. GERENTES DE LOJA (SUBADMINS)
-- ============================================
-- Gerentes têm acesso de VISUALIZAÇÃO a todos os setores da loja
-- Não podem preencher checklists, apenas ver métricas e dados

CREATE TABLE IF NOT EXISTS public.store_managers (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  store_id INTEGER NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  can_view_all_checklists BOOLEAN DEFAULT true,
  can_view_reports BOOLEAN DEFAULT true,
  can_manage_users BOOLEAN DEFAULT false, -- Futuro: gerente pode adicionar usuários
  assigned_by UUID REFERENCES public.users(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, store_id)
);

CREATE INDEX idx_store_managers_user ON public.store_managers(user_id);
CREATE INDEX idx_store_managers_store ON public.store_managers(store_id);

-- ============================================
-- 4. ATUALIZAR TEMPLATE_VISIBILITY
-- ============================================
-- Adicionar setor_id para vincular template a setor específico
-- Mantemos roles como fallback para compatibilidade

ALTER TABLE public.template_visibility
ADD COLUMN IF NOT EXISTS sector_id INTEGER REFERENCES public.sectors(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_template_visibility_sector ON public.template_visibility(sector_id);

-- ============================================
-- 5. ATUALIZAR CHECKLISTS
-- ============================================
-- Adicionar setor_id para saber de qual setor veio o checklist

ALTER TABLE public.checklists
ADD COLUMN IF NOT EXISTS sector_id INTEGER REFERENCES public.sectors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_checklists_sector ON public.checklists(sector_id);

-- ============================================
-- 6. FUNÇÕES AUXILIARES ATUALIZADAS
-- ============================================

-- Verificar se usuário é gerente da loja
CREATE OR REPLACE FUNCTION is_store_manager(check_store_id INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.store_managers
    WHERE user_id = auth.uid()
    AND store_id = check_store_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Obter setores do usuário
CREATE OR REPLACE FUNCTION user_sector_ids()
RETURNS SETOF INTEGER AS $$
BEGIN
  RETURN QUERY
  SELECT sector_id FROM public.user_sectors
  WHERE user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Obter lojas onde usuário é gerente
CREATE OR REPLACE FUNCTION user_managed_store_ids()
RETURNS SETOF INTEGER AS $$
BEGIN
  RETURN QUERY
  SELECT store_id FROM public.store_managers
  WHERE user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 7. POLÍTICAS RLS PARA SETORES
-- ============================================

ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_managers ENABLE ROW LEVEL SECURITY;

-- SECTORS: Ver setores das lojas que tem acesso
CREATE POLICY "sectors_select" ON public.sectors
  FOR SELECT USING (
    is_admin() OR
    store_id IN (SELECT user_store_ids()) OR
    store_id IN (SELECT user_managed_store_ids()) OR
    id IN (SELECT user_sector_ids())
  );

CREATE POLICY "sectors_admin" ON public.sectors
  FOR ALL USING (is_admin());

-- USER_SECTORS: Ver próprios setores ou se for admin/gerente
CREATE POLICY "user_sectors_select" ON public.user_sectors
  FOR SELECT USING (
    user_id = auth.uid() OR
    is_admin() OR
    sector_id IN (
      SELECT s.id FROM public.sectors s
      WHERE s.store_id IN (SELECT user_managed_store_ids())
    )
  );

CREATE POLICY "user_sectors_admin" ON public.user_sectors
  FOR ALL USING (is_admin());

-- STORE_MANAGERS: Ver próprio registro ou se for admin
CREATE POLICY "store_managers_select" ON public.store_managers
  FOR SELECT USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "store_managers_admin" ON public.store_managers
  FOR ALL USING (is_admin());

-- ============================================
-- 8. ATUALIZAR POLÍTICA DE CHECKLISTS
-- ============================================

-- Gerentes podem VER (mas não editar) checklists de suas lojas
DROP POLICY IF EXISTS "checklists_select" ON public.checklists;
CREATE POLICY "checklists_select" ON public.checklists
  FOR SELECT USING (
    is_admin() OR
    store_id IN (SELECT user_store_ids()) OR
    store_id IN (SELECT user_managed_store_ids()) OR
    sector_id IN (SELECT user_sector_ids())
  );

-- Apenas membros de setor podem criar/editar (não gerentes)
DROP POLICY IF EXISTS "checklists_insert" ON public.checklists;
CREATE POLICY "checklists_insert" ON public.checklists
  FOR INSERT WITH CHECK (
    created_by = auth.uid() AND
    (
      store_id IN (SELECT user_store_ids()) OR
      sector_id IN (
        SELECT us.sector_id FROM public.user_sectors us
        WHERE us.user_id = auth.uid() AND us.role = 'member'
      )
    )
  );

DROP POLICY IF EXISTS "checklists_update" ON public.checklists;
CREATE POLICY "checklists_update" ON public.checklists
  FOR UPDATE USING (
    is_admin() OR
    (
      created_by = auth.uid() AND
      (
        store_id IN (SELECT user_store_ids()) OR
        sector_id IN (SELECT user_sector_ids())
      )
    )
  );

-- ============================================
-- 9. CRIAR SETORES PADRÃO PARA LOJAS EXISTENTES
-- ============================================

DO $$
DECLARE
  store_rec RECORD;
BEGIN
  FOR store_rec IN SELECT id FROM public.stores LOOP
    -- Criar setores padrão
    INSERT INTO public.sectors (store_id, name, description, color, icon)
    VALUES
      (store_rec.id, 'Estoque', 'Recebimento e controle de mercadorias', '#10b981', 'package'),
      (store_rec.id, 'Cozinha', 'Preparação e higiene da cozinha', '#f59e0b', 'flame'),
      (store_rec.id, 'Salão', 'Atendimento e limpeza do salão', '#6366f1', 'users'),
      (store_rec.id, 'Geral', 'Checklist gerais da loja', '#8b5cf6', 'clipboard')
    ON CONFLICT (store_id, name) DO NOTHING;
  END LOOP;
END $$;

-- ============================================
-- 10. MIGRAR TEMPLATE_VISIBILITY EXISTENTES
-- ============================================
-- Associar templates de recebimento ao setor "Estoque"

DO $$
DECLARE
  tv_rec RECORD;
  estoque_sector_id INTEGER;
BEGIN
  FOR tv_rec IN
    SELECT tv.id, tv.store_id, tv.template_id
    FROM public.template_visibility tv
    JOIN public.checklist_templates ct ON tv.template_id = ct.id
    WHERE ct.category = 'recebimento' AND tv.sector_id IS NULL
  LOOP
    -- Buscar setor Estoque dessa loja
    SELECT id INTO estoque_sector_id
    FROM public.sectors
    WHERE store_id = tv_rec.store_id AND name = 'Estoque'
    LIMIT 1;

    IF estoque_sector_id IS NOT NULL THEN
      UPDATE public.template_visibility
      SET sector_id = estoque_sector_id
      WHERE id = tv_rec.id;
    END IF;
  END LOOP;
END $$;

-- ============================================
-- 11. MIGRAR USER_STORE_ROLES PARA USER_SECTORS
-- ============================================
-- Converter roles antigos para novos setores

DO $$
DECLARE
  role_rec RECORD;
  target_sector_id INTEGER;
  sector_name TEXT;
BEGIN
  FOR role_rec IN SELECT * FROM public.user_store_roles LOOP
    -- Mapear role antigo para setor
    CASE role_rec.role
      WHEN 'estoquista' THEN sector_name := 'Estoque';
      WHEN 'aprendiz' THEN sector_name := 'Estoque';
      WHEN 'cozinheiro' THEN sector_name := 'Cozinha';
      WHEN 'garcom' THEN sector_name := 'Salão';
      WHEN 'supervisor' THEN sector_name := 'Geral';
      WHEN 'gerente' THEN
        -- Gerentes vão para store_managers
        INSERT INTO public.store_managers (user_id, store_id)
        VALUES (role_rec.user_id, role_rec.store_id)
        ON CONFLICT (user_id, store_id) DO NOTHING;
        CONTINUE;
      ELSE sector_name := 'Geral';
    END CASE;

    -- Buscar setor correspondente
    SELECT id INTO target_sector_id
    FROM public.sectors
    WHERE store_id = role_rec.store_id AND name = sector_name
    LIMIT 1;

    IF target_sector_id IS NOT NULL THEN
      INSERT INTO public.user_sectors (user_id, sector_id, role, assigned_by)
      VALUES (role_rec.user_id, target_sector_id, 'member', role_rec.assigned_by)
      ON CONFLICT (user_id, sector_id) DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- ============================================
-- 12. GRANTS
-- ============================================
GRANT ALL ON public.sectors TO service_role;
GRANT ALL ON public.user_sectors TO service_role;
GRANT ALL ON public.store_managers TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- ============================================
-- RESUMO DAS MUDANÇAS
-- ============================================
--
-- NOVAS TABELAS:
--   - sectors: Setores por loja (Cozinha, Estoque, Salão, etc.)
--   - user_sectors: Associa usuários a setores (pode preencher checklists)
--   - store_managers: Gerentes de loja (só visualizam, não preenchem)
--
-- COLUNAS ADICIONADAS:
--   - template_visibility.sector_id: Template pertence a qual setor
--   - checklists.sector_id: Checklist foi preenchido em qual setor
--
-- HIERARQUIA DE ACESSO:
--   1. Admin (is_admin=true): Acesso total a tudo
--   2. Gerente de Loja (store_managers): Vê todos os setores da loja, só visualiza
--   3. Membro de Setor (user_sectors): Preenche checklists do seu setor
--
-- A tabela user_store_roles ainda existe para compatibilidade,
-- mas a nova lógica usa user_sectors e store_managers.
--
