/**
 * Testes da logica de hierarquia de secoes (etapas / sub-etapas)
 * usada nas paginas de template admin (novo e editar).
 *
 * Estrutura: Etapa (parent_id=null) > Sub-etapa (parent_id=etapa) > Campos
 */

// ─── Tipos locais (replicam os das pages) ────────────────────────────────────

type SectionConfig = {
  id: string
  name: string
  description: string
  sort_order: number
  parent_id: string | null
}

type FieldConfig = {
  id: string
  section_id: string | null
  name: string
  sort_order: number
}

// ─── Funcoes puras sob teste ─────────────────────────────────────────────────

function getParentSections(sections: SectionConfig[]): SectionConfig[] {
  return sections.filter(s => !s.parent_id)
}

function getSubSections(sections: SectionConfig[], parentId: string): SectionConfig[] {
  return sections
    .filter(s => s.parent_id === parentId)
    .sort((a, b) => a.sort_order - b.sort_order)
}

function createSection(sections: SectionConfig[], parentId: string | null = null): SectionConfig {
  return {
    id: `section_${sections.length + 1}`,
    name: '',
    description: '',
    sort_order: sections.length + 1,
    parent_id: parentId,
  }
}

function removeParentSection(
  sections: SectionConfig[],
  fields: FieldConfig[],
  parentId: string,
): { sections: SectionConfig[]; fields: FieldConfig[] } {
  const childIds = sections.filter(s => s.parent_id === parentId).map(s => s.id)
  return {
    sections: sections.filter(s => s.id !== parentId && s.parent_id !== parentId),
    fields: fields.map(f =>
      f.section_id === parentId || childIds.includes(f.section_id || '')
        ? { ...f, section_id: null }
        : f,
    ),
  }
}

function removeSubSection(
  sections: SectionConfig[],
  fields: FieldConfig[],
  subId: string,
): { sections: SectionConfig[]; fields: FieldConfig[] } {
  return {
    sections: sections.filter(s => s.id !== subId),
    fields: fields.map(f => (f.section_id === subId ? { ...f, section_id: null } : f)),
  }
}

function countFieldsForSection(
  sections: SectionConfig[],
  fields: FieldConfig[],
  sectionId: string,
): number {
  const subs = getSubSections(sections, sectionId)
  if (subs.length > 0) {
    return fields.filter(f => subs.some(sub => sub.id === f.section_id)).length
  }
  return fields.filter(f => f.section_id === sectionId).length
}

/** Converte secoes do banco (com parent_id numerico) para SectionConfig local */
function buildSectionsFromDb(
  dbSections: Array<{ id: number; parent_id: number | null; name: string; sort_order: number }>,
): SectionConfig[] {
  const dbIdToLocal: Record<number, string> = {}
  dbSections.forEach(s => {
    dbIdToLocal[s.id] = `section_${s.id}`
  })
  return dbSections.map(s => ({
    id: `section_${s.id}`,
    name: s.name,
    description: '',
    sort_order: s.sort_order,
    parent_id: s.parent_id ? dbIdToLocal[s.parent_id] || null : null,
  }))
}

