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

const api = axios.create({
  baseURL: process.env.CHECKLIST_API_BASE,
  headers: {
    'Authorization': `Bearer ${process.env.CHECKLIST_API_TOKEN}`,
    'Content-Type': 'application/json',
  },
});

async function debugEvaluation(evaluationId: number) {
  try {
    console.log(`Buscando avaliação ${evaluationId}...\n`);

    const response = await api.get(`/v2/evaluations/${evaluationId}`);
    const evaluation = response.data;

    console.log('=== ESTRUTURA COMPLETA DA AVALIAÇÃO ===\n');
    console.log(JSON.stringify(evaluation, null, 2));

    console.log('\n=== ANALISANDO CAMPOS COM POSSÍVEIS FOTOS ===\n');

    for (const category of evaluation.categories || []) {
      for (const item of category.items || []) {
        console.log(`Campo: ${item.name}`);
        console.log(`  answer:`, JSON.stringify(item.answer, null, 4));
        console.log('---');
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

// Usar o último evaluation ID do log: 182330008
const evalId = process.argv[2] ? parseInt(process.argv[2]) : 182330008;
debugEvaluation(evalId);
