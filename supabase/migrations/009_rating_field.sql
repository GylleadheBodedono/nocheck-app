-- NôCheck v3.1 - Campo de Avaliação (Rating)
-- Adiciona tipo 'rating' ao campo field_type

ALTER TABLE public.template_fields
DROP CONSTRAINT IF EXISTS template_fields_field_type_check;

ALTER TABLE public.template_fields
ADD CONSTRAINT template_fields_field_type_check
CHECK (field_type IN (
  'text', 'number', 'photo', 'dropdown', 'signature',
  'datetime', 'checkbox_multiple', 'gps', 'barcode', 'calculated',
  'yes_no', 'rating'
));
