/**
 * Logger do lado do servidor — compatível com Edge Runtime.
 *
 * ## O que faz
 * 1. Emite **JSON estruturado** para stdout/stderr (capturado automaticamente
 *    por Cloudflare Logs, Vercel Logs, Datadog, Logtail, etc.)
 * 2. Persiste na tabela `client_logs` do Supabase (aparece em `/admin/logs`)
 *    usando a service role key — nunca exposta ao cliente.
 *
 * ## Uso
 *
 * ### Logger global (fora de uma request)
 * ```ts
 * import { serverLogger } from '@/lib/serverLogger'
 * serverLogger.info('Cron iniciado')
 * serverLogger.error('Falha ao processar', { route: '/api/cron/daily' })
 * ```
 *
 * ### Logger escopado à request (recomendado em API routes)
 * ```ts
 * import { createRequestLogger } from '@/lib/serverLogger'
 *
 * export async function POST(request: Request) {
 *   const log = createRequestLogger(request)
 *   log.info('Requisição recebida')
 *   // ... processamento ...
 *   log.error('Falha ao salvar', { detail: err.message })
 * }
 * ```
 *
 * O logger escopado propaga automaticamente `requestId`, `method` e `route`
 * em todos os logs daquela request, facilitando correlação em telemetria.
 *
 * ## Saída estruturada (stdout/stderr)
 * ```json
 * {"timestamp":"2026-03-25T10:00:00.000Z","level":"error","message":"Falha",
 *  "requestId":"a1b2c3d4","route":"/api/settings","method":"PUT","context":{}}
 * ```
 *
 * Logs de nível `error` e `warn` vão para `console.error`.
 * Logs de nível `info` e `debug` vão para `console.log`.
 * Em produção, logs `debug` são omitidos do console (mas ainda persistidos se
 * `persist: true`).
 */

import { createClient } from '@supabase/supabase-js'

// ── Tipos públicos ────────────────────────────────────────────────────────────

/** Nível de severidade do log. */
export type ServerLogLevel = 'error' | 'warn' | 'info' | 'debug'

/**
 * Contexto extra anexado a cada log.
 * Campos comuns são tipados; campos arbitrários são aceitos via index signature.
 */
export interface ServerLogContext {
  /** Rota da API que originou o log (ex: "/api/settings"). */
  route?: string
  /** Método HTTP da requisição (ex: "POST"). */
  method?: string
  /** ID de correlação da requisição. */
  requestId?: string
  /** ID do usuário autenticado, se disponível. */
  userId?: string
  /** Duração da operação em ms (útil para métricas de latência). */
  durationMs?: number
  /** Status HTTP da resposta, quando aplicável. */
  statusCode?: number
  [key: string]: unknown
}

// ── Estrutura interna do log ──────────────────────────────────────────────────

interface LogEntry {
  timestamp: string
  level: ServerLogLevel
  message: string
  requestId?: string
  route?: string
  method?: string
  stack?: string
  context: ServerLogContext
}

// ── Helpers internos ─────────────────────────────────────────────────────────

const isProduction = process.env.NODE_ENV === 'production'

/**
 * Emite o log para stdout/stderr em formato JSON estruturado.
 * O prefixo `[SERVER]` permite distinguir de logs de cliente em agregadores.
 */
function emitToConsole(entry: LogEntry): void {
  // Suprimir debug em produção no console (ainda persiste no banco se configurado)
  if (isProduction && entry.level === 'debug') return

  const line = `[SERVER] ${JSON.stringify(entry)}`

  if (entry.level === 'error' || entry.level === 'warn') {
    console.error(line)
  } else {
    console.log(line)
  }
}

/**
 * Persiste o log na tabela `client_logs` via service role.
 * Fire-and-forget — nunca lança erros para o chamador.
 */
async function persistToSupabase(entry: LogEntry): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) return

  try {
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Compõe o campo `url` com método + rota para exibição no /admin/logs
    const urlField = entry.route
      ? `${entry.method ?? 'SERVER'}:${entry.route}`
      : null

    // Separa campos de contexto "especiais" que já têm coluna própria
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { route, method, requestId, userId, ...extraContext } = entry.context

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('client_logs').insert({
      user_id: userId ?? null,
      level: entry.level === 'debug' ? 'info' : entry.level, // client_logs aceita error|warn|info
      message: entry.message.slice(0, 2000),
      stack: entry.stack ? entry.stack.slice(0, 5000) : null,
      url: urlField,
      user_agent: `server-logger/${entry.requestId ?? 'no-request-id'}`,
      context: {
        source: 'server',
        requestId: entry.requestId,
        ...extraContext,
      },
    })
  } catch {
    // nunca propagar erros do logger
  }
}

