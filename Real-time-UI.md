# OpereCheck — Real-time UI

## Arquitetura

O app usa Supabase Realtime (postgres_changes) para atualizar a UI automaticamente
quando dados mudam no banco. Isso complementa o sistema offline-first com IndexedDB.

## Como funciona

1. Quando ONLINE: hooks de realtime se inscrevem em mudancas via WebSocket
2. Quando OFFLINE: app usa dados do IndexedDB normalmente
3. Ao reconectar: syncService recarrega dados + realtime reconecta automaticamente

## Hooks de Realtime

### useNotifications (existente)
- Tabela: notifications
- Eventos: INSERT
- Filtro: user_id = auth.uid()
- Arquivo: src/hooks/useNotifications.ts

### useRealtimeActionPlans (novo)
- Tabela: action_plans
- Eventos: INSERT, UPDATE
- Filtros: assigned_to = user.id OU assigned_function_id = user.function_id
- Arquivo: src/hooks/useRealtimeActionPlans.ts

### useRealtimeDashboard (novo)
- Wrapper que combina subscriptions
- Retorna refreshTrigger para recarregar dados
- Arquivo: src/hooks/useRealtimeDashboard.ts

## Tabelas com Realtime habilitado

| Tabela | Eventos | Filtro |
|--------|---------|--------|
| notifications | INSERT | user_id |
| action_plans | INSERT, UPDATE | assigned_to, assigned_function_id |
| checklists | INSERT, UPDATE | store_id (lojas do usuario) |

## Como adicionar nova subscription

1. Criar channel: `supabase.channel('nome-unico')`
2. Adicionar listener: `.on('postgres_changes', { event, schema, table, filter }, callback)`
3. Chamar `.subscribe()`
4. Limpar no unmount: `supabase.removeChannel(channel)`

## Compatibilidade Offline

- Realtime NAO funciona offline (depende de WebSocket)
- Verificar `navigator.onLine` antes de inscrever
- Ao reconectar, Supabase Realtime reconecta automaticamente
- Dados offline continuam via IndexedDB + syncService
- NUNCA substituir o mecanismo offline — realtime e um COMPLEMENTO
