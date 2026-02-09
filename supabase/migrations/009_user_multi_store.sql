-- NôCheck v3.1 - Funcionario em Multiplas Lojas
-- Permite que um funcionario pertenca a mais de uma loja simultaneamente.
--
-- Mudancas:
--   1. Garante existencia de tabelas dependentes (functions, sectors, etc.)
--   2. Garante colunas necessarias em users, checklists, template_visibility
--   3. Nova tabela "user_stores" (juncao usuario <-> loja, com setor por loja)
--   4. Triggers: validacao de setor, primary unico, sync com users.store_id
--   5. Migracao de dados existentes (users.store_id -> user_stores)
--   6. RLS para user_stores
--   7. Funcoes auxiliares atualizadas para multi-loja
--   8. Politicas RLS de checklists/respostas/anexos atualizadas
--
-- Seguro para rodar em qualquer estado do schema (usa IF NOT EXISTS).
-- ============================================

-- ============================================
-- 1. TABELA "functions" (funcoes globais)
-- ============================================
CREATE TABLE IF NOT EXISTS public.functions (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  icon TEXT DEFAULT 'briefcase',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.functions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "functions_select" ON public.functions;
CREATE POLICY "functions_select" ON public.functions
  FOR SELECT USING (is_active = true OR is_admin());

DROP POLICY IF EXISTS "functions_admin" ON public.functions;
CREATE POLICY "functions_admin" ON public.functions
  FOR ALL USING (is_admin());

GRANT ALL ON public.functions TO service_role;
GRANT ALL ON SEQUENCE public.functions_id_seq TO service_role;

INSERT INTO public.functions (name, description, color, icon) VALUES
  ('Estoquista', 'Recebimento e controle de estoque', '#10b981', 'package'),
  ('Cozinheiro', 'Preparacao de alimentos e higiene', '#f59e0b', 'flame'),
  ('Zelador', 'Limpeza e manutencao geral', '#8b5cf6', 'sparkles'),
  ('Garcom', 'Atendimento ao cliente no salao', '#3b82f6', 'users'),
  ('Aprendiz', 'Funcionario em treinamento', '#f97316', 'book-open')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 2. TABELA "sectors" (setores por loja)
-- ============================================
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

ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sectors_select" ON public.sectors;
CREATE POLICY "sectors_select" ON public.sectors
  FOR SELECT USING (
    is_active = true
    OR is_admin()
    OR store_id IN (SELECT user_store_ids())
  );

DROP POLICY IF EXISTS "sectors_admin" ON public.sectors;
CREATE POLICY "sectors_admin" ON public.sectors
  FOR ALL USING (is_admin());

GRANT ALL ON public.sectors TO service_role;
GRANT ALL ON SEQUENCE public.sectors_id_seq TO service_role;

-- ============================================
-- 3. TABELAS LEGADAS (compatibilidade)
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_sectors (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  sector_id INTEGER NOT NULL REFERENCES public.sectors(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  assigned_by UUID REFERENCES public.users(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, sector_id)
);

CREATE INDEX IF NOT EXISTS idx_user_sectors_user ON public.user_sectors(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sectors_sector ON public.user_sectors(sector_id);

ALTER TABLE public.user_sectors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_sectors_select" ON public.user_sectors;
CREATE POLICY "user_sectors_select" ON public.user_sectors
  FOR SELECT USING (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "user_sectors_admin" ON public.user_sectors;
CREATE POLICY "user_sectors_admin" ON public.user_sectors
  FOR ALL USING (is_admin());

GRANT ALL ON public.user_sectors TO service_role;
GRANT ALL ON SEQUENCE public.user_sectors_id_seq TO service_role;

CREATE TABLE IF NOT EXISTS public.store_managers (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  store_id INTEGER NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  can_view_all_checklists BOOLEAN DEFAULT true,
  can_view_reports BOOLEAN DEFAULT true,
  can_manage_users BOOLEAN DEFAULT false,
  assigned_by UUID REFERENCES public.users(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, store_id)
);

CREATE INDEX IF NOT EXISTS idx_store_managers_user ON public.store_managers(user_id);
CREATE INDEX IF NOT EXISTS idx_store_managers_store ON public.store_managers(store_id);

ALTER TABLE public.store_managers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "store_managers_select" ON public.store_managers;
CREATE POLICY "store_managers_select" ON public.store_managers
  FOR SELECT USING (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "store_managers_admin" ON public.store_managers;
CREATE POLICY "store_managers_admin" ON public.store_managers
  FOR ALL USING (is_admin());

GRANT ALL ON public.store_managers TO service_role;
GRANT ALL ON SEQUENCE public.store_managers_id_seq TO service_role;

CREATE TABLE IF NOT EXISTS public.user_store_roles (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  store_id INTEGER NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('estoquista', 'aprendiz', 'supervisor', 'gerente')),
  assigned_by UUID REFERENCES public.users(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, store_id, role)
);

CREATE INDEX IF NOT EXISTS idx_user_store_roles_user ON public.user_store_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_store_roles_store ON public.user_store_roles(store_id);

ALTER TABLE public.user_store_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "roles_select" ON public.user_store_roles;
CREATE POLICY "roles_select" ON public.user_store_roles
  FOR SELECT USING (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "roles_admin" ON public.user_store_roles;
CREATE POLICY "roles_admin" ON public.user_store_roles
  FOR ALL USING (is_admin());

GRANT ALL ON public.user_store_roles TO service_role;
GRANT ALL ON SEQUENCE public.user_store_roles_id_seq TO service_role;

-- ============================================
-- 4. COLUNAS NECESSARIAS EM TABELAS EXISTENTES
-- ============================================

-- users: function_id e sector_id
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS function_id INTEGER REFERENCES public.functions(id) ON DELETE SET NULL;

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS sector_id INTEGER REFERENCES public.sectors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_function ON public.users(function_id);
CREATE INDEX IF NOT EXISTS idx_users_sector ON public.users(sector_id);

-- checklists: sector_id
ALTER TABLE public.checklists
ADD COLUMN IF NOT EXISTS sector_id INTEGER REFERENCES public.sectors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_checklists_sector ON public.checklists(sector_id);

-- template_visibility: roles, sector_id, function_id
ALTER TABLE public.template_visibility
ADD COLUMN IF NOT EXISTS roles TEXT[] DEFAULT ARRAY[]::text[];

ALTER TABLE public.template_visibility
ADD COLUMN IF NOT EXISTS sector_id INTEGER REFERENCES public.sectors(id) ON DELETE CASCADE;

ALTER TABLE public.template_visibility
ADD COLUMN IF NOT EXISTS function_id INTEGER REFERENCES public.functions(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_template_visibility_sector ON public.template_visibility(sector_id);
CREATE INDEX IF NOT EXISTS idx_template_visibility_function ON public.template_visibility(function_id);

ALTER TABLE public.template_visibility
DROP CONSTRAINT IF EXISTS template_visibility_template_store_sector_key;

ALTER TABLE public.template_visibility
DROP CONSTRAINT IF EXISTS template_visibility_template_id_store_id_key;

ALTER TABLE public.template_visibility
DROP CONSTRAINT IF EXISTS template_visibility_unique_combo;

ALTER TABLE public.template_visibility
ADD CONSTRAINT template_visibility_unique_combo
UNIQUE(template_id, store_id, sector_id, function_id);

-- ============================================
-- 5. FUNCOES AUXILIARES
-- ============================================

CREATE OR REPLACE FUNCTION user_function_id()
RETURNS INTEGER AS $$
BEGIN
  RETURN (SELECT function_id FROM public.users WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION user_sector_id()
RETURNS INTEGER AS $$
BEGIN
  RETURN (SELECT sector_id FROM public.users WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION user_is_manager()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE((SELECT is_manager FROM public.users WHERE id = auth.uid()), false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_store_manager(check_store_id INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.store_managers
    WHERE user_id = auth.uid() AND store_id = check_store_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. SEED DE SETORES PADRAO POR LOJA
-- ============================================
DO $$
DECLARE
  store_rec RECORD;
BEGIN
  FOR store_rec IN SELECT id FROM public.stores WHERE is_active = true
  LOOP
    INSERT INTO public.sectors (name, store_id, color, icon)
    VALUES
      ('Cozinha', store_rec.id, '#f59e0b', 'flame'),
      ('Estoque', store_rec.id, '#10b981', 'package'),
      ('Salao', store_rec.id, '#3b82f6', 'users')
    ON CONFLICT (store_id, name) DO NOTHING;
  END LOOP;
END $$;

-- ============================================
-- 7. TABELA USER_STORES (juncao usuario <-> loja)
-- ============================================
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

-- ============================================
-- 8. TRIGGERS DE USER_STORES
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
-- 9. MIGRAR DADOS EXISTENTES (users.store_id -> user_stores)
-- ============================================
INSERT INTO public.user_stores (user_id, store_id, sector_id, is_primary)
SELECT id, store_id, sector_id, true
FROM public.users
WHERE store_id IS NOT NULL AND is_admin = false
ON CONFLICT (user_id, store_id) DO NOTHING;

-- ============================================
-- 10. RLS PARA USER_STORES
-- ============================================
ALTER TABLE public.user_stores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_stores_select" ON public.user_stores;
CREATE POLICY "user_stores_select" ON public.user_stores
  FOR SELECT USING (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "user_stores_admin" ON public.user_stores;
CREATE POLICY "user_stores_admin" ON public.user_stores
  FOR ALL USING (is_admin());

GRANT ALL ON public.user_stores TO service_role;
GRANT ALL ON SEQUENCE public.user_stores_id_seq TO service_role;

-- ============================================
-- 11. FUNCOES AUXILIARES MULTI-LOJA
-- ============================================

-- user_store_id() le da user_stores (primary)
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

-- user_store_ids() retorna TODAS as lojas do usuario
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

-- ============================================
-- 12. RLS - CHECKLISTS (gerente multi-loja)
-- ============================================

DROP POLICY IF EXISTS "checklists_select" ON public.checklists;
CREATE POLICY "checklists_select" ON public.checklists
  FOR SELECT USING (
    is_admin()
    OR (user_is_manager() AND store_id IN (SELECT user_store_ids()))
    OR created_by = auth.uid()
  );

DROP POLICY IF EXISTS "checklists_insert" ON public.checklists;
CREATE POLICY "checklists_insert" ON public.checklists
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND store_id IN (SELECT user_store_ids())
    AND NOT user_is_manager()
  );

DROP POLICY IF EXISTS "checklists_update" ON public.checklists;
CREATE POLICY "checklists_update" ON public.checklists
  FOR UPDATE USING (
    is_admin()
    OR (created_by = auth.uid() AND store_id IN (SELECT user_store_ids()))
  );

-- ============================================
-- 13. RLS - RESPOSTAS (gerente multi-loja)
-- ============================================

DROP POLICY IF EXISTS "responses_select" ON public.checklist_responses;
CREATE POLICY "responses_select" ON public.checklist_responses
  FOR SELECT USING (
    is_admin()
    OR checklist_id IN (
      SELECT id FROM public.checklists
      WHERE (user_is_manager() AND store_id IN (SELECT user_store_ids()))
         OR created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "responses_insert" ON public.checklist_responses;
CREATE POLICY "responses_insert" ON public.checklist_responses
  FOR INSERT WITH CHECK (
    checklist_id IN (
      SELECT id FROM public.checklists
      WHERE created_by = auth.uid() AND store_id IN (SELECT user_store_ids())
    )
  );

DROP POLICY IF EXISTS "responses_update" ON public.checklist_responses;
CREATE POLICY "responses_update" ON public.checklist_responses
  FOR UPDATE USING (
    is_admin()
    OR checklist_id IN (
      SELECT id FROM public.checklists
      WHERE created_by = auth.uid() AND store_id IN (SELECT user_store_ids())
    )
  );

-- ============================================
-- 14. RLS - ANEXOS (gerente multi-loja)
-- ============================================

DROP POLICY IF EXISTS "attachments_select" ON public.attachments;
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

DROP POLICY IF EXISTS "attachments_insert" ON public.attachments;
CREATE POLICY "attachments_insert" ON public.attachments
  FOR INSERT WITH CHECK (
    response_id IN (
      SELECT r.id FROM public.checklist_responses r
      JOIN public.checklists c ON r.checklist_id = c.id
      WHERE c.created_by = auth.uid() AND c.store_id IN (SELECT user_store_ids())
    )
  );

-- ============================================
-- 15. VERIFICACAO
-- ============================================
SELECT 'Lojas' as tipo, COUNT(*) as total FROM public.stores WHERE is_active = true
UNION ALL
SELECT 'Funcoes', COUNT(*) FROM public.functions WHERE is_active = true
UNION ALL
SELECT 'Setores', COUNT(*) FROM public.sectors WHERE is_active = true
UNION ALL
SELECT 'user_stores', COUNT(*) FROM public.user_stores
UNION ALL
SELECT 'Templates', COUNT(*) FROM public.checklist_templates WHERE is_active = true
UNION ALL
SELECT 'Visibilidades', COUNT(*) FROM public.template_visibility
UNION ALL
SELECT 'Usuarios', COUNT(*) FROM public.users
UNION ALL
SELECT 'Admins', COUNT(*) FROM public.users WHERE is_admin = true;
