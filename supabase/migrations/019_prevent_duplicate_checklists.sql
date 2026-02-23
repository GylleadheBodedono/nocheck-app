-- ============================================
-- Migration 019: Prevent duplicate em_andamento checklists
-- ============================================
-- A user can only have ONE em_andamento checklist per template+store per day.

-- First, clean up existing duplicates (keep the newest one by id)
DELETE FROM public.checklists c1
WHERE c1.status = 'em_andamento'
  AND EXISTS (
    SELECT 1 FROM public.checklists c2
    WHERE c2.template_id = c1.template_id
      AND c2.store_id = c1.store_id
      AND c2.created_by = c1.created_by
      AND c2.status = 'em_andamento'
      AND DATE(c2.created_at AT TIME ZONE 'America/Sao_Paulo')
        = DATE(c1.created_at AT TIME ZONE 'America/Sao_Paulo')
      AND c2.id > c1.id
  );

-- Create partial unique index: only one em_andamento per template+store+user per day
CREATE UNIQUE INDEX IF NOT EXISTS idx_checklists_one_em_andamento_per_day
  ON public.checklists (template_id, store_id, created_by, (DATE(created_at AT TIME ZONE 'America/Sao_Paulo')))
  WHERE status = 'em_andamento';
