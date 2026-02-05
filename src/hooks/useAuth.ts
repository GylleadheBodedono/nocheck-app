'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import type { User, Session } from '@supabase/supabase-js'
import type { User as DBUser, UserStoreRole, Store } from '@/types/database'
import {
  saveAuthCache,
  getAuthCache,
  saveUserCache,
  getUserCache,
  saveStoresCache,
  saveUserRolesCache,
  saveTemplatesCache,
  saveTemplateFieldsCache,
  saveSectorsCache,
  clearAllCache,
  getStoresCache,
  getUserRolesCache,
} from '@/lib/offlineCache'

export type UserWithRoles = DBUser & {
  roles: (UserStoreRole & { store: Store })[]
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserWithRoles | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isOffline, setIsOffline] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  // Monitora status de conexao
  useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)

    if (typeof window !== 'undefined') {
      setIsOffline(!navigator.onLine)
      window.addEventListener('online', handleOnline)
      window.addEventListener('offline', handleOffline)
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
      }
    }
  }, [])

  const fetchUserProfile = useCallback(async (userId: string): Promise<UserWithRoles | null> => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('users')
        .select(`
          *,
          roles:user_store_roles(
            *,
            store:stores(*)
          )
        `)
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error fetching user profile:', error)
        return null
      }

      return data as UserWithRoles
    } catch (error) {
      console.error('Error fetching user profile:', error)
      return null
    }
  }, [supabase])

  // Carrega perfil do cache (modo offline)
  const loadFromCache = useCallback(async () => {
    try {
      const cachedAuth = await getAuthCache()
      if (!cachedAuth) return false

      const cachedUser = await getUserCache(cachedAuth.userId)
      if (!cachedUser) return false

      // Busca roles e stores do cache
      const cachedRoles = await getUserRolesCache(cachedAuth.userId)
      const cachedStores = await getStoresCache()

      // Monta o profile com roles
      const rolesWithStores = cachedRoles.map(role => ({
        ...role,
        store: cachedStores.find(s => s.id === role.store_id) || {} as Store
      }))

      const profile: UserWithRoles = {
        ...cachedUser,
        roles: rolesWithStores
      }

      // Cria um user fake para manter compatibilidade
      const fakeUser = {
        id: cachedAuth.userId,
        email: cachedAuth.email,
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: '',
      } as User

      setUser(fakeUser)
      setUserProfile(profile)
      setLoading(false)

      console.log('[useAuth] Loaded from cache (offline mode)')
      return true
    } catch (error) {
      console.error('[useAuth] Error loading from cache:', error)
      return false
    }
  }, [])

  // Cacheia dados do usuario para uso offline
  const cacheUserData = useCallback(async (session: Session, profile: UserWithRoles) => {
    try {
      // Salva auth
      await saveAuthCache({
        userId: session.user.id,
        email: session.user.email || '',
        accessToken: session.access_token,
        refreshToken: session.refresh_token || '',
        expiresAt: session.expires_at || 0,
      })

      // Salva user profile
      await saveUserCache(profile)

      // Salva roles
      const roles = profile.roles.map(r => ({
        id: r.id,
        user_id: r.user_id,
        store_id: r.store_id,
        role: r.role,
        assigned_by: r.assigned_by,
        assigned_at: r.assigned_at,
      }))
      await saveUserRolesCache(roles)

      // Salva stores
      const stores = profile.roles.map(r => r.store).filter(Boolean)
      await saveStoresCache(stores)

      // Busca e cacheia dados adicionais
      const storeIds = [...new Set(profile.roles.map(r => r.store_id))]

      if (storeIds.length > 0) {
        // Setores
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: sectors } = await (supabase as any)
          .from('sectors')
          .select('*')
          .in('store_id', storeIds)

        if (sectors) {
          await saveSectorsCache(sectors)
        }

        // Templates visiveis
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: visibility } = await (supabase as any)
          .from('template_visibility')
          .select('template_id')
          .in('store_id', storeIds)

        if (visibility) {
          const templateIds = [...new Set(visibility.map((v: { template_id: number }) => v.template_id))]

          if (templateIds.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: templates } = await (supabase as any)
              .from('checklist_templates')
              .select('*')
              .in('id', templateIds)

            if (templates) {
              await saveTemplatesCache(templates)
            }

            // Campos dos templates
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: fields } = await (supabase as any)
              .from('template_fields')
              .select('*')
              .in('template_id', templateIds)
              .order('sort_order')

            if (fields) {
              await saveTemplateFieldsCache(fields)
            }
          }
        }
      }

      console.log('[useAuth] User data cached for offline use')
    } catch (error) {
      console.error('[useAuth] Error caching user data:', error)
    }
  }, [supabase])

  useEffect(() => {
    const initAuth = async () => {
      try {
        // Tenta buscar sessao online
        const { data: { session } } = await supabase.auth.getSession()

        if (session?.user) {
          setSession(session)
          setUser(session.user)

          const profile = await fetchUserProfile(session.user.id)
          if (profile) {
            setUserProfile(profile)
            // Cacheia para uso offline
            await cacheUserData(session, profile)
          }

          setLoading(false)
          return
        }

        // Se nao tem sessao online, tenta cache
        const loadedFromCache = await loadFromCache()
        if (!loadedFromCache) {
          setLoading(false)
        }
      } catch (error) {
        console.error('[useAuth] Init error, trying cache:', error)
        // Em caso de erro (ex: offline), tenta cache
        await loadFromCache()
        setLoading(false)
      }
    }

    initAuth()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)

      if (session?.user) {
        const profile = await fetchUserProfile(session.user.id)
        if (profile) {
          setUserProfile(profile)
          await cacheUserData(session, profile)
        }
      } else {
        setUserProfile(null)
      }

      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [supabase.auth, fetchUserProfile, cacheUserData, loadFromCache])

  const signIn = async (email: string, password: string) => {
    setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setLoading(false)
      return { error }
    }

    return { data }
  }

  const signOut = async () => {
    setLoading(true)

    // Limpa cache offline
    try {
      await clearAllCache()
      console.log('[useAuth] Offline cache cleared')
    } catch (error) {
      console.error('[useAuth] Error clearing cache:', error)
    }

    const { error } = await supabase.auth.signOut()
    if (error) {
      setLoading(false)
      return { error }
    }

    setUser(null)
    setUserProfile(null)
    setSession(null)
    setLoading(false)
    return { error: null }
  }

  const isAdmin = userProfile?.is_admin ?? false

  const hasRoleInStore = (storeId: number, role: string) => {
    if (isAdmin) return true
    return userProfile?.roles.some(
      r => r.store_id === storeId && r.role === role
    ) ?? false
  }

  const getUserStores = () => {
    if (!userProfile) return []
    if (isAdmin) return [] // Admin has access to all stores
    return userProfile.roles.map(r => r.store)
  }

  const getUserRolesInStore = (storeId: number) => {
    if (!userProfile) return []
    return userProfile.roles
      .filter(r => r.store_id === storeId)
      .map(r => r.role)
  }

  return {
    user,
    userProfile,
    session,
    loading,
    isAdmin,
    isOffline,
    signIn,
    signOut,
    hasRoleInStore,
    getUserStores,
    getUserRolesInStore,
    refetchProfile: () => user && fetchUserProfile(user.id),
  }
}
