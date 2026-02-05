import { NextResponse } from 'next/server'
import { testGoogleConnection, addRowToSheet } from '@/lib/google'

/**
 * GET /api/google/test
 * Testa a conexão com Google APIs
 */
export async function GET() {
  try {
    const result = await testGoogleConnection()

    // If connection works, try adding a test row
    if (result.sheets) {
      const testResult = await addRowToSheet(
        'Teste',
        [
          new Date().toISOString(),
          'Teste de conexão',
          'Se você vê isso, a integração está funcionando!',
        ],
        ['Data', 'Tipo', 'Mensagem']
      )

      return NextResponse.json({
        ...result,
        testRow: testResult,
        message: testResult.success
          ? 'Conexão OK! Uma linha de teste foi adicionada na aba "Teste" da planilha.'
          : 'Conexão parcial - não foi possível adicionar linha de teste.',
      })
    }

    return NextResponse.json(result)
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
