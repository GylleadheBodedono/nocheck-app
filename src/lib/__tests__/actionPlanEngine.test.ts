import { _evaluateCondition, _getNonConformityValueStr } from '@/lib/actionPlanEngine'
import { createField, createResponse, createCondition } from '@/tests/factories/field'

// ---------------------------------------------------------------------------
// evaluateCondition
// ---------------------------------------------------------------------------
describe('evaluateCondition', () => {
  // -----------------------------------------------------------------------
  // yes_no
  // -----------------------------------------------------------------------
  describe('yes_no field', () => {
    const field = createField({ field_type: 'yes_no' })

    it('returns true when answer from value_json equals condition value', () => {
      const response = createResponse({ value_json: { answer: 'Não' } })
      const condition = createCondition({
        condition_type: 'equals',
        condition_value: { value: 'Não' },
      })
      expect(_evaluateCondition(field, response, condition)).toBe(true)
    })

    it('is case-insensitive when comparing answers', () => {
      const response = createResponse({ value_json: { answer: 'NÃO' } })
      const condition = createCondition({
        condition_type: 'equals',
        condition_value: { value: 'não' },
      })
      expect(_evaluateCondition(field, response, condition)).toBe(true)
    })

    it('returns false when answer does not equal condition value (equals)', () => {
      const response = createResponse({ value_json: { answer: 'Sim' } })
      const condition = createCondition({
        condition_type: 'equals',
        condition_value: { value: 'Não' },
      })
      expect(_evaluateCondition(field, response, condition)).toBe(false)
    })

    it('returns true when answer differs from condition value (not_equals)', () => {
      const response = createResponse({ value_json: { answer: 'Sim' } })
      const condition = createCondition({
        condition_type: 'not_equals',
        condition_value: { value: 'Não' },
      })
      expect(_evaluateCondition(field, response, condition)).toBe(true)
    })

    it('returns false when answer matches condition value (not_equals)', () => {
      const response = createResponse({ value_json: { answer: 'Não' } })
      const condition = createCondition({
        condition_type: 'not_equals',
        condition_value: { value: 'Não' },
      })
      expect(_evaluateCondition(field, response, condition)).toBe(false)
    })

    it('falls back to value_text when value_json has no answer', () => {
      const response = createResponse({ value_json: null, value_text: 'Não' })
      const condition = createCondition({
        condition_type: 'equals',
        condition_value: { value: 'Não' },
      })
      expect(_evaluateCondition(field, response, condition)).toBe(true)
    })

    it('falls back to value_text when value_json.answer is falsy', () => {
      const response = createResponse({ value_json: { answer: null }, value_text: 'Sim' })
      const condition = createCondition({
        condition_type: 'equals',
        condition_value: { value: 'Sim' },
      })
      expect(_evaluateCondition(field, response, condition)).toBe(true)
    })

    it('returns true for empty condition when no answer is present', () => {
      const response = createResponse({ value_json: null, value_text: null })
      const condition = createCondition({
        condition_type: 'empty',
        condition_value: {},
      })
      expect(_evaluateCondition(field, response, condition)).toBe(true)
    })

    it('returns false for empty condition when answer exists', () => {
      const response = createResponse({ value_json: { answer: 'Sim' } })
      const condition = createCondition({
        condition_type: 'empty',
        condition_value: {},
      })
      expect(_evaluateCondition(field, response, condition)).toBe(false)
    })

    it('returns false for unsupported condition_type', () => {
      const response = createResponse({ value_json: { answer: 'Sim' } })
      const condition = createCondition({
        condition_type: 'contains' as never,
        condition_value: { value: 'Sim' },
      })
      expect(_evaluateCondition(field, response, condition)).toBe(false)
    })
  })

  // -----------------------------------------------------------------------
  // number
  // -----------------------------------------------------------------------
  describe('number field', () => {
    const field = createField({ field_type: 'number' })

    it('returns true when value_number is less than condValue.min (less_than)', () => {
      const response = createResponse({ value_number: 3 })
      const condition = createCondition({
        condition_type: 'less_than',
        condition_value: { min: 5 },
      })
      expect(_evaluateCondition(field, response, condition)).toBe(true)
    })

    it('returns false when value_number equals condValue.min (less_than)', () => {
      const response = createResponse({ value_number: 5 })
      const condition = createCondition({
        condition_type: 'less_than',
        condition_value: { min: 5 },
      })
      expect(_evaluateCondition(field, response, condition)).toBe(false)
    })

    it('returns false when value_number is above condValue.min (less_than)', () => {
      const response = createResponse({ value_number: 7 })
      const condition = createCondition({
        condition_type: 'less_than',
        condition_value: { min: 5 },
      })
      expect(_evaluateCondition(field, response, condition)).toBe(false)
    })

    it('returns true when value_number is greater than condValue.max (greater_than)', () => {
      const response = createResponse({ value_number: 15 })
      const condition = createCondition({
        condition_type: 'greater_than',
        condition_value: { max: 10 },
      })
      expect(_evaluateCondition(field, response, condition)).toBe(true)
    })

    it('returns false when value_number equals condValue.max (greater_than)', () => {
      const response = createResponse({ value_number: 10 })
      const condition = createCondition({
        condition_type: 'greater_than',
        condition_value: { max: 10 },
      })
      expect(_evaluateCondition(field, response, condition)).toBe(false)
    })

    it('returns false when value_number is below condValue.max (greater_than)', () => {
      const response = createResponse({ value_number: 8 })
      const condition = createCondition({
        condition_type: 'greater_than',
        condition_value: { max: 10 },
      })
      expect(_evaluateCondition(field, response, condition)).toBe(false)
    })

    describe('between (non-conforming if OUTSIDE range)', () => {
      const condition = createCondition({
        condition_type: 'between',
        condition_value: { min: 5, max: 10 },
      })

      it('returns true when value is below min', () => {
        const response = createResponse({ value_number: 3 })
        expect(_evaluateCondition(field, response, condition)).toBe(true)
      })

      it('returns true when value is above max', () => {
        const response = createResponse({ value_number: 12 })
        expect(_evaluateCondition(field, response, condition)).toBe(true)
      })

      it('returns false when value equals min (inside range)', () => {
        const response = createResponse({ value_number: 5 })
        expect(_evaluateCondition(field, response, condition)).toBe(false)
      })

      it('returns false when value equals max (inside range)', () => {
        const response = createResponse({ value_number: 10 })
        expect(_evaluateCondition(field, response, condition)).toBe(false)
      })

      it('returns false when value is between min and max', () => {
        const response = createResponse({ value_number: 7 })
        expect(_evaluateCondition(field, response, condition)).toBe(false)
      })
    })

    it('returns true for empty condition when value_number is null', () => {
      const response = createResponse({ value_number: null })
      const condition = createCondition({
        condition_type: 'empty',
        condition_value: {},
      })
      expect(_evaluateCondition(field, response, condition)).toBe(true)
    })

    it('returns false for empty condition when value_number exists', () => {
      const response = createResponse({ value_number: 0 })
      const condition = createCondition({
        condition_type: 'empty',
        condition_value: {},
      })
      expect(_evaluateCondition(field, response, condition)).toBe(false)
    })

    it('returns false for unsupported condition_type', () => {
      const response = createResponse({ value_number: 5 })
      const condition = createCondition({
        condition_type: 'contains' as never,
        condition_value: {},
      })
      expect(_evaluateCondition(field, response, condition)).toBe(false)
    })
  })

  // -----------------------------------------------------------------------
  // rating
  // -----------------------------------------------------------------------
  describe('rating field', () => {
    const field = createField({ field_type: 'rating' })

    it('returns true when rating is below threshold (less_than)', () => {
      const response = createResponse({ value_number: 2 })
      const condition = createCondition({
        condition_type: 'less_than',
        condition_value: { threshold: 3 },
      })
      expect(_evaluateCondition(field, response, condition)).toBe(true)
    })

    it('returns false when rating equals threshold (less_than)', () => {
      const response = createResponse({ value_number: 3 })
      const condition = createCondition({
        condition_type: 'less_than',
        condition_value: { threshold: 3 },
      })
      expect(_evaluateCondition(field, response, condition)).toBe(false)
    })

    it('returns false when rating is above threshold (less_than)', () => {
      const response = createResponse({ value_number: 5 })
      const condition = createCondition({
        condition_type: 'less_than',
        condition_value: { threshold: 3 },
      })
      expect(_evaluateCondition(field, response, condition)).toBe(false)
    })

    it('returns true for empty condition when value_number is null', () => {
      const response = createResponse({ value_number: null })
      const condition = createCondition({
        condition_type: 'empty',
        condition_value: {},
      })
      expect(_evaluateCondition(field, response, condition)).toBe(true)
    })

    it('returns false for empty condition when rating exists', () => {
      const response = createResponse({ value_number: 1 })
      const condition = createCondition({
        condition_type: 'empty',
        condition_value: {},
      })
      expect(_evaluateCondition(field, response, condition)).toBe(false)
    })

    it('returns false for unsupported condition_type', () => {
      const response = createResponse({ value_number: 2 })
      const condition = createCondition({
        condition_type: 'greater_than' as never,
        condition_value: { threshold: 3 },
      })
      expect(_evaluateCondition(field, response, condition)).toBe(false)
    })
  })

  // -----------------------------------------------------------------------
  // dropdown
  // -----------------------------------------------------------------------
  describe('dropdown field', () => {
    const field = createField({ field_type: 'dropdown' })

    it('returns true when value_text is in the target list (in_list)', () => {
      const response = createResponse({ value_text: 'Ruim' })
      const condition = createCondition({
        condition_type: 'in_list',
        condition_value: { values: ['Ruim', 'Pessimo'] },
      })
      expect(_evaluateCondition(field, response, condition)).toBe(true)
    })

    it('is case-insensitive for in_list', () => {
      const response = createResponse({ value_text: 'ruim' })
      const condition = createCondition({
        condition_type: 'in_list',
        condition_value: { values: ['Ruim', 'Pessimo'] },
      })
      expect(_evaluateCondition(field, response, condition)).toBe(true)
    })

    it('returns false when value_text is not in the target list (in_list)', () => {
      const response = createResponse({ value_text: 'Bom' })
      const condition = createCondition({
        condition_type: 'in_list',
        condition_value: { values: ['Ruim', 'Pessimo'] },
      })
      expect(_evaluateCondition(field, response, condition)).toBe(false)
    })

    it('returns true when value_text is not in the target list (not_in_list)', () => {
      const response = createResponse({ value_text: 'Bom' })
      const condition = createCondition({
        condition_type: 'not_in_list',
        condition_value: { values: ['Ruim', 'Pessimo'] },
      })
      expect(_evaluateCondition(field, response, condition)).toBe(true)
    })

    it('returns false when value_text is in the target list (not_in_list)', () => {
      const response = createResponse({ value_text: 'Ruim' })
      const condition = createCondition({
        condition_type: 'not_in_list',
        condition_value: { values: ['Ruim', 'Pessimo'] },
      })
      expect(_evaluateCondition(field, response, condition)).toBe(false)
    })

    it('returns true for empty condition when value_text is empty string', () => {
      const response = createResponse({ value_text: '' })
      const condition = createCondition({
        condition_type: 'empty',
        condition_value: {},
      })
      expect(_evaluateCondition(field, response, condition)).toBe(true)
    })

    it('returns true for empty condition when value_text is whitespace', () => {
      const response = createResponse({ value_text: '   ' })
      const condition = createCondition({
        condition_type: 'empty',
        condition_value: {},
      })
      expect(_evaluateCondition(field, response, condition)).toBe(true)
    })

    it('returns false for empty condition when value_text has content', () => {
      const response = createResponse({ value_text: 'Algo' })
      const condition = createCondition({
        condition_type: 'empty',
        condition_value: {},
      })
      expect(_evaluateCondition(field, response, condition)).toBe(false)
    })

    it('returns true for in_list when value_text is null (empty string matches)', () => {
      const response = createResponse({ value_text: null })
      const condition = createCondition({
        condition_type: 'in_list',
        condition_value: { values: [''] },
      })
      expect(_evaluateCondition(field, response, condition)).toBe(true)
    })

    it('handles null values array gracefully', () => {
      const response = createResponse({ value_text: 'test' })
      const condition = createCondition({
        condition_type: 'in_list',
        condition_value: {},
      })
      expect(_evaluateCondition(field, response, condition)).toBe(false)
    })

    it('returns false for unsupported condition_type', () => {
      const response = createResponse({ value_text: 'Ruim' })
      const condition = createCondition({
        condition_type: 'contains' as never,
        condition_value: { values: ['Ruim'] },
      })
      expect(_evaluateCondition(field, response, condition)).toBe(false)
    })
  })

  // -----------------------------------------------------------------------
  // checkbox_multiple
  // -----------------------------------------------------------------------
  describe('checkbox_multiple field', () => {
    const field = createField({ field_type: 'checkbox_multiple' })

    describe('required items', () => {
      it('returns true when a required item is missing', () => {
        const response = createResponse({ value_json: ['A', 'B'] })
        const condition = createCondition({
          condition_type: 'equals',
          condition_value: { required: ['A', 'C'] },
        })
        expect(_evaluateCondition(field, response, condition)).toBe(true)
      })

      it('returns false when all required items are selected', () => {
        const response = createResponse({ value_json: ['A', 'B', 'C'] })
        const condition = createCondition({
          condition_type: 'equals',
          condition_value: { required: ['A', 'C'] },
        })
        expect(_evaluateCondition(field, response, condition)).toBe(false)
      })

      it('returns true when selection is empty but items are required', () => {
        const response = createResponse({ value_json: [] })
        const condition = createCondition({
          condition_type: 'equals',
          condition_value: { required: ['A'] },
        })
        expect(_evaluateCondition(field, response, condition)).toBe(true)
      })
    })

    describe('forbidden items', () => {
      it('returns true when a forbidden item is selected', () => {
        const response = createResponse({ value_json: ['A', 'B', 'X'] })
        const condition = createCondition({
          condition_type: 'equals',
          condition_value: { forbidden: ['X', 'Y'] },
        })
        expect(_evaluateCondition(field, response, condition)).toBe(true)
      })

      it('returns false when no forbidden items are selected', () => {
        const response = createResponse({ value_json: ['A', 'B'] })
        const condition = createCondition({
          condition_type: 'equals',
          condition_value: { forbidden: ['X', 'Y'] },
        })
        expect(_evaluateCondition(field, response, condition)).toBe(false)
      })
    })

    describe('required + forbidden combined', () => {
      it('returns true when required item is missing even if no forbidden items selected', () => {
        const response = createResponse({ value_json: ['A'] })
        const condition = createCondition({
          condition_type: 'equals',
          condition_value: { required: ['A', 'B'], forbidden: ['X'] },
        })
        expect(_evaluateCondition(field, response, condition)).toBe(true)
      })

      it('returns true when forbidden item is selected even if all required present', () => {
        const response = createResponse({ value_json: ['A', 'B', 'X'] })
        const condition = createCondition({
          condition_type: 'equals',
          condition_value: { required: ['A', 'B'], forbidden: ['X'] },
        })
        expect(_evaluateCondition(field, response, condition)).toBe(true)
      })

      it('returns false when all required present and no forbidden selected', () => {
        const response = createResponse({ value_json: ['A', 'B', 'C'] })
        const condition = createCondition({
          condition_type: 'equals',
          condition_value: { required: ['A', 'B'], forbidden: ['X'] },
        })
        expect(_evaluateCondition(field, response, condition)).toBe(false)
      })
    })

    describe('fallback to value_text (JSON parse)', () => {
      it('parses value_text as JSON when value_json is not an array', () => {
        const response = createResponse({
          value_json: null,
          value_text: '["A","B"]',
        })
        const condition = createCondition({
          condition_type: 'equals',
          condition_value: { required: ['A', 'C'] },
        })
        expect(_evaluateCondition(field, response, condition)).toBe(true)
      })

      it('treats invalid JSON in value_text as empty array', () => {
        const response = createResponse({
          value_json: null,
          value_text: 'not-json',
        })
        const condition = createCondition({
          condition_type: 'equals',
          condition_value: { required: ['A'] },
        })
        expect(_evaluateCondition(field, response, condition)).toBe(true)
      })

      it('treats null value_text as empty array', () => {
        const response = createResponse({
          value_json: null,
          value_text: null,
        })
        const condition = createCondition({
          condition_type: 'equals',
          condition_value: { forbidden: ['X'] },
        })
        expect(_evaluateCondition(field, response, condition)).toBe(false)
      })
    })

    describe('no required / no forbidden', () => {
      it('returns false when neither required nor forbidden is specified', () => {
        const response = createResponse({ value_json: ['A', 'B'] })
        const condition = createCondition({
          condition_type: 'equals',
          condition_value: {},
        })
        expect(_evaluateCondition(field, response, condition)).toBe(false)
      })
    })
  })

  // -----------------------------------------------------------------------
  // text
  // -----------------------------------------------------------------------
  describe('text field', () => {
    const field = createField({ field_type: 'text' })

    it('returns true for empty condition when value_text is empty', () => {
      const response = createResponse({ value_text: '' })
      const condition = createCondition({
        condition_type: 'empty',
        condition_value: {},
      })
      expect(_evaluateCondition(field, response, condition)).toBe(true)
    })

    it('returns true for empty condition when value_text is whitespace', () => {
      const response = createResponse({ value_text: '  ' })
      const condition = createCondition({
        condition_type: 'empty',
        condition_value: {},
      })
      expect(_evaluateCondition(field, response, condition)).toBe(true)
    })

    it('returns true for empty condition when value_text is null', () => {
      const response = createResponse({ value_text: null })
      const condition = createCondition({
        condition_type: 'empty',
        condition_value: {},
      })
      expect(_evaluateCondition(field, response, condition)).toBe(true)
    })

    it('returns false for empty condition when value_text has content', () => {
      const response = createResponse({ value_text: 'algo' })
      const condition = createCondition({
        condition_type: 'empty',
        condition_value: {},
      })
      expect(_evaluateCondition(field, response, condition)).toBe(false)
    })

    it('returns true when text equals condition value (equals)', () => {
      const response = createResponse({ value_text: 'falha' })
      const condition = createCondition({
        condition_type: 'equals',
        condition_value: { value: 'falha' },
      })
      expect(_evaluateCondition(field, response, condition)).toBe(true)
    })

    it('is case-insensitive for equals', () => {
      const response = createResponse({ value_text: 'FALHA' })
      const condition = createCondition({
        condition_type: 'equals',
        condition_value: { value: 'falha' },
      })
      expect(_evaluateCondition(field, response, condition)).toBe(true)
    })

    it('returns false when text does not equal condition value (equals)', () => {
      const response = createResponse({ value_text: 'ok' })
      const condition = createCondition({
        condition_type: 'equals',
        condition_value: { value: 'falha' },
      })
      expect(_evaluateCondition(field, response, condition)).toBe(false)
    })

    it('returns true when text does not equal condition value (not_equals)', () => {
      const response = createResponse({ value_text: 'ok' })
      const condition = createCondition({
        condition_type: 'not_equals',
        condition_value: { value: 'falha' },
      })
      expect(_evaluateCondition(field, response, condition)).toBe(true)
    })

    it('returns false when text equals condition value (not_equals)', () => {
      const response = createResponse({ value_text: 'falha' })
      const condition = createCondition({
        condition_type: 'not_equals',
        condition_value: { value: 'falha' },
      })
      expect(_evaluateCondition(field, response, condition)).toBe(false)
    })

    it('returns false for unsupported condition_type', () => {
      const response = createResponse({ value_text: 'abc' })
      const condition = createCondition({
        condition_type: 'contains' as never,
        condition_value: { value: 'a' },
      })
      expect(_evaluateCondition(field, response, condition)).toBe(false)
    })
  })

  // -----------------------------------------------------------------------
  // unknown / default field type
  // -----------------------------------------------------------------------
  describe('unknown field type', () => {
    it('returns false for any condition', () => {
      const field = createField({ field_type: 'unknown_type' })
      const response = createResponse({ value_text: 'anything' })
      const condition = createCondition({
        condition_type: 'equals',
        condition_value: { value: 'anything' },
      })
      expect(_evaluateCondition(field, response, condition)).toBe(false)
    })
  })
})

