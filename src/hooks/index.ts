/**
 * Barrel de hooks do OpereCheck.
 * Agrupa os hooks por categoria para facilitar as importações nos componentes.
 */

// Hooks de autenticação
export { useAuth } from './useAuth'
export { useOfflineAuth, hasOfflineAuth } from './useOfflineAuth'
export type { OfflineAuthState, OfflineAuthActions } from './useOfflineAuth'

// Hooks de dados
export { useOfflineData } from './useOfflineData'
export type { OfflineDataState, OfflineDataActions } from './useOfflineData'

// Hooks de realtime
export { useRealtimeRefresh } from './useRealtimeRefresh'
export { useRealtimeDashboard } from './useRealtimeDashboard'
export { useRealtimeActionPlans } from './useRealtimeActionPlans'

// Hooks utilitários
export { useOnlineStatus } from './useOnlineStatus'
export { useTheme } from './useTheme'
export { usePrecache, triggerPrecache } from './usePrecache'
