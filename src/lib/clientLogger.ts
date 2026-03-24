import { createClient } from '@/lib/supabase'

type LogLevel = 'error' | 'warn' | 'info'

interface LogContext {
  checklist_id?: number
  template_name?: string
  section_id?: number
  page?: string
  [key: string]: unknown
}

let initialized = false

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

export function logError(message: string, context?: LogContext) {
  void sendLog('error', message, undefined, context)
}

export function logWarn(message: string, context?: LogContext) {
  void sendLog('warn', message, undefined, context)
}

export function logInfo(message: string, context?: LogContext) {
  void sendLog('info', message, undefined, context)
}

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
