/**
 * Parser seguro para requisições `application/x-www-form-urlencoded`.
 *
 * Compatível com Edge Runtime (sem Node.js APIs).
 *
 * ## Proteções implementadas
 * - Validação de Content-Type (rejeita se não for urlencoded)
 * - Limite de tamanho do body (padrão: 100 KB)
 * - Limite de quantidade de campos (padrão: 50)
 * - Limite de tamanho de nome e valor de cada campo
 * - Remoção de null bytes (prevenção de null byte injection)
 * - Decodificação UTF-8 estrita (rejeita sequências malformadas)
 * - Bloqueio de chaves que causariam prototype pollution
 * - Suporte a múltiplos valores para a mesma chave (retorna string[])
 *
 * ## Uso básico (parse direto)
 * ```ts
 * const body = await parseUrlEncodedBody(request)
 * const name = getSingleValue(body, 'name') // string | undefined
 * ```
 *
 * ## Uso com wrapper (recomendado para API routes)
 * ```ts
 * export const POST = withUrlEncodedBody(async (request, body) => {
 *   const name = getSingleValue(body, 'name')
 *   return NextResponse.json({ name })
 * })
 * ```
 */

// ── Configurações de limite ───────────────────────────────────────────────────

/** Tamanho máximo do body em bytes (padrão: 100 KB). */
const DEFAULT_MAX_BODY_BYTES = 100 * 1024

/** Número máximo de campos permitidos por requisição. */
const DEFAULT_MAX_FIELDS = 50

/** Tamanho máximo do nome de um campo em caracteres. */
const DEFAULT_MAX_FIELD_NAME_LENGTH = 100

/** Tamanho máximo do valor de um campo em caracteres. */
const DEFAULT_MAX_FIELD_VALUE_LENGTH = 10_000

// ── Chaves proibidas (prototype pollution) ───────────────────────────────────

const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

// ── Tipos públicos ────────────────────────────────────────────────────────────

/** Mapa de campos parseados. Valores múltiplos ficam em string[]. */
export type ParsedUrlEncodedBody = Record<string, string | string[]>

/** Opções para customizar os limites do parser. */
export interface ParseOptions {
  maxBodyBytes?: number
  maxFields?: number
  maxFieldNameLength?: number
  maxFieldValueLength?: number
}

// ── Erro tipado ───────────────────────────────────────────────────────────────

/** Erro de parse com status HTTP associado para fácil retorno em API routes. */
export class UrlEncodedParseError extends Error {
  constructor(
    message: string,
    public readonly statusCode: 400 | 413 | 415 | 422
  ) {
    super(message)
    this.name = 'UrlEncodedParseError'
  }
}

// ── Função principal ──────────────────────────────────────────────────────────

/**
 * Lê e parseia o body de uma requisição `application/x-www-form-urlencoded`.
 *
 * @throws {UrlEncodedParseError} Se Content-Type inválido, body grande demais,
 *   muitos campos, campos inválidos ou encoding malformado.
 */
