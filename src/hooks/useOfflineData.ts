'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import {
  getStoresCache,
  getTemplatesCache,
  getTemplateFieldsCache,
  getUserRolesCache,
  getSectorsCache,
  saveStoresCache,
  saveTemplatesCache,
  saveTemplateFieldsCache,
  saveUserRolesCache,
  saveSectorsCache,
  saveSyncMetadata,
} from '@/lib/offlineCache'
import type {
  Store,
  ChecklistTemplate,
  TemplateField,
  UserStoreRole,
  Sector,
} from '@/types/database'

export type OfflineDataState = {
  stores: Store[]
  templates: ChecklistTemplate[]
  userRoles: UserStoreRole[]
  sectors: Sector[]
  isLoading: boolean
  isOffline: boolean
  lastSyncAt: string | null
  error: string | null
}

export type OfflineDataActions = {
  loadStores: () => Promise<Store[]>
  loadTemplates: (storeId?: number) => Promise<ChecklistTemplate[]>
  loadTemplateFields: (templateId: number) => Promise<TemplateField[]>
  loadUserRoles: (userId: string) => Promise<UserStoreRole[]>
  loadSectors: (storeId?: number) => Promise<Sector[]>
  syncAllData: (userId: string) => Promise<void>
  getUserStoreIds: (userId: string) => Promise<number[]>
}

/**
 * Hook para carregar dados com suporte offline
 * - Quando online: busca do Supabase e atualiza cache
 * - Quando offline: usa dados do IndexedDB
 */
