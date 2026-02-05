import { NextResponse } from 'next/server'
import { testGoogleConnection } from '@/lib/google'

/**
 * GET /api/google/test
 * Testa a conexão com Google Drive API
 */
export async function GET() {
  try {
    const result = await testGoogleConnection()

    return NextResponse.json({
      ...result,
      message: result.success
        ? 'Conexão com Google Drive OK!'
        : 'Falha na conexão com Google Drive. Verifique as credenciais.',
      credentials: {
        GOOGLE_CLIENT_EMAIL: process.env.GOOGLE_CLIENT_EMAIL ? 'SET' : 'NOT SET',
        GOOGLE_PRIVATE_KEY: process.env.GOOGLE_PRIVATE_KEY ? 'SET' : 'NOT SET',
        GOOGLE_DRIVE_FOLDER_ID: process.env.GOOGLE_DRIVE_FOLDER_ID || '(auto-create)',
      },
    })
  } catch (error) {
    console.error('[API] Erro no teste:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    )
  }
}
