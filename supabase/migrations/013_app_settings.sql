-- ============================================
-- Migration 013: app_settings + remocao do papel de gerente
-- ============================================

-- ============================================
-- 1. TABELA APP_SETTINGS
-- ============================================

CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Valor padrao: 60 minutos para expiracao de validacao cruzada
INSERT INTO public.app_settings (key, value, description)
VALUES ('validation_expiration_minutes', '60', 'Tempo em minutos para expirar validacoes cruzadas pendentes')
ON CONFLICT (key) DO NOTHING;

-- RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ler configuracoes"
  ON public.app_settings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins podem atualizar configuracoes"
  ON public.app_settings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.is_admin = true
    )
  );

-- ============================================
-- 2. REMOCAO DO PAPEL DE GERENTE
-- O gerente agora e uma funcao normal na tabela functions.
-- Ordem: dropar policies primeiro, depois funcoes e tabelas.
-- ============================================

-- 2a. Dropar policies que dependem de user_is_manager()
DROP POLICY IF EXISTS "checklists_select" ON public.checklists;
DROP POLICY IF EXISTS "checklists_insert" ON public.checklists;
DROP POLICY IF EXISTS "responses_select" ON public.checklist_responses;
DROP POLICY IF EXISTS "attachments_select" ON public.attachments;

-- 2b. Dropar tabela store_managers e suas policies
DROP TABLE IF EXISTS public.store_managers CASCADE;

-- 2c. Dropar funcoes relacionadas ao gerente
DROP FUNCTION IF EXISTS public.user_is_manager();
DROP FUNCTION IF EXISTS public.is_store_manager(uuid, bigint);
DROP FUNCTION IF EXISTS public.user_managed_store_ids(uuid);

-- 2d. Remover coluna is_manager da tabela users
ALTER TABLE public.users DROP COLUMN IF EXISTS is_manager;

-- ============================================
-- 3. RECRIAR RLS POLICIES (sem referencia a user_is_manager)
-- ============================================

-- Checklists: admin ve tudo, usuario ve so os seus
DROP POLICY IF EXISTS "checklists_select" ON public.checklists;
CREATE POLICY "checklists_select" ON public.checklists
  FOR SELECT USING (
    is_admin()
    OR created_by = auth.uid()
  );

-- Checklists insert: usuario pode criar nas suas lojas
DROP POLICY IF EXISTS "checklists_insert" ON public.checklists;
CREATE POLICY "checklists_insert" ON public.checklists
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND store_id IN (SELECT user_store_ids())
  );

-- Checklists update: admin ou criador
DROP POLICY IF EXISTS "checklists_update" ON public.checklists;
CREATE POLICY "checklists_update" ON public.checklists
  FOR UPDATE USING (
    is_admin()
    OR (created_by = auth.uid() AND store_id IN (SELECT user_store_ids()))
  );

-- Respostas select: admin ou criador do checklist
DROP POLICY IF EXISTS "responses_select" ON public.checklist_responses;
CREATE POLICY "responses_select" ON public.checklist_responses
  FOR SELECT USING (
    is_admin()
    OR checklist_id IN (
      SELECT id FROM public.checklists
      WHERE created_by = auth.uid()
    )
  );

-- Respostas insert: criador do checklist
DROP POLICY IF EXISTS "responses_insert" ON public.checklist_responses;
CREATE POLICY "responses_insert" ON public.checklist_responses
  FOR INSERT WITH CHECK (
    checklist_id IN (
      SELECT id FROM public.checklists
      WHERE created_by = auth.uid() AND store_id IN (SELECT user_store_ids())
    )
  );

-- Respostas update: admin ou criador
DROP POLICY IF EXISTS "responses_update" ON public.checklist_responses;
CREATE POLICY "responses_update" ON public.checklist_responses
  FOR UPDATE USING (
    is_admin()
    OR checklist_id IN (
      SELECT id FROM public.checklists
      WHERE created_by = auth.uid() AND store_id IN (SELECT user_store_ids())
    )
  );

-- Anexos select: admin ou criador do checklist
DROP POLICY IF EXISTS "attachments_select" ON public.attachments;
CREATE POLICY "attachments_select" ON public.attachments
  FOR SELECT USING (
    is_admin()
    OR response_id IN (
      SELECT r.id FROM public.checklist_responses r
      JOIN public.checklists c ON r.checklist_id = c.id
      WHERE c.created_by = auth.uid()
    )
  );

-- Anexos insert: criador do checklist
DROP POLICY IF EXISTS "attachments_insert" ON public.attachments;
CREATE POLICY "attachments_insert" ON public.attachments
  FOR INSERT WITH CHECK (
    response_id IN (
      SELECT r.id FROM public.checklist_responses r
      JOIN public.checklists c ON r.checklist_id = c.id
      WHERE c.created_by = auth.uid() AND c.store_id IN (SELECT user_store_ids())
    )
  );
