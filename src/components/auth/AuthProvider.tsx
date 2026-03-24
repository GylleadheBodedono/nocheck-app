'use client'

import { createContext, useContext, ReactNode } from 'react'
import { useAuth, type UserWithProfile } from '@/hooks/useAuth'
import type { User, Session } from '@supabase/supabase-js'

/** Contrato do contexto de autenticação exposto para toda a árvore de componentes. */
interface AuthContextType {
  user: User | null
  userProfile: UserWithProfile | null
  session: Session | null
  loading: boolean
  isAdmin: boolean
  signIn: (email: string, password: string) => Promise<{ error?: unknown; data?: unknown }>
  signOut: () => Promise<{ error: unknown }>
  getUserStores: () => Array<{ id: number; name: string }>
  refetchProfile: () => Promise<UserWithProfile | null> | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

/**
 * Provider de autenticação que envolve a árvore de componentes e disponibiliza
 * o contexto de auth via `useAuthContext()`.
 * Deve ser montado no layout raiz, acima de todos os componentes que precisam de autenticação.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth()

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  )
}

/**
 * Acessa o contexto de autenticação.
 * @throws {Error} Se usado fora de um `<AuthProvider>`.
 */
export function useAuthContext() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider')
  }
  return context
}
