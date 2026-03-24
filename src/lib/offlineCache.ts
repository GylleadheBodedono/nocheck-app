/**
 * Sistema de cache offline completo via IndexedDB (`nocheck-cache`).
 * Armazena todos os dados necessários para funcionamento 100% offline.
 *
 * Entidades cacheadas: auth, usuário, lojas, templates, campos, setores,
 * funções, visibilidade, seções, checklists, respostas, user_stores, planos de ação.
 *
 * Uso típico:
 * ```ts
 * await cacheAllDataForOffline(userId) // precache completo no login
 * const templates = await getTemplatesCache() // leitura offline
 * await clearAllCache() // limpeza no logout
 * ```
 *
 * Todos os tipos exportados têm o campo `cachedAt: string` para controle de validade.
 */

import type {
  User, Store, ChecklistTemplate, TemplateField, Sector, FunctionRow,
  TemplateVisibility, TemplateSection, Checklist, ChecklistResponse,
  ChecklistSectionRow, UserStore,
} from '@/types/database'

const DB_NAME = 'nocheck-cache'
const DB_VERSION = 5

// Stores do IndexedDB
const STORES = {
  AUTH: 'auth_cache',
  USER: 'user_cache',
  STORES: 'stores_cache',
  TEMPLATES: 'templates_cache',
  TEMPLATE_FIELDS: 'template_fields_cache',
  USER_ROLES: 'user_roles_cache',
  SECTORS: 'sectors_cache',
  FUNCTIONS: 'functions_cache',
  TEMPLATE_VISIBILITY: 'template_visibility_cache',
  TEMPLATE_SECTIONS: 'template_sections_cache',
  CHECKLISTS: 'checklists_cache',
  CHECKLIST_RESPONSES: 'checklist_responses_cache',
  CHECKLIST_SECTIONS: 'checklist_sections_cache',
  USER_STORES: 'user_stores_cache',
  ACTION_PLANS: 'action_plans_cache',
  SYNC_META: 'sync_metadata',
} as const

// Tipos para os dados cacheados
export type CachedAuth = {
  id: 'current'
  userId: string
  email: string
  accessToken: string
  refreshToken: string
  expiresAt: number
  cachedAt: string
}

export type CachedUser = User & {
  cachedAt: string
}

export type CachedStore = Store & {
  cachedAt: string
}

export type CachedTemplate = ChecklistTemplate & {
  cachedAt: string
}

export type CachedTemplateField = TemplateField & {
  cachedAt: string
}

export type CachedSector = Sector & {
  cachedAt: string
}

export type CachedFunction = FunctionRow & {
  cachedAt: string
}

export type CachedTemplateVisibility = TemplateVisibility & {
  cachedAt: string
}

export type CachedTemplateSection = TemplateSection & {
  cachedAt: string
}

export type CachedChecklist = Checklist & {
  cachedAt: string
  // Dados denormalizados para exibicao offline
  template_name?: string
  template_category?: string | null
  store_name?: string
  sector_name?: string | null
  user_name?: string | null
}

export type CachedChecklistResponse = ChecklistResponse & {
  cachedAt: string
}

export type CachedChecklistSection = ChecklistSectionRow & {
  cachedAt: string
}

export type CachedUserStore = UserStore & {
  cachedAt: string
}

export type CachedActionPlan = {
  id: number
  checklist_id: number | null
  field_id: number | null
  template_id: number | null
  store_id: number
  sector_id: number | null
  title: string
  description: string | null
  severity: string
  status: string
  assigned_to: string
  assigned_by: string | null
  deadline: string
  is_reincidencia: boolean
  reincidencia_count: number
  parent_action_plan_id: number | null
  non_conformity_value: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // Denormalized for display
  store_name?: string
  template_name?: string
  field_name?: string
  assignee_name?: string
  cachedAt: string
}

export type SyncMetadata = {
  id: string
  lastSyncAt: string
  syncStatus: 'success' | 'partial' | 'failed'
}

let db: IDBDatabase | null = null

/**
 * Abre (ou reutiliza) a conexão com o IndexedDB `nocheck-cache` (versão 5).
 * Cria todas as object stores necessárias se ainda não existirem.
 * Usa padrão singleton — múltiplas chamadas retornam a mesma instância.
 *
 * @returns Instância do banco de dados pronta para uso
 */