export function useOfflineData(): OfflineDataState & OfflineDataActions {
  const [state, setState] = useState<OfflineDataState>({
    stores: [],
    templates: [],
    userRoles: [],
    sectors: [],
    isLoading: false,
    isOffline: typeof navigator !== 'undefined' ? !navigator.onLine : false,
    lastSyncAt: null,
    error: null,
  })

  const supabase = createClient()

  // Monitora status de conexao
  useEffect(() => {
    const handleOnline = () => {
      setState(prev => ({ ...prev, isOffline: false }))
    }

    const handleOffline = () => {
      setState(prev => ({ ...prev, isOffline: true }))
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  /**
   * Carrega lojas - online ou offline
   */
  const loadStores = useCallback(async (): Promise<Store[]> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      if (navigator.onLine) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from('stores')
          .select('*')
          .eq('is_active', true)
          .order('name')

        if (error) throw error

        if (data) {
          await saveStoresCache(data)
          setState(prev => ({ ...prev, stores: data, isLoading: false }))
          return data
        }
      }

      // Offline - usa cache
      const cached = await getStoresCache()
      setState(prev => ({ ...prev, stores: cached, isLoading: false }))
      return cached
    } catch (error) {
      console.error('[OfflineData] Error loading stores:', error)

      // Tenta cache em caso de erro
      try {
        const cached = await getStoresCache()
        setState(prev => ({ ...prev, stores: cached, isLoading: false }))
        return cached
      } catch {
        setState(prev => ({ ...prev, isLoading: false, error: 'Erro ao carregar lojas' }))
        return []
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * Carrega templates - online ou offline
   */
  const loadTemplates = useCallback(async (storeId?: number): Promise<ChecklistTemplate[]> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      if (navigator.onLine) {
        let query = (supabase as any) // eslint-disable-line @typescript-eslint/no-explicit-any
          .from('checklist_templates')
          .select('*')
          .eq('is_active', true)
          .order('name')

        if (storeId) {
          // Filtra por visibilidade da loja
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: visibility } = await (supabase as any)
            .from('template_visibility')
            .select('template_id')
            .eq('store_id', storeId)

          if (visibility) {
            const templateIds = visibility.map((v: { template_id: number }) => v.template_id)
            query = query.in('id', templateIds)
          }
        }

        const { data, error } = await query

        if (error) throw error

        if (data) {
          await saveTemplatesCache(data)
          setState(prev => ({ ...prev, templates: data, isLoading: false }))
          return data
        }
      }

      // Offline - usa cache
      const cached = await getTemplatesCache()
      setState(prev => ({ ...prev, templates: cached, isLoading: false }))
      return cached
    } catch (error) {
      console.error('[OfflineData] Error loading templates:', error)

      try {
        const cached = await getTemplatesCache()
        setState(prev => ({ ...prev, templates: cached, isLoading: false }))
        return cached
      } catch {
        setState(prev => ({ ...prev, isLoading: false, error: 'Erro ao carregar templates' }))
        return []
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * Carrega campos do template - online ou offline
   */
  const loadTemplateFields = useCallback(async (templateId: number): Promise<TemplateField[]> => {
    try {
      if (navigator.onLine) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from('template_fields')
          .select('*')
          .eq('template_id', templateId)
          .order('sort_order')

        if (error) throw error

        if (data) {
          // Atualiza cache (adiciona ao existente)
          const allCached = await getTemplateFieldsCache(templateId)
          const existingIds = new Set(allCached.map(f => f.id))
          const newFields = data.filter((f: TemplateField) => !existingIds.has(f.id))

          if (newFields.length > 0) {
            await saveTemplateFieldsCache([...allCached, ...newFields])
          }

          return data
        }
      }

      // Offline - usa cache
      return await getTemplateFieldsCache(templateId)
    } catch (error) {
      console.error('[OfflineData] Error loading template fields:', error)

      try {
        return await getTemplateFieldsCache(templateId)
      } catch {
        return []
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * Carrega roles do usuario - online ou offline
   */
  const loadUserRoles = useCallback(async (userId: string): Promise<UserStoreRole[]> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      if (navigator.onLine) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from('user_store_roles')
          .select('*')
          .eq('user_id', userId)

        if (error) throw error

        if (data) {
          await saveUserRolesCache(data)
          setState(prev => ({ ...prev, userRoles: data, isLoading: false }))
          return data
        }
      }

      // Offline - usa cache
      const cached = await getUserRolesCache(userId)
      setState(prev => ({ ...prev, userRoles: cached, isLoading: false }))
      return cached
    } catch (error) {
      console.error('[OfflineData] Error loading user roles:', error)

      try {
        const cached = await getUserRolesCache(userId)
        setState(prev => ({ ...prev, userRoles: cached, isLoading: false }))
        return cached
      } catch {
        setState(prev => ({ ...prev, isLoading: false, error: 'Erro ao carregar cargos' }))
        return []
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * Carrega setores - online ou offline
   */
  const loadSectors = useCallback(async (storeId?: number): Promise<Sector[]> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      if (navigator.onLine) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let query = (supabase as any)
          .from('sectors')
          .select('*')
          .eq('is_active', true)
          .order('name')

        if (storeId) {
          query = query.eq('store_id', storeId)
        }

        const { data, error } = await query

        if (error) throw error

        if (data) {
          await saveSectorsCache(data)
          setState(prev => ({ ...prev, sectors: data, isLoading: false }))
          return data
        }
      }

      // Offline - usa cache
      const cached = await getSectorsCache(storeId)
      setState(prev => ({ ...prev, sectors: cached, isLoading: false }))
      return cached
    } catch (error) {
      console.error('[OfflineData] Error loading sectors:', error)

      try {
        const cached = await getSectorsCache(storeId)
        setState(prev => ({ ...prev, sectors: cached, isLoading: false }))
        return cached
      } catch {
        setState(prev => ({ ...prev, isLoading: false, error: 'Erro ao carregar setores' }))
        return []
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * Retorna IDs das lojas do usuario
   */
  const getUserStoreIds = useCallback(async (userId: string): Promise<number[]> => {
    const roles = await loadUserRoles(userId)
    return [...new Set(roles.map(r => r.store_id))]
  }, [loadUserRoles])

  /**
   * Sincroniza todos os dados do usuario
   */
  const syncAllData = useCallback(async (userId: string) => {
    if (!navigator.onLine) {
      console.log('[OfflineData] Cannot sync while offline')
      return
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      console.log('[OfflineData] Starting full sync...')

      // Carrega roles primeiro para saber quais lojas
      const roles = await loadUserRoles(userId)
      const storeIds = [...new Set(roles.map(r => r.store_id))]

      // Carrega lojas
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: stores } = await (supabase as any)
        .from('stores')
        .select('*')
        .in('id', storeIds)

      if (stores) {
        await saveStoresCache(stores)
        setState(prev => ({ ...prev, stores }))
      }

      // Carrega setores
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: sectors } = await (supabase as any)
        .from('sectors')
        .select('*')
        .in('store_id', storeIds)

      if (sectors) {
        await saveSectorsCache(sectors)
        setState(prev => ({ ...prev, sectors }))
      }

      // Carrega templates visiveis
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: visibility } = await (supabase as any)
        .from('template_visibility')
        .select('template_id')
        .in('store_id', storeIds)

      if (visibility) {
        const templateIds = [...new Set(visibility.map((v: { template_id: number }) => v.template_id))]

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: templates } = await (supabase as any)
          .from('checklist_templates')
          .select('*')
          .in('id', templateIds)

        if (templates) {
          await saveTemplatesCache(templates)
          setState(prev => ({ ...prev, templates }))

          // Carrega campos dos templates
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

      const now = new Date().toISOString()
      await saveSyncMetadata('full_sync', 'success')

      setState(prev => ({
        ...prev,
        isLoading: false,
        lastSyncAt: now,
      }))

      console.log('[OfflineData] Full sync completed')
    } catch (error) {
      console.error('[OfflineData] Sync error:', error)
      await saveSyncMetadata('full_sync', 'failed')

      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Erro ao sincronizar dados',
      }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadUserRoles])

  return {
    ...state,
    loadStores,
    loadTemplates,
    loadTemplateFields,
    loadUserRoles,
    loadSectors,
    syncAllData,
    getUserStoreIds,
  }
}
