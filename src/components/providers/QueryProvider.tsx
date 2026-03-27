// ============================================
// QueryProvider — Wrapper para React Query
// ============================================
// Necessario para os hooks de tenant (useTenant, useFeature, etc.)
// que dependem do React Query para buscar dados do Supabase.
// ============================================

'use client'

import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // Criar QueryClient com useState garante que cada request do servidor
  // gera um client novo (evita compartilhar estado entre requests)
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Nao refetch automaticamente ao focar a janela (evita requests desnecessarios)
            refetchOnWindowFocus: false,
            // Retry 1x em caso de erro (padrao seria 3)
            retry: 1,
            // Cache por 5 minutos
            staleTime: 5 * 60 * 1000,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