export async function initOfflineCache(): Promise<IDBDatabase> {
  if (db) return db

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => { reject(request.error) }

    request.onsuccess = () => {
      db = request.result
      resolve(db)
    }

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result

      // Auth cache - armazena sessao do usuario
      if (!database.objectStoreNames.contains(STORES.AUTH)) {
        database.createObjectStore(STORES.AUTH, { keyPath: 'id' })
      }

      // User cache
      if (!database.objectStoreNames.contains(STORES.USER)) {
        database.createObjectStore(STORES.USER, { keyPath: 'id' })
      }

      // Stores cache
      if (!database.objectStoreNames.contains(STORES.STORES)) {
        database.createObjectStore(STORES.STORES, { keyPath: 'id' })
      }

      // Templates cache
      if (!database.objectStoreNames.contains(STORES.TEMPLATES)) {
        database.createObjectStore(STORES.TEMPLATES, { keyPath: 'id' })
      }

      // Template fields cache
      if (!database.objectStoreNames.contains(STORES.TEMPLATE_FIELDS)) {
        const store = database.createObjectStore(STORES.TEMPLATE_FIELDS, { keyPath: 'id' })
        store.createIndex('template_id', 'template_id', { unique: false })
      }

      // User roles cache
      if (!database.objectStoreNames.contains(STORES.USER_ROLES)) {
        const store = database.createObjectStore(STORES.USER_ROLES, { keyPath: 'id' })
        store.createIndex('user_id', 'user_id', { unique: false })
        store.createIndex('store_id', 'store_id', { unique: false })
      }

      // Sectors cache
      if (!database.objectStoreNames.contains(STORES.SECTORS)) {
        const store = database.createObjectStore(STORES.SECTORS, { keyPath: 'id' })
        store.createIndex('store_id', 'store_id', { unique: false })
      }

      // Functions cache
      if (!database.objectStoreNames.contains(STORES.FUNCTIONS)) {
        database.createObjectStore(STORES.FUNCTIONS, { keyPath: 'id' })
      }

      // Template visibility cache
      if (!database.objectStoreNames.contains(STORES.TEMPLATE_VISIBILITY)) {
        const tvStore = database.createObjectStore(STORES.TEMPLATE_VISIBILITY, { keyPath: 'id' })
        tvStore.createIndex('template_id', 'template_id', { unique: false })
        tvStore.createIndex('store_id', 'store_id', { unique: false })
      }

      // Template sections cache
      if (!database.objectStoreNames.contains(STORES.TEMPLATE_SECTIONS)) {
        const tsStore = database.createObjectStore(STORES.TEMPLATE_SECTIONS, { keyPath: 'id' })
        tsStore.createIndex('template_id', 'template_id', { unique: false })
      }

      // Checklists cache
      if (!database.objectStoreNames.contains(STORES.CHECKLISTS)) {
        const clStore = database.createObjectStore(STORES.CHECKLISTS, { keyPath: 'id' })
        clStore.createIndex('created_by', 'created_by', { unique: false })
        clStore.createIndex('store_id', 'store_id', { unique: false })
        clStore.createIndex('status', 'status', { unique: false })
      }

      // Checklist responses cache
      if (!database.objectStoreNames.contains(STORES.CHECKLIST_RESPONSES)) {
        const crStore = database.createObjectStore(STORES.CHECKLIST_RESPONSES, { keyPath: 'id' })
        crStore.createIndex('checklist_id', 'checklist_id', { unique: false })
      }

      // Checklist sections cache
      if (!database.objectStoreNames.contains(STORES.CHECKLIST_SECTIONS)) {
        const csStore = database.createObjectStore(STORES.CHECKLIST_SECTIONS, { keyPath: 'id' })
        csStore.createIndex('checklist_id', 'checklist_id', { unique: false })
      }

      // User stores cache (multi-loja)
      if (!database.objectStoreNames.contains(STORES.USER_STORES)) {
        const usStore = database.createObjectStore(STORES.USER_STORES, { keyPath: 'id' })
        usStore.createIndex('user_id', 'user_id', { unique: false })
      }

      // Action plans cache
      if (!database.objectStoreNames.contains(STORES.ACTION_PLANS)) {
        const apStore = database.createObjectStore(STORES.ACTION_PLANS, { keyPath: 'id' })
        apStore.createIndex('assigned_to', 'assigned_to', { unique: false })
        apStore.createIndex('store_id', 'store_id', { unique: false })
        apStore.createIndex('status', 'status', { unique: false })
      }

      // Sync metadata
      if (!database.objectStoreNames.contains(STORES.SYNC_META)) {
        database.createObjectStore(STORES.SYNC_META, { keyPath: 'id' })
      }

    }
  })
}

// ============================================
// AUTH CACHE
// ============================================

/** Salva os tokens de sessão do Supabase no cache offline. Substitui qualquer sessão anterior. */
export async function saveAuthCache(auth: Omit<CachedAuth, 'id' | 'cachedAt'>): Promise<void> {
  const database = await initOfflineCache()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.AUTH], 'readwrite')
    const store = transaction.objectStore(STORES.AUTH)

    const data: CachedAuth = {
      ...auth,
      id: 'current',
      cachedAt: new Date().toISOString(),
    }

    const request = store.put(data)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

/** Retorna a sessão cacheada offline ou `null` se não houver. */
export async function getAuthCache(): Promise<CachedAuth | null> {
  const database = await initOfflineCache()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.AUTH], 'readonly')
    const store = transaction.objectStore(STORES.AUTH)
    const request = store.get('current')

    request.onsuccess = () => {
      resolve(request.result || null)
    }
    request.onerror = () => reject(request.error)
  })
}

