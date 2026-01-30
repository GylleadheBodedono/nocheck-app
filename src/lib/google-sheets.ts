import { google } from 'googleapis';
import { readFileSync } from 'fs';
import { join } from 'path';
import { SHEETS_ID } from './config';

// Inicializar cliente do Google Sheets
function getSheetsClient() {
  const jsonPath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH || join(process.cwd(), 'checklist-app-485712-21867804854b.json');

  let credentials;
  try {
    const fileContent = readFileSync(jsonPath, 'utf-8');
    credentials = JSON.parse(fileContent);
  } catch {
    const credentialsJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!credentialsJson) {
      throw new Error('Credenciais Google não encontradas. Configure GOOGLE_SERVICE_ACCOUNT_PATH ou GOOGLE_SERVICE_ACCOUNT_JSON');
    }
    credentials = JSON.parse(credentialsJson);
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
}

const SHEET_NAME = 'Validações';
const SHEET_PENDENTES = 'Pendentes';

// === DADOS DO ESTOQUISTA ===
export interface DadosEstoquista {
  dataHora: string;
  loja: string;
  numeroNota: string;
  fornecedor: string;
  estoquista: string;
  valorEstoquista: number;
  fotoUrl: string | null;
  evalIdEstoquista: number;
}

// Criar linha com dados do estoquista (colunas A-H)
export async function criarLinhaEstoquista(dados: DadosEstoquista): Promise<number> {
  if (!SHEETS_ID) {
    throw new Error('GOOGLE_SHEETS_ID não configurado');
  }

  const sheets = getSheetsClient();

  const values = [
    [
      dados.dataHora,           // A: Data/Hora
      dados.loja,               // B: Loja
      dados.numeroNota,         // C: Numero Nota
      dados.fornecedor,         // D: Fornecedor
      dados.estoquista,         // E: Estoquista
      dados.valorEstoquista,    // F: Valor Estoquista
      '',                       // G: Aprendiz (vazio)
      '',                       // H: Valor Aprendiz (vazio)
      '',                       // I: Status (vazio)
      '',                       // J: Diferença (vazio)
      dados.fotoUrl || '',      // K: Link da foto
      '',                       // L: Nº Lançamento (vazio)
      dados.evalIdEstoquista,   // M: Eval ID Estoquista
      '',                       // N: Eval ID Aprendiz (vazio)
    ],
  ];

  const response = await sheets.spreadsheets.values.append({
    spreadsheetId: SHEETS_ID,
    range: `${SHEET_NAME}!A:N`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });

  // Retorna o número da linha criada
  const updatedRange = response.data.updates?.updatedRange || '';
  const match = updatedRange.match(/!A(\d+):/);
  const rowNumber = match ? parseInt(match[1]) : 0;

  console.log('========================================');
  console.log('[SHEETS] SUCESSO: Linha criada na planilha!');
  console.log(`[SHEETS] Linha: ${rowNumber}`);
  console.log(`[SHEETS] Nota: ${dados.numeroNota}`);
  console.log(`[SHEETS] Valor: R$ ${dados.valorEstoquista.toFixed(2)}`);
  console.log(`[SHEETS] Estoquista: ${dados.estoquista}`);
  console.log(`[SHEETS] Loja: ${dados.loja}`);
  console.log('========================================');

  return rowNumber;
}

// === BUSCAR LINHA POR NÚMERO DA NOTA ===
export interface DadosEstoquistaPlanilha {
  rowNumber: number;
  dataHora: string;
  loja: string;
  numeroNota: string;
  fornecedor: string;
  estoquista: string;
  valorEstoquista: number;
  fotoUrl: string | null;
  evalIdEstoquista: number;
}



export async function buscarLinhaPorNota(numeroNota: string): Promise<DadosEstoquistaPlanilha | null> {
  if (!SHEETS_ID) {
    throw new Error('GOOGLE_SHEETS_ID não configurado');
  }

  const sheets = getSheetsClient();

  // Buscar todas as linhas
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEETS_ID,
    range: `${SHEET_NAME}!A:N`,
  });

  const rows = response.data.values || [];

  // Procurar pela nota (coluna C, índice 2)
  // Começar do índice 1 para pular o cabeçalho
  for (let i = rows.length - 1; i >= 1; i--) {
    const row = rows[i];
    if (row[2] === numeroNota && !row[6]) { // Coluna C = nota, Coluna G = aprendiz (vazia)
      return {
        rowNumber: i + 1, // +1 porque planilha começa em 1
        dataHora: row[0] || '',
        loja: row[1] || '',
        numeroNota: row[2] || '',
        fornecedor: row[3] || '',
        estoquista: row[4] || '',
        valorEstoquista: parseFloat(row[5]) || 0,
        fotoUrl: row[10] || null,           // K: Link da foto
        evalIdEstoquista: parseInt(row[12]) || 0, // M: Eval ID Estoquista
      };
    }
  }

  return null;
}

// === DADOS DO APRENDIZ ===
export interface DadosAprendiz {
  aprendiz: string;
  valorAprendiz: number;
  numeroLancamento: string;
  evalIdAprendiz: number;
}

