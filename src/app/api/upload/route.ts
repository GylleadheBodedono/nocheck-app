export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'
import { isAllowedImageType, isValidBase64, estimateBase64Size, MAX_FILE_SIZE, ALLOWED_IMAGE_TYPES } from '@/lib/validation'
import { createRequestLogger } from '@/lib/serverLogger'

export const dynamic = 'force-dynamic'

// ── Supabase Config ──

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// ── Route Handler ──

/**
 * POST /api/upload
 * Faz upload de imagem (base64) para o Supabase Storage no bucket `checklist-images`.
 * Valida tipo MIME, formato base64 e tamanho (máx 5 MB) antes do upload.
 * Retorna `{ success, url, path }` com a URL pública do arquivo salvo.
 * Requer autenticação via `verifyApiAuth`.
 */
export async function POST(request: NextRequest) {
  const log = createRequestLogger(request)
  const auth = await verifyApiAuth(request)
  if (auth.error) return auth.error

  try {
    const body = await request.json()
    const { image, fileName, folder } = body as {
      image: string
      fileName: string
      folder?: string
    }

    if (!image || typeof image !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Imagem nao fornecida' },
        { status: 400 }
      )
    }

    // ── Image Type Validation ──

    if (!isAllowedImageType(image)) {
      return NextResponse.json(
        { success: false, error: `Tipo de arquivo nao permitido. Use ${ALLOWED_IMAGE_TYPES.join(', ')}.` },
        { status: 400 }
      )
    }

    // ── Base64 Validation ──

    const base64Data = image.replace(/^data:image\/\w+;base64,/, '')

    if (!isValidBase64(image)) {
      return NextResponse.json(
        { success: false, error: 'Dados de imagem invalidos' },
        { status: 400 }
      )
    }

    const estimatedSize = estimateBase64Size(base64Data)
    log.debug('Tamanho estimado do upload', { sizeKB: Math.round(estimatedSize / 1024) })

    if (estimatedSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: `Imagem muito grande (max ${MAX_FILE_SIZE / 1024 / 1024}MB)` },
        { status: 400 }
      )
    }

    // ── Upload to Storage ──

    const buffer = Buffer.from(base64Data, 'base64')
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const timestamp = Date.now()
    const uniqueFileName = fileName || `checklist_${timestamp}.jpg`
    const filePath = `${folder || 'uploads'}/${uniqueFileName}`

    log.debug('Iniciando upload para bucket checklist-images', { filePath })
    const { data, error } = await supabase.storage
      .from('checklist-images')
      .upload(filePath, buffer, {
        contentType: 'image/jpeg',
        upsert: true,
      })

    if (error) {
      const { data: buckets } = await supabase.storage.listBuckets()
      log.error('Erro no Supabase Storage', { filePath, availableBuckets: buckets?.map(b => b.name) }, error)
      throw new Error(error.message)
    }

    // ── Build Public URL ──

    const { data: urlData } = supabase.storage
      .from('checklist-images')
      .getPublicUrl(filePath)

    log.info('Upload concluido com sucesso', { filePath, publicUrl: urlData.publicUrl })

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      path: data.path,
    })
  } catch (error) {
    log.error('Erro inesperado em POST /api/upload', {}, error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    )
  }
}
