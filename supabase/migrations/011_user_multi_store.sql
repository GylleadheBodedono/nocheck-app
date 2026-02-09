-- NôCheck v3.1 - Funcionário em Múltiplas Lojas
-- Permite que um funcionário pertença a mais de uma loja simultaneamente.
--
-- Mudanças:
-- 1. Nova tabela "user_stores" (junção usuário ↔ loja, com setor por loja)
-- 2. Triggers: validação de setor, primary único, sync com users.store_id
-- 3. Migração de dados existentes (users.store_id → user_stores)
-- 4. RLS para user_stores
-- 5. Funções auxiliares atualizadas (user_store_id, user_store_ids)
-- 6. Políticas RLS de checklists/respostas/anexos atualizadas para multi-loja

-- ============================================
-- 1. TABELA USER_STORES (junção usuário ↔ loja)
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
-- 2. TRIGGER: setor deve pertencer à loja
-- ============================================
CREATE OR REPLACE FUNCTION public.check_user_store_sector()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sector_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.sectors
      WHERE id = NEW.sector_id AND store_id = NEW.store_id
    ) THEN
      RAISE EXCEPTION 'Setor % não pertence à loja %', NEW.sector_id, NEW.store_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_stores_check_sector ON public.user_stores;
CREATE TRIGGER user_stores_check_sector
  BEFORE INSERT OR UPDATE ON public.user_stores
  FOR EACH ROW EXECUTE FUNCTION public.check_user_store_sector();

-- ============================================
-- 3. TRIGGER: apenas um is_primary = true por usuário
-- ============================================
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

-- ============================================
-- 4. TRIGGER: sync users.store_id com loja primária
-- ============================================
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

-- Quando loja primária é deletada, promover outra ou limpar
CREATE OR REPLACE FUNCTION public.sync_user_primary_store_delete()
RETURNS TRIGGER AS $$
DECLARE
  next_store_id INTEGER;
BEGIN
  IF OLD.is_primary = true THEN
    -- Tenta promover outra loja
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
      -- Sem outra loja: limpar users
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
-- 5. MIGRAR DADOS EXISTENTES
-- ============================================
INSERT INTO public.user_stores (user_id, store_id, sector_id, is_primary)
SELECT id, store_id, sector_id, true
FROM public.users
WHERE store_id IS NOT NULL AND is_admin = false
ON CONFLICT (user_id, store_id) DO NOTHING;

-- ============================================
-- 6. RLS PARA USER_STORES
-- ============================================
ALTER TABLE public.user_stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_stores_select" ON public.user_stores
  FOR SELECT USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "user_stores_admin" ON public.user_stores
  FOR ALL USING (is_admin());

GRANT ALL ON public.user_stores TO service_role;
GRANT ALL ON SEQUENCE public.user_stores_id_seq TO service_role;

-- ============================================
-- 7. ATUALIZAR FUNÇÕES AUXILIARES
-- ============================================

-- user_store_id() agora lê da user_stores (primary)
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

-- user_store_ids() retorna TODAS as lojas do usuário
CREATE OR REPLACE FUNCTION user_store_ids()
RETURNS SETOF INTEGER AS $$
BEGIN
  RETURN QUERY
  -- Novo modelo: user_stores
  SELECT us.store_id FROM public.user_stores us
  WHERE us.user_id = auth.uid()
  UNION
  -- Fallback: users.store_id (compatibilidade)
  SELECT u.store_id FROM public.users u
  WHERE u.id = auth.uid() AND u.store_id IS NOT NULL
  UNION
  -- Fallback legado: user_store_roles
  SELECT usr.store_id FROM public.user_store_roles usr
  WHERE usr.user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. ATUALIZAR RLS - CHECKLISTS (gerente multi-loja)
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
-- 9. ATUALIZAR RLS - RESPOSTAS (gerente multi-loja)
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
-- 10. ATUALIZAR RLS - ANEXOS (gerente multi-loja)
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
-- 11. VERIFICAÇÃO
-- ============================================
SELECT
  'user_stores migrados' as info,
  COUNT(*) as total
FROM public.user_stores;
