# 🗂️ NoCheck

> Sistema de gestão de qualidade e checklists para o **Grupo Do Nô** — controle de recebimento, não-conformidades e planos de ação em tempo real.

**PWA offline-first** com painel administrativo completo, validação cruzada entre operadores, planos de ação rastreáveis, notificações por email, e pesquisa global integrada.

---

## ✨ Funcionalidades

### 📋 Checklists
- **Templates dinâmicos** — crie e edite templates com campos de texto, número, data, dropdown, checkbox múltiplo, sim/não, e fotos
- **Etapas (seções)** — organize os campos em blocos dentro do template
- **Campos condicionais** — exiba ou oculte campos com base na resposta de outro campo (condições: igual, diferente, maior, menor, contém, etc.)
- **Ícones customizáveis** — cada campo pode ter um ícone associado
- **Categorias de template** — Recebimento, Limpeza, Abertura, Fechamento, Outros
- **Preenchimento offline** — funciona 100% sem internet após o primeiro acesso; sincroniza automaticamente ao reconectar
- **Validação cruzada** — compara valores preenchidos por dois operadores (ex: estoquista vs aprendiz) e detecta divergências automaticamente

### 🔐 Autenticação & Permissões
- Login com Supabase Auth (email + senha)
- Dois níveis: **Administrador** e **Usuário comum**
- Adminstradores têm acesso ao painel `/admin`; usuários são direcionados para o dashboard
- Cache de autenticação para login offline
- Logout completo com limpeza de caches e bloqueio de acesso pós-logout

### 🏬 Multi-loja
- Cada usuário é atribuído a uma ou mais lojas
- **Loja principal** — usada como padrão nas listagens e filtros
- Checklists e planos de ação são sempre vinculados à loja

### 📣 Planos de Ação
- Criação manual ou automática (gerado automaticamente ao responder um checklist com condições de severidade)
- Campos: título, descrição, severidade (baixa / média / alta / crítica), loja(s), responsável, prazo
- Acompanhamento de status: **Aberto → Em andamento → Concluído → Cancelado**
- Upload de fotos de evidência e resolução
- Comentários de acompanhamento (log de atividades)
- Reincidência — sistema detecta planos repetidos e incrementa contador
- Notificação in-app e email automático ao responsável ao ser atribuído

### 🔔 Notificações
- Notificações in-app com badge de contagem no header
- **Notificações do sistema (PWA)** — planos de ação, vencimentos e demais avisos podem ser exibidos como notificação nativa no celular/navegador; o usuário precisa permitir notificações no prompt do navegador (ícone do sino > "Ativar notificações")
- Tipos: `action_plan_assigned`, `action_plan_overdue`, `checklist_submitted`, etc.
- Integração com **Microsoft Teams** via Webhook para alertas de divergências
- **Alertas Teams por canal da função** — cada função/cargo pode ter seu próprio webhook do Teams; alertas de plano de ação são enviados para o canal da equipe do responsável com **@menção** do preenchedor e do responsável usando o email cadastrado
- Fallback automático para canal global se a função não tiver webhook configurado
- Envio de **email** via Edge Function do Supabase com templates HTML customizáveis configurados no painel admin

### 📸 Relatório Fotográfico de Não-Conformidades
- Geração de relatório agrupado por template/campo com fotos das respostas marcadas como não-conformidade
- Filtros por loja, template, severidade e período
- Exportação em **CSV, Excel, TXT e PDF** (com fotos embutidas no PDF)

### 🔍 Pesquisa Global no Admin
- Campo de busca no header do painel admin (atalho `Ctrl+K` / `Cmd+K`)
- Pesquisa simultânea em **8 categorias**: módulos do sistema, usuários, lojas, templates, planos de ação, setores, funções, checklists
- Dropdown com resultados agrupados, destaque do texto encontrado e badge de severidade
- Navegação por teclado (↑↓ Enter Escape)

### 🎨 Design System
- Tema claro/escuro com variáveis CSS (`--color-*`, `--bg-*`)
- Componente `<Select>` moderno com animação, teclado e busca — substitui todos os `<select>` nativos
- Design tokens centralizados no Tailwind: `text-main`, `bg-surface`, `border-subtle`, `text-primary`, etc.
- Componentes reutilizáveis: `Header`, `LoadingPage`, `Select`, `GlobalSearch`, `IconPicker`