/** Remove a sessão cacheada offline. Chamado após logout. */
export async function clearAuthCache(): Promise<void> {
  const database = await initOfflineCache()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.AUTH], 'readwrite')
    const store = transaction.objectStore(STORES.AUTH)
    const request = store.delete('current')

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

// ============================================
// USER CACHE
// ============================================

/** Salva o perfil do usuário no cache offline. */
export async function saveUserCache(user: User): Promise<void> {
  const database = await initOfflineCache()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.USER], 'readwrite')
    const store = transaction.objectStore(STORES.USER)

    const data: CachedUser = {
      ...user,
      cachedAt: new Date().toISOString(),
    }

    const request = store.put(data)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

/** Busca o perfil de um usuário específico no cache offline. */
export async function getUserCache(userId: string): Promise<CachedUser | null> {
  const database = await initOfflineCache()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.USER], 'readonly')
    const store = transaction.objectStore(STORES.USER)
    const request = store.get(userId)

    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  })
}

/** Retorna todos os usuários cacheados offline (usado pelo admin offline). */
export async function getAllUsersCache(): Promise<CachedUser[]> {
  const database = await initOfflineCache()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.USER], 'readonly')
    const store = transaction.objectStore(STORES.USER)
    const request = store.getAll()

    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })
}

// ============================================
// STORES CACHE
// ============================================

/** Sobrescreve todo o cache de lojas (clear + insert). */
export async function saveStoresCache(stores: Store[]): Promise<void> {
  const database = await initOfflineCache()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.STORES], 'readwrite')
    const store = transaction.objectStore(STORES.STORES)

    // Limpa stores antigos e adiciona novos
    const clearRequest = store.clear()

    clearRequest.onsuccess = () => {
      const now = new Date().toISOString()
      let completed = 0

      if (stores.length === 0) {
        resolve()
        return
      }

      stores.forEach(s => {
        const data: CachedStore = { ...s, cachedAt: now }
        const addRequest = store.add(data)

        addRequest.onsuccess = () => {
          completed++
          if (completed === stores.length) resolve()
        }
        addRequest.onerror = () => reject(addRequest.error)
      })
    }

    clearRequest.onerror = () => reject(clearRequest.error)
  })
}

/** Retorna todas as lojas cacheadas offline. */
export async function getStoresCache(): Promise<CachedStore[]> {
  const database = await initOfflineCache()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.STORES], 'readonly')
    const store = transaction.objectStore(STORES.STORES)
    const request = store.getAll()

    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })
}

// ============================================
// TEMPLATES CACHE
// ============================================

/** Sobrescreve todo o cache de templates de checklist (clear + insert). */
export async function saveTemplatesCache(templates: ChecklistTemplate[]): Promise<void> {
  const database = await initOfflineCache()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.TEMPLATES], 'readwrite')
    const store = transaction.objectStore(STORES.TEMPLATES)

    const clearRequest = store.clear()

    clearRequest.onsuccess = () => {
      const now = new Date().toISOString()
      let completed = 0

      if (templates.length === 0) {
        resolve()
        return
      }

      templates.forEach(t => {
        const data: CachedTemplate = { ...t, cachedAt: now }
        const addRequest = store.add(data)

        addRequest.onsuccess = () => {
          completed++
          if (completed === templates.length) resolve()
        }
        addRequest.onerror = () => reject(addRequest.error)
      })
    }

    clearRequest.onerror = () => reject(clearRequest.error)
  })
}

/** Retorna todos os templates de checklist cacheados offline. */
export async function getTemplatesCache(): Promise<CachedTemplate[]> {
  const database = await initOfflineCache()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.TEMPLATES], 'readonly')
    const store = transaction.objectStore(STORES.TEMPLATES)
    const request = store.getAll()

    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })
}

// ============================================
// TEMPLATE FIELDS CACHE
// ============================================

/** Sobrescreve todo o cache de campos de template (clear + insert). */
export async function saveTemplateFieldsCache(fields: TemplateField[]): Promise<void> {
  const database = await initOfflineCache()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.TEMPLATE_FIELDS], 'readwrite')
    const store = transaction.objectStore(STORES.TEMPLATE_FIELDS)

    const clearRequest = store.clear()

    clearRequest.onsuccess = () => {
      const now = new Date().toISOString()
      let completed = 0

      if (fields.length === 0) {
        resolve()
        return
      }

      fields.forEach(f => {
        const data: CachedTemplateField = { ...f, cachedAt: now }
        const addRequest = store.add(data)

        addRequest.onsuccess = () => {
          completed++
          if (completed === fields.length) resolve()
        }
        addRequest.onerror = () => reject(addRequest.error)
      })
    }

    clearRequest.onerror = () => reject(clearRequest.error)
  })
}

