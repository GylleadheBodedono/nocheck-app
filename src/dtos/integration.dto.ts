// ============================================
// DTOs — Integrações Externas (Teams, etc.)
// ============================================
// Tipos para envio de alertas a plataformas externas
// como Microsoft Teams via Adaptive Cards Webhook.
//
// Dois tipos de alerta são suportados:
//   1. Validação cruzada: divergência entre valores de funcionários
//   2. Plano de ação: nova não conformidade criada automaticamente
// ============================================

/**
 * Dados de uma validação cruzada para alerta no Teams.
 * Enviada quando há divergência de valores entre estoquista e aprendiz,
 * quando notas fiscais diferentes são vinculadas, ou quando uma nota
 * expira sem par correspondente após 1 hora.
 */
export interface ValidationAlertDTO {
  /** ID da validação cruzada no banco de dados */
  id: number
  /** Número da nota fiscal do estoquista */
  numeroNota: string
  /** Número da nota fiscal do aprendiz (quando as notas são diferentes) */
  numeroNotaVinculada?: string
  /** Nome da loja onde ocorreu a validação */
  loja: string
  /** Valor declarado pelo estoquista em reais (null se não preencheu) */
  valorEstoquista: number | null
  /** Valor declarado pelo aprendiz em reais (null se não preencheu) */
  valorAprendiz: number | null
  /** Diferença calculada entre os valores (null quando expirado sem par) */
  diferenca: number | null
  /** Status da validação que disparou o alerta */
  status: 'pendente' | 'sucesso' | 'falhou' | 'notas_diferentes' | 'expirado'
  /** Data e hora da validação formatada para exibição (ex: "26/03/2026 14:30") */
  dataHora: string
  /** Motivo do vínculo quando notas são diferentes (ex: "Valores similares") */
  matchReason?: string
  /** Nome do setor onde ocorreu a validação (opcional) */
  setor?: string
}

/**
 * Dados de um plano de ação para notificação no Teams.
 * Enviada quando um novo plano de ação é criado por não conformidade
 * em checklist, incluindo suporte a @mentions no Teams.
 */
export interface ActionPlanAlertDTO {
  /** Título descritivo do plano de ação */
  title: string
  /** Nome do campo que apresentou não conformidade */
  fieldName: string
  /** Nome da loja onde ocorreu */
  storeName: string
  /** Severidade: "baixa", "media", "alta" ou "critica" */
  severity: string
  /** Prazo para conclusão formatado (ex: "30/03/2026") */
  deadline: string
  /** Nome completo do responsável pelo plano */
  assigneeName: string
  /** Valor que causou a não conformidade (ex: "Não", "3.50") */
  nonConformityValue: string | null
  /** Se é uma reincidência do mesmo campo/loja */
  isReincidencia: boolean
  /** Número de ocorrências anteriores nos últimos 90 dias */
  reincidenciaCount: number
  /** Nome do usuário que preencheu o checklist (para @mention) */
  respondentName?: string
  /** E-mail do preenchedor para @mention no Teams */
  respondentEmail?: string
  /** E-mail do responsável para @mention no Teams */
  assigneeEmail?: string
  /**
   * URL do webhook específico da função responsável.
   * Quando fornecido, sobrepõe o webhook global (TEAMS_WEBHOOK_URL).
   * Permite enviar alertas para canais específicos por função.
   */
  webhookUrl?: string | null
}

/**
 * Body do POST /api/integrations/notify
 * Dispara uma notificação de alerta no Microsoft Teams.
 */
export interface NotifyRequestDTO {
  /**
   * Tipo da ação que disparou a notificação.
   * Use "action_plan" para planos de ação.
   * Qualquer outro valor é tratado como validação cruzada.
   */
  action: 'action_plan' | string
  /**
   * Dados do alerta:
   * - `ActionPlanAlertDTO` quando action === "action_plan"
   * - `ValidationAlertDTO` para demais casos
   */
  data: ValidationAlertDTO | ActionPlanAlertDTO
}

/**
 * Resultado do envio para o Teams.
 * Retornado como campo `teams` na resposta do endpoint.
 */
export interface TeamsNotifyResultDTO {
  /** Se o alerta foi enviado com sucesso ao Teams */
  success: boolean
  /** Mensagem de erro do Teams ou do fetch (se success=false) */
  error?: string
}

/**
 * Resposta do POST /api/integrations/notify.
 */
export interface NotifyResponseDTO {
  /** Indica que o endpoint processou a requisição */
  success: boolean
  /** Resultado do envio ao Teams (presente quando um alerta foi disparado) */
  teams?: TeamsNotifyResultDTO
  /**
   * Mensagem informativa quando nenhum alerta foi enviado.
   * Ocorre quando o status da validação não requer alerta.
   */
  message?: string
}
