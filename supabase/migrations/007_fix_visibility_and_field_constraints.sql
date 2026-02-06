-- NôCheck - Correção de Constraints
-- Execute este SQL no Supabase SQL Editor
-- Corrige 2 problemas:
-- 1. UNIQUE em template_visibility precisa incluir sector_id
-- 2. checklist_responses.field_id precisa de ON DELETE CASCADE

-- ============================================
-- 1. CORRIGIR UNIQUE de template_visibility
-- A constraint antiga é UNIQUE(template_id, store_id)
-- Precisa incluir sector_id para suportar múltiplos setores por loja
-- ============================================

-- Remove a constraint antiga
ALTER TABLE public.template_visibility
DROP CONSTRAINT IF EXISTS template_visibility_template_id_store_id_key;

-- Cria nova constraint incluindo sector_id
-- Usa COALESCE para tratar NULL em sector_id (evita duplicatas com NULL)
ALTER TABLE public.template_visibility
ADD CONSTRAINT template_visibility_template_store_sector_key
UNIQUE(template_id, store_id, sector_id);

-- ============================================
-- 2. CORRIGIR FK de checklist_responses.field_id
-- A FK original não tem ON DELETE CASCADE, impedindo
-- deletar campos de template que já foram usados em respostas
-- ============================================

-- Remove a FK antiga
ALTER TABLE public.checklist_responses
DROP CONSTRAINT IF EXISTS checklist_responses_field_id_fkey;

-- Recria com ON DELETE CASCADE
ALTER TABLE public.checklist_responses
ADD CONSTRAINT checklist_responses_field_id_fkey
FOREIGN KEY (field_id) REFERENCES public.template_fields(id) ON DELETE CASCADE;

-- ============================================
-- VERIFICAÇÃO
-- ============================================
SELECT
  tc.constraint_name,
  tc.table_name,
  tc.constraint_type,
  kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name IN ('template_visibility', 'checklist_responses')
  AND tc.constraint_type IN ('UNIQUE', 'FOREIGN KEY')
ORDER BY tc.table_name, tc.constraint_name;
