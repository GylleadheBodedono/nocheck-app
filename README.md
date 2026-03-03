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
- Tipos: `action_plan_assigned`, `action_plan_overdue`, `checklist_submitted`, etc.
- Integração com **Microsoft Teams** via Webhook para alertas de divergências
- Envio de **email** via Edge Function do Supabase com templates HTML customizáveis configurados no painel admin

### 📸 Relatório Fotográfico de Não-Conformidades
- Geração de relatório agrupado por template/campo com fotos das respostas marcadas como não-conformidade
- Filtros por loja, template, severidade e período
- Exportação em PDF

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

### 📊 Relatórios e Dashboard
- Dashboard com resumo de checklists do dia, alertas de vencimento e atividade recente
- Tela de relatórios admin com filtros de usuário, loja, template e período
- Gráficos de evolução e contagens de conformidade/não-conformidade

---

## 🗄️ Banco de Dados

### Tabelas Principais

| Tabela | Descrição |
|--------|-----------|
| `users` | Perfis de usuário (vinculados ao Supabase Auth) |
| `stores` | Lojas/unidades do grupo |
| `sectors` | Setores dentro das lojas |
| `functions` | Cargos/funções dos usuários |
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
| `yes_no` | Sim / Não (com foto e campos adicionais opcionais) |
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
│   │   ├── relatorios/           # Relatórios de checklists
│   │   │   └── fotos-nc/         # Relatório fotográfico de não-conformidades
│   │   └── configuracoes/        # Configurações globais e templates de email
│   ├── api/                      # API Routes (Next.js)
│   │   ├── admin/users/          # Criação e edição de usuários (usa service role)
│   │   ├── email/                # Envio de emails via Supabase Edge Function
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
│   │   ├── LoadingPage.tsx
│   │   ├── IconPicker.tsx
│   │   └── index.ts
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
│   ├── google.ts                 # Integração Google Drive (upload de fotos)
│   └── teams.ts                  # Alertas Microsoft Teams via Webhook
├── hooks/
│   └── useNotifications.ts       # Hook de notificações em tempo real
└── types/
    └── database.ts               # Tipos TypeScript do schema do Supabase
```

---

## 🛠️ Stack Tecnológica

| Camada | Tecnologia |
|--------|------------|
| Framework | **Next.js 15** (App Router, Edge Runtime) |
| Linguagem | **TypeScript** (strict) |
| Backend / DB | **Supabase** (PostgreSQL + Auth + Realtime + Edge Functions) |
| Estilo | **Tailwind CSS** v3 com design tokens customizados |
| Offline | **IndexedDB** + **Service Worker** (PWA) |
| Drag-and-drop | **@dnd-kit** (reordenação de campos e seções) |
| Ícones | **react-icons** (Feather Icons) |
| Animações | CSS keyframes nativo |
| Email | Supabase Edge Function + templates HTML |
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

# Microsoft Teams (opcional)
TEAMS_WEBHOOK_URL=https://xxx.webhook.office.com/...

# Google Drive (opcional)
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
GOOGLE_DRIVE_FOLDER_ID=xxx
```

### 3. Executar migrations no Supabase

Execute os arquivos em `supabase/migrations/` no SQL Editor do Supabase, na ordem numérica.

### 4. Rodar em desenvolvimento

```bash
npm run dev
```

### 5. Build para Cloudflare Pages

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
