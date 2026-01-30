import axios from 'axios';
import { TEAMS_WEBHOOK } from './config';

export interface DadosAlerta {
  numeroNota: string;
  loja: string;
  fornecedor: string;
  estoquista: string;
  valorEstoquista: number;
  aprendiz: string;
  valorAprendiz: number;
  diferenca: number;
  fotoUrl: string | null;
}

export async function sendTeamsAlert(dados: DadosAlerta): Promise<void> {
  if (!TEAMS_WEBHOOK) {
    console.warn('[Teams] TEAMS_WEBHOOK_URL não configurado, pulando...');
    return;
  }

  const payload = {
    '@type': 'MessageCard',
    '@context': 'https://schema.org/extensions',
    summary: 'Erro no Recebimento',
    themeColor: 'FF0000',
    title: '🚨 ERRO: Valores não batem',
    sections: [
      {
        activityTitle: `Nota #${dados.numeroNota} - ${dados.loja}`,
        activitySubtitle: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
        facts: [
          { name: 'Fornecedor:', value: dados.fornecedor },
          {
            name: 'Estoquista (valor):',
            value: `${dados.estoquista} → R$ ${dados.valorEstoquista.toFixed(2)}`,
          },
          {
            name: 'Aprendiz (valor):',
            value: `${dados.aprendiz} → R$ ${dados.valorAprendiz.toFixed(2)}`,
          },
          {
            name: 'Diferença:',
            value: `R$ ${dados.diferenca.toFixed(2)}`,
          },
        ],
      },
    ],
    potentialAction: dados.fotoUrl
      ? [
          {
            '@type': 'OpenUri',
            name: 'Ver Foto da Nota',
            targets: [{ os: 'default', uri: dados.fotoUrl }],
          },
        ]
      : [],
  };

  await axios.post(TEAMS_WEBHOOK, payload);
  console.log(`[Teams] Alerta enviado: Nota ${dados.numeroNota}`);
}

// Alerta para quando o aprendiz preenche uma nota que não existe na planilha
export interface DadosAlertaNotaPendente {
  notaAprendiz: string;
  aprendiz: string;
  valorAprendiz: number;
  numeroLancamento: string;
  dataHoraAprendiz: string;
}

export async function sendTeamsAlertNotaPendente(dados: DadosAlertaNotaPendente): Promise<void> {
  if (!TEAMS_WEBHOOK) {
    console.warn('[Teams] TEAMS_WEBHOOK_URL não configurado, pulando...');
    return;
  }

  const payload = {
    '@type': 'MessageCard',
    '@context': 'https://schema.org/extensions',
    summary: 'Nota Fiscal Pendente',
    themeColor: 'FFA500', // Laranja
    title: '⚠️ NOTA PENDENTE: Número não encontrado',
    sections: [
      {
        activityTitle: 'Dados do Aprendiz',
        activitySubtitle: dados.dataHoraAprendiz,
        facts: [
          {
            name: '👤 Aprendiz:',
            value: dados.aprendiz,
          },
          {
            name: '📄 Nota digitada:',
            value: dados.notaAprendiz,
          },
          {
            name: '💰 Valor informado:',
            value: `R$ ${dados.valorAprendiz.toFixed(2)}`,
          },
          {
            name: '🔢 Nº Lançamento:',
            value: dados.numeroLancamento || 'Não informado',
          },
        ],
      },
      {
        activityTitle: '❓ Possíveis causas',
        text: '• Estoquista ainda não preencheu o checklist\n• Número da nota digitado diferente\n• Estoquista digitou número errado',
      },
      {
        activityTitle: '📋 Ação necessária',
        text: 'Verificar na aba **Pendentes** da planilha e conferir com o estoquista o número correto da nota.',
      },
    ],
  };

  await axios.post(TEAMS_WEBHOOK, payload);
  console.log(`[Teams] Alerta de nota pendente enviado: Nota ${dados.notaAprendiz}`);
}
