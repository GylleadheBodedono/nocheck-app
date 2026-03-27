// ============================================
// DTOs — Checklists e Templates
// ============================================
// Tipos de transferência para operações com checklists
// e templates: criação, preenchimento, respostas,
// seções e justificativas de campos incompletos.
// ============================================

import type { ChecklistStatus, FieldType } from '@/types/database'

/**
 * Resposta de um campo durante o preenchimento do checklist.
 * O tipo de valor preenchido depende do `field_type` do campo:
 *   - text, yes_no, dropdown, barcode → `valueText`
 *   - number, calculated, rating → `valueNumber`
 *   - gps, signature, photo, checkbox_multiple → `valueJson`
 */
export interface ChecklistResponseDTO {
  /** ID do campo respondido (template_fields.id) */
  fieldId: number
  /** Valor textual da resposta (texto, sim/não, dropdown, código de barras) */
  valueText?: string | null
  /** Valor numérico da resposta (número, cálculo automático, avaliação) */
  valueNumber?: number | null
  /**
   * Valor em JSON para tipos complexos.
   * GPS: `{ latitude, longitude, accuracy, timestamp }`
   * Assinatura: `{ dataUrl, timestamp }`
   * Foto: `{ url, path, timestamp }`
   * Múltipla escolha: `string[]`
   */
  valueJson?: Record<string, unknown> | null
}

/**
 * Dados para criar ou salvar um checklist.
 * Enviado ao iniciar/concluir um checklist no app.
 */
export interface SaveChecklistRequestDTO {
  /** ID do template de checklist selecionado */
  templateId: number
  /** ID da loja onde o checklist está sendo preenchido */
  storeId: number
  /** ID do setor dentro da loja (opcional) */
  sectorId?: number | null
  /** Status atual do checklist */
  status: ChecklistStatus
  /** Latitude coletada no início do checklist (se a loja exige GPS) */
  latitude?: number | null
  /** Longitude coletada no início do checklist */
  longitude?: number | null
  /** Precisão do GPS em metros */
  accuracy?: number | null
  /**
   * ID local gerado offline para sincronização.
   * Evita duplicatas ao sincronizar com o servidor.
   */
  localId?: string | null
  /** Lista de respostas preenchidas para os campos do template */
  responses: ChecklistResponseDTO[]
}

/**
 * Dados para criar um template de checklist.
 * Templates definem a estrutura dos formulários usados nas lojas.
 */
export interface CreateTemplateRequestDTO {
  /** Nome do template (ex: "Checklist de Abertura") */
  name: string
  /** Descrição explicando o objetivo do template */
  description?: string | null
  /** Categoria para organização e filtros */
  category?: 'recebimento' | 'limpeza' | 'abertura' | 'fechamento' | 'outros' | null
  /**
   * Horário mais cedo permitido para iniciar o preenchimento (formato "HH:MM").
   * Ex: "06:00" — não permite preencher antes das 6h.
   */
  allowedStartTime?: string | null
  /**
   * Horário mais tarde permitido para iniciar o preenchimento (formato "HH:MM").
   * Ex: "10:00" — não permite preencher após as 10h.
   */
  allowedEndTime?: string | null
  /**
   * Prazo em horas para justificar campos obrigatórios não preenchidos.
   * Ex: 2 — o operador tem 2 horas para justificar após concluir.
   */
  justificationDeadlineHours?: number | null
  /**
   * Se true, apenas administradores podem preencher este template.
   * Útil para templates de auditoria interna.
   */
  adminOnly?: boolean
}

/**
 * Configuração de um campo dentro de um template de checklist.
 * Cada campo define o tipo de dado coletado e as regras de validação.
 */
export interface TemplateFieldDTO {
  /** Label exibido ao operador durante o preenchimento */
  name: string
  /** Tipo do campo — determina o componente de input renderizado */
  fieldType: FieldType
  /** Se o campo é obrigatório para completar o checklist */
  isRequired?: boolean
  /** Posição de ordenação dentro da seção (menor = primeiro) */
  sortOrder?: number | null
  /**
   * Opções para campos de seleção.
   * Usado por: dropdown, checkbox_multiple.
   * Formato: `[{ value: "ok", label: "Conforme" }, ...]`
   */
  options?: { value: string; label: string }[] | null
  /**
   * Regras de validação específicas do tipo de campo.
   * Texto: `{ minLength?, maxLength?, pattern? }`
   * Número: `{ min?, max?, decimals? }`
   * Foto: `{ minPhotos?, maxPhotos?, maxSizeMB? }`
   * GPS: `{ allowedRadius?, referencePoint? }`
   */
  validation?: Record<string, unknown> | null
  /**
   * Configuração de cálculo automático.
   * Usado por campos do tipo `calculated`.
   * Formato: `{ formula: "field_1 + field_2", dependsOn: [1, 2] }`
   */
  calculation?: Record<string, unknown> | null
  /** Texto de placeholder exibido no input quando vazio */
  placeholder?: string | null
  /** Texto de ajuda exibido ao usuário abaixo do campo */
  helpText?: string | null
  /** ID da seção do template a que este campo pertence */
  sectionId?: number | null
}

/**
 * Justificativa para campo obrigatório não preenchido em checklist incompleto.
 * O operador tem um prazo (definido no template) para submeter a justificativa.
 */
export interface SubmitJustificationRequestDTO {
  /** ID do checklist com campo não preenchido */
  checklistId: number
  /** ID do campo que não foi preenchido */
  fieldId: number
  /**
   * Texto explicando o motivo pelo qual o campo não foi preenchido.
   * Ex: "Produto em falta — reposição prevista para amanhã."
   */
  justificationText: string
}
