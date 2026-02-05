import { NextRequest, NextResponse } from 'next/server'
import { uploadImageToDrive } from '@/lib/google'

/**
 * POST /api/google/upload
 * Faz upload de imagem para o Google Drive
 */
export async function POST(request: NextRequest) {
  console.log('[API Upload] Recebendo requisição de upload')

  try {
    const body = await request.json()
    const { image, fileName, mimeType } = body as {
      image: string // base64 image
      fileName: string
      mimeType?: string
    }

    if (!image) {
      console.error('[API Upload] Imagem não fornecida no body')
      return NextResponse.json(
        { success: false, error: 'Imagem não fornecida' },
        { status: 400 }
      )
    }

    console.log('[API Upload] Processando imagem:', fileName, '- Tamanho:', Math.round(image.length / 1024), 'KB')

    const result = await uploadImageToDrive(
      image,
      fileName || `nocheck-${Date.now()}.jpg`,
      mimeType || 'image/jpeg'
    )

    console.log('[API Upload] Resultado:', result)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[API Upload] Erro:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    )
  }
}
