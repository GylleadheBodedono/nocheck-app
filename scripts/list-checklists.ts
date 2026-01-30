import axios from 'axios';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env manually
const envPath = resolve(process.cwd(), '.env');
const envContent = readFileSync(envPath, 'utf-8');
for (const line of envContent.split('\n')) {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    process.env[key.trim()] = valueParts.join('=').trim();
  }
}

const baseURL = process.env.CHECKLIST_API_BASE || 'https://integration.checklistfacil.com.br';
const token = process.env.CHECKLIST_API_TOKEN;

console.log('Base URL:', baseURL);
console.log('Token (primeiros 20 chars):', token?.substring(0, 20) + '...');

const api = axios.create({
  baseURL,
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
});

async function listChecklists() {
  try {
    console.log('Buscando checklists da conta...\n');

    const response = await api.get('/v2/checklists', {
      params: { limit: 100 }
    });

    const checklists = response.data.data || response.data;

    console.log('=== CHECKLISTS ENCONTRADOS ===\n');

    for (const checklist of checklists) {
      console.log(`ID: ${checklist.id}`);
      console.log(`Nome: ${checklist.name}`);
      console.log('---');
    }

    console.log(`\nTotal: ${checklists.length} checklists`);

    // Filtrar os de recebimento
    const recebimento = checklists.filter((c: any) =>
      c.name.toLowerCase().includes('recebimento')
    );

    if (recebimento.length > 0) {
      console.log('\n=== CHECKLISTS DE RECEBIMENTO ===\n');
      for (const c of recebimento) {
        console.log(`ID: ${c.id} - Nome: ${c.name}`);
      }
    }

  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Erro:', error.response?.status, error.response?.data);
    } else {
      console.error('Erro:', error);
    }
  }
}

listChecklists();
