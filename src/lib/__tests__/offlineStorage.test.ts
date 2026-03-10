import { describe, it, expect, beforeEach, vi } from 'vitest'

// We need to reset the module's internal `db` cache between tests
// to ensure clean state with fake-indexeddb
let mod: typeof import('@/lib/offlineStorage')

beforeEach(async () => {
  vi.resetModules()
  // Re-import to get a fresh module with db = null
  mod = await import('@/lib/offlineStorage')
  // Clear any leftover data from previous tests
  await mod.clearOfflineData()
})

function makeChecklist(overrides: Record<string, unknown> = {}) {
  return {
    templateId: 1,
    storeId: 1,
    sectorId: null,
    userId: 'user-123',
    responses: [
      { fieldId: 1, valueText: 'Sim', valueNumber: null, valueJson: null },
    ],
    ...overrides,
  }
}

describe('offlineStorage', () => {
  describe('initDB', () => {
    it('opens database successfully and returns IDBDatabase', async () => {
      const database = await mod.initDB()
      expect(database).toBeDefined()
      expect(database).toBeInstanceOf(IDBDatabase)
    })

    it('returns the same cached instance on subsequent calls', async () => {
      const db1 = await mod.initDB()
      const db2 = await mod.initDB()
      expect(db1).toBe(db2)
    })
  })

  describe('saveOfflineChecklist + getOfflineChecklist', () => {
    it('save returns a UUID string', async () => {
      const id = await mod.saveOfflineChecklist(makeChecklist())
      expect(typeof id).toBe('string')
      // UUID v4 format
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      )
    })

    it('get returns the saved data with auto-generated fields', async () => {
      const input = makeChecklist()
      const id = await mod.saveOfflineChecklist(input)
      const result = await mod.getOfflineChecklist(id)

      expect(result).not.toBeNull()
      expect(result!.id).toBe(id)
      expect(result!.templateId).toBe(input.templateId)
      expect(result!.storeId).toBe(input.storeId)
      expect(result!.sectorId).toBe(input.sectorId)
      expect(result!.userId).toBe(input.userId)
      expect(result!.responses).toEqual(input.responses)
      expect(result!.syncStatus).toBe('draft')
      expect(result!.createdAt).toBeDefined()
      // createdAt should be a valid ISO string
      expect(new Date(result!.createdAt).toISOString()).toBe(result!.createdAt)
    })

    it('get returns null for a non-existent ID', async () => {
      await mod.initDB()
      const result = await mod.getOfflineChecklist('non-existent-id')
      expect(result).toBeUndefined()
    })
  })

  describe('getPendingChecklists', () => {
    it('returns empty array when no checklists exist', async () => {
      const result = await mod.getPendingChecklists()
      expect(result).toEqual([])
    })

    it('returns all stored checklists', async () => {
      await mod.saveOfflineChecklist(makeChecklist({ userId: 'user-a' }))
      await mod.saveOfflineChecklist(makeChecklist({ userId: 'user-b' }))
      await mod.saveOfflineChecklist(makeChecklist({ userId: 'user-c' }))

      const result = await mod.getPendingChecklists()
      expect(result).toHaveLength(3)
      const userIds = result.map((c) => c.userId).sort()
      expect(userIds).toEqual(['user-a', 'user-b', 'user-c'])
    })
  })

  describe('getPendingCount', () => {
    it('returns 0 when no checklists exist', async () => {
      const count = await mod.getPendingCount()
      expect(count).toBe(0)
    })

    it('returns count of pending status items only', async () => {
      // Save multiple checklists (all start as 'draft')
      const id1 = await mod.saveOfflineChecklist(makeChecklist())
      const id2 = await mod.saveOfflineChecklist(makeChecklist())
      const id3 = await mod.saveOfflineChecklist(makeChecklist())
      await mod.saveOfflineChecklist(makeChecklist()) // id4 stays as 'draft'

      // Initially all are 'draft', so pending count is 0
      expect(await mod.getPendingCount()).toBe(0)

      // Change some to 'pending'
      await mod.updateChecklistStatus(id1, 'pending')
      await mod.updateChecklistStatus(id2, 'pending')

      // Change one to 'failed'
      await mod.updateChecklistStatus(id3, 'failed')

      // id4 stays as 'draft'

      const count = await mod.getPendingCount()
      expect(count).toBe(2)
    })

    it('does not count syncing or failed items', async () => {
      const id1 = await mod.saveOfflineChecklist(makeChecklist())
      const id2 = await mod.saveOfflineChecklist(makeChecklist())

      await mod.updateChecklistStatus(id1, 'syncing')
      await mod.updateChecklistStatus(id2, 'failed')

      const count = await mod.getPendingCount()
      expect(count).toBe(0)
    })
  })

  describe('updateChecklistStatus', () => {
    it('changes status from draft to pending', async () => {
      const id = await mod.saveOfflineChecklist(makeChecklist())

      let result = await mod.getOfflineChecklist(id)
      expect(result!.syncStatus).toBe('draft')

      await mod.updateChecklistStatus(id, 'pending')

      result = await mod.getOfflineChecklist(id)
      expect(result!.syncStatus).toBe('pending')
    })

    it('stores error message when provided', async () => {
      const id = await mod.saveOfflineChecklist(makeChecklist())

      await mod.updateChecklistStatus(id, 'failed', 'Network error')

      const result = await mod.getOfflineChecklist(id)
      expect(result!.syncStatus).toBe('failed')
      expect(result!.errorMessage).toBe('Network error')
    })

    it('does not throw when updating a non-existent checklist', async () => {
      await mod.initDB()
      // Should resolve without error (the function just resolves if not found)
      await expect(
        mod.updateChecklistStatus('non-existent', 'pending')
      ).resolves.toBeUndefined()
    })
  })

  describe('deleteOfflineChecklist', () => {
    it('removes a checklist so it can no longer be retrieved', async () => {
      const id = await mod.saveOfflineChecklist(makeChecklist())

      // Verify it exists
      let result = await mod.getOfflineChecklist(id)
      expect(result).toBeDefined()

      await mod.deleteOfflineChecklist(id)

      // Verify it is gone
      result = await mod.getOfflineChecklist(id)
      expect(result).toBeUndefined()
    })

    it('does not affect other checklists', async () => {
      const id1 = await mod.saveOfflineChecklist(makeChecklist({ userId: 'keep' }))
      const id2 = await mod.saveOfflineChecklist(makeChecklist({ userId: 'remove' }))

      await mod.deleteOfflineChecklist(id2)

      const remaining = await mod.getPendingChecklists()
      expect(remaining).toHaveLength(1)
      expect(remaining[0].id).toBe(id1)
      expect(remaining[0].userId).toBe('keep')
    })
  })

  describe('clearOfflineData', () => {
    it('removes all checklists from the store', async () => {
      await mod.saveOfflineChecklist(makeChecklist())
      await mod.saveOfflineChecklist(makeChecklist())
      await mod.saveOfflineChecklist(makeChecklist())

      let all = await mod.getPendingChecklists()
      expect(all).toHaveLength(3)

      await mod.clearOfflineData()

      all = await mod.getPendingChecklists()
      expect(all).toEqual([])
    })

    it('works when store is already empty', async () => {
      await mod.initDB()
      await expect(mod.clearOfflineData()).resolves.toBeUndefined()
      const all = await mod.getPendingChecklists()
      expect(all).toEqual([])
    })
  })

  describe('updateOfflineFieldResponse', () => {
    it('updates an existing field value in a non-sectioned checklist', async () => {
      const id = await mod.saveOfflineChecklist(makeChecklist())

      await mod.updateOfflineFieldResponse(id, null, 1, {
        valueText: 'Nao',
        valueNumber: null,
        valueJson: null,
      })

      const result = await mod.getOfflineChecklist(id)
      expect(result!.responses).toHaveLength(1)
      expect(result!.responses[0].fieldId).toBe(1)
      expect(result!.responses[0].valueText).toBe('Nao')
    })

    it('adds a new field if fieldId does not exist in responses', async () => {
      const id = await mod.saveOfflineChecklist(makeChecklist())

      await mod.updateOfflineFieldResponse(id, null, 99, {
        valueText: 'New field',
        valueNumber: null,
        valueJson: null,
      })

      const result = await mod.getOfflineChecklist(id)
      expect(result!.responses).toHaveLength(2)
      expect(result!.responses[1].fieldId).toBe(99)
      expect(result!.responses[1].valueText).toBe('New field')
    })

    it('updates a field within a specific section', async () => {
      const id = await mod.saveOfflineChecklist(
        makeChecklist({
          responses: [],
          sections: [
            {
              sectionId: 10,
              status: 'pendente',
              completedAt: null,
              responses: [
                { fieldId: 5, valueText: 'Old', valueNumber: null, valueJson: null },
              ],
            },
          ],
        })
      )

      await mod.updateOfflineFieldResponse(id, 10, 5, {
        valueText: 'Updated',
        valueNumber: null,
        valueJson: null,
      })

      const result = await mod.getOfflineChecklist(id)
      expect(result!.sections![0].responses[0].valueText).toBe('Updated')
    })

    it('rejects when checklist does not exist', async () => {
      await mod.initDB()
      await expect(
        mod.updateOfflineFieldResponse('non-existent', null, 1, {
          valueText: 'x',
          valueNumber: null,
          valueJson: null,
        })
      ).rejects.toThrow('Checklist nao encontrado')
    })
  })

  describe('updateOfflineChecklistSection', () => {
    it('marks a section as concluido and stores responses', async () => {
      const id = await mod.saveOfflineChecklist(
        makeChecklist({
          responses: [],
          sections: [
            {
              sectionId: 1,
              status: 'pendente',
              completedAt: null,
              responses: [],
            },
            {
              sectionId: 2,
              status: 'pendente',
              completedAt: null,
              responses: [],
            },
          ],
        })
      )

      const sectionResponses = [
        { fieldId: 10, valueText: 'OK', valueNumber: null, valueJson: null },
      ]
      await mod.updateOfflineChecklistSection(id, 1, sectionResponses)

      const result = await mod.getOfflineChecklist(id)
      const section1 = result!.sections!.find((s) => s.sectionId === 1)
      expect(section1!.status).toBe('concluido')
      expect(section1!.completedAt).toBeDefined()
      expect(section1!.responses).toEqual(sectionResponses)

      // Section 2 should still be pendente
      const section2 = result!.sections!.find((s) => s.sectionId === 2)
      expect(section2!.status).toBe('pendente')

      // syncStatus should still be draft since not all sections are done
      expect(result!.syncStatus).toBe('draft')
    })

    it('sets syncStatus to pending when all sections are concluido', async () => {
      const id = await mod.saveOfflineChecklist(
        makeChecklist({
          responses: [],
          sections: [
            {
              sectionId: 1,
              status: 'pendente',
              completedAt: null,
              responses: [],
            },
            {
              sectionId: 2,
              status: 'pendente',
              completedAt: null,
              responses: [],
            },
          ],
        })
      )

      // Complete section 1
      await mod.updateOfflineChecklistSection(id, 1, [
        { fieldId: 10, valueText: 'A', valueNumber: null, valueJson: null },
      ])

      // Complete section 2
      await mod.updateOfflineChecklistSection(id, 2, [
        { fieldId: 20, valueText: 'B', valueNumber: null, valueJson: null },
      ])

      const result = await mod.getOfflineChecklist(id)
      expect(result!.syncStatus).toBe('pending')
      // Consolidated responses from all sections
      expect(result!.responses).toHaveLength(2)
      expect(result!.responses.map((r) => r.fieldId)).toEqual([10, 20])
    })

    it('rejects when checklist has no sections', async () => {
      const id = await mod.saveOfflineChecklist(makeChecklist())

      await expect(
        mod.updateOfflineChecklistSection(id, 1, [])
      ).rejects.toThrow('Checklist ou secoes nao encontrados')
    })
  })

  describe('putOfflineChecklist', () => {
    it('inserts a new checklist via put', async () => {
      await mod.initDB()

      const checklist = {
        id: 'custom-id-123',
        templateId: 5,
        storeId: 2,
        sectorId: null,
        userId: 'user-456',
        responses: [
          { fieldId: 1, valueText: 'Test', valueNumber: null, valueJson: null },
        ],
        createdAt: new Date().toISOString(),
        syncStatus: 'draft' as const,
      }

      await mod.putOfflineChecklist(checklist)

      const result = await mod.getOfflineChecklist('custom-id-123')
      expect(result).toBeDefined()
      expect(result!.templateId).toBe(5)
      expect(result!.userId).toBe('user-456')
    })

    it('upserts (overwrites) an existing checklist', async () => {
      const id = await mod.saveOfflineChecklist(makeChecklist())
      const original = await mod.getOfflineChecklist(id)

      const updated = {
        ...original!,
        userId: 'user-updated',
        syncStatus: 'pending' as const,
      }

      await mod.putOfflineChecklist(updated)

      const result = await mod.getOfflineChecklist(id)
      expect(result!.userId).toBe('user-updated')
      expect(result!.syncStatus).toBe('pending')
    })
  })

  describe('multiple checklists', () => {
    it('can store and retrieve multiple items independently', async () => {
      const id1 = await mod.saveOfflineChecklist(
        makeChecklist({ templateId: 1, userId: 'user-a' })
      )
      const id2 = await mod.saveOfflineChecklist(
        makeChecklist({ templateId: 2, userId: 'user-b' })
      )
      const id3 = await mod.saveOfflineChecklist(
        makeChecklist({ templateId: 3, userId: 'user-c' })
      )

      // All IDs should be unique
      expect(new Set([id1, id2, id3]).size).toBe(3)

      // Each can be retrieved individually
      const c1 = await mod.getOfflineChecklist(id1)
      const c2 = await mod.getOfflineChecklist(id2)
      const c3 = await mod.getOfflineChecklist(id3)

      expect(c1!.templateId).toBe(1)
      expect(c1!.userId).toBe('user-a')
      expect(c2!.templateId).toBe(2)
      expect(c2!.userId).toBe('user-b')
      expect(c3!.templateId).toBe(3)
      expect(c3!.userId).toBe('user-c')

      // getAll returns all three
      const all = await mod.getPendingChecklists()
      expect(all).toHaveLength(3)
    })

    it('operations on one checklist do not affect others', async () => {
      const id1 = await mod.saveOfflineChecklist(makeChecklist({ userId: 'keep' }))
      const id2 = await mod.saveOfflineChecklist(makeChecklist({ userId: 'update' }))
      const id3 = await mod.saveOfflineChecklist(makeChecklist({ userId: 'delete' }))

      // Update one
      await mod.updateChecklistStatus(id2, 'pending')

      // Delete another
      await mod.deleteOfflineChecklist(id3)

      // Verify states
      const c1 = await mod.getOfflineChecklist(id1)
      expect(c1!.syncStatus).toBe('draft')
      expect(c1!.userId).toBe('keep')

      const c2 = await mod.getOfflineChecklist(id2)
      expect(c2!.syncStatus).toBe('pending')
      expect(c2!.userId).toBe('update')

      const c3 = await mod.getOfflineChecklist(id3)
      expect(c3).toBeUndefined()

      const all = await mod.getPendingChecklists()
      expect(all).toHaveLength(2)
    })
  })
})