/** Retorna os campos cacheados de um template específico, indexados por `template_id`. */
export async function getTemplateFieldsCache(templateId: number): Promise<CachedTemplateField[]> {
  const database = await initOfflineCache()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.TEMPLATE_FIELDS], 'readonly')
    const store = transaction.objectStore(STORES.TEMPLATE_FIELDS)
    const index = store.index('template_id')
    const request = index.getAll(templateId)

    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })
}

// ============================================
// SECTORS CACHE
// ============================================

/** Sobrescreve todo o cache de setores (clear + insert). */
export async function saveSectorsCache(sectors: Sector[]): Promise<void> {
  const database = await initOfflineCache()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.SECTORS], 'readwrite')
    const store = transaction.objectStore(STORES.SECTORS)

    const clearRequest = store.clear()

    clearRequest.onsuccess = () => {
      const now = new Date().toISOString()
      let completed = 0

      if (sectors.length === 0) {
        resolve()
        return
      }

      sectors.forEach(s => {
        const data: CachedSector = { ...s, cachedAt: now }
        const addRequest = store.add(data)

        addRequest.onsuccess = () => {
          completed++
          if (completed === sectors.length) resolve()
        }
        addRequest.onerror = () => reject(addRequest.error)
      })
    }

    clearRequest.onerror = () => reject(clearRequest.error)
  })
}

/**
 * Retorna setores cacheados offline.
 * Se `storeId` fornecido, filtra pelo índice `store_id`; caso contrário retorna todos.
 */
export async function getSectorsCache(storeId?: number): Promise<CachedSector[]> {
  const database = await initOfflineCache()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.SECTORS], 'readonly')
    const store = transaction.objectStore(STORES.SECTORS)

    if (storeId !== undefined) {
      const index = store.index('store_id')
      const request = index.getAll(storeId)
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    } else {
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    }
  })
}

// ============================================
// FUNCTIONS CACHE
// ============================================

/** Sobrescreve todo o cache de funções de cargo (clear + insert). */
export async function saveFunctionsCache(functions: FunctionRow[]): Promise<void> {
  const database = await initOfflineCache()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.FUNCTIONS], 'readwrite')
    const store = transaction.objectStore(STORES.FUNCTIONS)

    const clearRequest = store.clear()

    clearRequest.onsuccess = () => {
      const now = new Date().toISOString()
      let completed = 0

      if (functions.length === 0) {
        resolve()
        return
      }

      functions.forEach(f => {
        const data: CachedFunction = { ...f, cachedAt: now }
        const addRequest = store.add(data)

        addRequest.onsuccess = () => {
          completed++
          if (completed === functions.length) resolve()
        }
        addRequest.onerror = () => reject(addRequest.error)
      })
    }

    clearRequest.onerror = () => reject(clearRequest.error)
  })
}

/** Retorna todas as funções de cargo cacheadas offline. */
export async function getFunctionsCache(): Promise<CachedFunction[]> {
  const database = await initOfflineCache()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.FUNCTIONS], 'readonly')
    const store = transaction.objectStore(STORES.FUNCTIONS)
    const request = store.getAll()

    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })
}

// ============================================
// TEMPLATE VISIBILITY CACHE
// ============================================

/** Sobrescreve todo o cache de visibilidade de templates por loja (clear + insert). */
export async function saveTemplateVisibilityCache(rows: TemplateVisibility[]): Promise<void> {
  const database = await initOfflineCache()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.TEMPLATE_VISIBILITY], 'readwrite')
    const store = transaction.objectStore(STORES.TEMPLATE_VISIBILITY)

    const clearRequest = store.clear()
    clearRequest.onsuccess = () => {
      const now = new Date().toISOString()
      let completed = 0
      if (rows.length === 0) { resolve(); return }

      rows.forEach(r => {
        const data: CachedTemplateVisibility = { ...r, cachedAt: now }
        const addRequest = store.add(data)
        addRequest.onsuccess = () => { completed++; if (completed === rows.length) resolve() }
        addRequest.onerror = () => reject(addRequest.error)
      })
    }
    clearRequest.onerror = () => reject(clearRequest.error)
  })
}

/** Retorna todo o mapa de visibilidade template→loja cacheado offline. */
export async function getTemplateVisibilityCache(): Promise<CachedTemplateVisibility[]> {
  const database = await initOfflineCache()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.TEMPLATE_VISIBILITY], 'readonly')
    const store = transaction.objectStore(STORES.TEMPLATE_VISIBILITY)
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })
}

// ============================================
// TEMPLATE SECTIONS CACHE
// ============================================

/** Sobrescreve todo o cache de seções de templates (clear + insert). */
export async function saveTemplateSectionsCache(sections: TemplateSection[]): Promise<void> {
  const database = await initOfflineCache()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.TEMPLATE_SECTIONS], 'readwrite')
    const store = transaction.objectStore(STORES.TEMPLATE_SECTIONS)

    const clearRequest = store.clear()
    clearRequest.onsuccess = () => {
      const now = new Date().toISOString()
      let completed = 0
      if (sections.length === 0) { resolve(); return }

      sections.forEach(s => {
        const data: CachedTemplateSection = { ...s, cachedAt: now }
        const addRequest = store.add(data)
        addRequest.onsuccess = () => { completed++; if (completed === sections.length) resolve() }
        addRequest.onerror = () => reject(addRequest.error)
      })
    }
    clearRequest.onerror = () => reject(clearRequest.error)
  })
}

