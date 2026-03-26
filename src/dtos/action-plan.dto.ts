// ============================================
// DTOs — Planos de Ação
// ============================================
// Tipos de transferência para criação, atualização
// e consulta de planos de ação gerados por não
// conformidades encontradas em checklists.
//
// Fluxo típico:
//   1. Campo marcado como "não conforme" no checklist
//   2. Engine (actionPlanEngine.ts) avalia as field_conditions
//   3. Plano de ação criado automaticamente com responsável e prazo
//   4. Responsável recebe notificação e atualiza o status
//   5. Admin acompanha pelo painel de planos de ação
// ============================================

import type { Severity, ActionPlanStatus } from '@/types/database'

/**
 * Dados para criar um novo plano de ação.
 * Pode ser criado automaticamente pela engine ou manualmente por um admin.
 * Apenas `title` e `deadline` são obrigatórios.
 */
export interface CreateActionPlanRequestDTO {
  /** ID do checklist que originou a não conformidade (opcional para criação manual) */
  checklistId?: number | null
  /** ID do campo que apresentou o valor fora do esperado */
  fieldId?: number | null
  /** ID da condição de campo que disparou a criação do plano */
  fieldConditionId?: number | null
  /** ID da resposta específica que acionou a condição */
  responseId?: number | null
  /** ID do template relacionado */
  templateId?: number | null
  /** ID da loja onde ocorreu a não conformidade */
  storeId?: number | null
  /** ID do setor dentro da loja */
  sectorId?: number | null
  /** Título descritivo do plano de ação */
  title: string
  /** Descrição detalhada do problema e ação esperada */
  description?: string | null
  /** Nível de urgência — afeta prioridade na fila e cor na interface */
  severity?: Severity
  /** UUID do usuário responsável pela resolução */
  assignedTo?: string | null
  /** ID da função responsável (quando não há usuário específico) */
  assignedFunctionId?: number | null
  /** Prazo para conclusão em formato ISO 8601 */
  deadline: string
  /**
   * Valor que causou a não conformidade, armazenado como texto.
   * Ex: "Não", "3.50", "Vencido em 20/03/2026"
   */
  nonConformityValue?: string | null
  /** Se true, o responsável deve anexar uma foto ao concluir */
  requirePhotoOnCompletion?: boolean
  /** Se true, o responsável deve escrever um texto de conclusão */
  requireTextOnCompletion?: boolean
  /** Número máximo de caracteres para o texto de conclusão */
  completionMaxChars?: number
}

/**
 * Dados para atualizar o status de um plano de ação existente.
 * Usado pelo responsável ao iniciar, concluir ou cancelar o plano.
 */
export interface UpdateActionPlanStatusRequestDTO {
  /** Novo status do plano */
  status: ActionPlanStatus
  /**
   * Texto de conclusão descrevendo a ação tomada.
   * Obrigatório quando `requireTextOnCompletion` é true no plano.
   */
  completionText?: string | null
}

/**
 * Dados para adicionar uma atualização ou comentário ao histórico do plano.
 * Registrado na tabela `action_plan_updates` para rastreabilidade.
 */
export interface AddActionPlanUpdateRequestDTO {
  /** ID do plano de ação que receberá a atualização */
  actionPlanId: number
  /** Tipo da atualização — define o ícone e comportamento na interface */
  updateType: 'comment' | 'status_change' | 'evidence' | 'reassign'
  /**
   * Conteúdo da atualização:
   * - comment: texto do comentário
   * - status_change: motivo da mudança (opcional)
   * - evidence: nome ou descrição do arquivo anexado
   * - reassign: motivo da reatribuição
   */
  content?: string | null
  /** Status anterior (usado para registrar mudanças de status) */
  oldStatus?: string | null
  /** Novo status (usado para registrar mudanças de status) */
  newStatus?: string | null
}

/**
 * Parâmetros de filtro para consultar planos de ação.
 * Todos os campos são opcionais — sem filtros retorna todos os planos do tenant.
 */
export interface ListActionPlansQueryDTO {
  /** Filtrar por status do plano */
  status?: ActionPlanStatus
  /** Filtrar por severidade */
  severity?: Severity
  /** Filtrar por loja (store_id) */
  storeId?: number
  /** Filtrar por responsável (UUID do usuário) */
  assignedTo?: string
  /** Se true, retorna apenas reincidências (is_reincidencia = true) */
  isReincidencia?: boolean
  /** Número da página para paginação (começa em 1) */
  page?: number
  /** Quantidade de itens por página (padrão: 20) */
  pageSize?: number
}
