// ============================================
// DTOs — Chat com IA (Assistente Flux)
// ============================================
// Tipos para interação com o assistente virtual Flux,
// alimentado pelo modelo Groq llama-3.3-70b-versatile.
//
// O histórico de mensagens é limitado às últimas 20 para
// controlar o tamanho do payload enviado à API Groq.
// ============================================

/**
 * Mensagem individual na conversa com o assistente.
 * Segue o formato padrão OpenAI Chat Completions.
 */
export interface ChatMessageDTO {
  /** Papel do autor da mensagem na conversa */
  role: 'user' | 'assistant'
  /** Conteúdo textual da mensagem */
  content: string
}

/**
 * Body do POST /api/chat
 * Envia o histórico de mensagens para o assistente Flux.
 * Apenas as últimas 20 mensagens serão enviadas para a IA.
 */
export interface ChatRequestDTO {
  /**
   * Histórico completo de mensagens da conversa.
   * O servidor usará apenas as últimas 20 para limitar o payload.
   * Deve conter pelo menos uma mensagem.
   */
  messages: ChatMessageDTO[]
  /**
   * Nome customizado do app para white-label do assistente.
   * Padrão: "OpereCheck".
   * Exemplo: "MeuChecklist" → o Flux se apresentará como assistente do "MeuChecklist".
   */
  appName?: string
}

/**
 * Resposta do POST /api/chat em caso de sucesso.
 */
export interface ChatResponseDTO {
  /** Texto da resposta gerada pelo assistente Flux */
  message: string
}

/**
 * Resposta do POST /api/chat em caso de erro.
 */
export interface ChatErrorDTO {
  /** Mensagem de erro (ex: "Erro ao consultar IA") */
  error: string
}
