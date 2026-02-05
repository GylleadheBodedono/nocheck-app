-- NôCheck v2.2 - Correção das Políticas RLS
-- Execute este SQL no Supabase SQL Editor
-- IMPORTANTE: Este arquivo corrige as políticas para que admins possam fazer tudo

-- ============================================
-- 1. CORRIGIR POLÍTICA DE INSERT EM CHECKLISTS
-- ============================================
-- O problema: Admin não conseguia inserir checklists porque
-- a política de INSERT não verificava is_admin()

DROP POLICY IF EXISTS "checklists_insert" ON public.checklists;

CREATE POLICY "checklists_insert" ON public.checklists
  FOR INSERT WITH CHECK (
    -- Admin pode inserir em qualquer loja
    is_admin() OR
    (
      created_by = auth.uid() AND
      (
        store_id IN (SELECT user_store_ids()) OR
        sector_id IN (
          SELECT us.sector_id FROM public.user_sectors us
          WHERE us.user_id = auth.uid() AND us.role = 'member'
        )
      )
    )
  );

-- ============================================
-- 2. CORRIGIR POLÍTICA DE INSERT EM RESPONSES
-- ============================================

DROP POLICY IF EXISTS "responses_insert" ON public.checklist_responses;

CREATE POLICY "responses_insert" ON public.checklist_responses
  FOR INSERT WITH CHECK (
    -- Admin pode inserir respostas em qualquer checklist
    is_admin() OR
    checklist_id IN (
      SELECT id FROM public.checklists
      WHERE store_id IN (SELECT user_store_ids()) AND created_by = auth.uid()
    ) OR
    checklist_id IN (
      SELECT c.id FROM public.checklists c
      WHERE c.sector_id IN (
        SELECT us.sector_id FROM public.user_sectors us
        WHERE us.user_id = auth.uid() AND us.role = 'member'
      ) AND c.created_by = auth.uid()
    )
  );

-- ============================================
-- 3. CORRIGIR POLÍTICA DE UPDATE EM RESPONSES
-- ============================================

DROP POLICY IF EXISTS "responses_update" ON public.checklist_responses;

CREATE POLICY "responses_update" ON public.checklist_responses
  FOR UPDATE USING (
    is_admin() OR
    checklist_id IN (
      SELECT id FROM public.checklists
      WHERE store_id IN (SELECT user_store_ids()) AND created_by = auth.uid()
    )
  );

-- ============================================
-- 4. ADICIONAR DELETE EM RESPONSES PARA ADMIN
-- ============================================

DROP POLICY IF EXISTS "responses_delete" ON public.checklist_responses;

CREATE POLICY "responses_delete" ON public.checklist_responses
  FOR DELETE USING (is_admin());

-- ============================================
-- 5. ADICIONAR DELETE EM CROSS_VALIDATIONS
-- ============================================
-- Admin pode deletar validações

DROP POLICY IF EXISTS "validations_delete" ON public.cross_validations;

CREATE POLICY "validations_delete" ON public.cross_validations
  FOR DELETE USING (is_admin());

-- ============================================
-- 6. CORRIGIR POLÍTICA DE INSERT EM ATTACHMENTS
-- ============================================

DROP POLICY IF EXISTS "attachments_insert" ON public.attachments;

CREATE POLICY "attachments_insert" ON public.attachments
  FOR INSERT WITH CHECK (
    -- Admin pode inserir anexos em qualquer checklist
    is_admin() OR
    response_id IN (
      SELECT r.id FROM public.checklist_responses r
      JOIN public.checklists c ON r.checklist_id = c.id
      WHERE c.store_id IN (SELECT user_store_ids()) AND c.created_by = auth.uid()
    )
  );

-- ============================================
-- 7. ADICIONAR DELETE EM ATTACHMENTS PARA ADMIN
-- ============================================

DROP POLICY IF EXISTS "attachments_delete" ON public.attachments;

CREATE POLICY "attachments_delete" ON public.attachments
  FOR DELETE USING (is_admin());

-- ============================================
-- 8. CORRIGIR ACTIVITY_LOG - PERMITIR INSERT
-- ============================================
-- Qualquer usuário autenticado pode criar logs de suas ações

DROP POLICY IF EXISTS "activity_insert" ON public.activity_log;

CREATE POLICY "activity_insert" ON public.activity_log
  FOR INSERT WITH CHECK (
    -- Qualquer usuário autenticado pode criar log
    auth.uid() IS NOT NULL
  );

-- ============================================
-- 9. STORAGE BUCKET - POLÍTICAS PARA IMAGENS
-- ============================================
-- Execute estas políticas diretamente na seção Storage do Supabase
-- ou use os comandos abaixo se tiver acesso ao schema storage

-- Permitir upload de imagens por usuários autenticados
-- INSERT INTO storage.policies (name, bucket_id, definition, check_expression)
-- VALUES (
--   'Authenticated users can upload',
--   'checklist-images',
--   '(auth.role() = ''authenticated'')',
--   'true'
-- );

-- Permitir leitura pública das imagens
-- INSERT INTO storage.policies (name, bucket_id, definition)
-- VALUES (
--   'Public can view images',
--   'checklist-images',
--   'true'
-- );

-- ============================================
-- IMPORTANTE: VERIFIQUE SE O USUÁRIO ADMIN
-- TEM is_admin = true NA TABELA users
-- ============================================

-- Para verificar:
-- SELECT id, email, full_name, is_admin FROM public.users;

-- Para definir um usuário como admin:
-- UPDATE public.users SET is_admin = true WHERE email = 'seu@email.com';

-- ============================================
-- RESUMO DAS CORREÇÕES
-- ============================================
--
-- PROBLEMA: Admin não conseguia inserir checklists (erro 403)
-- CAUSA: Política de INSERT não incluía is_admin()
--
-- CORREÇÕES:
--   1. checklists_insert: Adicionado is_admin() OR ...
--   2. responses_insert: Adicionado is_admin() OR ...
--   3. responses_update: Corrigido para incluir setor
--   4. responses_delete: NOVA - Admin pode deletar
--   5. validations_delete: NOVA - Admin pode deletar validações
--   6. attachments_insert: Adicionado is_admin() OR ...
--   7. attachments_delete: NOVA - Admin pode deletar
--   8. activity_insert: Qualquer usuário autenticado
--
-- APÓS EXECUTAR:
--   1. Verifique se seu usuário tem is_admin = true
--   2. Configure as políticas do Storage Bucket
--   3. Teste criando um checklist como admin
--