/**
 * Retorna seções de templates cacheadas offline.
 * Se `templateId` fornecido, filtra pelo índice `template_id`; caso contrário retorna todas.
 */
export async function getTemplateSectionsCache(templateId?: number): Promise<CachedTemplateSection[]> {
  const database = await initOfflineCache()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.TEMPLATE_SECTIONS], 'readonly')
    const store = transaction.objectStore(STORES.TEMPLATE_SECTIONS)

    if (templateId !== undefined) {
      const index = store.index('template_id')
      const request = index.getAll(templateId)
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    } else {
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    }
  })
}

// ============================================
// CHECKLISTS CACHE
// ============================================

/** Sobrescreve o cache de checklists com dados denormalizados (template_name, store_name, etc.). */
export async function saveChecklistsCache(checklists: CachedChecklist[]): Promise<void> {
  const database = await initOfflineCache()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.CHECKLISTS], 'readwrite')
    const store = transaction.objectStore(STORES.CHECKLISTS)

    const clearRequest = store.clear()
    clearRequest.onsuccess = () => {
      const now = new Date().toISOString()
      let completed = 0
      if (checklists.length === 0) { resolve(); return }

      checklists.forEach(c => {
        const data = { ...c, cachedAt: now }
        const addRequest = store.add(data)
        addRequest.onsuccess = () => { completed++; if (completed === checklists.length) resolve() }
        addRequest.onerror = () => reject(addRequest.error)
      })
    }
    clearRequest.onerror = () => reject(clearRequest.error)
  })
}

/** Retorna todos os checklists cacheados offline (inclui dados denormalizados). */
export async function getChecklistsCache(): Promise<CachedChecklist[]> {
  const database = await initOfflineCache()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.CHECKLISTS], 'readonly')
    const store = transaction.objectStore(STORES.CHECKLISTS)
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })
}

// ============================================
// CHECKLIST RESPONSES CACHE
// ============================================

/** Sobrescreve o cache de respostas de checklists (clear + insert). */
export async function saveChecklistResponsesCache(responses: ChecklistResponse[]): Promise<void> {
  const database = await initOfflineCache()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.CHECKLIST_RESPONSES], 'readwrite')
    const store = transaction.objectStore(STORES.CHECKLIST_RESPONSES)

    const clearRequest = store.clear()
    clearRequest.onsuccess = () => {
      const now = new Date().toISOString()
      let completed = 0
      if (responses.length === 0) { resolve(); return }

      responses.forEach(r => {
        const data: CachedChecklistResponse = { ...r, cachedAt: now }
        const addRequest = store.add(data)
        addRequest.onsuccess = () => { completed++; if (completed === responses.length) resolve() }
        addRequest.onerror = () => reject(addRequest.error)
      })
    }
    clearRequest.onerror = () => reject(clearRequest.error)
  })
}

/**
 * Retorna respostas de checklists cacheadas offline.
 * Se `checklistId` fornecido, filtra pelo índice `checklist_id`; caso contrário retorna todas.
 */
export async function getChecklistResponsesCache(checklistId?: number): Promise<CachedChecklistResponse[]> {
  const database = await initOfflineCache()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.CHECKLIST_RESPONSES], 'readonly')
    const store = transaction.objectStore(STORES.CHECKLIST_RESPONSES)

    if (checklistId !== undefined) {
      const index = store.index('checklist_id')
      const request = index.getAll(checklistId)
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    } else {
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    }
  })
}

// ============================================
// CHECKLIST SECTIONS CACHE
// ============================================

/** Sobrescreve o cache de seções de checklists preenchidos (clear + insert). */
export async function saveChecklistSectionsCache(sections: ChecklistSectionRow[]): Promise<void> {
  const database = await initOfflineCache()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.CHECKLIST_SECTIONS], 'readwrite')
    const store = transaction.objectStore(STORES.CHECKLIST_SECTIONS)

    const clearRequest = store.clear()
    clearRequest.onsuccess = () => {
      const now = new Date().toISOString()
      let completed = 0
      if (sections.length === 0) { resolve(); return }

      sections.forEach(s => {
        const data: CachedChecklistSection = { ...s, cachedAt: now }
        const addRequest = store.add(data)
        addRequest.onsuccess = () => { completed++; if (completed === sections.length) resolve() }
        addRequest.onerror = () => reject(addRequest.error)
      })
    }
    clearRequest.onerror = () => reject(clearRequest.error)
  })
}

/**
 * Retorna seções de checklists cacheadas offline.
 * Se `checklistId` fornecido, filtra pelo índice `checklist_id`; caso contrário retorna todas.
 */
