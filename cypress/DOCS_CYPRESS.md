# Documentação dos Testes E2E — Cypress

## Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura dos Testes](#arquitetura-dos-testes)
3. [Pré-requisitos](#pré-requisitos)
4. [Instalação e Configuração](#instalação-e-configuração)
5. [Como Executar os Testes](#como-executar-os-testes)
6. [Estrutura de Diretórios](#estrutura-de-diretórios)
7. [Descrição dos Test Suites](#descrição-dos-test-suites)
8. [Comandos Customizados](#comandos-customizados)
9. [Fixtures (Dados de Teste)](#fixtures-dados-de-teste)
10. [Interceptação de API (Mocking)](#interceptação-de-api-mocking)
11. [Estratégia de Testes](#estratégia-de-testes)
12. [Como Escrever Novos Testes](#como-escrever-novos-testes)
13. [Integração com CI/CD](#integração-com-cicd)
14. [Troubleshooting](#troubleshooting)
15. [Cobertura de Funcionalidades](#cobertura-de-funcionalidades)

---

## Visão Geral

Esta suíte de testes E2E (End-to-End) utiliza **Cypress** para testar todas as funcionalidades do **NoCheck/OpereCheck** — desde a autenticação até o fluxo completo de preenchimento de checklists, painel administrativo, planos de ação, validações cruzadas, modo offline e segurança.

### Stack de Testes

| Tecnologia | Função |
|---|---|
| **Cypress 15** | Framework de testes E2E |
| **@testing-library/cypress** | Seletores acessíveis (by role, by text) |
| **TypeScript** | Tipagem dos testes e comandos |

### Números

- **20 arquivos de teste** distribuídos em 11 categorias
- **~150+ test cases** cobrindo todos os fluxos da aplicação
- **7 fixtures** com dados mock realistas
- **15+ comandos customizados** para operações recorrentes

---

## Arquitetura dos Testes

```
                  ┌─────────────────────┐
                  │   cypress.config.ts  │  ← Configuração global
                  └──────────┬──────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
     ┌────────▼───────┐ ┌───▼────┐ ┌───────▼──────┐
     │ support/       │ │ e2e/   │ │ fixtures/    │
     │  commands.ts   │ │ *.cy.ts│ │  *.json      │
     │  e2e.ts        │ │        │ │              │
     └────────────────┘ └────────┘ └──────────────┘
       Comandos          Specs       Dados mock
       customizados      de teste
```

### Estratégia de Intercept (Mock)

Os testes utilizam `cy.intercept()` para interceptar chamadas à API do Supabase e às rotas internas (`/api/*`). Isso permite:

- **Isolamento**: testes não dependem do banco de dados
- **Velocidade**: respostas instantâneas sem latência de rede
- **Previsibilidade**: dados de teste sempre consistentes
- **Cenários negativos**: simular erros HTTP, timeouts, etc.

---

## Pré-requisitos

- **Node.js** ≥ 18
- **npm** ≥ 9
- Servidor de desenvolvimento rodando (`npm run dev`) na porta 3000
- Navegador compatível (Chrome, Firefox, Edge ou Electron)

---

## Instalação e Configuração

As dependências já estão instaladas. Para confirmar:

```bash
cd nocheck-app
npm install
```

### Arquivo de Configuração: `cypress.config.ts`

| Propriedade | Valor | Descrição |
|---|---|---|
| `baseUrl` | `http://localhost:3000` | URL base do servidor dev |
| `viewportWidth` | `1280` | Largura padrão da viewport |
| `viewportHeight` | `720` | Altura padrão da viewport |
| `defaultCommandTimeout` | `10000` | Timeout padrão (10s) |
| `video` | `false` | Gravação de vídeo desativada |
| `retries.runMode` | `2` | Retentativas no modo CI |
| `retries.openMode` | `0` | Sem retentativas no modo dev |

### Variáveis de Ambiente

Configuradas em `cypress.config.ts` → `env` ou via `cypress.env.json`:

```json
{
  "ADMIN_EMAIL": "admin@operecheck.com.br",
  "ADMIN_PASSWORD": "123456",
  "USER_EMAIL": "admin@operecheck.com.br",
  "USER_PASSWORD": "123456",
  "PLATFORM_ADMIN_EMAIL": "admin@operecheck.com.br",
  "PLATFORM_ADMIN_PASSWORD": "123456",
  "SUPABASE_URL": "http://127.0.0.1:54321",
  "SUPABASE_ANON_KEY": "sua-chave-anon-aqui"
}
```

> **IMPORTANTE**: Nunca comite o arquivo `cypress.env.json` com credenciais reais. Adicione-o ao `.gitignore`.

---

## Como Executar os Testes

### Passo 1: Inicie o servidor de desenvolvimento

```bash
npm run dev
```

### Passo 2: Execute os testes

| Comando | Descrição |
|---|---|
| `npm run cy:open` | Abre o Cypress UI (modo interativo) |
| `npm run cy:run` | Executa todos os testes em headless |
| `npm run cy:run:headed` | Executa com navegador visível |
| `npm run cy:run:chrome` | Executa no Google Chrome |
| `npm run e2e` | Alias para `cy:run` |
| `npm run e2e:dev` | Alias para `cy:open --e2e` |

### Executar uma spec específica

```bash
npx cypress run --spec "cypress/e2e/auth/login.cy.ts"
```

### Executar por pasta/categoria

```bash
npx cypress run --spec "cypress/e2e/admin/**/*.cy.ts"
```

---

## Estrutura de Diretórios

```
cypress/
├── DOCS_CYPRESS.md            ← Este documento
├── tsconfig.json              ← Config TypeScript para Cypress
│
├── support/
│   ├── e2e.ts                 ← Setup global (importado antes de cada spec)
│   └── commands.ts            ← Comandos customizados (login, intercept, etc.)
│
├── fixtures/
│   ├── users.json             ← Dados de usuários de teste
│   ├── stores.json            ← Dados de lojas
│   ├── templates.json         ← Templates de checklist com campos
│   ├── checklists.json        ← Checklists preenchidos
│   ├── action-plans.json      ← Planos de ação
│   ├── sectors.json           ← Setores
│   └── functions.json         ← Funções/cargos
│
├── e2e/
│   ├── auth/                  ← Autenticação
│   │   ├── login.cy.ts        ← Login (form, validação, sucesso, erro)
│   │   ├── logout.cy.ts       ← Logout (limpeza de cache)
│   │   ├── password-reset.cy.ts ← Recuperação de senha
│   │   └── signup.cy.ts       ← Cadastro de conta
│   │
│   ├── dashboard/
│   │   └── user-dashboard.cy.ts ← Dashboard do usuário
│   │
│   ├── checklist/
│   │   ├── novo-checklist.cy.ts  ← Criação de novo checklist
│   │   └── checklist-fill.cy.ts  ← Preenchimento e tipos de campo
│   │
│   ├── admin/                 ← Painel Administrativo (10 arquivos)
│   │   ├── admin-dashboard.cy.ts ← Dashboard admin (KPIs)
│   │   ├── usuarios.cy.ts     ← CRUD de usuários
│   │   ├── lojas.cy.ts        ← CRUD de lojas
│   │   ├── setores.cy.ts      ← CRUD de setores
│   │   ├── funcoes.cy.ts      ← CRUD de funções
│   │   ├── templates.cy.ts    ← CRUD de templates (campos, seções)
│   │   ├── checklists.cy.ts   ← Listagem de checklists
│   │   ├── planos-de-acao.cy.ts ← Planos de ação (CRUD + modelos)
│   │   ├── validacoes.cy.ts   ← Validações cruzadas
│   │   ├── relatorios.cy.ts   ← Relatórios (fotos NC, planos)
│   │   ├── galeria.cy.ts      ← Galeria de fotos
│   │   ├── configuracoes.cy.ts ← Configurações (billing, branding, equipe)
│   │   └── logs.cy.ts         ← Logs de auditoria
│   │
│   ├── platform/
│   │   └── platform-admin.cy.ts ← Superadmin (clientes, config, pricing)
│   │
│   ├── reports/
│   │   └── user-reports.cy.ts ← Relatórios do usuário
│   │
│   ├── landing/
│   │   └── landing-page.cy.ts ← Landing page (conteúdo, responsividade)
│   │
│   ├── offline/
│   │   └── offline-pwa.cy.ts  ← Modo offline, IndexedDB, sync
│   │
│   ├── api/
│   │   └── api-routes.cy.ts   ← Testes diretos de API (auth, rate limit)
│   │
│   ├── theme/
│   │   └── theme-toggle.cy.ts ← Dark/Light mode
│   │
│   ├── accessibility/
│   │   └── a11y.cy.ts         ← Acessibilidade (labels, ARIA, keyboard)
│   │
│   └── security/
│       └── security.cy.ts     ← Segurança (XSS, headers, CSRF, enum)
│
└── screenshots/               ← Screenshots de falhas (auto-gerado)
```

---

## Descrição dos Test Suites

### 1. Autenticação (`auth/`)

| Arquivo | Testes | Cobertura |
|---|---|---|
| `login.cy.ts` | 14 | Renderização, validação HTML5, toggle senha, login sucesso/erro, redirect por role, loading states, links, searchParams |
| `logout.cy.ts` | 3 | Limpeza de localStorage, cookies e IndexedDB |
| `password-reset.cy.ts` | 4 | Formulário de recuperação, envio, link de volta ao login |
| `signup.cy.ts` | 4 | Formulário de cadastro, validação, seleção de planos |

### 2. Dashboard (`dashboard/`)

| Arquivo | Testes | Cobertura |
|---|---|---|
| `user-dashboard.cy.ts` | 5 | Saudação, cards de estatísticas, links para checklist, ícones |

### 3. Checklist (`checklist/`)

| Arquivo | Testes | Cobertura |
|---|---|---|
| `novo-checklist.cy.ts` | 6 | Seleção de template/loja, campos yes_no/number/text, submissão, auto-save |
| `checklist-fill.cy.ts` | 9 | Continuação em andamento, validação obrigatória, 5 tipos de campo, seções |

### 4. Painel Admin (`admin/`)

| Arquivo | Testes | Cobertura |
|---|---|---|
| `admin-dashboard.cy.ts` | 5 | KPIs, atalhos, contadores, realtime |
| `usuarios.cy.ts` | 9 | Listagem, busca, filtro, criação, edição, exclusão |
| `lojas.cy.ts` | 9 | Listagem, busca, GPS, ativo/inativo, modal CRUD, limite de plano |
| `setores.cy.ts` | 6 | Listagem, busca, CRUD completo |
| `funcoes.cy.ts` | 7 | Listagem, busca, CRUD completo |
| `templates.cy.ts` | 12 | Listagem, categorias, criação (campos, seções, opções), edição, drag-and-drop |
| `checklists.cy.ts` | 5 | Listagem, status, filtros, nome usuário, data |
| `planos-de-acao.cy.ts` | 10 | Listagem, severidade, status, recorrência, filtros, criação, detalhes, modelos |
| `validacoes.cy.ts` | 6 | Listagem, status, divergências, operadores, filtros |
| `relatorios.cy.ts` | 6 | Hub, fotos NC, planos de ação, filtros, exportação |
| `galeria.cy.ts` | 2 | Carregamento, filtros |
| `configuracoes.cy.ts` | 5 | Geral, billing, branding, equipe |
| `logs.cy.ts` | 4 | Listagem, ação, autor, filtros |

### 5. Platform/Superadmin (`platform/`)

| Arquivo | Testes | Cobertura |
|---|---|---|
| `platform-admin.cy.ts` | 7 | Dashboard, clientes, detalhes, configurações, pricing, proteção de rota |

### 6. Relatórios (`reports/`)

| Arquivo | Testes | Cobertura |
|---|---|---|
| `user-reports.cy.ts` | 2 | Página de relatórios, filtros |

### 7. Landing Page (`landing/`)

| Arquivo | Testes | Cobertura |
|---|---|---|
| `landing-page.cy.ts` | 7 | Conteúdo, CTAs, links, responsividade (mobile/tablet/desktop), SEO, performance |

### 8. Offline/PWA (`offline/`)

| Arquivo | Testes | Cobertura |
|---|---|---|
| `offline-pwa.cy.ts` | 5 | Indicador offline, restauração online, página /offline, IndexedDB, sync |

### 9. API (`api/`)

| Arquivo | Testes | Cobertura |
|---|---|---|
| `api-routes.cy.ts` | 10 | Auth, admin, upload, billing, integrations, email, chat, settings, storage, rate limit |

### 10. Tema (`theme/`)

| Arquivo | Testes | Cobertura |
|---|---|---|
| `theme-toggle.cy.ts` | 3 | Botão de tema, alternância dark/light, persistência no localStorage |

### 11. Acessibilidade (`accessibility/`)

| Arquivo | Testes | Cobertura |
|---|---|---|
| `a11y.cy.ts` | 8 | Labels, ARIA, autocomplete, required, links, contraste, teclado, responsividade |

### 12. Segurança (`security/`)

| Arquivo | Testes | Cobertura |
|---|---|---|
| `security.cy.ts` | 8 | XSS via URL, proteção de rotas, headers, open redirect, cookies, enumeração de email |

---

## Comandos Customizados

Definidos em `cypress/support/commands.ts`:

### Autenticação

| Comando | Parâmetros | Descrição |
|---|---|---|
| `cy.login(email?, password?)` | email, password (opcionais) | Login via API do Supabase (com sessão cacheada) |
| `cy.loginAsAdmin()` | — | Login com credenciais de admin |
| `cy.loginAsPlatformAdmin()` | — | Login com credenciais de superadmin |
| `cy.logout()` | — | Limpa localStorage, cookies, sessionStorage e IndexedDB |
| `cy.loginViaUI(email, password)` | email, password | Login através do formulário visual |

### Interceptação de API

| Comando | Parâmetros | Descrição |
|---|---|---|
| `cy.interceptSupabase()` | — | Intercepta todas as chamadas Supabase REST |
| `cy.interceptSupabaseTable(table, alias, response?)` | table, alias, response | Intercepta consultas a uma tabela específica |
| `cy.interceptAPI(method, route, alias, response?)` | method, route, alias, response | Intercepta rota interna `/api/*` |

### Simulação de Rede

| Comando | Parâmetros | Descrição |
|---|---|---|
| `cy.goOffline()` | — | Simula modo offline (dispara evento + stub navigator.onLine) |
| `cy.goOnline()` | — | Restaura modo online e recarrega a página |

### Utilitários de UI

| Comando | Parâmetros | Descrição |
|---|---|---|
| `cy.waitForPageLoad()` | — | Aguarda spinners de loading desaparecerem |
| `cy.expectToast(message)` | message | Verifica se uma mensagem toast apareceu |
| `cy.fillField(label, value)` | label, value | Preenche campo pelo texto do label |
| `cy.selectOption(label, optionText)` | label, optionText | Seleciona opção em dropdown |
| `cy.assertPath(path)` | path | Verifica se URL contém o path |
| `cy.getByTestId(testId)` | testId | Busca elemento por `data-testid` |
| `cy.checkA11y()` | — | Verifica acessibilidade básica (alt, labels) |

---

## Fixtures (Dados de Teste)

### `users.json`
4 perfis de usuário: admin, regular, platformAdmin, inactive. Cada um com store, function e sector associados.

### `stores.json`
3 lojas: Centro (GPS obrigatório), Shopping Norte, Sul (desativada).

### `templates.json`
3 templates com campos de diferentes tipos: yes_no, number, text, dropdown, checkbox_multiple, rating.

### `checklists.json`
3 checklists em diferentes estados: concluído, em_andamento.

### `action-plans.json`
2 planos de ação: severidade alta (pendente), crítica (em andamento, recorrente).

### `sectors.json`
4 setores: Administração, Operações, Logística, Frios (desativado).

### `functions.json`
4 funções: Gerente, Operador, Supervisor, Auxiliar.

### Uso nos testes

```typescript
// Carregar fixture
cy.fixture('users').then((users) => {
  cy.intercept('GET', '**/rest/v1/users*', {
    body: [users.admin, users.regular],
  })
})

// Ou via alias
cy.fixture('stores').as('stores')
```

---

## Interceptação de API (Mocking)

### Padrão de Interceptação

Todos os testes que acessam páginas autenticadas seguem o padrão:

```typescript
beforeEach(() => {
  // 1. Interceptar auth (obrigatório)
  cy.intercept('GET', '**/auth/v1/user', {
    statusCode: 200,
    body: { id: 'uuid', email: 'admin@operecheck.com.br' },
  }).as('authUser')

  // 2. Interceptar verificação de admin
  cy.intercept('GET', '**/rest/v1/users*select=*is_admin*', {
    statusCode: 200,
    body: { is_admin: true },
  }).as('adminCheck')

  // 3. Interceptar dados da página
  cy.intercept('GET', '**/rest/v1/stores*', {
    statusCode: 200,
    body: [{ id: 1, name: 'Loja Centro' }],
  }).as('stores')
})
```

### Simulando Erros

```typescript
cy.intercept('POST', '**/auth/v1/token*', {
  statusCode: 400,
  body: { error: 'Invalid login credentials' },
}).as('loginFail')
```

### Simulando Delay

```typescript
cy.intercept('GET', '**/rest/v1/checklists*', {
  statusCode: 200,
  delay: 2000,  // 2 segundos
  body: [],
}).as('slowResponse')
```

---

## Estratégia de Testes

### Pirâmide de Testes

```
         ▲ E2E (Cypress)        ← Fluxos completos, poucos
        ╱ ╲
       ╱   ╲ Integração         ← billing-routes, rls-contract
      ╱     ╲
     ╱       ╲ Unitários        ← ~160 testes (Vitest)
    ╱─────────╲
```

### O que os testes E2E cobrem

- **Fluxos de usuário completos** (login → dashboard → preencher checklist)
- **Renderização de página** (todos os elementos críticos visíveis)
- **Navegação e roteamento** (rotas protegidas, redirecionamentos)
- **CRUD administrativo** (criar, listar, editar, excluir recursos)
- **Segurança** (XSS, auth bypass, headers, rate limiting)
- **Offline/PWA** (indicadores, IndexedDB, sync)
- **Acessibilidade** (labels, ARIA, keyboard, responsividade)
- **Tema** (dark/light mode toggle e persistência)

### O que NÃO cobrem (deixar para testes unitários)

- Lógica pura de business logic (actionPlanEngine, crossValidation)
- Cálculos matemáticos (adherenceCalculations)
- Parsing de templates de email
- Validação de schemas Zod

---

## Como Escrever Novos Testes

### Template básico

```typescript
/// <reference types="cypress" />

describe('Nome da Feature', () => {
  beforeEach(() => {
    // Setup: intercepts, login, visit
    cy.intercept('GET', '**/auth/v1/user', {
      statusCode: 200,
      body: { id: 'uuid', email: 'admin@operecheck.com.br' },
    })
    cy.login(Cypress.env('ADMIN_EMAIL'), Cypress.env('ADMIN_PASSWORD'))
  })

  describe('Cenário específico', () => {
    it('deve [comportamento esperado]', () => {
      cy.visit('/rota')
      cy.contains('Texto esperado').should('be.visible')
    })
  })
})
```

### Boas práticas

1. **Use `cy.intercept()` para TODA chamada de API** — nunca dependa do backend real
2. **Use `{ timeout: 15000 }` em seletores** — Next.js pode demorar para hidratar
3. **Agrupe testes por funcionalidade** — um `describe` por feature
4. **Use fixtures para dados complexos** — mantenha os mocks centralizados
5. **Teste cenários positivos E negativos** — sucesso e erro
6. **Evite `cy.wait(ms)`** — use `cy.wait('@alias')` ou assertions
7. **Prefira seletores semânticos** — `cy.contains()`, `cy.get('[role="dialog"]')` em vez de classes CSS

### Convenção de nomes

- Arquivo: `nome-da-feature.cy.ts` (kebab-case)
- Describe: `'Admin - Nome da Página'`
- It: `'deve [verbo] [resultado esperado]'`

---

## Integração com CI/CD

### GitHub Actions

```yaml
# .github/workflows/e2e.yml
name: E2E Tests
on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install dependencies
        working-directory: nocheck-app
        run: npm ci

      - name: Build app
        working-directory: nocheck-app
        run: npm run build

      - name: Start server
        working-directory: nocheck-app
        run: npm start &
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}

      - name: Run Cypress
        working-directory: nocheck-app
        run: npx cypress run
        env:
          CYPRESS_ADMIN_EMAIL: ${{ secrets.TEST_ADMIN_EMAIL }}
          CYPRESS_ADMIN_PASSWORD: ${{ secrets.TEST_ADMIN_PASSWORD }}

      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: cypress-screenshots
          path: nocheck-app/cypress/screenshots
```

### Cloudflare Pages (Preview)

```yaml
      - name: Run against preview
        run: npx cypress run --config baseUrl=${{ steps.deploy.outputs.url }}
```

---

## Troubleshooting

### Problema: "Timed out retrying after 10000ms"

**Causa**: Elemento não encontrado no tempo limite.

**Soluções**:
- Aumente o timeout: `{ timeout: 15000 }`
- Verifique se o intercept está correto (URL, body)
- Verifique se o `cy.login()` está antes do `cy.visit()`

### Problema: "cy.session() requires a unique identifier"

**Causa**: Login com credenciais diferentes na mesma sessão.

**Solução**: Use `cy.session([email], ...)` — o array deve ser único por credencial.

### Problema: Hydration errors do Next.js

**Causa**: Next.js detecta diferença entre SSR e CSR.

**Solução**: Já tratado em `cypress/support/e2e.ts` — erros de hydration são ignorados.

### Problema: "WebSocket connection failed"

**Causa**: Supabase Realtime tenta conectar durante testes.

**Solução**: Já tratado em `cypress/support/e2e.ts` — erros de WebSocket são ignorados.

### Problema: Testes lentos

**Soluções**:
- Use `cy.session()` para cachear login (já implementado)
- Use `cy.intercept()` em vez de esperar respostas reais
- Execute specs específicas: `--spec "cypress/e2e/auth/**"`
- Paralelise com Cypress Cloud: `npx cypress run --record --parallel`

### Problema: Screenshots não aparecem

**Causa**: `screenshotOnRunFailure` pode estar desabilitado.

**Solução**: Verifique `cypress.config.ts` → `screenshotOnRunFailure: true`.

---

## Cobertura de Funcionalidades

### Mapa de Cobertura

| Funcionalidade | Test Suite | Status |
|---|---|---|
| Login email/senha | `auth/login.cy.ts` | ✅ |
| Logout (limpeza cache) | `auth/logout.cy.ts` | ✅ |
| Recuperação de senha | `auth/password-reset.cy.ts` | ✅ |
| Cadastro de conta | `auth/signup.cy.ts` | ✅ |
| Dashboard do usuário | `dashboard/user-dashboard.cy.ts` | ✅ |
| Novo checklist | `checklist/novo-checklist.cy.ts` | ✅ |
| Preenchimento de checklist | `checklist/checklist-fill.cy.ts` | ✅ |
| Tipos de campo dinâmicos | `checklist/checklist-fill.cy.ts` | ✅ |
| Seções de checklist | `checklist/checklist-fill.cy.ts` | ✅ |
| Dashboard admin (KPIs) | `admin/admin-dashboard.cy.ts` | ✅ |
| CRUD Usuários | `admin/usuarios.cy.ts` | ✅ |
| CRUD Lojas | `admin/lojas.cy.ts` | ✅ |
| CRUD Setores | `admin/setores.cy.ts` | ✅ |
| CRUD Funções | `admin/funcoes.cy.ts` | ✅ |
| CRUD Templates | `admin/templates.cy.ts` | ✅ |
| Campos e condições | `admin/templates.cy.ts` | ✅ |
| Listagem checklists | `admin/checklists.cy.ts` | ✅ |
| Planos de ação | `admin/planos-de-acao.cy.ts` | ✅ |
| Modelos de plano | `admin/planos-de-acao.cy.ts` | ✅ |
| Validações cruzadas | `admin/validacoes.cy.ts` | ✅ |
| Relatórios NC | `admin/relatorios.cy.ts` | ✅ |
| Relatórios planos | `admin/relatorios.cy.ts` | ✅ |
| Galeria de fotos | `admin/galeria.cy.ts` | ✅ |
| Configurações | `admin/configuracoes.cy.ts` | ✅ |
| Billing/Cobrança | `admin/configuracoes.cy.ts` | ✅ |
| Branding/White-label | `admin/configuracoes.cy.ts` | ✅ |
| Equipe/Membros | `admin/configuracoes.cy.ts` | ✅ |
| Logs de auditoria | `admin/logs.cy.ts` | ✅ |
| Superadmin/Platform | `platform/platform-admin.cy.ts` | ✅ |
| Clientes/Organizações | `platform/platform-admin.cy.ts` | ✅ |
| Pricing | `platform/platform-admin.cy.ts` | ✅ |
| Relatórios do usuário | `reports/user-reports.cy.ts` | ✅ |
| Landing page | `landing/landing-page.cy.ts` | ✅ |
| Modo offline | `offline/offline-pwa.cy.ts` | ✅ |
| IndexedDB cache | `offline/offline-pwa.cy.ts` | ✅ |
| Sync indicator | `offline/offline-pwa.cy.ts` | ✅ |
| APIs protegidas | `api/api-routes.cy.ts` | ✅ |
| Rate limiting | `api/api-routes.cy.ts` | ✅ |
| Dark/Light mode | `theme/theme-toggle.cy.ts` | ✅ |
| Acessibilidade | `accessibility/a11y.cy.ts` | ✅ |
| Segurança (XSS) | `security/security.cy.ts` | ✅ |
| Headers de segurança | `security/security.cy.ts` | ✅ |
| Open redirect | `security/security.cy.ts` | ✅ |
| Responsividade | `landing/landing-page.cy.ts` + `accessibility/a11y.cy.ts` | ✅ |
| Rotas protegidas | `navigation/routing.cy.ts` | ✅ |
| Middleware redirect | `navigation/routing.cy.ts` | ✅ |

### Cobertura por Rota

| Rota | Arquivo de Teste |
|---|---|
| `/` | `landing/landing-page.cy.ts` |
| `/login` | `auth/login.cy.ts` |
| `/cadastro` | `auth/signup.cy.ts` |
| `/esqueci-senha` | `auth/password-reset.cy.ts` |
| `/auth/reset-password` | `auth/password-reset.cy.ts` |
| `/dashboard` | `dashboard/user-dashboard.cy.ts` |
| `/checklist/novo` | `checklist/novo-checklist.cy.ts` |
| `/checklist/[id]` | `checklist/checklist-fill.cy.ts` |
| `/relatorios` | `reports/user-reports.cy.ts` |
| `/offline` | `offline/offline-pwa.cy.ts` |
| `/admin` | `admin/admin-dashboard.cy.ts` |
| `/admin/usuarios` | `admin/usuarios.cy.ts` |
| `/admin/usuarios/novo` | `admin/usuarios.cy.ts` |
| `/admin/usuarios/[id]` | `admin/usuarios.cy.ts` |
| `/admin/lojas` | `admin/lojas.cy.ts` |
| `/admin/setores` | `admin/setores.cy.ts` |
| `/admin/funcoes` | `admin/funcoes.cy.ts` |
| `/admin/templates` | `admin/templates.cy.ts` |
| `/admin/templates/novo` | `admin/templates.cy.ts` |
| `/admin/templates/[id]` | `admin/templates.cy.ts` |
| `/admin/checklists` | `admin/checklists.cy.ts` |
| `/admin/planos-de-acao` | `admin/planos-de-acao.cy.ts` |
| `/admin/planos-de-acao/novo` | `admin/planos-de-acao.cy.ts` |
| `/admin/planos-de-acao/[id]` | `admin/planos-de-acao.cy.ts` |
| `/admin/planos-de-acao/modelos` | `admin/planos-de-acao.cy.ts` |
| `/admin/validacoes` | `admin/validacoes.cy.ts` |
| `/admin/relatorios` | `admin/relatorios.cy.ts` |
| `/admin/relatorios/fotos-nc` | `admin/relatorios.cy.ts` |
| `/admin/relatorios/planos-de-acao` | `admin/relatorios.cy.ts` |
| `/admin/galeria` | `admin/galeria.cy.ts` |
| `/admin/configuracoes` | `admin/configuracoes.cy.ts` |
| `/admin/configuracoes/billing` | `admin/configuracoes.cy.ts` |
| `/admin/configuracoes/branding` | `admin/configuracoes.cy.ts` |
| `/admin/configuracoes/equipe` | `admin/configuracoes.cy.ts` |
| `/admin/logs` | `admin/logs.cy.ts` |
| `/platform` | `platform/platform-admin.cy.ts` |
| `/platform/clientes` | `platform/platform-admin.cy.ts` |
| `/platform/clientes/[orgId]` | `platform/platform-admin.cy.ts` |
| `/platform/configuracoes` | `platform/platform-admin.cy.ts` |
| `/platform/pricing` | `platform/platform-admin.cy.ts` |
| `/api/*` (10 rotas) | `api/api-routes.cy.ts` |

---

## Glossário

| Termo | Significado |
|---|---|
| **E2E** | End-to-End (teste de ponta a ponta) |
| **Spec** | Arquivo de especificação de testes |
| **Fixture** | Dados estáticos de teste (JSON) |
| **Intercept** | Interceptação de requisição HTTP (mock) |
| **Alias** | Nome dado a um intercept (`@nomeDoAlias`) |
| **Session** | Sessão de login cacheada entre testes |
| **PWA** | Progressive Web App |
| **RLS** | Row-Level Security (Supabase) |
| **NC** | Não-Conformidade |
| **KPI** | Key Performance Indicator |
