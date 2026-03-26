// ============================================
// DTOs — Configurações do Sistema (app_settings)
// ============================================
// Tipos para leitura e escrita de configurações globais
// na tabela `app_settings`, que armazena pares chave-valor.
//
// Exemplos de chaves utilizadas no sistema:
//   - "teams_webhook_url" — URL do webhook do Teams
//   - "email_notifications_enabled" — habilitar e-mails
//   - "gps_required_default" — exigir GPS por padrão
// ============================================

/**
 * Body do PUT /api/settings
 * Cria ou atualiza uma configuração via upsert.
 * Requer autenticação de administrador.
 */
export interface UpdateSettingRequestDTO {
  /**
   * Chave da configuração.
   * Deve ser única e identificar claramente o parâmetro.
   * Exemplos: "teams_webhook_url", "max_photos_per_checklist".
   */
  key: string
  /**
   * Valor da configuração (sempre serializado como string).
   * Booleanos e números devem ser convertidos: "true", "42".
   */
  value: string
}

/**
 * Configuração individual retornada pelo GET /api/settings.
 */
export interface SettingDTO {
  /** Chave identificadora da configuração */
  key: string
  /** Valor da configuração */
  value: string
}

/**
 * Resposta do PUT /api/settings em caso de sucesso.
 */
export interface UpdateSettingResponseDTO {
  /** Indica que a configuração foi salva com sucesso */
  success: boolean
  /** Chave da configuração atualizada */
  key: string
  /** Novo valor da configuração */
  value: string
}
