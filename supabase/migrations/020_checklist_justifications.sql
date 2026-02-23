-- ============================================
-- Migration 020: Checklist Justifications
-- ============================================
-- Adds 'incompleto' status and justification table for incomplete checklists

-- Add 'incompleto' to allowed status values
-- Note: Supabase doesn't use CHECK constraints for this typically,
-- but if one exists, update it
DO $$
BEGIN
  -- Try to drop existing constraint if it exists
  ALTER TABLE public.checklists DROP CONSTRAINT IF EXISTS checklists_status_check;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Create justifications table
CREATE TABLE IF NOT EXISTS public.checklist_justifications (
  id SERIAL PRIMARY KEY,
  checklist_id INTEGER NOT NULL REFERENCES public.checklists(id) ON DELETE CASCADE,
  field_id INTEGER NOT NULL REFERENCES public.template_fields(id) ON DELETE CASCADE,
  justification_text TEXT NOT NULL,
  justified_by UUID REFERENCES public.users(id),
  justified_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(checklist_id, field_id)
);

CREATE INDEX IF NOT EXISTS idx_justifications_checklist ON public.checklist_justifications(checklist_id);

-- RLS policies for checklist_justifications
ALTER TABLE public.checklist_justifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert justifications for their checklists"
  ON public.checklist_justifications FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.checklists c
      WHERE c.id = checklist_id AND c.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can view justifications for accessible checklists"
  ON public.checklist_justifications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.checklists c
      WHERE c.id = checklist_id
        AND (c.created_by = auth.uid() OR public.is_admin())
    )
  );