export async function getChecklistSectionsCache(checklistId?: number): Promise<CachedChecklistSection[]> {
  const database = await initOfflineCache()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.CHECKLIST_SECTIONS], 'readonly')
    const store = transaction.objectStore(STORES.CHECKLIST_SECTIONS)

    if (checklistId !== undefined) {
      const index = store.index('checklist_id')
      const request = index.getAll(checklistId)
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    } else {
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    }
  })
}

// ============================================
// USER STORES CACHE (multi-loja)
// ============================================

/** Sobrescreve o cache de vínculos usuário↔loja (clear + insert). */
export async function saveUserStoresCache(userStores: UserStore[]): Promise<void> {
  const database = await initOfflineCache()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.USER_STORES], 'readwrite')
    const store = transaction.objectStore(STORES.USER_STORES)

    const clearRequest = store.clear()
    clearRequest.onsuccess = () => {
      const now = new Date().toISOString()
      let completed = 0
      if (userStores.length === 0) { resolve(); return }

      userStores.forEach(us => {
        const data: CachedUserStore = { ...us, cachedAt: now }
        const addRequest = store.add(data)
        addRequest.onsuccess = () => { completed++; if (completed === userStores.length) resolve() }
        addRequest.onerror = () => reject(addRequest.error)
      })
    }
    clearRequest.onerror = () => reject(clearRequest.error)
  })
}

/**
 * Retorna vínculos usuário↔loja cacheados offline.
 * Se `userId` fornecido, filtra pelo índice `user_id`; caso contrário retorna todos.
 */
export async function getUserStoresCache(userId?: string): Promise<CachedUserStore[]> {
  const database = await initOfflineCache()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.USER_STORES], 'readonly')
    const store = transaction.objectStore(STORES.USER_STORES)

    if (userId !== undefined) {
      const index = store.index('user_id')
      const request = index.getAll(userId)
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    } else {
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    }
  })
}

// ============================================
// ACTION PLANS CACHE
// ============================================

/** Sobrescreve o cache de planos de ação com dados denormalizados (clear + insert). */
export async function saveActionPlansCache(plans: CachedActionPlan[]): Promise<void> {
  const database = await initOfflineCache()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.ACTION_PLANS], 'readwrite')
    const store = transaction.objectStore(STORES.ACTION_PLANS)

    const clearRequest = store.clear()
    clearRequest.onsuccess = () => {
      const now = new Date().toISOString()
      let completed = 0
      if (plans.length === 0) { resolve(); return }

      plans.forEach(p => {
        const data = { ...p, cachedAt: now }
        const addRequest = store.add(data)
        addRequest.onsuccess = () => { completed++; if (completed === plans.length) resolve() }
        addRequest.onerror = () => reject(addRequest.error)
      })
    }
    clearRequest.onerror = () => reject(clearRequest.error)
  })
}

/**
 * Retorna planos de ação cacheados offline.
 * Se `userId` fornecido, filtra pelo índice `assigned_to`; caso contrário retorna todos.
 */
export async function getActionPlansCache(userId?: string): Promise<CachedActionPlan[]> {
  const database = await initOfflineCache()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.ACTION_PLANS], 'readonly')
    const store = transaction.objectStore(STORES.ACTION_PLANS)

    if (userId !== undefined) {
      const index = store.index('assigned_to')
      const request = index.getAll(userId)
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    } else {
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    }
  })
}

// ============================================
// SYNC METADATA
// ============================================

/** Salva ou atualiza metadados de sincronização para uma chave específica (ex: `'full_sync'`). */
export async function saveSyncMetadata(key: string, status: SyncMetadata['syncStatus']): Promise<void> {
  const database = await initOfflineCache()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.SYNC_META], 'readwrite')
    const store = transaction.objectStore(STORES.SYNC_META)

    const data: SyncMetadata = {
      id: key,
      lastSyncAt: new Date().toISOString(),
      syncStatus: status,
    }

    const request = store.put(data)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

/** Retorna os metadados de sincronização para uma chave, ou `null` se inexistente. */
export async function getSyncMetadata(key: string): Promise<SyncMetadata | null> {
  const database = await initOfflineCache()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORES.SYNC_META], 'readonly')
    const store = transaction.objectStore(STORES.SYNC_META)
    const request = store.get(key)

    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  })
}

// ============================================
// CLEAR ALL CACHE
// ============================================

/**
 * Limpa todos os 16 object stores do IndexedDB em uma única transação.
 * Chamado durante o logout para garantir que nenhum dado do usuário
 * permaneça no dispositivo após o encerramento da sessão.
 */
export async function clearAllCache(): Promise<void> {
  const database = await initOfflineCache()

  const storeNames = Object.values(STORES)

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeNames, 'readwrite')

    let completed = 0

    storeNames.forEach(storeName => {
      const store = transaction.objectStore(storeName)
      const request = store.clear()

      request.onsuccess = () => {
        completed++
        if (completed === storeNames.length) resolve()
      }

      request.onerror = () => reject(request.error)
    })
  })
}

