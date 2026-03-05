# Implementacao: Alertas Teams por Funcao + Relatorios Exportaveis

Este documento descreve as duas features implementadas neste ciclo de desenvolvimento.

---

## 1. Alertas Teams por Canal da Funcao com @Mencao

### Problema

O sistema ja enviava alertas de plano de acao para um canal global do Teams. A empresa precisava de canais separados por equipe (ex: "Alertas Manutencao", "Alertas Estoque"), com notificacao direta (@mencao) do preenchedor e do responsavel.

### Solucao

Cada **funcao** (cargo) agora pode ter seu proprio webhook do Teams. Quando um plano de acao e criado, o alerta vai para o canal da funcao do **responsavel**, com @mencao usando o email cadastrado (que corresponde ao chat do Teams).

### Arquivos Modificados

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/schema.sql` | Coluna `teams_webhook_url TEXT` na tabela `functions` |
| `src/types/database.ts` | Campo `teams_webhook_url: string \| null` em FunctionRow/Insert/Update |
| `src/app/admin/funcoes/page.tsx` | Input de URL do webhook no modal de criar/editar funcao |
| `src/lib/actionPlanEngine.ts` | Busca email do preenchedor, email e webhook da funcao do responsavel |
| `src/lib/notificationService.ts` | Campos opcionais: respondentName, respondentEmail, assigneeEmail, webhookUrl |
| `src/app/api/integrations/notify/route.ts` | Roteamento por webhook da funcao + @mencoes via msteams.entities |

### Fluxo Completo

```
Checklist concluido com nao-conformidade
  -> actionPlanEngine cria plano de acao
  -> Busca: email do preenchedor + email do responsavel + webhook da funcao
  -> Chama sendActionPlanTeamsAlert com todos os dados
  -> notificationService envia para /api/integrations/notify
  -> API determina webhook: funcao do assignee || TEAMS_WEBHOOK_URL global
  -> Monta Adaptive Card com @mencoes (preenchedor + responsavel)
  -> POST para webhook do canal correto
  -> Teams notifica ambos via @mencao
```

### Configuracao

1. Criar canais no Teams: "Alertas Manutencao", "Alertas Estoque", etc.
2. Em cada canal: Configuracoes > Conectores > Incoming Webhook > copiar URL
3. No sistema: Admin > Funcoes > editar funcao > colar URL do webhook
4. Rodar SQL de migracao:
   ```sql
   ALTER TABLE public.functions ADD COLUMN IF NOT EXISTS teams_webhook_url TEXT;
   ```

### Fallback

Se a funcao do responsavel nao tiver webhook configurado, o alerta vai para o canal global (`TEAMS_WEBHOOK_URL` do .env).

---

## 2. Relatorios Exportaveis por Tab

### Problema

A pagina de relatorios (`/admin/relatorios`) tinha 4 tabs com dados ricos (Visao Geral, Respostas por Usuario, Conformidade, Reincidencias) mas nenhuma tinha opcao de exportar. A exportacao so existia nas sub-paginas separadas (Fotos NC e Planos de Acao).

### Solucao

Cada tab agora tem um botao "Exportar" com dropdown para 4 formatos: **CSV**, **Excel (XLSX)**, **TXT** e **PDF**.

### Arquivos Modificados

| Arquivo | Alteracao |
|---------|-----------|
| `src/lib/exportUtils.ts` | 16 novas funcoes de exportacao (4 tabs x 4 formatos) + tipos + helper PDF |
| `src/app/admin/relatorios/page.tsx` | Imports, state, handlers, dropdown de exportacao em cada tab |

### Funcoes Adicionadas em exportUtils.ts

#### Tab 1: Visao Geral
- `exportOverviewToCSV(data, filename)` — resumo + lojas + templates + dados diarios
- `exportOverviewToTXT(data, filename)` — formatado com graficos ASCII de barras
- `exportOverviewToExcel(data, filename)` — 3 sheets: "Desempenho por Loja", "Uso de Checklists", "Dados Diarios"
- `exportOverviewToPDF(data)` — tabelas de lojas e templates com header de resumo

#### Tab 2: Respostas por Usuario
- `exportResponsesToCSV(items, filename)` — usuario, email, checklist, loja, status, datas
- `exportResponsesToTXT(items, filename)` — blocos formatados por resposta
- `exportResponsesToExcel(items, filename)` — 1 sheet com todas as colunas
- `exportResponsesToPDF(items)` — tabela paginada

#### Tab 3: Conformidade
- `exportComplianceToCSV(data, filename)` — resumo + campos + lojas
- `exportComplianceToTXT(data, filename)` — KPIs + tabelas formatadas
- `exportComplianceToExcel(data, filename)` — 2 sheets: "Por Campo", "Por Loja"
- `exportComplianceToPDF(data)` — tabelas de campo e loja com resumo

#### Tab 4: Reincidencias
- `exportReincidenciasToCSV(data, filename)` — resumo + campos + responsaveis
- `exportReincidenciasToTXT(data, filename)` — formatado com estatisticas
- `exportReincidenciasToExcel(data, filename)` — 2 sheets: "Reincidencias", "Desempenho Responsaveis"
- `exportReincidenciasToPDF(data)` — tabelas com paginacao

### Tipos Exportados

```typescript
OverviewExportData    // summary + storeStats + templateStats + dailyStats + period
UserChecklistExport   // id, status, created_at, completed_at, user_name, user_email, store_name, template_name
ComplianceExportData  // summary + byField + byStore
ReincidenciaExportData // summary + rows + assigneeStats
```

### Helper PDF Compartilhado

```typescript
drawPdfTable(doc, columns, rows, startY): number
```
Desenha tabelas no PDF com header cinza, linhas alternadas, alinhamento configuravel e quebra de pagina automatica.

### Convencao de Nomes dos Arquivos

`relatorio_{tab}_{YYYY-MM-DD}.{ext}`

Exemplos:
- `relatorio_visao_geral_2026-03-05.csv`
- `relatorio_conformidade_2026-03-05.xlsx`
- `relatorio_reincidencias_2026-03-05.pdf`

### Formatos Suportados

| Formato | Detalhes |
|---------|----------|
| **CSV** | UTF-8 BOM para Excel, virgula como separador, escape de aspas |
| **Excel** | Dynamic import do xlsx (~300KB), multiplas sheets, auto-width |
| **TXT** | Legivel em qualquer editor, separadores visuais, labels alinhados |
| **PDF** | Dynamic import do jsPDF (~300KB), tabelas, header, paginacao |

### UI

Botao "Exportar" com dropdown aparece ao lado dos filtros de periodo em cada tab. O mesmo handler compartilhado detecta a tab ativa e chama a funcao correspondente.

---

## Migracao SQL Necessaria

```sql
-- Feature Teams por funcao
ALTER TABLE public.functions ADD COLUMN IF NOT EXISTS teams_webhook_url TEXT;

-- Feature is_tech (dashboard tecnica) - de implementacao anterior
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_tech BOOLEAN DEFAULT false;
```
