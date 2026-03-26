# Plano de Testes — NoCheck App

> Estratégia completa de testes automatizados para o sistema NoCheck do Grupo Do Nô.
> Criado em: 10/03/2026

---

## Sumário

- [1. Diagnóstico Atual](#1-diagnóstico-atual)
- [2. Por Que Testar?](#2-por-que-testar)
- [3. Estratégia — Pirâmide de Testes](#3-estratégia--pirâmide-de-testes)
- [4. Stack de Testes](#4-stack-de-testes)
- [5. Fase 1 — Infraestrutura](#5-fase-1--infraestrutura)
- [6. Fase 2 — Testes Unitários](#6-fase-2--testes-unitários)
- [7. Fase 3 — Testes de Integração](#7-fase-3--testes-de-integração)
- [8. Fase 4 — Testes de Componente](#8-fase-4--testes-de-componente)
- [9. Fase 5 — Testes E2E (Futuro)](#9-fase-5--testes-e2e-futuro)
- [10. Estrutura de Arquivos](#10-estrutura-de-arquivos)
- [11. Prioridade de Implementação](#11-prioridade-de-implementação)
- [12. Metas de Cobertura](#12-metas-de-cobertura)
- [13. Como Simular Cenários Complexos](#13-como-simular-cenários-complexos)
- [14. Comandos Úteis](#14-comandos-úteis)

---

## 1. Diagnóstico Atual

| Item | Status |
|------|--------|
| Framework de testes | **Vitest** (instalado e configurado) |
| Arquivos de teste | 4 arquivos, **160 testes** |
| Cobertura de código | Parcial (`src/lib/` — módulos críticos) |
| CI/CD com testes | Não configurado |

### Testes Implementados (Fase 1-2)

| Arquivo | Testes | Módulo |
|---------|--------|--------|
| `actionPlanEngine.test.ts` | 85 | `evaluateCondition` + `getNonConformityValueStr` |
| `emailTemplateEngine.test.ts` | 30 | `replaceTemplatePlaceholders` + `buildEmailFromTemplate` + `SEVERITY_COLORS` |
| `crossValidation.test.ts` | 17 | `verificarNotasIrmas` (matching temporal) |
| `offlineStorage.test.ts` | 28 | IndexedDB CRUD completo (fake-indexeddb) |

---

## 2. Por Que Testar?

O NoCheck é um sistema **crítico para a operação** do Grupo Do Nô, com:

- **Motor de planos de ação** que avalia condições em 12+ tipos de campo
- **Validação cruzada** entre operadores com matching temporal
- **Sincronização offline-first** com IndexedDB e retry
- **Formulários dinâmicos** com campos condicionais, GPS, fotos, assinaturas
- **Integrações externas** com Teams, Email (Resend), IA (Groq)

Qualquer bug nessas áreas pode gerar:
- Planos de ação criados incorretamente
- Dados perdidos na sincronização offline
- Alertas falsos ou ausentes no Teams
- Campos obrigatórios ignorados

Testes automatizados previnem regressões e dão confiança para evoluir o sistema.

---

## 3. Estratégia — Pirâmide de Testes

```
        /‾‾‾‾‾‾‾‾‾‾‾\
       /    E2E (5%)   \        ← Poucos, caros, fluxos críticos
      /   Playwright     \
     /‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾\
    /  Componente (20%)      \   ← FieldRenderer, formulários
   /   Testing Library        \
  /‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾\
 /   Integração (25%)           \  ← Hooks, sync, offline
/    MSW + fake-indexeddb         \
/‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾\
/     Unitário (50%)                 \  ← Lógica pura em src/lib/
/      Vitest                          \
/‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾\
```

**Princípio:** Quanto mais próximo da base, mais rápido, barato e estável é o teste.

---

## 4. Stack de Testes

| Ferramenta | Propósito | Tipo |
|------------|-----------|------|
| **Vitest** | Test runner principal | devDependency |
| **@testing-library/react** | Renderização de componentes React | devDependency |
| **@testing-library/jest-dom** | Matchers de DOM (`.toBeInTheDocument()`) | devDependency |
| **@testing-library/user-event** | Simulação de interações do usuário | devDependency |
| **MSW** (Mock Service Worker) v2 | Interceptação de chamadas HTTP/Supabase | devDependency |
| **fake-indexeddb** | Simulação de IndexedDB em memória | devDependency |
| **happy-dom** | Ambiente de DOM leve para Vitest | devDependency |
| **@vitest/coverage-v8** | Relatório de cobertura de código | devDependency |

> **Importante:** Todas são `devDependencies` — não afetam o build de produção nem o tamanho do bundle.

---

## 5. Fase 1 — Infraestrutura

### 5.1. Instalação

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event msw fake-indexeddb happy-dom @vitest/coverage-v8
```

### 5.2. Configuração — `vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/lib/**', 'src/hooks/**', 'src/components/**'],
      exclude: ['src/tests/**', 'src/types/**']
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
```

### 5.3. Setup Global — `src/tests/setup.ts`

```typescript
import '@testing-library/jest-dom'
import 'fake-indexeddb/auto'
```

### 5.4. Scripts no `package.json`

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui"
  }
}
```

### 5.5. Mock do Supabase — `src/tests/mocks/supabase.ts`

Mock factory que retorna um cliente Supabase falso com respostas controladas, permitindo testar funções que dependem do banco sem precisar de conexão real.

### 5.6. Factories de Dados — `src/tests/factories/`

Funções que geram objetos de teste consistentes:

```typescript
// Exemplo: src/tests/factories/field.ts
export function createField(overrides = {}) {
  return {
    id: 'field-1',
    field_type: 'yes_no',
    field_name: 'Piso limpo?',
    is_required: true,
    order_index: 0,
    ...overrides
  }
}
```

---

## 6. Fase 2 — Testes Unitários

### 6.1. `actionPlanEngine.ts` — Motor de Planos de Ação

**Arquivo de teste:** `src/lib/__tests__/actionPlanEngine.test.ts`

Este é o módulo mais crítico do sistema. Cenários a testar:

#### `evaluateCondition()`

| Tipo de Campo | Cenário | Resultado Esperado |
|---------------|---------|-------------------|
| `yes_no` | Resposta "Não" com condição "equals: Não" | `true` (NC detectada) |
| `yes_no` | Resposta "Sim" com condição "equals: Não" | `false` |
| `number` | Valor 3 com condição "less_than: 5" | `true` |
| `number` | Valor 8 com condição "less_than: 5" | `false` |
| `number` | Valor 5 com condição "between: [3, 7]" | `false` (dentro do range = conforme) |
| `rating` | Nota 2 com condição "less_than: 3" | `true` |
| `dropdown` | Valor "Ruim" com condição "in: [Ruim, Péssimo]" | `true` |
| `dropdown` | Valor "Bom" com condição "in: [Ruim, Péssimo]" | `false` |
| `checkbox_multiple` | Selecionou "Item A" com condição "contains: Item A" | `true` |
| `text` | Campo vazio com condição "is_empty" | `true` |
| `text` | Texto "ok" com condição "is_empty" | `false` |

#### `processChecklistForActionPlans()`

- Checklist com 0 NCs → nenhum plano criado
- Checklist com 1 NC → 1 plano criado com severidade correta
- Checklist com NC reincidente → severidade elevada
- Plano criado com assignee correto (preset vs padrão)
- Notificação enviada ao responsável
- Email enviado se configurado

#### Reincidência

- Primeira ocorrência → severidade original
- Segunda ocorrência (mesmo campo, mesma loja, < 30 dias) → severidade elevada
- Ocorrência antiga (> 30 dias) → não conta como reincidência

---

### 6.2. `crossValidation.ts` — Validação Cruzada

**Arquivo de teste:** `src/lib/__tests__/crossValidation.test.ts`

| Cenário | Resultado Esperado |
|---------|-------------------|
| 2 checklists da mesma loja/template em 30min | Match encontrado |
| 2 checklists da mesma loja mas templates diferentes | Sem match |
| 2 checklists da mesma loja mas intervalo > janela | Sem match |
| Notas iguais entre operadores | Divergência = 0 |
| Notas com diferença dentro da tolerância | Sem alerta |
| Notas com diferença acima da tolerância | Alerta gerado |
| Sessão expirada | Status "expired" |
| Validação com campo yes_no divergente | Divergência registrada |

---

### 6.3. `emailTemplateEngine.ts` — Templates de Email

**Arquivo de teste:** `src/lib/__tests__/emailTemplateEngine.test.ts`

| Cenário | Resultado Esperado |
|---------|-------------------|
| Template com `{{nome}}` e variável `nome: "João"` | "João" no resultado |
| Template com variável não fornecida | Fallback (string vazia ou placeholder) |
| Template com múltiplas variáveis | Todas substituídas |
| Template sem variáveis | Retorna o template original |
| Variável com caracteres especiais em HTML | Escapada corretamente |

---

### 6.4. `exportUtils.ts` — Exportação de Relatórios

**Arquivo de teste:** `src/lib/__tests__/exportUtils.test.ts`

| Cenário | Resultado Esperado |
|---------|-------------------|
| Formatação monetária `1234.56` | `R$ 1.234,56` |
| Formatação percentual `0.125` | `12,5%` |
| CSV com vírgula no valor | Valor entre aspas |
| CSV com quebra de linha no valor | Valor entre aspas |
| Headers corretos para relatório de NC | Colunas esperadas presentes |
| Dados vazios | Arquivo gerado sem erros |

---

## 7. Fase 3 — Testes de Integração

### 7.1. `syncService.ts` — Sincronização Offline

**Arquivo de teste:** `src/lib/__tests__/syncService.test.ts`

Com MSW interceptando chamadas ao Supabase:

| Cenário | Resultado Esperado |
|---------|-------------------|
| 1 checklist pendente, sync bem-sucedido | Removido do IndexedDB, gravado no Supabase |
| Falha no upload de imagem | Retry automático, status "error" se falhar 3x |
| 3 checklists pendentes | Todos sincronizados em sequência |
| 0 checklists pendentes | Nenhuma operação, status "idle" |
| Sync dispara validação cruzada | Função de cross-validation chamada |
| Sync dispara processamento de planos de ação | Função de action plans chamada |

### 7.2. `offlineStorage.ts` e `offlineCache.ts`

**Arquivos de teste:** `src/lib/__tests__/offlineStorage.test.ts`, `src/lib/__tests__/offlineCache.test.ts`

Com `fake-indexeddb`:

| Cenário | Resultado Esperado |
|---------|-------------------|
| Salvar checklist pendente | Recuperável por ID |
| Listar todos os pendentes | Retorna array completo |
| Remover checklist após sync | Não mais recuperável |
| Cache de templates | Dados acessíveis offline |
| Cache de stores | Dados acessíveis offline |
| Limpar cache (logout) | Todos os dados removidos |
| Cache vazio | Retorna null/array vazio sem erro |

### 7.3. Hooks

**Arquivos de teste:** `src/hooks/__tests__/useAuth.test.ts`, etc.

Com `renderHook` do Testing Library:

| Hook | Cenário | Resultado Esperado |
|------|---------|-------------------|
| `useOnlineStatus` | `navigator.onLine = true` | `isOnline = true` |
| `useOnlineStatus` | Evento `offline` disparado | `isOnline = false` |
| `useAuth` | signIn com credenciais válidas (mock) | user + session populados |
| `useAuth` | signOut | user + session limpos, cache limpo |
| `useOfflineData` | Online: busca do Supabase | Dados do Supabase retornados |
| `useOfflineData` | Offline: busca do cache | Dados do IndexedDB retornados |

### 7.4. API Routes

**Arquivos de teste:** `src/app/api/__tests__/`

| Rota | Cenário | Resultado Esperado |
|------|---------|-------------------|
| `POST /api/admin/users` | Dados válidos | 201 + usuário criado |
| `POST /api/admin/users` | Sem auth | 401 |
| `POST /api/admin/users` | Não admin | 403 |
| `POST /api/notifications/email` | Template válido | Email enviado (mock Resend) |
| `POST /api/chat` | Mensagem válida | Resposta da IA (mock Groq) |

---

## 8. Fase 4 — Testes de Componente

### 8.1. `FieldRenderer.tsx`

**Arquivo de teste:** `src/components/fields/__tests__/FieldRenderer.test.tsx`

| Tipo de Campo | Verificação |
|---------------|-------------|
| `text` | Renderiza input text, aceita digitação |
| `number` | Renderiza input number, subtype monetário mostra "R$" |
| `yes_no` | Renderiza botões "Sim" e "Não", clique dispara onChange |
| `photo` | Renderiza botão de captura/upload |
| `dropdown` | Renderiza select com opções do template |
| `rating` | Renderiza estrelas, clique seleciona nota |
| `checkbox_multiple` | Renderiza checkboxes, seleção múltipla funciona |
| `gps` | Renderiza botão de localização |
| `datetime` | Renderiza input de data/hora |
| `signature` | Renderiza área de assinatura |
| `barcode` | Renderiza leitor de código |
| `calculated` | Exibe resultado da fórmula |
| Campo condicional | Oculto quando condição não atendida |
| Campo obrigatório | Mostra indicador de obrigatório |

### 8.2. `FieldConditionEditor.tsx`

**Arquivo de teste:** `src/components/admin/__tests__/FieldConditionEditor.test.tsx`

| Ação | Verificação |
|------|-------------|
| Adicionar condição | Nova condição aparece na lista |
| Remover condição | Condição removida da lista |
| Mudar tipo de campo | Opções de condição atualizam |
| Definir severidade | Valor salvo corretamente |
| Definir assignee | Responsável selecionado |

---

## 9. Fase 5 — Testes E2E (Futuro)

Com **Playwright**, testar os fluxos end-to-end mais críticos:

| Fluxo | Etapas |
|-------|--------|
| **Login → Dashboard** | Acessar /login → preencher email/senha → submeter → verificar redirect para /dashboard → verificar dados carregados |
| **Criar Checklist** | Dashboard → selecionar template → selecionar loja → preencher campos por seção → finalizar → verificar checklist salvo |
| **Admin: Template** | /admin/templates → novo → preencher nome/categoria → adicionar campos → adicionar condições → salvar → verificar na lista |

> Esta fase será implementada após as fases 1-4 estarem estáveis.

---

## 10. Estrutura de Arquivos

```
src/
├── tests/
│   ├── setup.ts                              # Setup global
│   ├── mocks/
│   │   ├── supabase.ts                       # Mock do cliente Supabase
│   │   ├── handlers.ts                       # MSW request handlers
│   │   └── server.ts                         # MSW server setup
│   └── factories/
│       ├── checklist.ts                      # Factory de checklists
│       ├── template.ts                       # Factory de templates
│       ├── field.ts                          # Factory de campos
│       ├── user.ts                           # Factory de usuários
│       └── store.ts                          # Factory de lojas
│
├── lib/
│   └── __tests__/
│       ├── actionPlanEngine.test.ts           # ⭐ Prioridade 1
│       ├── crossValidation.test.ts            # ⭐ Prioridade 2
│       ├── emailTemplateEngine.test.ts        # Prioridade 3
│       ├── exportUtils.test.ts                # Prioridade 4
│       ├── offlineStorage.test.ts             # Prioridade 5
│       ├── offlineCache.test.ts               # Prioridade 5
│       └── syncService.test.ts                # Prioridade 6
│
├── hooks/
│   └── __tests__/
│       ├── useAuth.test.ts
│       ├── useOnlineStatus.test.ts
│       └── useOfflineData.test.ts
│
├── components/
│   ├── fields/
│   │   └── __tests__/
│   │       ├── FieldRenderer.test.tsx         # Prioridade 7
│   │       └── ReadOnlyFieldRenderer.test.tsx
│   └── admin/
│       └── __tests__/
│           └── FieldConditionEditor.test.tsx
```

---

## 11. Prioridade de Implementação

A ordem prioriza **maior retorno com menor esforço**:

| # | Tarefa | Tipo | Dificuldade | Impacto | Status |
|---|--------|------|-------------|---------|--------|
| 1 | Setup da infraestrutura | Config | Baixa | Essencial | ✅ Concluído |
| 2 | `actionPlanEngine.test.ts` | Unitário | Média | Altíssimo | ✅ 85 testes |
| 3 | `crossValidation.test.ts` | Unitário | Média | Alto | ✅ 17 testes |
| 4 | `emailTemplateEngine.test.ts` | Unitário | Baixa | Médio | ✅ 30 testes |
| 5 | `exportUtils.test.ts` | Unitário | Baixa | Médio | Pendente |
| 6 | `offlineStorage.test.ts` + `offlineCache.test.ts` | Integração | Média | Alto | ✅ 28 testes (storage) |
| 7 | `syncService.test.ts` | Integração | Alta | Alto | Pendente |
| 8 | `FieldRenderer.test.tsx` | Componente | Alta | Alto | ✅ 73 testes |
| 9 | Hooks (useAuth, useOnlineStatus, useOfflineData) | Integração | Média | Médio | Pendente |
| 10 | `FieldConditionEditor.test.tsx` | Componente | Média | Médio | ✅ 45 testes |

---

## 12. Metas de Cobertura

| Fase | Meta | Prazo Sugerido |
|------|------|----------------|
| Inicial (Fases 1-2) | 60% em `src/lib/` | 2 semanas |
| Intermediária (Fase 3) | 50% geral do projeto | 4 semanas |
| Avançada (Fase 4) | 65% geral | 6 semanas |
| Completa (Fase 5) | 70%+ com E2E | 8 semanas |

---

## 13. Como Simular Cenários Complexos

### Cenários Offline

```typescript
// Simular offline
Object.defineProperty(navigator, 'onLine', { value: false, writable: true })
window.dispatchEvent(new Event('offline'))

// Simular retorno online
Object.defineProperty(navigator, 'onLine', { value: true, writable: true })
window.dispatchEvent(new Event('online'))
```

### Respostas do Supabase (MSW)

```typescript
// Handler MSW para simular resposta do Supabase
http.get('*/rest/v1/checklists*', () => {
  return HttpResponse.json([
    { id: '1', store_id: 'store-1', status: 'completed' }
  ])
})

// Simular erro do Supabase
http.get('*/rest/v1/checklists*', () => {
  return HttpResponse.json(
    { message: 'Internal Server Error' },
    { status: 500 }
  )
})
```

### IndexedDB (fake-indexeddb)

```typescript
// Importar no setup.ts — substitui automaticamente o IndexedDB global
import 'fake-indexeddb/auto'

// Nos testes, offlineStorage e offlineCache funcionam normalmente
// mas os dados ficam em memória e são limpos entre testes
```

### Geolocalização

```typescript
// Simular GPS
const mockGeolocation = {
  getCurrentPosition: vi.fn((success) =>
    success({ coords: { latitude: -8.05, longitude: -34.87 } })
  )
}
Object.defineProperty(navigator, 'geolocation', { value: mockGeolocation })
```

### Tempo (datas)

```typescript
// Fixar data para testes de janela temporal
vi.useFakeTimers()
vi.setSystemTime(new Date('2026-03-10T14:00:00'))

// Avançar tempo
vi.advanceTimersByTime(30 * 60 * 1000) // 30 minutos
```

---

## 14. Comandos Úteis

```bash
# Rodar todos os testes
npm test

# Rodar testes uma vez (sem watch)
npm run test:run

# Rodar testes com cobertura
npm run test:coverage

# Rodar apenas testes de um arquivo
npx vitest run src/lib/__tests__/actionPlanEngine.test.ts

# Rodar testes que contenham um nome específico
npx vitest run -t "evaluateCondition"

# Modo UI (interface visual no navegador)
npm run test:ui
```

---

> **Nota:** Todas as dependências de teste são `devDependencies` e não afetam o build de produção.
> Os arquivos de teste são versionados no Git para que qualquer desenvolvedor possa executá-los.
