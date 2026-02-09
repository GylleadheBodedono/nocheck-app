-- Generalizar validacao cruzada para todos os setores
-- Antes: so funcionava para templates de "recebimento" (estoquista vs aprendiz)
-- Agora: funciona para qualquer setor (Aprendiz vs funcionario do mesmo setor)

-- Adicionar coluna sector_id para rastrear o setor da validacao
ALTER TABLE public.cross_validations
ADD COLUMN IF NOT EXISTS sector_id INTEGER REFERENCES public.sectors(id) ON DELETE SET NULL;

-- Atualizar constraint de status para incluir 'expirado'
ALTER TABLE public.cross_validations DROP CONSTRAINT IF EXISTS cross_validations_status_check;
ALTER TABLE public.cross_validations
ADD CONSTRAINT cross_validations_status_check
CHECK (status IN ('pendente', 'sucesso', 'falhou', 'notas_diferentes', 'expirado'));

-- Indice para buscas por loja + setor + status
CREATE INDEX IF NOT EXISTS idx_validations_store_sector_status
ON public.cross_validations(store_id, sector_id, status);

COMMENT ON COLUMN public.cross_validations.sector_id IS 'Setor da validacao - permite filtrar divergencias por setor';
