// Configurações da API Checklist Fácil
export const CHECKLIST_API = {
  baseURL: process.env.CHECKLIST_API_BASE || 'https://integration.checklistfacil.com.br',
  token: process.env.CHECKLIST_API_TOKEN || '',
};

// ID da planilha Google Sheets
export const SHEETS_ID = process.env.GOOGLE_SHEETS_ID || '';

// URL do webhook Teams
export const TEAMS_WEBHOOK = process.env.TEAMS_WEBHOOK_URL || '';

// Mapeamento lojas (unitId → nome)
export const LOJAS: Record<number, string> = {
  1: process.env.UNIT_1 || 'BDN Boa Viagem',
  2: process.env.UNIT_2 || 'BDN Guararapes',
  3: process.env.UNIT_3 || 'BDN Afogados',
  4: process.env.UNIT_4 || 'BDN Tacaruna',
  5: process.env.UNIT_5 || 'BDN Olinda',
  6: process.env.UNIT_6 || 'BRG Boa Viagem',
  7: process.env.UNIT_7 || 'BRG Riomar',
  8: process.env.UNIT_8 || 'BRG Guararapes',
};