### 🤖 Flux (Chatbot IA)
- **Assistente flutuante** — botão fixo no canto inferior direito, disponível em todas as telas
- Powered by **Groq API** (LLaMA 3.3 70B) com Edge Runtime (compatível com Cloudflare Pages)
- Personalidade amigável, extrovertida e engraçada — responde em português brasileiro
- Responde dúvidas sobre qualquer funcionalidade do NoCheck (checklists, relatórios, planos de ação, etc.)
- Histórico de conversa mantido durante a sessão (últimas 20 mensagens)
- Indicador de digitação animado enquanto processa a resposta

### 📊 Relatórios e Dashboard
- Dashboard com resumo de checklists do dia, alertas de vencimento e atividade recente
- **Dashboard técnica** — usuários marcados como "técnico" veem dashboard diferenciada com notificações, planos de ação atribuídos e histórico recente
- Tela de relatórios admin com 4 tabs: **Visão Geral**, **Respostas por Usuário**, **Conformidade** e **Reincidências**
- **Exportação em cada tab** — botão "Exportar" com 4 formatos: CSV, Excel (XLSX), TXT e PDF
- Relatório de Planos de Ação com exportação em CSV, Excel, TXT e PDF (com fotos de evidência)
- Gráficos de evolução, heatmap loja x campo, ranking de conformidade por loja

---

## 🗄️ Banco de Dados

### Tabelas Principais

| Tabela | Descrição |
|--------|-----------|
| `users` | Perfis de usuário (vinculados ao Supabase Auth) |
| `stores` | Lojas/unidades do grupo |
| `sectors` | Setores dentro das lojas |
| `functions` | Cargos/funções dos usuários (com webhook Teams opcional) |
| `user_stores` | Vínculo N:N usuário↔loja (com setor e flag `is_primary`) |
| `checklist_templates` | Templates de checklist (nome, categoria, campos, status) |
| `template_sections` | Etapas/seções de um template |
| `template_fields` | Campos de um template (tipo, nome, opções, condições) |
| `checklists` | Preenchimentos de checklist realizados |
| `checklist_responses` | Respostas individuais de cada campo |
| `action_plans` | Planos de ação (título, severidade, prazo, responsável) |
| `action_plan_stores` | Vínculo N:N plano↔loja |
| `action_plan_photos` | Fotos anexadas a planos de ação |
| `action_plan_comments` | Comentários/log de atividade nos planos |
| `notifications` | Notificações in-app dos usuários |
| `app_settings` | Configurações globais (chave → valor) |
| `field_condition_presets` | Presets de condições de campo salvos |
| `validation_sessions` | Sessões de validação cruzada |

### Configurações via `app_settings`

| Chave | Descrição |
|-------|-----------|
| `action_plan_email_template` | HTML do template de email de plano de ação |
| `action_plan_email_subject` | Assunto do email de plano de ação |
| `checklist_email_template` | HTML do template de email de checklist |
| `teams_webhook_url` | URL do webhook do Microsoft Teams |
| `teams_enabled` | Ativa/desativa alertas no Teams (`true`/`false`) |

### Tipos de Campos (`template_fields.field_type`)

| Tipo | Descrição |
|------|-----------|
| `text` | Texto livre |
| `number` | Numérico (monetário, quantidade, decimal, porcentagem) |
| `date` | Data |
| `time` | Hora |
| `datetime` | Data e hora |
| `dropdown` | Lista de opções (seleção única) |
| `checkbox_multiple` | Lista de opções (múltipla seleção) |
| `yes_no` | Sim / Não / N/A (com foto e campos adicionais opcionais) |
| `photo` | Foto obrigatória |
| `signature` | Assinatura |

---

## 🏗️ Arquitetura

