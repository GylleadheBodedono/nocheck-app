import type { SupabaseClient } from '@supabase/supabase-js'
import { clearAllCache } from './offlineCache'
import { clearOfflineData } from './offlineStorage'

/**
 * Limpa o cache do Service Worker com confirmação via MessageChannel.
 * Aguarda resposta do SW ou timeout de 2s.
 */
function clearServiceWorkerCache(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
      resolve()
      return
    }

    const channel = new MessageChannel()
    channel.port1.onmessage = () => resolve()
    navigator.serviceWorker.controller.postMessage(
      { type: 'CLEAR_CACHE' },
      [channel.port2]
    )

    // Fallback: resolve após 2s se SW não responder
    setTimeout(resolve, 2000)
  })
}

/**
 * Logout completo: limpa TODOS os caches e storages antes de deslogar.
 * Usa window.location.href para hard redirect (ignora cache do Next.js router).
 */
export async function fullLogout(supabase: SupabaseClient): Promise<void> {
  // 1. Limpar IndexedDB (nocheck-cache) — dados offline do app
  try {
    await clearAllCache()
  } catch {
    // Não bloquear logout se falhar
  }

  // 2. Limpar IndexedDB (nocheck-offline) — checklists pendentes
  try {
    await clearOfflineData()
  } catch {
    // Não bloquear logout se falhar
  }

  // 3. Limpar Cache API do Service Worker (com confirmação)
  try {
    await clearServiceWorkerCache()
  } catch {
    // Não bloquear logout se falhar
  }

  // 4. Limpar localStorage e sessionStorage
  try { localStorage.clear() } catch {}
  try { sessionStorage.clear() } catch {}

  // 5. Deslogar do Supabase (limpa cookies de sessão)
  try {
    await supabase.auth.signOut()
  } catch {
    // Continuar mesmo se falhar
  }

  // 6. Hard redirect para landing page (ignora cache do Next.js)
  window.location.href = '/'
}