/** Separa secoes para insert: pais primeiro, filhas depois (com parent_id mapeado) */
function prepareSectionsForSave(
  sections: SectionConfig[],
  sectionIdMap: Record<string, number>,
) {
  const parents = sections.filter(s => !s.parent_id)
  const children = sections.filter(s => s.parent_id)
  return {
    parents: parents.map(s => ({ name: s.name, sort_order: s.sort_order, parent_id: null as number | null })),
    children: children.map(s => ({
      name: s.name,
      sort_order: s.sort_order,
      parent_id: s.parent_id ? sectionIdMap[s.parent_id] || null : null,
    })),
  }
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

function buildHierarchy(): { sections: SectionConfig[]; fields: FieldConfig[] } {
  const sections: SectionConfig[] = [
    { id: 'etapa_1', name: 'SALA DE CORTE', description: '', sort_order: 1, parent_id: null },
    { id: 'etapa_2', name: 'ESTOQUE SECO', description: '', sort_order: 2, parent_id: null },
    { id: 'sub_1a', name: 'Estrutura Fisica', description: '', sort_order: 1, parent_id: 'etapa_1' },
    { id: 'sub_1b', name: 'Higienizacao', description: '', sort_order: 2, parent_id: 'etapa_1' },
    { id: 'sub_2a', name: 'Organizacao', description: '', sort_order: 1, parent_id: 'etapa_2' },
  ]
  const fields: FieldConfig[] = [
    { id: 'f1', section_id: 'sub_1a', name: 'Piso integro', sort_order: 1 },
    { id: 'f2', section_id: 'sub_1a', name: 'Parede lavavel', sort_order: 2 },
    { id: 'f3', section_id: 'sub_1b', name: 'Pia limpa', sort_order: 1 },
    { id: 'f4', section_id: 'sub_2a', name: 'Estantes organizadas', sort_order: 1 },
    { id: 'f5', section_id: null, name: 'Observacoes gerais', sort_order: 1 },
  ]
  return { sections, fields }
}

// ─── Testes ──────────────────────────────────────────────────────────────────

describe('Hierarquia de secoes (etapas / sub-etapas)', () => {
  // ─── Filtragem ───────────────────────────────────────────────────────────

  describe('filtragem de secoes', () => {
    it('retorna apenas etapas pai (parent_id=null)', () => {
      const { sections } = buildHierarchy()
      const parents = getParentSections(sections)
      expect(parents).toHaveLength(2)
      expect(parents.map(s => s.name)).toEqual(['SALA DE CORTE', 'ESTOQUE SECO'])
    })

    it('retorna sub-etapas ordenadas por sort_order', () => {
      const { sections } = buildHierarchy()
      const subs = getSubSections(sections, 'etapa_1')
      expect(subs).toHaveLength(2)
      expect(subs[0].name).toBe('Estrutura Fisica')
      expect(subs[1].name).toBe('Higienizacao')
    })

    it('retorna vazio para etapa sem sub-etapas', () => {
      const sections: SectionConfig[] = [
        { id: 'e1', name: 'Flat', description: '', sort_order: 1, parent_id: null },
      ]
      expect(getSubSections(sections, 'e1')).toHaveLength(0)
    })

    it('retorna vazio para array vazio', () => {
      expect(getParentSections([])).toHaveLength(0)
      expect(getSubSections([], 'x')).toHaveLength(0)
    })
  })

  // ─── Criacao ─────────────────────────────────────────────────────────────

  describe('criacao de secoes', () => {
    it('cria etapa raiz com parent_id=null', () => {
      const section = createSection([])
      expect(section.parent_id).toBeNull()
      expect(section.sort_order).toBe(1)
    })

    it('cria sub-etapa com parent_id correto', () => {
      const existing = [createSection([])]
      const sub = createSection(existing, existing[0].id)
      expect(sub.parent_id).toBe(existing[0].id)
      expect(sub.sort_order).toBe(2)
    })

    it('incrementa sort_order baseado no total de secoes', () => {
      const s1 = createSection([])
      const s2 = createSection([s1])
      const s3 = createSection([s1, s2])
      expect(s3.sort_order).toBe(3)
    })
  })

  // ─── Remocao ─────────────────────────────────────────────────────────────

  describe('remocao de secoes', () => {
    it('remover etapa pai remove suas sub-etapas em cascata', () => {
      const { sections, fields } = buildHierarchy()
      const result = removeParentSection(sections, fields, 'etapa_1')
      // Sobra apenas etapa_2 e sub_2a
      expect(result.sections).toHaveLength(2)
      expect(result.sections.map(s => s.id)).toEqual(['etapa_2', 'sub_2a'])
    })

    it('remover etapa pai desvincula campos das sub-etapas removidas', () => {
      const { sections, fields } = buildHierarchy()
      const result = removeParentSection(sections, fields, 'etapa_1')
      // f1, f2 (sub_1a) e f3 (sub_1b) ficam sem secao
      const unassigned = result.fields.filter(f => f.section_id === null)
      expect(unassigned.map(f => f.id).sort()).toEqual(['f1', 'f2', 'f3', 'f5'])
    })

    it('remover sub-etapa nao afeta a etapa pai', () => {
      const { sections, fields } = buildHierarchy()
      const result = removeSubSection(sections, fields, 'sub_1a')
      expect(result.sections.find(s => s.id === 'etapa_1')).toBeDefined()
      expect(result.sections.find(s => s.id === 'sub_1b')).toBeDefined()
      expect(result.sections.find(s => s.id === 'sub_1a')).toBeUndefined()
    })

    it('remover sub-etapa desvincula apenas seus campos', () => {
      const { sections, fields } = buildHierarchy()
      const result = removeSubSection(sections, fields, 'sub_1a')
      // f1, f2 ficam sem secao; f3 continua em sub_1b
      expect(result.fields.find(f => f.id === 'f1')!.section_id).toBeNull()
      expect(result.fields.find(f => f.id === 'f2')!.section_id).toBeNull()
      expect(result.fields.find(f => f.id === 'f3')!.section_id).toBe('sub_1b')
    })
  })

  // ─── Contagem de campos ──────────────────────────────────────────────────

  describe('contagem de campos', () => {
    it('conta campos de etapa pai somando todas sub-etapas', () => {
      const { sections, fields } = buildHierarchy()
      // etapa_1 tem sub_1a (2 campos) + sub_1b (1 campo) = 3
      expect(countFieldsForSection(sections, fields, 'etapa_1')).toBe(3)
    })

    it('conta campos de etapa pai com uma unica sub-etapa', () => {
      const { sections, fields } = buildHierarchy()
      // etapa_2 tem sub_2a (1 campo)
      expect(countFieldsForSection(sections, fields, 'etapa_2')).toBe(1)
    })

    it('conta campos diretos em secao sem sub-etapas', () => {
      const sections: SectionConfig[] = [
        { id: 'flat', name: 'Flat', description: '', sort_order: 1, parent_id: null },
      ]
      const fields: FieldConfig[] = [
        { id: 'f1', section_id: 'flat', name: 'Campo 1', sort_order: 1 },
        { id: 'f2', section_id: 'flat', name: 'Campo 2', sort_order: 2 },
      ]
      expect(countFieldsForSection(sections, fields, 'flat')).toBe(2)
    })

    it('campos sem section_id nao sao contados em nenhuma secao', () => {
      const { sections, fields } = buildHierarchy()
      // f5 tem section_id=null, nao pertence a nenhuma etapa
      expect(countFieldsForSection(sections, fields, 'etapa_1')).toBe(3)
      expect(countFieldsForSection(sections, fields, 'etapa_2')).toBe(1)
    })
  })

  // ─── Carregamento do banco (edit mode) ───────────────────────────────────

  describe('carregamento do banco', () => {
    it('mapeia parent_id numerico para id local string', () => {
      const dbSections = [
        { id: 10, parent_id: null, name: 'Etapa 1', sort_order: 1 },
        { id: 20, parent_id: 10, name: 'Sub 1a', sort_order: 1 },
        { id: 30, parent_id: 10, name: 'Sub 1b', sort_order: 2 },
      ]
      const result = buildSectionsFromDb(dbSections)
      expect(result[0].parent_id).toBeNull()
      expect(result[1].parent_id).toBe('section_10')
      expect(result[2].parent_id).toBe('section_10')
    })

    it('secoes sem parent_id no banco ficam com parent_id null', () => {
      const dbSections = [
        { id: 1, parent_id: null, name: 'Flat 1', sort_order: 1 },
        { id: 2, parent_id: null, name: 'Flat 2', sort_order: 2 },
      ]
      const result = buildSectionsFromDb(dbSections)
      expect(result.every(s => s.parent_id === null)).toBe(true)
    })

    it('ids locais seguem o padrao section_{dbId}', () => {
      const dbSections = [{ id: 42, parent_id: null, name: 'Test', sort_order: 1 }]
      const result = buildSectionsFromDb(dbSections)
      expect(result[0].id).toBe('section_42')
    })
  })

  // ─── Logica de save ──────────────────────────────────────────────────────

  describe('preparacao para salvar', () => {
    it('separa pais e filhas corretamente', () => {
      const { sections } = buildHierarchy()
      const sectionIdMap: Record<string, number> = {
        etapa_1: 100,
        etapa_2: 200,
      }
      const result = prepareSectionsForSave(sections, sectionIdMap)
      expect(result.parents).toHaveLength(2)
      expect(result.children).toHaveLength(3)
      expect(result.parents.every(p => p.parent_id === null)).toBe(true)
    })

    it('filhas referenciam o id do banco do pai', () => {
      const { sections } = buildHierarchy()
      const sectionIdMap: Record<string, number> = {
        etapa_1: 100,
        etapa_2: 200,
      }
      const result = prepareSectionsForSave(sections, sectionIdMap)
      const childOfEtapa1 = result.children.filter(c => c.parent_id === 100)
      expect(childOfEtapa1).toHaveLength(2)
      const childOfEtapa2 = result.children.filter(c => c.parent_id === 200)
      expect(childOfEtapa2).toHaveLength(1)
    })

    it('filha com pai nao mapeado recebe parent_id null', () => {
      const sections: SectionConfig[] = [
        { id: 'orphan_sub', name: 'Orfao', description: '', sort_order: 1, parent_id: 'deleted_parent' },
      ]
      const result = prepareSectionsForSave(sections, {})
      expect(result.children[0].parent_id).toBeNull()
    })
  })
})