```
src/
├── app/
│   ├── admin/                    # Painel administrativo (requer is_admin=true)
│   │   ├── page.tsx              # Hub do admin com módulos
│   │   ├── checklists/           # Listagem e detalhes de checklists
│   │   ├── templates/            # CRUD de templates
│   │   │   ├── novo/             # Criação de template
│   │   │   └── [id]/             # Edição de template
│   │   ├── planos-de-acao/       # Gestão de planos de ação
│   │   │   ├── novo/             # Criação manual
│   │   │   ├── modelos/          # Modelos/templates de planos
│   │   │   └── [id]/             # Detalhe e edição
│   │   ├── usuarios/             # CRUD de usuários
│   │   │   ├── novo/
│   │   │   └── [id]/
│   │   ├── lojas/                # Gestão de lojas
│   │   ├── setores/              # Gestão de setores
│   │   ├── funcoes/              # Gestão de cargos
│   │   ├── validacoes/           # Sessões de validação cruzada
│   │   ├── relatorios/           # Relatórios de checklists (4 tabs com exportação)
│   │   │   ├── fotos-nc/         # Relatório fotográfico de não-conformidades
│   │   │   └── planos-de-acao/   # Relatório de planos de ação
│   │   └── configuracoes/        # Configurações globais e templates de email
│   ├── api/                      # API Routes (Next.js, Edge Runtime)
│   │   ├── admin/users/          # Criação e edição de usuários (usa service role)
│   │   ├── chat/                 # Chatbot Flux (Groq API)
│   │   ├── notifications/email/  # Envio de emails via Resend
│   │   └── sync/                 # Sincronização offline
│   ├── checklist/
│   │   └── [id]/                 # Preenchimento de checklist
│   ├── dashboard/                # Dashboard do usuário
│   ├── login/                    # Tela de login
│   ├── auth/callback/            # Callback de autenticação OAuth/email
│   └── offline/                  # Página de fallback offline
├── components/
│   ├── ui/                       # Componentes base do design system
│   │   ├── Header.tsx            # Header universal com GlobalSearch
│   │   ├── GlobalSearch.tsx      # Pesquisa global no admin
│   │   ├── Select.tsx            # Dropdown customizado (substitui <select> nativo)
│   │   ├── PageContainer.tsx     # Container com largura padronizada
│   │   ├── AdminSidebar.tsx      # Sidebar de navegação admin
│   │   ├── LoadingPage.tsx
│   │   ├── IconPicker.tsx
│   │   └── index.ts
│   ├── FluxChat.tsx              # Chatbot IA flutuante (Flux)
│   ├── PWAInstall.tsx            # Prompt de instalação PWA
│   ├── SyncIndicator.tsx         # Indicador de sincronização offline
│   ├── OfflineIndicator.tsx      # Banner de modo offline
│   ├── fields/
│   │   └── FieldRenderer.tsx     # Renderiza campos de checklist pelo tipo
│   └── admin/
│       └── FieldConditionEditor.tsx  # Editor de condições de campo
├── lib/
│   ├── supabase.ts               # Cliente Supabase (browser + server)
│   ├── config.ts                 # Constantes e rotas da aplicação
│   ├── offlineCache.ts           # Cache de auth/usuário no IndexedDB
│   ├── offlineStorage.ts         # Armazenamento de checklists offline
│   ├── syncService.ts            # Sincronização automática ao reconectar
│   ├── crossValidation.ts        # Motor de validação cruzada
│   ├── notificationService.ts    # Criação de notificações in-app
│   ├── emailTemplateEngine.ts    # Engine de templates de email com variáveis
│   ├── exportUtils.ts            # Exportação client-side (CSV, Excel, TXT, PDF)
│   ├── analyticsQueries.ts       # Queries de conformidade e reincidências
│   ├── actionPlanEngine.ts       # Motor de criação automática de planos de ação
│   ├── api-auth.ts               # Verificação de auth em API routes
│   ├── logout.ts                 # Logout completo com limpeza de caches
│   ├── google.ts                 # Integração Google Drive (upload de fotos)
│   └── teams.ts                  # Alertas Microsoft Teams via Webhook
├── hooks/
│   ├── useAuth.ts                # Hook de autenticação (online + cache offline)
│   ├── useOfflineAuth.ts         # Hook de auth com suporte offline completo
│   ├── useOfflineData.ts         # Hook de dados com fallback offline (IndexedDB)
│   ├── useOnlineStatus.ts        # Hook de status de conexão
│   ├── useNotifications.ts       # Hook de notificações em tempo real
│   ├── usePrecache.ts            # Hook de precache de assets (PWA)
│   └── useTheme.ts               # Hook de tema claro/escuro
└── types/
    └── database.ts               # Tipos TypeScript do schema do Supabase
```

---

## 🛠️ Stack Tecnológica

| Camada | Tecnologia |
|--------|------------|
| Framework | **Next.js 14.2** (App Router, Edge Runtime) |
| Linguagem | **TypeScript** (strict) |
| Backend / DB | **Supabase** (PostgreSQL + Auth + Realtime + Edge Functions) |
| Estilo | **Tailwind CSS** v3 com design tokens customizados |
| Offline | **IndexedDB** + **Service Worker** (PWA) |
| Drag-and-drop | **@dnd-kit** (reordenação de campos e seções) |
| Ícones | **react-icons** (Feather Icons) |
| Animações | **Framer Motion** |
| IA / Chatbot | **Groq API** (LLaMA 3.3 70B) |
| Email | **Resend** + templates HTML |
| Alertas | Microsoft Teams Webhooks |
| Fotos | Google Drive API |
| Deploy | **Cloudflare Pages** (build com `@cloudflare/next-on-pages`) |

---

## 🚀 Setup

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente

