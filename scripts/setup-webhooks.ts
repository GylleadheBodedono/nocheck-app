#!/usr/bin/env bun
/**
 * Script para configurar webhooks no Checklist Fácil
 *
 * Uso:
 *   bun scripts/setup-webhooks.ts https://sua-url.com
 *   bun scripts/setup-webhooks.ts https://abc123.ngrok-free.dev
 */

import { configurarWebhooks, listarWebhooks, listarChecklists, CHECKLIST_IDS } from '../src/lib/webhook-setup';

async function main() {
  const baseUrl = process.argv[2];

  if (!baseUrl) {
    console.log('');
    console.log('📋 Setup de Webhooks - Checklist Fácil');
    console.log('=====================================');
    console.log('');
    console.log('Uso:');
    console.log('  bun scripts/setup-webhooks.ts <BASE_URL>');
    console.log('');
    console.log('Exemplo:');
    console.log('  bun scripts/setup-webhooks.ts https://abc123.ngrok-free.dev');
    console.log('  bun scripts/setup-webhooks.ts https://meu-app.vercel.app');
    console.log('');
    console.log('---');
    console.log('');

    // Listar estado atual
    console.log('📡 Webhooks atuais:');
    const webhooks = await listarWebhooks();
    if (webhooks.length === 0) {
      console.log('   Nenhum webhook configurado');
    } else {
      webhooks.forEach(wh => {
        console.log(`   [${wh.id}] ${wh.name} → ${wh.url} (${wh.active ? '✅ ativo' : '❌ inativo'})`);
      });
    }

    console.log('');
    console.log('📝 Checklists de Recebimento:');
    const checklists = await listarChecklists();
    const recebimento = checklists.filter(c => c.name.toLowerCase().includes('recebimento'));
    recebimento.forEach(c => {
      console.log(`   [${c.id}] ${c.name} (${c.active ? '✅ ativo' : '❌ inativo'})`);
    });

    console.log('');
    console.log('🔧 IDs configurados no código:');
    console.log(`   ESTOQUISTA: ${CHECKLIST_IDS.ESTOQUISTA}`);
    console.log(`   APRENDIZ: ${CHECKLIST_IDS.APRENDIZ}`);
    console.log('');

    process.exit(0);
  }

  console.log('');
  console.log('📋 Configurando Webhooks...');
  console.log('===========================');
  console.log('');

  try {
    const resultado = await configurarWebhooks(baseUrl);

    console.log('');
    console.log('✅ Webhooks configurados com sucesso!');
    console.log('');
    console.log('Estoquista:');
    console.log(`   ID: ${resultado.estoquista.id}`);
    console.log(`   URL: ${resultado.estoquista.url}`);
    console.log('');
    console.log('Aprendiz:');
    console.log(`   ID: ${resultado.aprendiz.id}`);
    console.log(`   URL: ${resultado.aprendiz.url}`);
    console.log('');
  } catch (error) {
    console.error('❌ Erro:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