// ============================================
// CHECK IF HAS CACHED DATA
// ============================================

/**
 * Verifica se existe cache de autenticação no IndexedDB.
 * Usado para decidir se o modo offline pode ser ativado sem conectividade.
 * @returns `true` se houver sessão cacheada, `false` caso contrário ou em caso de erro.
 */
export async function hasCachedData(): Promise<boolean> {
  try {
    const auth = await getAuthCache()
    return auth !== null
  } catch {
    return false
  }
}

// ============================================
// CACHE ALL DATA FOR OFFLINE (chamado após login)
// ============================================

import { createClient } from './supabase'

/**
 * Cacheia todos os dados necessários para funcionamento offline.
 * Deve ser chamado logo após o login bem-sucedido.
 *
 * Pipeline de 14 etapas (na ordem de execução):
 * 1. Sessão de autenticação (access_token, refresh_token)
 * 2. Perfil do usuário logado
 * 3. Todas as lojas (`stores`)
 * 4. Templates ativos (`checklist_templates`)
 * 5. Campos de todos os templates (`template_fields`)
 * 6. Setores (`sectors`)
 * 7. Funções ativas (`functions`)
 * 8. Todos os usuários — somente se `is_admin = true`
 * 9. Visibilidade de templates (`template_visibility`)
 * 10. Seções de templates (`template_sections`)
 * 11. Lojas do usuário atual (`user_stores`)
 * 12. Últimos 50 checklists (admin vê todos; operador vê apenas os próprios)
 * 13. Respostas e seções dos checklists cacheados
 * 14. Planos de ação (admin: últimos 200; operador: apenas atribuídos)
 *
 * Em caso de falha em qualquer etapa, registra `syncStatus = 'failed'` e encerra silenciosamente.
 *
 * @param userId - ID do usuário autenticado (usado para filtrar dados por permissão)
 */
