/**
 * Logger do lado do cliente — envia logs para a tabela `client_logs` no Supabase.
 *
 * Uso:
 *  - `logError(msg, ctx)` — erros de negócio ou falhas inesperadas
 *  - `logWarn(msg, ctx)`  — situações de atenção (sem impacto imediato)
 *  - `logInfo(msg, ctx)`  — eventos relevantes de fluxo
 *  - `initClientLogger()` — chamar uma vez no root layout para capturar erros globais
 *
 * Todos os logs ficam visíveis em `/admin/logs`.
 * O logger nunca lança erros — falhas de envio são silenciosas.
 */

import { createClient } from '@/lib/supabase'

/** Nível de severidade do log. */
type LogLevel = 'error' | 'warn' | 'info'

/**
 * Contexto adicional anexado a cada log.
 * Campos comuns são tipados; campos extras são aceitos via index signature.
 */
interface LogContext {
  checklist_id?: number
  template_name?: string
  section_id?: number
  page?: string
  [key: string]: unknown
}

/** Indica se os listeners globais já foram registrados. Evita duplicação. */
let initialized = false

/**
 * Envia um registro de log para a tabela `client_logs` no Supabase.
 * Fire-and-forget — nunca propaga erros para o chamador.
 *
 * @param level   - Nível de severidade
 * @param message - Mensagem principal (truncada a 2000 chars)
 * @param stack   - Stack trace opcional (truncado a 5000 chars)
 * @param context - Dados de contexto extras para diagnóstico
 */
async function sendLog(level: LogLevel, message: string, stack?: string, context?: LogContext) {
  try {
    const supabase = createClient()
    if (!supabase) return
    const { data: { user } } = await supabase.auth.getUser()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('client_logs').insert({
      user_id: user?.id ?? null,
      level,
      message: message.slice(0, 2000),
      stack: stack ? stack.slice(0, 5000) : null,
      url: typeof window !== 'undefined' ? window.location.href : null,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      context: context ?? null,
    })
  } catch {
    // nunca lançar erro do logger
  }
}

/**
 * Registra um log de nível `error` com contexto opcional.
 *
 * @param message - Descrição do erro
 * @param context - Dados de contexto (checklist_id, página, etc.)
 */
export function logError(message: string, context?: LogContext) {
  void sendLog('error', message, undefined, context)
}

/**
 * Registra um log de nível `warn` com contexto opcional.
 *
 * @param message - Descrição do aviso
 * @param context - Dados de contexto (checklist_id, página, etc.)
 */
export function logWarn(message: string, context?: LogContext) {
  void sendLog('warn', message, undefined, context)
}

/**
 * Registra um log de nível `info` com contexto opcional.
 *
 * @param message - Descrição do evento
 * @param context - Dados de contexto (checklist_id, página, etc.)
 */
export function logInfo(message: string, context?: LogContext) {
  void sendLog('info', message, undefined, context)
}

/**
 * Inicializa o logger global do cliente.
 * Deve ser chamado uma única vez no root layout (via `ClientLoggerInit`).
 *
 * Registra dois listeners:
 * - `window.onerror` → captura erros síncronos não tratados
 * - `unhandledrejection` → captura Promises rejeitadas sem `.catch()`
 *
 * Idempotente: chamadas subsequentes são ignoradas.
 */
export function initClientLogger() {
  if (initialized || typeof window === 'undefined') return
  initialized = true

  window.addEventListener('error', (event) => {
    void sendLog(
      'error',
      event.message || 'Unknown error',
      (event.error as Error | null)?.stack,
      {
        page: window.location.pathname,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      }
    )
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason as { message?: string; stack?: string } | string | null
    const message = (typeof reason === 'object' && reason?.message) ? reason.message : String(reason ?? 'Unhandled promise rejection')
    const stack = typeof reason === 'object' ? reason?.stack : undefined
    void sendLog('error', message, stack, {
      page: window.location.pathname,
      type: 'unhandledrejection',
    })
  })
}
