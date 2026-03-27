-- Adicionar 'deadline_change' ao CHECK constraint de action_plan_updates.update_type
-- Permite que responsaveis alterem o prazo de planos de acao

ALTER TABLE public.action_plan_updates
DROP CONSTRAINT IF EXISTS action_plan_updates_update_type_check;

ALTER TABLE public.action_plan_updates
ADD CONSTRAINT action_plan_updates_update_type_check
CHECK (update_type IN ('comment','status_change','evidence','reassign','deadline_change'));
