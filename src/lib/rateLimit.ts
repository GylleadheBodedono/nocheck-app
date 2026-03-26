/**
 * Rate limiter in-memory para API routes (Edge Runtime compatible).
 *
 * Para producao com multiplas instancias, substituir por @upstash/ratelimit.
 * Este funciona para single-instance (dev, Cloudflare Workers single-region).
 *
 * Uso:
 * ```ts
 * const limiter = createRateLimiter({ maxRequests: 10, windowMs: 60000 })
 * const { success, remaining } = limiter.check(identifier)
 * if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
 * ```
 */

type RateLimitEntry = { count: number; resetAt: number }

const stores = new Map<string, Map<string, RateLimitEntry>>()

export function createRateLimiter(opts: { maxRequests: number; windowMs: number; name?: string }) {
  const storeName = opts.name || 'default'
  if (!stores.has(storeName)) stores.set(storeName, new Map())
  const store = stores.get(storeName)!

  return {
    check(identifier: string): { success: boolean; remaining: number; resetAt: number } {
      const now = Date.now()
      const entry = store.get(identifier)

      if (!entry || now > entry.resetAt) {
        store.set(identifier, { count: 1, resetAt: now + opts.windowMs })
        return { success: true, remaining: opts.maxRequests - 1, resetAt: now + opts.windowMs }
      }

      entry.count++
      if (entry.count > opts.maxRequests) {
        return { success: false, remaining: 0, resetAt: entry.resetAt }
      }

      return { success: true, remaining: opts.maxRequests - entry.count, resetAt: entry.resetAt }
    },

    /** Limpar entradas expiradas (chamar periodicamente se necessario) */
    cleanup() {
      const now = Date.now()
      for (const [key, entry] of store) {
        if (now > entry.resetAt) store.delete(key)
      }
    },
  }
}

/** Rate limiters pre-configurados por tipo de rota */
export const billingLimiter = createRateLimiter({ maxRequests: 10, windowMs: 60_000, name: 'billing' })
export const authLimiter = createRateLimiter({ maxRequests: 5, windowMs: 60_000, name: 'auth' })
export const aiLimiter = createRateLimiter({ maxRequests: 3, windowMs: 60_000, name: 'ai' })

/** Extrair identifier do request (IP ou user ID) */
export function getRequestIdentifier(req: Request, userId?: string): string {
  if (userId) return userId
  return req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'anonymous'
}
