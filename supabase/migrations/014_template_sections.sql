-- ============================================
-- Migration 014: Template Sections (Subgrupos)
-- ============================================
-- Adiciona suporte a secoes/subgrupos dentro de um template.
-- Um template pode ter 0..N secoes. Cada secao agrupa campos.
-- Templates sem secoes continuam funcionando normalmente.

-- 1. Tabela de secoes do template
CREATE TABLE IF NOT EXISTS template_sections (
  id BIGSERIAL PRIMARY KEY,
  template_id BIGINT NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0
);

-- 2. Coluna section_id em template_fields (nullable = backwards compatible)
ALTER TABLE template_fields ADD COLUMN IF NOT EXISTS section_id BIGINT REFERENCES template_sections(id) ON DELETE SET NULL;

-- 3. Tabela de progresso de secoes por checklist
CREATE TABLE IF NOT EXISTS checklist_sections (
  id BIGSERIAL PRIMARY KEY,
  checklist_id BIGINT NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
  section_id BIGINT NOT NULL REFERENCES template_sections(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'concluido')),
  completed_at TIMESTAMPTZ,
  UNIQUE(checklist_id, section_id)
);

-- 4. Indices
CREATE INDEX IF NOT EXISTS idx_template_sections_template_id ON template_sections(template_id);
CREATE INDEX IF NOT EXISTS idx_template_fields_section_id ON template_fields(section_id);
CREATE INDEX IF NOT EXISTS idx_checklist_sections_checklist_id ON checklist_sections(checklist_id);
CREATE INDEX IF NOT EXISTS idx_checklist_sections_section_id ON checklist_sections(section_id);

-- 5. RLS - template_sections
ALTER TABLE template_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "template_sections_select" ON template_sections
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "template_sections_insert" ON template_sections
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "template_sections_update" ON template_sections
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "template_sections_delete" ON template_sections
  FOR DELETE TO authenticated USING (true);

-- 6. RLS - checklist_sections
ALTER TABLE checklist_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checklist_sections_select" ON checklist_sections
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "checklist_sections_insert" ON checklist_sections
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "checklist_sections_update" ON checklist_sections
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "checklist_sections_delete" ON checklist_sections
  FOR DELETE TO authenticated USING (true);
