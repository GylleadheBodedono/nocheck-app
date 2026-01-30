import axios from 'axios';
import { CHECKLIST_API } from './config';

const api = axios.create({
  baseURL: CHECKLIST_API.baseURL,
  headers: {
    'Authorization': `Bearer ${CHECKLIST_API.token}`,
    'Content-Type': 'application/json',
  },
});

interface Webhook {
  id: number;
  name: string;
  url: string;
  type: number;
  active: boolean;
  checklistIds?: number[];
}

interface WebhookCreateParams {
  name: string;
  url: string;
  type?: number; // 1 = Avaliação concluída
  active?: boolean;
  checklistIds: number[];
}

// Listar webhooks existentes
export async function listarWebhooks(): Promise<Webhook[]> {
  const response = await api.get('/v2/webhooks');
  return response.data.data || [];
}

// Criar webhook
export async function criarWebhook(params: WebhookCreateParams): Promise<Webhook> {
  const response = await api.post('/v2/webhooks', {
    name: params.name,
    url: params.url,
    type: params.type || 1, // 1 = Avaliação concluída
    active: params.active ?? true,
    checklistIds: params.checklistIds,
  });
  return response.data;
}

// Excluir webhook
export async function excluirWebhook(webhookId: number): Promise<void> {
  await api.delete(`/v2/webhooks/${webhookId}`);
}

// Listar checklists disponíveis
export async function listarChecklists(): Promise<{ id: number; name: string; active: boolean }[]> {
  const response = await api.get('/v2/checklists?limit=100');
  return response.data.data || [];
}

// IDs dos checklists de recebimento (8 lojas cada)
export const CHECKLIST_IDS = {
  ESTOQUISTA: [
    921336, // BDN Afogados
    921326, // BDN Boa Viagem
    921332, // BDN Guararapes
    921338, // BDN Olinda
    921337, // BDN Tacaruna
    921340, // BRG Boa Viagem
    921344, // BRG Guararapes
    921342, // BRG Riomar
  ],
  APRENDIZ: [
    921361, // BDN Afogados
    921350, // BDN Boa Viagem
    921359, // BDN Guararapes
    921372, // BDN Olinda
    921370, // BDN Tacaruna
    921376, // BRG Boa Viagem
    921383, // BRG Guararapes
    921380, // BRG Riomar
  ],
};

// Configurar webhooks automaticamente (2 webhooks para 16 checklists)
export async function configurarWebhooks(baseUrl: string): Promise<{ estoquista: Webhook; aprendiz: Webhook }> {
  console.log('[Webhook Setup] Configurando webhooks para 8 lojas...');
  console.log(`[Webhook Setup] Base URL: ${baseUrl}`);

  // Verificar webhooks existentes
  const webhooksExistentes = await listarWebhooks();

  // Remover webhooks antigos com mesmo nome
  for (const wh of webhooksExistentes) {
    if (wh.name === 'Webhook Estoquista' || wh.name === 'Webhook Aprendiz') {
      console.log(`[Webhook Setup] Removendo webhook antigo: ${wh.name} (ID: ${wh.id})`);
      await excluirWebhook(wh.id);
    }
  }

  // Criar webhook Estoquista (8 checklists → 1 webhook)
  const estoquista = await criarWebhook({
    name: 'Webhook Estoquista',
    url: `${baseUrl}/api/webhook/estoquista`,
    checklistIds: CHECKLIST_IDS.ESTOQUISTA,
  });
  console.log(`[Webhook Setup] ✅ Webhook Estoquista criado (ID: ${estoquista.id}) - ${CHECKLIST_IDS.ESTOQUISTA.length} checklists`);

  // Criar webhook Aprendiz (8 checklists → 1 webhook)
  const aprendiz = await criarWebhook({
    name: 'Webhook Aprendiz',
    url: `${baseUrl}/api/webhook/aprendiz`,
    checklistIds: CHECKLIST_IDS.APRENDIZ,
  });
  console.log(`[Webhook Setup] ✅ Webhook Aprendiz criado (ID: ${aprendiz.id}) - ${CHECKLIST_IDS.APRENDIZ.length} checklists`);

  return { estoquista, aprendiz };
}
