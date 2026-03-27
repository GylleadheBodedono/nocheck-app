-- Adiciona políticas de SELECT para platform admin nas tabelas checklists e activity_log
-- Necessário para que o dashboard do super admin mostre estatísticas de todos os clientes

CREATE POLICY "checklists_select_platform_admin" ON public.checklists
  FOR SELECT USING (
    coalesce(
      (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'is_platform_admin')::boolean,
      false
    )
  );

CREATE POLICY "activity_log_select_platform_admin" ON public.activity_log
  FOR SELECT USING (
    coalesce(
      (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'is_platform_admin')::boolean,
      false
    )
  );
