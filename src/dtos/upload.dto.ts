// ============================================
// DTOs — Upload de Arquivos
// ============================================
// Tipos para upload de imagens para o Supabase Storage.
// Suporta imagens em formato base64, validadas por
// tipo MIME (JPEG/PNG/WebP/GIF) e tamanho (máx. 5 MB).
// ============================================

/**
 * Body do POST /api/upload
 * Envia uma imagem codificada em base64 para o Supabase Storage.
 * O campo `image` deve incluir o prefixo de data URL (ex: "data:image/jpeg;base64,...").
 */
export interface UploadImageRequestDTO {
  /**
   * Imagem codificada em base64 com prefixo de data URL.
   * Formatos aceitos: JPEG, PNG, WebP, GIF.
   * Tamanho máximo decodificado: 5 MB.
   * Exemplo: "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
   */
  image: string
  /** Nome do arquivo a ser salvo no bucket do storage */
  fileName: string
  /**
   * Pasta/diretório de destino dentro do bucket `checklist-images`.
   * Padrão: "uploads".
   * Não pode conter `..` (prevenção de path traversal).
   */
  folder?: string
}

/**
 * Resposta do POST /api/upload em caso de sucesso.
 */
export interface UploadImageSuccessDTO {
  success: true
  /** URL pública do arquivo salvo, pronta para uso em `<img src>` */
  url: string
  /** Caminho relativo do arquivo dentro do bucket */
  path: string
}

/**
 * Resposta do POST /api/upload em caso de erro de validação ou storage.
 */
export interface UploadImageErrorDTO {
  success: false
  /** Mensagem descritiva do erro */
  error: string
}

/** União dos possíveis retornos do POST /api/upload */
export type UploadImageResponseDTO = UploadImageSuccessDTO | UploadImageErrorDTO
