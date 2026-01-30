import axios from 'axios';
import { CHECKLIST_API } from './config';

// Tipos baseados na API do Checklist Fácil (estrutura real)
interface ChecklistFile {
  url: string;
  name?: string;
}

interface SelectedOption {
  id: number;
  text: string;
  value?: number | null;
}

interface ChecklistAnswer {
  text?: string;
  number?: number;
  evaluative?: boolean | null;
  files?: ChecklistFile[];
  selectedOptions?: SelectedOption[];
}

interface ChecklistAttachment {
  id: number;
  url: string;
  subtitle?: string;
}

interface ChecklistItem {
  id: number;
  name: string;
  answer?: ChecklistAnswer;
  attachments?: ChecklistAttachment[];
}

interface ChecklistCategory {
  id: number;
  name: string;
  items: ChecklistItem[];
}

interface Evaluation {
  id: number;
  user: { id: number; name: string };
  unit: { id: number; name: string };
  checklist: { id: number; name: string };
  categories: ChecklistCategory[];
  signatures?: { url: string }[];
}

// Cliente da API
const api = axios.create({
  baseURL: CHECKLIST_API.baseURL,
  headers: {
    'Authorization': `Bearer ${CHECKLIST_API.token}`,
    'Content-Type': 'application/json',
  },
});

// Helper para delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Buscar avaliação completa (com retry para rate limiting)
export async function getEvaluation(evaluationId: number, retries = 5): Promise<Evaluation> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await api.get<Evaluation>(`/v2/evaluations/${evaluationId}`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 429) {
        // Rate limiting - usar Retry-After se disponível, senão usar delay progressivo curto
        const retryAfter = error.response.headers['retry-after'];
        const waitTime = retryAfter
          ? parseInt(retryAfter) * 1000
          : Math.min(attempt * 1000, 5000); // 1s, 2s, 3s, 4s, 5s (máx 5s)
        console.log(`[API] Rate limited. Aguardando ${waitTime/1000}s... (tentativa ${attempt}/${retries})`);
        await delay(waitTime);
        continue;
      }
      throw error;
    }
  }
  throw new Error(`Falha após ${retries} tentativas (rate limiting)`);
}

// Extrair todos os items de todas as categorias
function getAllItems(evaluation: Evaluation): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  for (const category of evaluation.categories || []) {
    items.push(...(category.items || []));
  }
  return items;
}

// Extrair valor de um campo pelo nome
export function getFieldValue(evaluation: Evaluation, fieldName: string): string | number | null {
  const items = getAllItems(evaluation);
  const item = items.find(i =>
    i.name.toLowerCase().includes(fieldName.toLowerCase())
  );

  if (!item?.answer) return null;

  // Dropdown/Lista - usa selectedOptions
  if (item.answer.selectedOptions && item.answer.selectedOptions.length > 0) {
    return item.answer.selectedOptions[0].text;
  }

  // Campo de texto
  if (item.answer.text !== undefined && item.answer.text !== null) {
    return item.answer.text;
  }

  // Campo numérico/monetário
  if (item.answer.number !== undefined && item.answer.number !== null) {
    return item.answer.number;
  }

  return null;
}

// IDs dos checklists de recebimento (8 lojas cada)
export const CHECKLIST_IDS = {
  ESTOQUISTA: [
    921336, // RECEBIMENTO - ESTOQUISTA - BDN Afogados
    921326, // RECEBIMENTO - ESTOQUISTA - BDN Boa Viagem
    921332, // RECEBIMENTO - ESTOQUISTA - BDN Guararapes
    921338, // RECEBIMENTO - ESTOQUISTA - BDN Olinda
    921337, // RECEBIMENTO - ESTOQUISTA - BDN Tacaruna
    921340, // RECEBIMENTO - ESTOQUISTA - BRG Boa Viagem
    921344, // RECEBIMENTO - ESTOQUISTA - BRG Guararapes
    921342, // RECEBIMENTO - ESTOQUISTA - BRG Riomar
  ],
  APRENDIZ: [
    921361, // RECEBIMENTO - APRENDIZ - BDN Afogados
    921350, // RECEBIMENTO - APRENDIZ - BDN Boa Viagem
    921359, // RECEBIMENTO - APRENDIZ - BDN Guararapes
    921372, // RECEBIMENTO - APRENDIZ - BDN Olinda
    921370, // RECEBIMENTO - APRENDIZ - BDN Tacaruna
    921376, // RECEBIMENTO - APRENDIZ - BRG Boa Viagem
    921383, // RECEBIMENTO - APRENDIZ - BRG Guararapes
    921380, // RECEBIMENTO - APRENDIZ - BRG Riomar
  ],
};

// Verificar se a avaliação é do checklist correto
export function isChecklistEstoquista(evaluation: Evaluation): boolean {
  return CHECKLIST_IDS.ESTOQUISTA.includes(evaluation.checklist?.id);
}

export function isChecklistAprendiz(evaluation: Evaluation): boolean {
  return CHECKLIST_IDS.APRENDIZ.includes(evaluation.checklist?.id);
}

// Extrair URL da foto de um campo (fotos ficam em attachments, não em answer.files)
export function getPhotoUrl(evaluation: Evaluation, fieldName: string): string | null {
  const items = getAllItems(evaluation);
  const item = items.find(i =>
    i.name.toLowerCase().includes(fieldName.toLowerCase())
  );
  return item?.attachments?.[0]?.url ?? null;
}

// Extrair valor numérico (para campos monetários)
export function getNumericValue(evaluation: Evaluation, fieldName: string): number {
  const value = getFieldValue(evaluation, fieldName);
  if (value === null) return 0;
  if (typeof value === 'number') return value;
  // Remove formatação de moeda (R$ 1.234,56 → 1234.56)
  const cleaned = String(value)
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  return parseFloat(cleaned) || 0;
}

// Validar se dois campos de valor são iguais (confirmação)
export function validarValorConfirmacao(
  evaluation: Evaluation,
  campoValor: string,
  campoConfirmacao: string
): { valido: boolean; valor: number; valorConfirmacao: number } {
  const valor = getNumericValue(evaluation, campoValor);
  const valorConfirmacao = getNumericValue(evaluation, campoConfirmacao);

  return {
    valido: valor === valorConfirmacao,
    valor,
    valorConfirmacao,
  };
}

// Helpers para acessar dados da avaliação
export function getUserName(evaluation: Evaluation): string {
  return evaluation.user?.name || 'Desconhecido';
}

export function getUnitId(evaluation: Evaluation): number {
  return evaluation.unit?.id || 0;
}

export function getUnitName(evaluation: Evaluation): string {
  return evaluation.unit?.name || 'Loja Desconhecida';
}
