/**
 * Armazenamento offline via IndexedDB (`nocheck-offline`).
 *
 * Gerencia a fila de checklists pendentes de sincronização com o servidor.
 * Cada checklist salvo offline recebe um UUID local e um `syncStatus` que
 * avança de `draft` → `pending` → `syncing` → (removido após sync bem-sucedido).
 */

const DB_NAME = 'nocheck-offline'
const DB_VERSION = 1
const STORE_NAME = 'pending_checklists'

/** Dados de uma seção de checklist com etapas salva offline. */
type PendingChecklistSection = {
  sectionId: number
  status: 'pendente' | 'concluido'
  completedAt: string | null
  responses: Array<{
    fieldId: number
    valueText: string | null
    valueNumber: number | null
    valueJson: unknown
  }>
}

/** Checklist salvo localmente aguardando sincronização com o servidor. */
type PendingChecklist = {
  id: string // UUID local
  templateId: number
  storeId: number
  sectorId: number | null
  userId: string
  dbChecklistId?: number | null // ID do checklist no DB (quando iniciado online)
  responses: Array<{
    fieldId: number
    valueText: string | null
    valueNumber: number | null
    valueJson: unknown
  }>
  createdAt: string
  syncStatus: 'draft' | 'pending' | 'syncing' | 'failed'
  errorMessage?: string
  // Suporte a checklists com etapas (offline)
  sections?: PendingChecklistSection[]
}

/** Instância singleton do banco IndexedDB. Criada na primeira chamada a `initDB`. */
let db: IDBDatabase | null = null

/**
 * Abre (ou reutiliza) a conexão com o IndexedDB `nocheck-offline`.
 * Cria a object store `pending_checklists` se ainda não existir.
 *
 * @returns Instância do banco de dados pronta para uso
 */
export async function initDB(): Promise<IDBDatabase> {
  if (db) return db

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)

    request.onsuccess = () => {
      db = request.result
      resolve(db)
    }

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result

      // Cria a object store para checklists pendentes (somente na primeira abertura)
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('syncStatus', 'syncStatus', { unique: false })
        store.createIndex('createdAt', 'createdAt', { unique: false })
      }
    }
  })
}

/**
 * Salva um checklist na fila offline com status `draft`.
 * Gera um UUID local como identificador temporário.
 *
 * @param checklist - Dados do checklist sem `id`, `createdAt` e `syncStatus` (gerados automaticamente)
 * @returns UUID local do checklist salvo
 */
export async function saveOfflineChecklist(checklist: Omit<PendingChecklist, 'id' | 'createdAt' | 'syncStatus'>): Promise<string> {
  const database = await initDB()

  const id = crypto.randomUUID()
  const pendingChecklist: PendingChecklist = {
    ...checklist,
    id,
    createdAt: new Date().toISOString(),
    syncStatus: 'draft',
  }

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.add(pendingChecklist)

    request.onsuccess = () => {
      resolve(id)
    }

    request.onerror = () => reject(request.error)
  })
}

/**
 * Retorna todos os checklists offline armazenados (qualquer status).
 *
 * @returns Lista de checklists pendentes em ordem de inserção
 */
export async function getPendingChecklists(): Promise<PendingChecklist[]> {
  const database = await initDB()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.getAll()

    request.onsuccess = () => {
      resolve(request.result as PendingChecklist[])
    }

    request.onerror = () => reject(request.error)
  })
}

/**
 * Retorna a contagem de checklists com status `pending` (prontos para sincronizar).
 *
 * @returns Número de checklists aguardando envio
 */
export async function getPendingCount(): Promise<number> {
  const database = await initDB()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const index = store.index('syncStatus')
    const request = index.count(IDBKeyRange.only('pending'))

    request.onsuccess = () => {
      resolve(request.result)
    }

    request.onerror = () => {
      reject(request.error)
    }
  })
}

/**
 * Atualiza o `syncStatus` de um checklist offline.
 * Opcionalmente registra uma mensagem de erro em caso de falha.
 *
 * @param id           - UUID local do checklist
 * @param status       - Novo status de sincronização
 * @param errorMessage - Mensagem de erro (somente para status `failed`)
 */
export async function updateChecklistStatus(
  id: string,
  status: PendingChecklist['syncStatus'],
  errorMessage?: string
): Promise<void> {
  const database = await initDB()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const getRequest = store.get(id)

    getRequest.onsuccess = () => {
      const checklist = getRequest.result as PendingChecklist
      if (checklist) {
        checklist.syncStatus = status
        if (errorMessage) checklist.errorMessage = errorMessage

        const updateRequest = store.put(checklist)
        updateRequest.onsuccess = () => resolve()
        updateRequest.onerror = () => reject(updateRequest.error)
      } else {
        resolve()
      }
    }

    getRequest.onerror = () => reject(getRequest.error)
  })
}

/**
 * Remove um checklist da fila offline pelo UUID local.
 * Chamado após sincronização bem-sucedida.
 *
 * @param id - UUID local do checklist a remover
 */
