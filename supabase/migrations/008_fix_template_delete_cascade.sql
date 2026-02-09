-- NôCheck v3.2 - Fix: permite excluir templates com checklists vinculados
-- Altera FK checklists.template_id para ON DELETE CASCADE

ALTER TABLE public.checklists
DROP CONSTRAINT IF EXISTS checklists_template_id_fkey;

ALTER TABLE public.checklists
ADD CONSTRAINT checklists_template_id_fkey
FOREIGN KEY (template_id) REFERENCES public.checklist_templates(id) ON DELETE CASCADE;
