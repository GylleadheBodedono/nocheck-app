# OpereCheck — Real-time UI

## Arquitetura

O app usa Supabase Realtime (postgres_changes) para atualizar a UI automaticamente
quando dados mudam no banco. Isso complementa o sistema offline-first com IndexedDB.

Todas as 24 paginas de dados do app tem realtime ativo.

## Como funciona

1. Quando ONLINE: hooks de realtime se inscrevem em mudancas via WebSocket
2. Quando OFFLINE: app usa dados do IndexedDB normalmente (realtime desativado)
3. Ao reconectar: syncService recarrega dados + realtime reconecta automaticamente
4. Cada mudanca detectada incrementa um `refreshKey` que dispara refetch dos dados

## Hooks de Realtime

### useRealtimeRefresh (hook generico — usado em 24 paginas)
- Aceita lista de tabelas: `useRealtimeRefresh(['action_plans', 'notifications'])`
- Cria um canal Supabase por tabela, escutando evento `*` (INSERT, UPDATE, DELETE)
- Retorna `{ refreshKey }` — numero que incrementa a cada mudanca
- A pagina usa `useEffect(() => { if (refreshKey > 0) loadData() }, [refreshKey])`
- So ativo quando `navigator.onLine`
- Cleanup automatico no unmount
- Arquivo: `src/hooks/useRealtimeRefresh.ts`

### useNotifications (notificacoes — sino do header)
- Tabela: notifications
- Eventos: INSERT
- Filtro: user_id = auth.uid()
- Arquivo: `src/hooks/useNotifications.ts`

### useRealtimeActionPlans (planos de acao — dashboard tech user)
- Tabela: action_plans
- Eventos: INSERT, UPDATE
- Filtros: assigned_to = user.id OU assigned_function_id = user.function_id
- Dois canais separados (Supabase so suporta 1 filtro por canal)
- Arquivo: `src/hooks/useRealtimeActionPlans.ts`

### useRealtimeDashboard (dashboard — wrapper combinado)
- Combina subscriptions de notifications, action_plans e checklists
- Retorna `{ refreshTrigger }` para recarregar dados do dashboard
- Arquivo: `src/hooks/useRealtimeDashboard.ts`

## Cobertura completa — 24 paginas

### Admin
| Pagina | Tabelas monitoradas |
|--------|-------------------|
| `/admin` (dashboard) | checklists, action_plans, users, stores |
| `/admin/checklists` | checklists, checklist_responses |
| `/admin/lojas` | stores |
| `/admin/usuarios` | users |
| `/admin/usuarios/[id]` | users |
| `/admin/funcoes` | functions |
| `/admin/setores` | sectors |
| `/admin/validacoes` | cross_validations |
| `/admin/templates` | checklist_templates, template_fields |
| `/admin/templates/novo` | template_fields |
| `/admin/templates/[id]` | template_fields, field_conditions |
| `/admin/galeria` | checklist_responses |
| `/admin/configuracoes` | app_settings |
| `/admin/relatorios` | checklists |
| `/admin/relatorios/fotos-nc` | checklist_responses, action_plans |
| `/admin/relatorios/planos-de-acao` | action_plans |
| `/admin/planos-de-acao` | action_plans |
| `/admin/planos-de-acao/[id]` | action_plans, action_plan_updates |
| `/admin/planos-de-acao/novo` | action_plan_presets |
| `/admin/planos-de-acao/modelos` | action_plan_presets |

### Employee / Tech User
| Pagina | Tabelas monitoradas |
|--------|-------------------|
| `/dashboard` | notifications, action_plans, checklists (via useRealtimeDashboard) |
| `/checklist/[id]` | checklist_responses |
| `/relatorios` | checklists, action_plans |

### Paginas SEM realtime (estaticas/auth)
- `/` (landing page)
- `/login`, `/cadastro`, `/esqueci-senha`
- `/auth/confirmed`, `/auth/reset-password`
- `/offline`
- `/checklist/novo` (preenchimento ativo — nao precisa de refresh externo)

## Como adicionar realtime a uma nova pagina

```typescript
// 1. Import
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh'

// 2. Hook (dentro do componente, apos state declarations)
const { refreshKey } = useRealtimeRefresh(['nome_da_tabela'])

// 3. Refetch quando dados mudam
useEffect(() => {
  if (refreshKey > 0 && navigator.onLine) loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [refreshKey])
```

## Como adicionar subscription customizada (com filtro)

```typescript
import { createClient } from '@/lib/supabase'

useEffect(() => {
  if (!navigator.onLine) return
  const supabase = createClient()

  const channel = supabase
    .channel('nome-unico')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'nome_tabela',
      filter: 'coluna=eq.valor',
    }, (payload) => {
      // Tratar mudanca
    })
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}, [])
```

## Compatibilidade Offline

- Realtime NAO funciona offline (depende de WebSocket)
- Hook verifica `navigator.onLine` antes de inscrever
- `refreshKey > 0` guard evita refetch desnecessario no mount
- Ao reconectar, Supabase Realtime reconecta automaticamente
- Dados offline continuam via IndexedDB + syncService (src/lib/syncService.ts)
- NUNCA substituir o mecanismo offline — realtime e um COMPLEMENTO

## Arquivos de referencia

| Arquivo | Descricao |
|---------|-----------|
| `src/hooks/useRealtimeRefresh.ts` | Hook generico (usado em 24 paginas) |
| `src/hooks/useRealtimeActionPlans.ts` | Hook especifico para action plans |
| `src/hooks/useRealtimeDashboard.ts` | Hook combinado para o dashboard |
| `src/hooks/useNotifications.ts` | Hook de notificacoes (sino) |
| `src/lib/supabase.ts` | Client singleton do browser |
| `src/lib/syncService.ts` | Sync offline → online |
| `src/lib/offlineCache.ts` | Cache IndexedDB |