export async function deleteOfflineChecklist(id: string): Promise<void> {
  const database = await initDB()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.delete(id)

    request.onsuccess = () => {
      resolve()
    }

    request.onerror = () => reject(request.error)
  })
}

/**
 * Remove todos os checklists offline do IndexedDB.
 * Chamado durante o logout para limpar dados do usuário.
 */
export async function clearOfflineData(): Promise<void> {
  const database = await initDB()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.clear()

    request.onsuccess = () => {
      resolve()
    }

    request.onerror = () => reject(request.error)
  })
}

/**
 * Busca um único checklist offline pelo UUID local.
 *
 * @param id - UUID local do checklist
 * @returns O checklist encontrado ou `null` se não existir
 */
export async function getOfflineChecklist(id: string): Promise<PendingChecklist | null> {
  const database = await initDB()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.get(id)

    request.onsuccess = () => {
      resolve(request.result as PendingChecklist | null)
    }
    request.onerror = () => reject(request.error)
  })
}

/**
 * Atualiza as respostas de uma seção em um checklist offline com etapas.
 * Quando todas as seções ficam com status `concluido`, consolida as respostas
 * no campo principal e marca o checklist como `pending` para sincronização.
 *
 * @param checklistId - UUID local do checklist pai
 * @param sectionId   - ID da seção a atualizar
 * @param responses   - Novas respostas da seção
 */
export async function updateOfflineChecklistSection(
  checklistId: string,
  sectionId: number,
  responses: PendingChecklistSection['responses']
): Promise<void> {
  const database = await initDB()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const getRequest = store.get(checklistId)

    getRequest.onsuccess = () => {
      const checklist = getRequest.result as PendingChecklist
      if (!checklist || !checklist.sections) {
        reject(new Error('Checklist ou secoes nao encontrados'))
        return
      }

      // Atualiza a secao
      checklist.sections = checklist.sections.map(s =>
        s.sectionId === sectionId
          ? { ...s, status: 'concluido' as const, completedAt: new Date().toISOString(), responses }
          : s
      )

      // Se todas as secoes estao concluidas, marca como pending para sync
      const allDone = checklist.sections.every(s => s.status === 'concluido')
      if (allDone) {
        // Consolida todas as responses das secoes no campo principal
        checklist.responses = checklist.sections.flatMap(s => s.responses)
        checklist.syncStatus = 'pending'
      }

      const updateRequest = store.put(checklist)
      updateRequest.onsuccess = () => {
        resolve()
      }
      updateRequest.onerror = () => reject(updateRequest.error)
    }

    getRequest.onerror = () => reject(getRequest.error)
  })
}

/**
 * Atualiza a resposta de um campo individual em um checklist offline (auto-save).
 * Funciona tanto para checklists com etapas quanto sem.
 * Se a resposta do campo já existe, substitui; caso contrário, adiciona.
 *
 * @param checklistId  - UUID local do checklist
 * @param sectionId    - ID da seção (ou `null` para checklists sem etapas)
 * @param fieldId      - ID do campo a atualizar
 * @param responseData - Novos valores da resposta
 */
export async function updateOfflineFieldResponse(
  checklistId: string,
  sectionId: number | null,
  fieldId: number,
  responseData: { valueText: string | null; valueNumber: number | null; valueJson: unknown }
): Promise<void> {
  const database = await initDB()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const getRequest = store.get(checklistId)

    getRequest.onsuccess = () => {
      const checklist = getRequest.result as PendingChecklist
      if (!checklist) {
        reject(new Error('Checklist nao encontrado'))
        return
      }

      const newEntry = {
        fieldId,
        valueText: responseData.valueText,
        valueNumber: responseData.valueNumber,
        valueJson: responseData.valueJson,
      }

      if (sectionId !== null && checklist.sections) {
        // Sectioned: update within the specific section
        checklist.sections = checklist.sections.map(s => {
          if (s.sectionId !== sectionId) return s
          const existing = s.responses.findIndex(r => r.fieldId === fieldId)
          if (existing >= 0) {
            s.responses[existing] = newEntry
          } else {
            s.responses.push(newEntry)
          }
          return s
        })
      } else {
        // Non-sectioned: update in main responses array
        const existing = checklist.responses.findIndex(r => r.fieldId === fieldId)
        if (existing >= 0) {
          checklist.responses[existing] = newEntry
        } else {
          checklist.responses.push(newEntry)
        }
      }

      const updateRequest = store.put(checklist)
      updateRequest.onsuccess = () => resolve()
      updateRequest.onerror = () => reject(updateRequest.error)
    }

    getRequest.onerror = () => reject(getRequest.error)
  })
}

/**
 * Sobrescreve um checklist offline diretamente no IndexedDB (upsert).
 * Usado para atualizar status de seções durante o fluxo de auto-save.
 *
 * @param checklist - Objeto completo do checklist com os dados atualizados
 */
export async function putOfflineChecklist(checklist: PendingChecklist): Promise<void> {
  const database = await initDB()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.put(checklist)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export type { PendingChecklist, PendingChecklistSection }
