export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'
import { isAllowedImageType, isValidBase64, estimateBase64Size, MAX_FILE_SIZE, ALLOWED_IMAGE_TYPES } from '@/lib/validation'

export const dynamic = 'force-dynamic'

// ── Supabase Config ──

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// ── Route Handler ──

/**
 * Uploads a base64-encoded image to Supabase Storage (`checklist-images` bucket).
 *
 * `POST /api/upload` with body:
 * ```json
 * { "image": "data:image/jpeg;base64,...", "fileName": "photo.jpg", "folder": "uploads" }
 * ```
 *
 * Validates MIME type, base64 format, and file size before uploading.
 * Returns the public URL and storage path on success.
 *
 * @requires Authentication via `verifyApiAuth`
 */
export async function POST(request: NextRequest) {
  const auth = await verifyApiAuth(request)
  if (auth.error) return auth.error

  console.log('[Upload] Recebendo requisicao de upload')

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

    // ── File Size Validation ──

    const estimatedSize = estimateBase64Size(base64Data)
    console.log('[Upload] Tamanho estimado:', Math.round(estimatedSize / 1024), 'KB')

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

    console.log('[Upload] Tentando upload para bucket checklist-images, path:', filePath)
    const { data, error } = await supabase.storage
      .from('checklist-images')
      .upload(filePath, buffer, {
        contentType: 'image/jpeg',
        upsert: true,
      })

    if (error) {
      console.error('[Upload] Erro Supabase Storage:', error.message, error)
      const { data: buckets } = await supabase.storage.listBuckets()
      console.log('[Upload] Buckets disponiveis:', buckets?.map(b => b.name))
      throw new Error(error.message)
    }

    // ── Build Public URL ──

    const { data: urlData } = supabase.storage
      .from('checklist-images')
      .getPublicUrl(filePath)

    console.log('[Upload] Sucesso:', urlData.publicUrl)

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      path: data.path,
    })
  } catch (error) {
    console.error('[Upload] Erro:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    )
  }
}