export async function parseUrlEncodedBody(
  request: Request,
  options: ParseOptions = {}
): Promise<ParsedUrlEncodedBody> {
  const {
    maxBodyBytes = DEFAULT_MAX_BODY_BYTES,
    maxFields = DEFAULT_MAX_FIELDS,
    maxFieldNameLength = DEFAULT_MAX_FIELD_NAME_LENGTH,
    maxFieldValueLength = DEFAULT_MAX_FIELD_VALUE_LENGTH,
  } = options

  // 1. Validar Content-Type
  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.includes('application/x-www-form-urlencoded')) {
    throw new UrlEncodedParseError(
      'Content-Type deve ser application/x-www-form-urlencoded',
      415
    )
  }

  // 2. Rejeitar antecipadamente pelo Content-Length declarado
  const declaredLength = request.headers.get('content-length')
  if (declaredLength !== null) {
    const declared = parseInt(declaredLength, 10)
    if (!isNaN(declared) && declared > maxBodyBytes) {
      throw new UrlEncodedParseError(
        `Body muito grande: ${declared} bytes (máximo: ${maxBodyBytes})`,
        413
      )
    }
  }

  // 3. Ler body com limite real (Edge Runtime: sem Node streams)
  if (!request.body) {
    return {}
  }

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      totalBytes += value.byteLength
      if (totalBytes > maxBodyBytes) {
        throw new UrlEncodedParseError(
          `Body muito grande: excede ${maxBodyBytes} bytes`,
          413
        )
      }

      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  if (totalBytes === 0) {
    return {}
  }

  // 4. Decodificar com UTF-8 estrito (fatal: true rejeita bytes malformados)
  const combined = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    combined.set(chunk, offset)
    offset += chunk.byteLength
  }

  let rawBody: string
  try {
    rawBody = new TextDecoder('utf-8', { fatal: true }).decode(combined)
  } catch {
    throw new UrlEncodedParseError('Body contém encoding UTF-8 inválido', 422)
  }

  // 5. Parsear com URLSearchParams (lida corretamente com percent-encoding)
  const params = new URLSearchParams(rawBody)
  const entries = [...params.entries()]

  // 6. Validar quantidade de campos
  if (entries.length > maxFields) {
    throw new UrlEncodedParseError(
      `Muitos campos: ${entries.length} (máximo: ${maxFields})`,
      400
    )
  }

  // 7. Construir resultado com validações por campo
  const result: ParsedUrlEncodedBody = Object.create(null)

  for (const [rawKey, rawValue] of entries) {
    // Limpar null bytes de chave e valor
    const key = rawKey.replace(/\0/g, '').trim()
    const value = rawValue.replace(/\0/g, '').trim()

    // Ignorar campos com nome vazio após sanitização
    if (key.length === 0) continue

    // Bloquear chaves perigosas (prototype pollution)
    if (BLOCKED_KEYS.has(key)) {
      throw new UrlEncodedParseError(
        `Nome de campo não permitido: "${key}"`,
        400
      )
    }

    // Validar comprimento do nome
    if (key.length > maxFieldNameLength) {
      throw new UrlEncodedParseError(
        `Nome de campo muito longo: "${key.slice(0, 20)}..." (máximo: ${maxFieldNameLength})`,
        400
      )
    }

    // Validar comprimento do valor
    if (value.length > maxFieldValueLength) {
      throw new UrlEncodedParseError(
        `Valor muito longo para o campo "${key}" (máximo: ${maxFieldValueLength} caracteres)`,
        400
      )
    }

    // Acumular múltiplos valores para a mesma chave
    if (key in result) {
      const existing = result[key]
      result[key] = Array.isArray(existing)
        ? [...existing, value]
        : [existing, value]
    } else {
      result[key] = value
    }
  }

  return result
}

// ── HOF wrapper para API routes ───────────────────────────────────────────────

type RouteContext = { params?: Record<string, string> }

type UrlEncodedHandler = (
  request: Request,
  body: ParsedUrlEncodedBody,
  context?: RouteContext
) => Promise<Response>

/**
 * Higher-Order Function que envolve um handler de API route e injeta o body
 * já parseado como segundo argumento.
 *
 * Retorna automaticamente 415 se o Content-Type for errado, 413 se muito
 * grande, ou 400 para qualquer outro erro de parse — sem precisar de
 * try/catch no handler.
 *
 * ```ts
 * export const POST = withUrlEncodedBody(async (request, body) => {
 *   const email = getSingleValue(body, 'email')
 *   if (!email) return NextResponse.json({ error: 'email obrigatório' }, { status: 400 })
 *   return NextResponse.json({ ok: true })
 * })
 * ```
 */
export function withUrlEncodedBody(
  handler: UrlEncodedHandler,
  options?: ParseOptions
) {
  return async (request: Request, context?: RouteContext): Promise<Response> => {
    let body: ParsedUrlEncodedBody

    try {
      body = await parseUrlEncodedBody(request, options)
    } catch (err) {
      if (err instanceof UrlEncodedParseError) {
        return Response.json(
          { error: err.message },
          { status: err.statusCode }
        )
      }
      return Response.json(
        { error: 'Falha ao processar o body da requisição' },
        { status: 400 }
      )
    }

    return handler(request, body, context)
  }
}

// ── Helpers de extração de valores ───────────────────────────────────────────

/**
 * Extrai um valor único de um campo. Se o campo tiver múltiplos valores,
 * retorna o primeiro. Retorna `undefined` se o campo não existir.
 */
export function getSingleValue(
  body: ParsedUrlEncodedBody,
  key: string
): string | undefined {
  const value = body[key]
  if (value === undefined) return undefined
  return Array.isArray(value) ? value[0] : value
}

/**
 * Extrai todos os valores de um campo como array.
 * Retorna array vazio se o campo não existir.
 */
export function getAllValues(
  body: ParsedUrlEncodedBody,
  key: string
): string[] {
  const value = body[key]
  if (value === undefined) return []
  return Array.isArray(value) ? value : [value]
}
