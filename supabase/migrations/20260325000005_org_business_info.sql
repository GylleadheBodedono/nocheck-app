-- Dados empresariais coletados no cadastro (CNPJ, tipo, cidade, etc.)
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS business_info JSONB DEFAULT '{}';

-- Estrutura esperada do business_info:
-- {
--   "cnpj": "XX.XXX.XXX/XXXX-XX",
--   "businessType": "restaurante|bar|lanchonete|padaria|hotel|outro",
--   "employeeRange": "1-10|11-50|51-200|200+",
--   "city": "Recife",
--   "state": "PE"
-- }
