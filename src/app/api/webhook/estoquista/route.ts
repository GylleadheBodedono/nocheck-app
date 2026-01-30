import { NextRequest, NextResponse } from 'next/server';
import {
  getEvaluation,
  getFieldValue,
  getPhotoUrl,
  getNumericValue,
  getUserName,
  getUnitName,
  isChecklistEstoquista
} from '@/lib/checklist-api';
import { criarLinhaEstoquista } from '@/lib/google-sheets';

interface WebhookBody {
  evaluationId: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('[Webhook Estoquista] Body completo:', JSON.stringify(body, null, 2));

    const { evaluationId } = body as WebhookBody;

    // Buscar dados completos da avaliação
    const evaluation = await getEvaluation(evaluationId);
    console.log('[Webhook Estoquista] Avaliação carregada:', evaluation.id, '- Checklist:', evaluation.checklist?.name);

    // Verificar se é o checklist correto
    if (!isChecklistEstoquista(evaluation)) {
      console.log('[Webhook Estoquista] Ignorando - não é checklist de estoquista');
      return NextResponse.json({
        success: true,
        message: 'Ignorado - checklist diferente',
        checklistId: evaluation.checklist?.id
      });
    }

    // Extrair dados do usuário e unidade
    const userName = getUserName(evaluation);
    const loja = getUnitName(evaluation);

    // Extrair campos
    const fornecedor = String(getFieldValue(evaluation, 'Lista') || '');
    const numeroNota = String(getFieldValue(evaluation, 'Número da Nota Fiscal') || '');
    const fotoUrl = getPhotoUrl(evaluation, 'foto da nota fiscal');
    const valorTotal = getNumericValue(evaluation, 'Valor Total da Nota');

    // Debug: listar todos os campos
    console.log('[Webhook Estoquista] === TODOS OS CAMPOS ===');
    for (const category of evaluation.categories || []) {
      for (const item of category.items || []) {
        const attachments = (item as any).attachments;
        if (attachments && attachments.length > 0) {
          console.log(`  - ${item.name}: TEM FOTO → ${attachments[0].url.substring(0, 80)}...`);
        } else {
          console.log(`  - ${item.name}: ${item.answer?.text || item.answer?.number || 'vazio'}`);
        }
      }
    }
    console.log('[Webhook Estoquista] === FIM DOS CAMPOS ===');

    console.log('[Webhook Estoquista] Campos extraídos:', {
      numeroNota,
      fornecedor,
      valorTotal,
      fotoUrl,
      userName,
      loja
    });

    if (!numeroNota) {
      console.error('[Webhook Estoquista] Número da nota não encontrado');
      return NextResponse.json(
        { error: 'Número da nota fiscal não encontrado na avaliação' },
        { status: 400 }
      );
    }

    // Salvar direto na planilha do Google Sheets
    try {
      const rowNumber = await criarLinhaEstoquista({
        dataHora: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
        loja,
        numeroNota,
        fornecedor,
        estoquista: userName,
        valorEstoquista: valorTotal,
        fotoUrl,
        evalIdEstoquista: evaluationId,
      });

      return NextResponse.json({
        success: true,
        message: 'Dados do estoquista salvos na planilha',
        numeroNota,
        valor: valorTotal,
        linha: rowNumber,
      });
    } catch (sheetsError) {
      console.error('========================================');
      console.error('[SHEETS] ERRO: Falha ao salvar na planilha!');
      console.error(`[SHEETS] Nota: ${numeroNota}`);
      console.error('[SHEETS] Detalhes:', sheetsError);
      console.error('========================================');

      return NextResponse.json(
        {
          error: 'Erro ao salvar na planilha',
          details: sheetsError instanceof Error ? sheetsError.message : 'Erro desconhecido'
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[Webhook Estoquista] Erro:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    );
  }
}