// Atualizar linha com dados do aprendiz (colunas G-N)
export async function atualizarLinhaAprendiz(
  rowNumber: number,
  dados: DadosAprendiz,
  valorEstoquista: number,
  fotoUrl: string | null,
  evalIdEstoquista: number
): Promise<{ status: 'Sucesso' | 'Falhou'; diferenca: number }> {
  if (!SHEETS_ID) {
    throw new Error('GOOGLE_SHEETS_ID não configurado');
  }

  const sheets = getSheetsClient();

  // Calcular status e diferença
  const diferenca = Math.abs(valorEstoquista - dados.valorAprendiz);
  const status: 'Sucesso' | 'Falhou' = diferenca === 0 ? 'Sucesso' : 'Falhou';

  const values = [
    [
      dados.aprendiz,           // G: Aprendiz
      dados.valorAprendiz,      // H: Valor Aprendiz
      status,                   // I: Status
      diferenca,                // J: Diferença
      fotoUrl || '',            // K: Link da foto (preservar)
      dados.numeroLancamento,   // L: Nº Lançamento
      evalIdEstoquista,         // M: Eval ID Estoquista (preservar)
      dados.evalIdAprendiz,     // N: Eval ID Aprendiz
    ],
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEETS_ID,
    range: `${SHEET_NAME}!G${rowNumber}:N${rowNumber}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });

  console.log('========================================');
  console.log('[SHEETS] SUCESSO: Linha atualizada com dados do aprendiz!');
  console.log(`[SHEETS] Linha: ${rowNumber}`);
  console.log(`[SHEETS] Aprendiz: ${dados.aprendiz}`);
  console.log(`[SHEETS] Valor Aprendiz: R$ ${dados.valorAprendiz.toFixed(2)}`);
  console.log(`[SHEETS] Valor Estoquista: R$ ${valorEstoquista.toFixed(2)}`);
  console.log(`[SHEETS] Status: ${status}`);
  console.log(`[SHEETS] Diferença: R$ ${diferenca.toFixed(2)}`);
  console.log('========================================');

  return { status, diferenca };
}

// === ABA PENDENTES (notas órfãs) ===

// Garantir que a aba "Pendentes" existe, criar se não existir
async function garantirAbaPendentes(): Promise<void> {
  if (!SHEETS_ID) {
    throw new Error('GOOGLE_SHEETS_ID não configurado');
  }

  const sheets = getSheetsClient();

  // Verificar se a aba já existe
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: SHEETS_ID,
  });

  const abaExiste = spreadsheet.data.sheets?.some(
    sheet => sheet.properties?.title === SHEET_PENDENTES
  );

  if (!abaExiste) {
    // Criar a aba
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEETS_ID,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: SHEET_PENDENTES,
              },
            },
          },
        ],
      },
    });

    // Adicionar cabeçalho
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEETS_ID,
      range: `${SHEET_PENDENTES}!A1:F1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          'Data/Hora',
          'Aprendiz',
          'Nota Digitada',
          'Valor Aprendiz',
          'Nº Lançamento',
          'Eval ID Aprendiz',
        ]],
      },
    });

    console.log('[SHEETS] Aba "Pendentes" criada com sucesso!');
  }
}

// Dados para aba Pendentes
export interface DadosPendente {
  dataHora: string;
  aprendiz: string;
  notaDigitada: string;
  valorAprendiz: number;
  numeroLancamento: string;
  evalIdAprendiz: number;
}

// Criar linha na aba Pendentes (quando nota não encontrada)
export async function criarLinhaPendente(dados: DadosPendente): Promise<number> {
  if (!SHEETS_ID) {
    throw new Error('GOOGLE_SHEETS_ID não configurado');
  }

  // Garantir que a aba existe
  await garantirAbaPendentes();

  const sheets = getSheetsClient();

  const values = [
    [
      dados.dataHora,
      dados.aprendiz,
      dados.notaDigitada,
      dados.valorAprendiz,
      dados.numeroLancamento,
      dados.evalIdAprendiz,
    ],
  ];

  const response = await sheets.spreadsheets.values.append({
    spreadsheetId: SHEETS_ID,
    range: `${SHEET_PENDENTES}!A:F`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });

  const updatedRange = response.data.updates?.updatedRange || '';
  const match = updatedRange.match(/!A(\d+):/);
  const rowNumber = match ? parseInt(match[1]) : 0;

  console.log('========================================');
  console.log('[SHEETS] Nota pendente registrada!');
  console.log(`[SHEETS] Aba: ${SHEET_PENDENTES}`);
  console.log(`[SHEETS] Linha: ${rowNumber}`);
  console.log(`[SHEETS] Nota digitada: ${dados.notaDigitada}`);
  console.log(`[SHEETS] Aprendiz: ${dados.aprendiz}`);
  console.log(`[SHEETS] Valor: R$ ${dados.valorAprendiz.toFixed(2)}`);
  console.log('========================================');

  return rowNumber;
}