Crie um arquivo `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# Groq (chatbot Flux)
GROQ_API_KEY=gsk_xxx

# Resend (envio de emails)
RESEND_API_KEY=re_xxx
RESEND_FROM_EMAIL=NoCheck <noreply@seudominio.com>

# Microsoft Teams (opcional)
TEAMS_WEBHOOK_URL=https://xxx.webhook.office.com/...
```

### 3. Executar migrations no Supabase

Execute os arquivos em `supabase/migrations/` no SQL Editor do Supabase, na ordem numérica.

### 4. Rodar em desenvolvimento

```bash
npm run dev
```

### 5. Seed de dados de teste (Relatório Fotográfico NC)

Para testar o **Relatório Fotográfico de Não-Conformidades** com volume de dados e fotos fictícias:

```bash
bun run seed:nc
```

Requisitos: `.env.local` com `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`; ao menos **uma loja ativa**, um **template com campo Sim/Não** e **um usuário** cadastrado. O script cria checklists concluídos com resposta "Não" e fotos placeholder (Picsum), além de planos de ação ligados — visíveis em **Admin > Relatórios > Relatório Fotográfico NC** (filtro "Últimos 30 dias"). Para alterar a quantidade: `SEED_NC_COUNT=50 bun run seed:nc` (máx. 200).

### 6. Build para Cloudflare Pages

```bash
npm run build
```

---

## 🏬 Lojas Cadastradas

| ID | Nome |
|----|------|
| 1 | BDN Boa Viagem |
| 2 | BDN Guararapes |
| 3 | BDN Afogados |
| 4 | BDN Tacaruna |
| 5 | BDN Olinda |
| 6 | BRDN Boa Viagem |
| 7 | BRG Riomar |
| 8 | BRG Guararapes |

---

## 🔄 Fluxo de Validação Cruzada

1. **Estoquista** preenche checklist com campos numéricos (notas, valores)
2. **Aprendiz** preenche o mesmo checklist independentemente
3. O sistema associa as duas respostas via **matching temporal** (proximidade de horário)
4. Campos com `validationRole: 'nota'` e `'valor'` são comparados automaticamente
5. Divergências geram **alertas no Teams** e opcionalmente um **plano de ação**

---

## 📐 Condições de Campo

Cada campo pode ter uma condição que determina quando ele aparece:

```ts
type FieldCondition = {
  conditionType: 'equals' | 'not_equals' | 'greater_than' | 'less_than'
                | 'contains' | 'not_contains' | 'empty' | 'not_empty'
  conditionValue: { value?: string | number }
  targetFieldId: string          // campo que dispara a condição
  severity?: 'baixa' | 'media' | 'alta' | 'critica'
  defaultAssigneeId?: string     // responsável automático do plano de ação
  createActionPlan?: boolean     // gerar plano de ação quando condição for verdadeira
}
```

Quando `createActionPlan: true` e a condição é atendida ao enviar o checklist, um plano de ação é gerado automaticamente com a severidade e responsável configurados.

---

## 📧 Templates de Email

Os templates de email são configuráveis no painel admin em **Configurações**. Variáveis disponíveis:

| Variável | Descrição |
|----------|-----------|
| `{{plan_title}}` | Título do plano de ação |
| `{{store_name}}` | Nome da(s) loja(s) |
| `{{assignee_name}}` | Nome do responsável |
| `{{severity_label}}` | Severidade (ex: Alta) |
| `{{severity_color}}` | Cor hexadecimal da severidade |
| `{{deadline}}` | Prazo formatado (DD/MM/AAAA) |
| `{{plan_url}}` | Link direto para o plano |
| `{{description}}` | Descrição do plano |
| `{{respondent_name}}` | Nome de quem criou |
| `{{is_reincidencia}}` | "Sim" ou "Não" |
| `{{app_name}}` | Nome da aplicação |

---

## 🔒 Segurança

- **Row Level Security (RLS)** habilitado em todas as tabelas no Supabase
- Criação de usuários via **API Route com service role** (nunca exposta ao cliente)
- Logout completo limpa: `localStorage`, `sessionStorage`, todos os caches do IndexedDB e Service Worker
- Acesso pós-logout bloqueado mesmo com cache — verificação de `is_active` no perfil
- Rotas admin verificam `is_admin` no servidor e no cliente

---

## 🌐 Deploy (Cloudflare Pages)

1. Conecte o repositório ao Cloudflare Pages
2. Configure as variáveis de ambiente no painel
3. Build command: `npm run build`
4. Output directory: `.vercel/output/static`

A aplicação usa `@cloudflare/next-on-pages` para rodar como Worker no edge.

---

## 📜 Licença

Uso interno — **Grupo Do Nô**
