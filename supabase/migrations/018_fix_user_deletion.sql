-- ============================================
-- Migration 018: Fix User Deletion FK Constraints + Auto-Save Support
-- ============================================
-- Corrige todas as foreign keys para public.users(id) que nao tem ON DELETE rule,
-- adicionando ON DELETE SET NULL para permitir deleção de usuarios.
-- Também adiciona UNIQUE constraint para suportar auto-save via upsert.
-- ============================================

-- ============================================
-- PARTE A: Fix FK constraints para public.users(id)
-- ============================================

-- 1. activity_log.user_id -> ON DELETE SET NULL
ALTER TABLE public.activity_log
DROP CONSTRAINT IF EXISTS activity_log_user_id_fkey;

ALTER TABLE public.activity_log
ADD CONSTRAINT activity_log_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- 2. checklist_templates.created_by -> ON DELETE SET NULL
ALTER TABLE public.checklist_templates
DROP CONSTRAINT IF EXISTS checklist_templates_created_by_fkey;

ALTER TABLE public.checklist_templates
ADD CONSTRAINT checklist_templates_created_by_fkey
FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- 3. template_visibility.assigned_by -> ON DELETE SET NULL
ALTER TABLE public.template_visibility
DROP CONSTRAINT IF EXISTS template_visibility_assigned_by_fkey;

ALTER TABLE public.template_visibility
ADD CONSTRAINT template_visibility_assigned_by_fkey
FOREIGN KEY (assigned_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- 4. checklists.created_by: DROP NOT NULL + ON DELETE SET NULL
ALTER TABLE public.checklists ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE public.checklists
DROP CONSTRAINT IF EXISTS checklists_created_by_fkey;

ALTER TABLE public.checklists
ADD CONSTRAINT checklists_created_by_fkey
FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- 5. checklists.validated_by -> ON DELETE SET NULL
ALTER TABLE public.checklists
DROP CONSTRAINT IF EXISTS checklists_validated_by_fkey;

ALTER TABLE public.checklists
ADD CONSTRAINT checklists_validated_by_fkey
FOREIGN KEY (validated_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- 6. checklist_responses.answered_by -> ON DELETE SET NULL
ALTER TABLE public.checklist_responses
DROP CONSTRAINT IF EXISTS checklist_responses_answered_by_fkey;

ALTER TABLE public.checklist_responses
ADD CONSTRAINT checklist_responses_answered_by_fkey
FOREIGN KEY (answered_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- 7. attachments.uploaded_by -> ON DELETE SET NULL
ALTER TABLE public.attachments
DROP CONSTRAINT IF EXISTS attachments_uploaded_by_fkey;

ALTER TABLE public.attachments
ADD CONSTRAINT attachments_uploaded_by_fkey
FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- 8. user_store_roles.assigned_by -> ON DELETE SET NULL
ALTER TABLE public.user_store_roles
DROP CONSTRAINT IF EXISTS user_store_roles_assigned_by_fkey;

ALTER TABLE public.user_store_roles
ADD CONSTRAINT user_store_roles_assigned_by_fkey
FOREIGN KEY (assigned_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- 9. user_sectors.assigned_by -> ON DELETE SET NULL (tabela pode nao existir)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_sectors' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE public.user_sectors DROP CONSTRAINT IF EXISTS user_sectors_assigned_by_fkey';
    EXECUTE 'ALTER TABLE public.user_sectors ADD CONSTRAINT user_sectors_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id) ON DELETE SET NULL';
  END IF;
END $$;

-- 10. store_managers.assigned_by -> ON DELETE SET NULL (tabela pode nao existir)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'store_managers' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE public.store_managers DROP CONSTRAINT IF EXISTS store_managers_assigned_by_fkey';
    EXECUTE 'ALTER TABLE public.store_managers ADD CONSTRAINT store_managers_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id) ON DELETE SET NULL';
  END IF;
END $$;

-- 11. field_conditions.default_assignee_id -> ON DELETE SET NULL (tabela da migration 017)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'field_conditions' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE public.field_conditions DROP CONSTRAINT IF EXISTS field_conditions_default_assignee_id_fkey';
    EXECUTE 'ALTER TABLE public.field_conditions ADD CONSTRAINT field_conditions_default_assignee_id_fkey FOREIGN KEY (default_assignee_id) REFERENCES public.users(id) ON DELETE SET NULL';
  END IF;
END $$;

-- ============================================
-- PARTE B: UNIQUE constraint para auto-save upsert
-- ============================================

-- Remove respostas duplicadas (mantendo a mais recente por id)
DELETE FROM public.checklist_responses r1
USING public.checklist_responses r2
WHERE r1.checklist_id = r2.checklist_id
  AND r1.field_id = r2.field_id
  AND r1.id < r2.id;

-- Cria UNIQUE constraint para permitir upsert por (checklist_id, field_id)
ALTER TABLE public.checklist_responses
ADD CONSTRAINT checklist_responses_checklist_field_unique
UNIQUE (checklist_id, field_id);