// ── Core ──────────────────────────────────────────────────────────────────────

/**
 * Constrói a entrada de log e despacha para console + Supabase.
 */
function dispatch(
  level: ServerLogLevel,
  message: string,
  context: ServerLogContext = {},
  error?: unknown
): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    requestId: context.requestId,
    route: context.route,
    method: context.method,
    context,
  }

  if (error instanceof Error && error.stack) {
    entry.stack = error.stack
    if (!entry.message && error.message) {
      entry.message = error.message
    }
  }

  emitToConsole(entry)
  void persistToSupabase(entry)
}

// ── Interface do logger ───────────────────────────────────────────────────────

export interface ServerLogger {
  /**
   * Registra um erro. Vai para `console.error` e para o banco.
   * Aceita um `Error` como terceiro argumento para capturar o stack trace.
   *
   * ```ts
   * log.error('Falha ao salvar', { userId }, err)
   * ```
   */
  error(message: string, context?: ServerLogContext, error?: unknown): void

  /**
   * Registra um aviso. Vai para `console.error` e para o banco.
   */
  warn(message: string, context?: ServerLogContext): void

  /**
   * Registra um evento informativo. Vai para `console.log` e para o banco.
   */
  info(message: string, context?: ServerLogContext): void

  /**
   * Registra detalhe de debug. Omitido do console em produção.
   * Persiste no banco apenas se `NEXT_PUBLIC_LOG_DEBUG=true`.
   */
  debug(message: string, context?: ServerLogContext): void
}

// ── Logger global ─────────────────────────────────────────────────────────────

/**
 * Logger de servidor pronto para usar, sem contexto de request.
 * Ideal para cron jobs, scripts de setup e código de inicialização.
 */
export const serverLogger: ServerLogger = {
  error: (msg, ctx, err) => dispatch('error', msg, ctx, err),
  warn:  (msg, ctx)      => dispatch('warn',  msg, ctx),
  info:  (msg, ctx)      => dispatch('info',  msg, ctx),
  debug: (msg, ctx)      => {
    if (isProduction && process.env.NEXT_PUBLIC_LOG_DEBUG !== 'true') return
    dispatch('debug', msg, ctx)
  },
}

// ── Logger escopado à request ─────────────────────────────────────────────────

/**
 * Cria um logger já pré-populado com `requestId`, `method` e `route`
 * extraídos da requisição atual.
 *
 * O `requestId` é gerado automaticamente com `crypto.randomUUID()` e pode
 * ser devolvido no header `X-Request-Id` da resposta para correlação:
 *
 * ```ts
 * export async function POST(request: Request) {
 *   const log = createRequestLogger(request)
 *   const response = await handleRequest(request, log)
 *   response.headers.set('X-Request-Id', log.requestId)
 *   return response
 * }
 * ```
 */
export function createRequestLogger(request: Request): ServerLogger & { requestId: string } {
  const requestId = crypto.randomUUID()
  const url = new URL(request.url)

  const baseContext: ServerLogContext = {
    requestId,
    route: url.pathname,
    method: request.method,
  }

  const merge = (ctx?: ServerLogContext): ServerLogContext => ({ ...baseContext, ...ctx })

  return {
    requestId,
    error: (msg, ctx, err) => dispatch('error', msg, merge(ctx), err),
    warn:  (msg, ctx)      => dispatch('warn',  msg, merge(ctx)),
    info:  (msg, ctx)      => dispatch('info',  msg, merge(ctx)),
    debug: (msg, ctx)      => {
      if (isProduction && process.env.NEXT_PUBLIC_LOG_DEBUG !== 'true') return
      dispatch('debug', msg, merge(ctx))
    },
  }
}

// ── Helper de temporização ────────────────────────────────────────────────────

/**
 * Inicia um timer e retorna uma função que loga a duração quando chamada.
 * Útil para medir latência de operações críticas.
 *
 * ```ts
 * const done = startTimer(log, 'Sync concluído')
 * await syncService.syncAll()
 * done()  // loga: "Sync concluído" com { durationMs: 342 }
 * ```
 */
export function startTimer(
  logger: ServerLogger,
  label: string,
  context?: ServerLogContext
): () => void {
  const start = Date.now()
  return () => {
    logger.info(label, { ...context, durationMs: Date.now() - start })
  }
}
