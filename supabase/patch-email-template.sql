-- ============================================
-- PATCH: Seed de templates de email no app_settings
-- Execute no Supabase SQL Editor.
-- ============================================

INSERT INTO public.app_settings (key, value, description) VALUES
  ('action_plan_email_subject', '[NoCheck] {{reincidencia_prefix}}Plano de Acao: {{field_name}}', 'Template do assunto do email de plano de acao. Variaveis: {{field_name}}, {{store_name}}, {{severity}}, etc.')
ON CONFLICT (key) DO NOTHING;

-- O template HTML e salvo via admin UI (/admin/configuracoes).
-- Se nao houver template salvo, o sistema usa o padrao hardcoded.
-- Nao precisamos inserir o HTML aqui pois o codigo ja tem fallback.

-- ============================================
-- FIM DO PATCH
-- ============================================
