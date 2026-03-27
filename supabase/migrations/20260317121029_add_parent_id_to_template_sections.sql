-- Compatibility: parent_id already exists in initial_schema CREATE TABLE.
-- This file matches the production schema_migrations entry.
ALTER TABLE public.template_sections
  ADD COLUMN IF NOT EXISTS parent_id bigint
  REFERENCES public.template_sections(id) ON DELETE CASCADE DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_template_sections_parent_id
  ON public.template_sections(parent_id);

COMMENT ON COLUMN public.template_sections.parent_id
  IS 'ID da etapa pai. NULL = etapa raiz. Preenchido = sub-etapa.';
