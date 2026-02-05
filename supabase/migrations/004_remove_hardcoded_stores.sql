-- NôCheck v2.2 - Remover lojas fixas
-- Torna o sistema genérico para qualquer empresa/lojas

-- ATENÇÃO: Esta migration vai DESATIVAR as lojas pré-definidas
-- Se você já tem dados associados a essas lojas, eles serão mantidos
-- mas as lojas ficarão inativas

-- Desativar lojas pré-definidas (não deleta para preservar histórico)
UPDATE public.stores
SET is_active = false
WHERE id IN (1, 2, 3, 4, 5, 6, 7, 8);

-- OU se preferir deletar completamente (descomente abaixo):
DELETE FROM public.stores WHERE id IN (1, 2, 3, 4, 5, 6, 7, 8);

-- Resetar a sequência de IDs para começar do 1
-- (só funciona se deletar as lojas acima)
-- SELECT setval('stores_id_seq', 1, false);
