import { NextRequest, NextResponse } from 'next/server';
import {
  getEvaluation,
  getFieldValue,
  getNumericValue,
  getUserName,
  isChecklistAprendiz
} from '@/lib/checklist-api';
import { buscarLinhaPorNota, atualizarLinhaAprendiz, criarLinhaPendente } from '@/lib/google-sheets';
import { sendTeamsAlert, sendTeamsAlertNotaPendente } from '@/lib/teams';

interface WebhookBody {
  evaluationId: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('[Webhook Aprendiz] Body completo:', JSON.stringify(body, null, 2));

    const { evaluationId } = body as WebhookBody;

    // Buscar dados completos da avaliação
    const evaluation = await getEvaluation(evaluationId);
    console.log('[Webhook Aprendiz] Avaliação carregada:', evaluation.id, '- Checklist:', evaluation.checklist?.name);

    // Verificar se é o checklist correto
    if (!isChecklistAprendiz(evaluation)) {
      console.log('[Webhook Aprendiz] Ignorando - não é checklist de aprendiz');
      return NextResponse.json({
        success: true,
        message: 'Ignorado - checklist diferente',
        checklistId: evaluation.checklist?.id
      });
    }

    // Extrair dados
    const userName = getUserName(evaluation);
    const numeroNota = String(getFieldValue(evaluation, 'Número da Nota Fiscal') || '');
    const numeroLancamento = String(getFieldValue(evaluation, 'Número do Lançamento') || '');
    const valorAprendiz = getNumericValue(evaluation, 'Valor que Você Lançou');

    console.log('[Webhook Aprendiz] Campos:', {
      numeroNota,
      numeroLancamento,
      valorAprendiz,
      userName
    });

    if (!numeroNota) {
      console.error('[Webhook Aprendiz] Número da nota não encontrado');
      return NextResponse.json(
        { error: 'Número da nota fiscal não encontrado na avaliação' },
        { status: 400 }
      );
    }

    // Buscar linha do estoquista na planilha
    const dadosEstoquista = await buscarLinhaPorNota(numeroNota);

    if (!dadosEstoquista) {
      console.log(`[Webhook Aprendiz] Nota ${numeroNota} não encontrada - salvando na aba Pendentes e alertando Teams`);

      const dataHoraAprendiz = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

      // Salvar na aba Pendentes para revisão manual
      try {
        const rowNumber = await criarLinhaPendente({
          dataHora: dataHoraAprendiz,
          aprendiz: userName,
          notaDigitada: numeroNota,
          valorAprendiz,
          numeroLancamento,
          evalIdAprendiz: evaluationId,
        });

        // Enviar alerta no Teams
        try {
          await sendTeamsAlertNotaPendente({
            notaAprendiz: numeroNota,
            aprendiz: userName,
            valorAprendiz,
            numeroLancamento,
            dataHoraAprendiz,
          });
          console.log('[Webhook Aprendiz] Alerta de nota pendente enviado ao Teams');
        } catch (teamsError) {
          console.error('[Webhook Aprendiz] Erro ao enviar alerta Teams:', teamsError);
        }

        return NextResponse.json({
          success: true,
          message: 'Nota não encontrada - salva na aba Pendentes e alerta enviado',
          numeroNota,
          linhaPendente: rowNumber,
        });
      } catch (sheetsError) {
        console.error('[Webhook Aprendiz] Erro ao salvar pendente:', sheetsError);
        return NextResponse.json(
          { error: 'Erro ao salvar nota pendente' },
          { status: 500 }
        );
      }
    }

    console.log(`[Webhook Aprendiz] Encontrou linha ${dadosEstoquista.rowNumber} do estoquista`);

    // Atualizar linha com dados do aprendiz
    const { status, diferenca } = await atualizarLinhaAprendiz(
      dadosEstoquista.rowNumber,
      {
        aprendiz: userName,
        valorAprendiz,
        numeroLancamento,
        evalIdAprendiz: evaluationId,
      },
      dadosEstoquista.valorEstoquista,
      dadosEstoquista.fotoUrl,
      dadosEstoquista.evalIdEstoquista
    );

    // Se valores diferentes, enviar alerta no Teams
    if (status === 'Falhou') {
      try {
        await sendTeamsAlert({
          numeroNota,
          loja: dadosEstoquista.loja,
          fornecedor: dadosEstoquista.fornecedor,
          estoquista: dadosEstoquista.estoquista,
          valorEstoquista: dadosEstoquista.valorEstoquista,
          aprendiz: userName,
          valorAprendiz,
          diferenca,
          fotoUrl: dadosEstoquista.fotoUrl,
        });
        console.log('[Webhook Aprendiz] Alerta enviado ao Teams');
      } catch (teamsError) {
        console.error('[Webhook Aprendiz] Erro ao enviar alerta Teams:', teamsError);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Validação concluída',
      status,
      numeroNota,
      diferenca,
    });
  } catch (error) {
    console.error('[Webhook Aprendiz] Erro:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    );
  }
}
