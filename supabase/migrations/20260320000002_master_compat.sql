-- Colunas adicionadas na master (producao) que o saas nao tinha
ALTER TABLE action_plans ADD COLUMN IF NOT EXISTS assigned_function_id INTEGER REFERENCES functions(id);
ALTER TABLE field_conditions ADD COLUMN IF NOT EXISTS default_function_id INTEGER REFERENCES functions(id);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_url TEXT;
ALTER TABLE checklist_templates ADD COLUMN IF NOT EXISTS skip_justifications BOOLEAN DEFAULT false;

-- RLS: funcao responsavel pode ver action_plans
DROP POLICY IF EXISTS ap_select ON action_plans;
CREATE POLICY ap_select ON action_plans FOR SELECT USING (
  assigned_to = auth.uid()
  OR created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.function_id = action_plans.assigned_function_id)
  OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true)
);

DROP POLICY IF EXISTS ap_update ON action_plans;
CREATE POLICY ap_update ON action_plans FOR UPDATE USING (
  assigned_to = auth.uid()
  OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.function_id = action_plans.assigned_function_id)
  OR EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = true)
);

-- RLS: funcao responsavel pode ver checklists de origem
DROP POLICY IF EXISTS checklists_select ON checklists;
CREATE POLICY checklists_select ON checklists FOR SELECT USING (
  is_admin()
  OR (user_is_manager() AND store_id IN (SELECT user_store_ids()))
  OR created_by = auth.uid()
  OR id IN (SELECT checklist_id FROM action_plans WHERE assigned_to = auth.uid())
  OR id IN (SELECT checklist_id FROM action_plans WHERE assigned_function_id IN (
    SELECT function_id FROM users WHERE id = auth.uid()
  ))
);

-- RLS: funcao responsavel pode ver respostas
DROP POLICY IF EXISTS responses_select ON checklist_responses;
CREATE POLICY responses_select ON checklist_responses FOR SELECT USING (
  is_admin()
  OR checklist_id IN (SELECT id FROM checklists WHERE
    (user_is_manager() AND store_id IN (SELECT user_store_ids()))
    OR created_by = auth.uid()
  )
  OR checklist_id IN (SELECT checklist_id FROM action_plans WHERE assigned_to = auth.uid())
  OR checklist_id IN (SELECT checklist_id FROM action_plans WHERE assigned_function_id IN (
    SELECT function_id FROM users WHERE id = auth.uid()
  ))
);

-- RLS: tech users podem inserir campos
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'fields_tech_insert') THEN
    CREATE POLICY fields_tech_insert ON template_fields
    FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_tech = true)
    );
  END IF;
END $$;