export async function cacheAllDataForOffline(userId: string): Promise<void> {
  try {
    const supabase = createClient()

    // 1. Salva auth
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      await saveAuthCache({
        userId: session.user.id,
        email: session.user.email || '',
        accessToken: session.access_token,
        refreshToken: session.refresh_token || '',
        expiresAt: session.expires_at || 0,
      })
    }

    // 2. Busca e salva perfil do usuário
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: userData } = await (supabase as any)
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (userData) {
      await saveUserCache(userData as User)
    }

    // 3. Busca e salva TODAS as lojas (não só ativas, para admin)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: storesData } = await (supabase as any)
      .from('stores')
      .select('*')
      .order('name')

    if (storesData && storesData.length > 0) {
      await saveStoresCache(storesData as Store[])
    }

    // 4. Busca e salva templates ativos
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: templatesData } = await (supabase as any)
      .from('checklist_templates')
      .select('*')
      .eq('is_active', true)
      .order('name')

    if (templatesData && templatesData.length > 0) {
      await saveTemplatesCache(templatesData as ChecklistTemplate[])
    }

    // 5. Busca e salva campos dos templates
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: fieldsData } = await (supabase as any)
      .from('template_fields')
      .select('*')
      .order('sort_order')

    if (fieldsData && fieldsData.length > 0) {
      await saveTemplateFieldsCache(fieldsData as TemplateField[])
    }

    // 6. Busca e salva setores
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: sectorsData } = await (supabase as any)
      .from('sectors')
      .select('*')

    if (sectorsData && sectorsData.length > 0) {
      await saveSectorsCache(sectorsData as Sector[])
    }

    // 7. Busca e salva funções
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: functionsData } = await (supabase as any)
      .from('functions')
      .select('*')
      .eq('is_active', true)

    if (functionsData && functionsData.length > 0) {
      await saveFunctionsCache(functionsData as FunctionRow[])
    }

    // 8. Se for admin, busca e salva TODOS os usuários
    if (userData?.is_admin) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: allUsersData } = await (supabase as any)
        .from('users')
        .select('*')
        .order('full_name')

      if (allUsersData && allUsersData.length > 0) {
        for (const user of allUsersData) {
          await saveUserCache(user as User)
        }
      }
    }

    // 9. Busca e salva visibilidade dos templates
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: visibilityData } = await (supabase as any)
      .from('template_visibility')
      .select('*')

    if (visibilityData && visibilityData.length > 0) {
      await saveTemplateVisibilityCache(visibilityData as TemplateVisibility[])
    }

    // 10. Busca e salva secoes dos templates
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: sectionsData } = await (supabase as any)
      .from('template_sections')
      .select('*')
      .order('sort_order')

    if (sectionsData && sectionsData.length > 0) {
      await saveTemplateSectionsCache(sectionsData as TemplateSection[])
    }

    // 11. Busca e salva user_stores do usuario (multi-loja)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: userStoresData } = await (supabase as any)
      .from('user_stores')
      .select('*')
      .eq('user_id', userId)

    if (userStoresData && userStoresData.length > 0) {
      await saveUserStoresCache(userStoresData as UserStore[])
    }

    // 12. Busca e salva checklists recentes do usuario (max 50)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let checklistQuery = (supabase as any)
      .from('checklists')
      .select(`
        *,
        template:checklist_templates(id, name, category),
        store:stores(id, name),
        sector:sectors(id, name),
        user:users!checklists_created_by_fkey(id, full_name)
      `)
      .order('created_at', { ascending: false })
      .limit(50)

    if (!userData?.is_admin) {
      checklistQuery = checklistQuery.eq('created_by', userId)
    }

    const { data: checklistsData } = await checklistQuery

    if (checklistsData && checklistsData.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const checklistsToCache: CachedChecklist[] = checklistsData.map((c: any) => ({
        id: c.id,
        template_id: c.template_id,
        store_id: c.store_id,
        sector_id: c.sector_id,
        status: c.status,
        created_by: c.created_by,
        started_at: c.started_at,
        completed_at: c.completed_at,
        validated_by: c.validated_by,
        validated_at: c.validated_at,
        latitude: c.latitude,
        longitude: c.longitude,
        accuracy: c.accuracy,
        sync_status: c.sync_status,
        created_at: c.created_at,
        cachedAt: new Date().toISOString(),
        template_name: c.template?.name,
        template_category: c.template?.category,
        store_name: c.store?.name,
        sector_name: c.sector?.name,
        user_name: c.user?.full_name,
      }))

      await saveChecklistsCache(checklistsToCache)

      // 13. Busca responses e sections dos checklists cacheados
      const checklistIds = checklistsToCache.map(c => c.id)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: responsesData } = await (supabase as any)
        .from('checklist_responses')
        .select('*')
        .in('checklist_id', checklistIds)

      if (responsesData && responsesData.length > 0) {
        await saveChecklistResponsesCache(responsesData as ChecklistResponse[])
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: clSectionsData } = await (supabase as any)
        .from('checklist_sections')
        .select('*')
        .in('checklist_id', checklistIds)

      if (clSectionsData && clSectionsData.length > 0) {
        await saveChecklistSectionsCache(clSectionsData as ChecklistSectionRow[])
      }
    }

    // 14. Busca e salva planos de acao (para admin: todos; para usuario: somente atribuidos)
    // Sem FK-disambiguated join (users!action_plans_assigned_to_fkey falha com 400)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let apQuery = (supabase as any)
      .from('action_plans')
      .select(`
        id, checklist_id, field_id, template_id, store_id, sector_id,
        title, description, severity, status, assigned_to, assigned_by,
        deadline, is_reincidencia, reincidencia_count, parent_action_plan_id,
        non_conformity_value, created_by, created_at, updated_at,
        store:stores(name),
        template:checklist_templates(name),
        field:template_fields(name)
      `)
      .order('created_at', { ascending: false })
      .limit(200)

    if (!userData?.is_admin) {
      apQuery = apQuery.eq('assigned_to', userId)
    }

    const { data: actionPlansData } = await apQuery

    if (actionPlansData && actionPlansData.length > 0) {
      // Buscar nomes dos responsaveis separadamente (evita FK-disambiguated join)
      const assigneeIds = [...new Set(actionPlansData.map((p: { assigned_to: string }) => p.assigned_to).filter(Boolean))]
      let assigneeMap = new Map<string, string>()
      if (assigneeIds.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: assignees } = await (supabase as any)
          .from('users')
          .select('id, full_name')
          .in('id', assigneeIds)
        if (assignees) {
          assigneeMap = new Map(assignees.map((u: { id: string; full_name: string }) => [u.id, u.full_name]))
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const plansToCache: CachedActionPlan[] = actionPlansData.map((p: any) => ({
        id: p.id,
        checklist_id: p.checklist_id,
        field_id: p.field_id,
        template_id: p.template_id,
        store_id: p.store_id,
        sector_id: p.sector_id,
        title: p.title,
        description: p.description,
        severity: p.severity,
        status: p.status,
        assigned_to: p.assigned_to,
        assigned_by: p.assigned_by,
        deadline: p.deadline,
        is_reincidencia: p.is_reincidencia,
        reincidencia_count: p.reincidencia_count,
        parent_action_plan_id: p.parent_action_plan_id,
        non_conformity_value: p.non_conformity_value,
        created_by: p.created_by,
        created_at: p.created_at,
        updated_at: p.updated_at,
        store_name: p.store?.name,
        template_name: p.template?.name,
        field_name: p.field?.name,
        assignee_name: assigneeMap.get(p.assigned_to) || null,
        cachedAt: new Date().toISOString(),
      }))

      await saveActionPlansCache(plansToCache)
    }

    // Salva metadata de sync
    await saveSyncMetadata('full_sync', 'success')
  } catch {
    await saveSyncMetadata('full_sync', 'failed')
  }
}