// ---------------------------------------------------------------------------
// getNonConformityValueStr
// ---------------------------------------------------------------------------
describe('getNonConformityValueStr', () => {
  describe('yes_no field', () => {
    const field = createField({ field_type: 'yes_no' })

    it('returns answer from value_json when available', () => {
      const response = createResponse({ value_json: { answer: 'Não' } })
      expect(_getNonConformityValueStr(field, response)).toBe('Não')
    })

    it('falls back to value_text when value_json.answer is falsy', () => {
      const response = createResponse({ value_json: { answer: null }, value_text: 'Sim' })
      expect(_getNonConformityValueStr(field, response)).toBe('Sim')
    })

    it('falls back to value_text when value_json is null', () => {
      const response = createResponse({ value_json: null, value_text: 'Sim' })
      expect(_getNonConformityValueStr(field, response)).toBe('Sim')
    })

    it('returns empty string when value_json is not an object', () => {
      const response = createResponse({ value_json: 'not-object', value_text: null })
      expect(_getNonConformityValueStr(field, response)).toBe('')
    })

    it('returns empty string when no value is present', () => {
      const response = createResponse({ value_json: null, value_text: null })
      expect(_getNonConformityValueStr(field, response)).toBe('')
    })
  })

  describe('number field', () => {
    const field = createField({ field_type: 'number' })

    it('returns stringified number', () => {
      const response = createResponse({ value_number: 42 })
      expect(_getNonConformityValueStr(field, response)).toBe('42')
    })

    it('returns "0" for zero', () => {
      const response = createResponse({ value_number: 0 })
      expect(_getNonConformityValueStr(field, response)).toBe('0')
    })

    it('returns empty string when value_number is null', () => {
      const response = createResponse({ value_number: null })
      expect(_getNonConformityValueStr(field, response)).toBe('')
    })
  })

  describe('rating field', () => {
    const field = createField({ field_type: 'rating' })

    it('returns stringified rating', () => {
      const response = createResponse({ value_number: 3 })
      expect(_getNonConformityValueStr(field, response)).toBe('3')
    })

    it('returns empty string when value_number is null', () => {
      const response = createResponse({ value_number: null })
      expect(_getNonConformityValueStr(field, response)).toBe('')
    })
  })

  describe('dropdown field', () => {
    const field = createField({ field_type: 'dropdown' })

    it('returns value_text', () => {
      const response = createResponse({ value_text: 'Ruim' })
      expect(_getNonConformityValueStr(field, response)).toBe('Ruim')
    })

    it('returns empty string when value_text is null', () => {
      const response = createResponse({ value_text: null })
      expect(_getNonConformityValueStr(field, response)).toBe('')
    })
  })

  describe('text field', () => {
    const field = createField({ field_type: 'text' })

    it('returns value_text', () => {
      const response = createResponse({ value_text: 'Descricao aqui' })
      expect(_getNonConformityValueStr(field, response)).toBe('Descricao aqui')
    })

    it('returns empty string when value_text is null', () => {
      const response = createResponse({ value_text: null })
      expect(_getNonConformityValueStr(field, response)).toBe('')
    })
  })

  describe('checkbox_multiple field', () => {
    const field = createField({ field_type: 'checkbox_multiple' })

    it('joins value_json array with comma and space', () => {
      const response = createResponse({ value_json: ['A', 'B', 'C'] })
      expect(_getNonConformityValueStr(field, response)).toBe('A, B, C')
    })

    it('returns single item without separator', () => {
      const response = createResponse({ value_json: ['Unico'] })
      expect(_getNonConformityValueStr(field, response)).toBe('Unico')
    })

    it('returns empty string for empty array', () => {
      const response = createResponse({ value_json: [] })
      expect(_getNonConformityValueStr(field, response)).toBe('')
    })

    it('falls back to value_text when value_json is not an array', () => {
      const response = createResponse({ value_json: null, value_text: 'fallback' })
      expect(_getNonConformityValueStr(field, response)).toBe('fallback')
    })

    it('returns empty string when both value_json and value_text are null', () => {
      const response = createResponse({ value_json: null, value_text: null })
      expect(_getNonConformityValueStr(field, response)).toBe('')
    })
  })

  describe('unknown field type', () => {
    it('returns value_text as fallback', () => {
      const field = createField({ field_type: 'custom_widget' })
      const response = createResponse({ value_text: 'some value' })
      expect(_getNonConformityValueStr(field, response)).toBe('some value')
    })

    it('returns empty string when value_text is null', () => {
      const field = createField({ field_type: 'custom_widget' })
      const response = createResponse({ value_text: null })
      expect(_getNonConformityValueStr(field, response)).toBe('')
    })
  })
})
