-- NôCheck v2.1 - Smart Validation Matching
-- Adiciona campos para vincular validações com notas fiscais diferentes mas relacionadas

-- Primeiro, remover a constraint antiga de status
ALTER TABLE public.cross_validations DROP CONSTRAINT IF EXISTS cross_validations_status_check;

-- Adicionar nova constraint que inclui 'notas_diferentes'
ALTER TABLE public.cross_validations
ADD CONSTRAINT cross_validations_status_check
CHECK (status IN ('pendente', 'sucesso', 'falhou', 'notas_diferentes'));

-- Adicionar campos para vinculação de notas "irmãs"
ALTER TABLE public.cross_validations
ADD COLUMN IF NOT EXISTS linked_validation_id INTEGER REFERENCES public.cross_validations(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS match_reason TEXT,
ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT true;

-- Índice para busca de validações vinculadas
CREATE INDEX IF NOT EXISTS idx_validations_linked ON public.cross_validations(linked_validation_id);

-- Comentários para documentação
COMMENT ON COLUMN public.cross_validations.linked_validation_id IS 'ID da validação vinculada quando notas são diferentes mas parecem relacionadas';
COMMENT ON COLUMN public.cross_validations.match_reason IS 'Motivo do vínculo: mesma loja, horário próximo (30min), primeiros 3 dígitos iguais';
COMMENT ON COLUMN public.cross_validations.is_primary IS 'Se true, esta é a validação principal do par vinculado';
