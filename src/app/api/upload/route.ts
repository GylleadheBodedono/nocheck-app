export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyApiAuth } from '@/lib/api-auth'
import { createRequestLogger } from '@/lib/serverLogger'

export const dynamic = 'force-dynamic'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

/**
 * POST /api/upload
 * Faz upload de imagem (base64) para o Supabase Storage no bucket `checklist-photos`.
 * Limite: 5 MB por arquivo. Requer autenticação.
 * Retorna `{ url }` com a URL pública do arquivo salvo.
 */
export async function POST(request: NextRequest) {
  const log = createRequestLogger(request)
  const auth = await verifyApiAuth(request)
  if (auth.error) return auth.error

  try {
    const body = await request.json()
    const { image, fileName, folder } = body as {
      image: string // base64 image
      fileName: string
      folder?: string // pasta no bucket (default: 'uploads')
    }

    if (!image) {
      return NextResponse.json(
        { success: false, error: 'Imagem não fornecida' },
        { status: 400 }
      )
    }

    // Remove data URL prefix if present
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '')

    // Check file size (base64 is ~33% larger than binary)
    const estimatedSize = (base64Data.length * 3) / 4
    log.debug('Tamanho estimado do upload', { sizeKB: Math.round(estimatedSize / 1024) })

    if (estimatedSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: `Imagem muito grande (máx ${MAX_FILE_SIZE / 1024 / 1024}MB)` },
        { status: 400 }
      )
    }

    // Convert base64 to buffer
    const buffer = Buffer.from(base64Data, 'base64')

    // Create Supabase client with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Generate unique filename
    const timestamp = Date.now()
    const uniqueFileName = fileName || `checklist_${timestamp}.jpg`
    const filePath = `${folder || 'uploads'}/${uniqueFileName}`

    // Upload to Supabase Storage
    log.debug('Iniciando upload para bucket checklist-images', { filePath })
    const { data, error } = await supabase.storage
      .from('checklist-images')
      .upload(filePath, buffer, {
        contentType: 'image/jpeg',
        upsert: true, // Permite sobrescrever se já existir
      })

    if (error) {
      // Tenta verificar se o bucket existe para melhor diagnóstico
      const { data: buckets } = await supabase.storage.listBuckets()
      log.error('Erro no Supabase Storage', { filePath, availableBuckets: buckets?.map(b => b.name) }, error)
      throw new Error(error.message)
    }

    // Get public URL
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
