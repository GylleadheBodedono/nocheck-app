/**
 * Constantes e funções de validação reutilizáveis para APIs.
 */

/** Tipos MIME permitidos para upload de imagens */
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const

/** Tamanho máximo de arquivo em bytes (5MB) */
export const MAX_FILE_SIZE = 5 * 1024 * 1024

/** Pastas permitidas no storage */
export const ALLOWED_STORAGE_FOLDERS = ['uploads', 'anexos'] as const

/**
 * Valida se o MIME type da imagem é permitido.
 */
export function isAllowedImageType(dataUrl: string): boolean {
  const match = dataUrl.match(/^data:(image\/\w+);base64,/)
  if (!match) return false // rejeitar dados sem prefixo MIME valido
  return ALLOWED_IMAGE_TYPES.includes(match[1] as typeof ALLOWED_IMAGE_TYPES[number])
}

/**
 * Valida se a string é base64 válido (verifica primeiros 100 chars).
 */
export function isValidBase64(data: string): boolean {
  const clean = data.replace(/^data:image\/\w+;base64,/, '')
  return /^[A-Za-z0-9+/]+=*$/.test(clean.slice(0, 100))
}

/**
 * Estima o tamanho em bytes de uma string base64.
 */
export function estimateBase64Size(base64Data: string): number {
  return (base64Data.length * 3) / 4
}

/**
 * Valida se o caminho de pasta no storage é permitido.
 */
export function isValidStoragePath(folder: string): boolean {
  // Must be in allowed folders
  const isAllowed = ALLOWED_STORAGE_FOLDERS.some(
    allowed => folder === allowed || folder.startsWith(allowed + '/')
  )
  if (!isAllowed) return false

  // No path traversal
  if (folder.includes('..') || folder.includes('//')) return false

  return true
}

/**
 * Sanitiza HTML para prevenir XSS em templates de email.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
