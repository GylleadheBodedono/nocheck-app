import { NextRequest, NextResponse } from 'next/server';
import { configurarWebhooks, listarWebhooks, listarChecklists } from '@/lib/webhook-setup';

// GET - Listar webhooks e checklists configurados
export async function GET() {
  try {
    const [webhooks, checklists] = await Promise.all([
      listarWebhooks(),
      listarChecklists(),
    ]);

    return NextResponse.json({
      webhooks,
      checklists: checklists.filter(c => c.name.toLowerCase().includes('recebimento')),
    });
  } catch (error) {
    console.error('[Setup] Erro ao listar:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    );
  }
}

// POST - Configurar webhooks
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { baseUrl } = body;

    if (!baseUrl) {
      return NextResponse.json(
        { error: 'baseUrl é obrigatório. Ex: https://seu-dominio.com' },
        { status: 400 }
      );
    }

    const resultado = await configurarWebhooks(baseUrl);

    return NextResponse.json({
      success: true,
      message: 'Webhooks configurados com sucesso!',
      webhooks: resultado,
    });
  } catch (error) {
    console.error('[Setup] Erro ao configurar:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    );
  }
}
