/* eslint-disable */
// ============================================
// Testes — FieldConditionEditor (Fase 4)
// ============================================
// Cobre o editor de condicoes de nao conformidade
// para cada tipo de campo suportado: yes_no, number,
// rating, dropdown, checkbox_multiple, text.
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { FieldConditionEditor, ConditionConfig, PresetOption } from '../FieldConditionEditor'
import type { Severity } from '@/types/database'

// --- Helpers ---

const defaultCondition: ConditionConfig = {
  enabled: true,
  conditionType: 'equals',
  conditionValue: { value: 'Nao' },
  severity: 'media',
  defaultAssigneeId: null,
  deadlineDays: 7,
  descriptionTemplate: 'Nao conformidade: Campo - {store_name}',
  requirePhotoOnCompletion: true,
  requireTextOnCompletion: true,
  completionMaxChars: 800,
}

const mockUsers = [
  { id: 'user-1', name: 'Joao Silva' },
  { id: 'user-2', name: 'Maria Santos' },
]

const mockPresets: PresetOption[] = [
  {
    id: 1,
    name: 'Preset Limpeza',
    severity: 'alta' as Severity,
    deadlineDays: 3,
    defaultAssigneeId: 'user-1',
    descriptionTemplate: 'NC Limpeza: {field_name}',
    requirePhotoOnCompletion: true,
    requireTextOnCompletion: true,
    completionMaxChars: 500,
  },
]

// ============================================
// Rendering & Toggle
// ============================================

describe('FieldConditionEditor', () => {
  describe('renderizacao e toggle', () => {
    it('renderiza botao de condicao para tipo suportado', () => {
      render(
        <FieldConditionEditor
          fieldType="yes_no"
          fieldName="Piso limpo?"
          condition={null}
          onChange={vi.fn()}
          users={mockUsers}
        />
      )
      expect(screen.getByText('Condição de Não Conformidade')).toBeInTheDocument()
    })

    it('retorna null para tipo de campo nao suportado', () => {
      const { container } = render(
        <FieldConditionEditor
          fieldType="photo"
          fieldName="Foto"
          condition={null}
          onChange={vi.fn()}
          users={mockUsers}
        />
      )
      expect(container.innerHTML).toBe('')
    })

    it('retorna null para tipo signature', () => {
      const { container } = render(
        <FieldConditionEditor
          fieldType="signature"
          fieldName="Assinatura"
          condition={null}
          onChange={vi.fn()}
          users={mockUsers}
        />
      )
      expect(container.innerHTML).toBe('')
    })

    it('mostra badge "Ativa" quando condicao existe', () => {
      render(
        <FieldConditionEditor
          fieldType="yes_no"
          fieldName="Piso limpo?"
          condition={defaultCondition}
          onChange={vi.fn()}
          users={mockUsers}
        />
      )
      expect(screen.getByText('Ativa')).toBeInTheDocument()
    })

    it('nao mostra badge "Ativa" quando condicao e null', () => {
      render(
        <FieldConditionEditor
          fieldType="yes_no"
          fieldName="Piso limpo?"
          condition={null}
          onChange={vi.fn()}
          users={mockUsers}
        />
      )
      expect(screen.queryByText('Ativa')).not.toBeInTheDocument()
    })

    it('cria condicao com defaults de yes_no ao clicar no botao sem condicao', () => {
      const onChange = vi.fn()
      render(
        <FieldConditionEditor
          fieldType="yes_no"
          fieldName="Piso limpo?"
          condition={null}
          onChange={onChange}
          users={mockUsers}
        />
      )
      fireEvent.click(screen.getByText('Condição de Não Conformidade'))
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: true,
          conditionType: 'equals',
          conditionValue: { value: 'Nao' },
          severity: 'media',
          deadlineDays: 7,
          descriptionTemplate: expect.stringContaining('Piso limpo?'),
        })
      )
    })

    it('cria condicao com defaults de number', () => {
      const onChange = vi.fn()
      render(
        <FieldConditionEditor
          fieldType="number"
          fieldName="Temperatura"
          condition={null}
          onChange={onChange}
          users={mockUsers}
        />
      )
      fireEvent.click(screen.getByText('Condição de Não Conformidade'))
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          conditionType: 'less_than',
          conditionValue: { min: 0 },
        })
      )
    })

    it('cria condicao com defaults de rating', () => {
      const onChange = vi.fn()
      render(
        <FieldConditionEditor
          fieldType="rating"
          fieldName="Avaliacao"
          condition={null}
          onChange={onChange}
          users={mockUsers}
        />
      )
      fireEvent.click(screen.getByText('Condição de Não Conformidade'))
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          conditionType: 'less_than',
          conditionValue: { threshold: 3 },
        })
      )
    })

    it('cria condicao com defaults de dropdown', () => {
      const onChange = vi.fn()
      render(
        <FieldConditionEditor
          fieldType="dropdown"
          fieldName="Estado"
          condition={null}
          onChange={onChange}
          users={mockUsers}
        />
      )
      fireEvent.click(screen.getByText('Condição de Não Conformidade'))
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          conditionType: 'in_list',
          conditionValue: { values: [] },
        })
      )
    })

    it('cria condicao com defaults de checkbox_multiple', () => {
      const onChange = vi.fn()
      render(
        <FieldConditionEditor
          fieldType="checkbox_multiple"
          fieldName="Itens"
          condition={null}
          onChange={onChange}
          users={mockUsers}
        />
      )
      fireEvent.click(screen.getByText('Condição de Não Conformidade'))
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          conditionType: 'in_list',
          conditionValue: { required: [], forbidden: [] },
        })
      )
    })

    it('cria condicao com defaults de text', () => {
      const onChange = vi.fn()
      render(
        <FieldConditionEditor
          fieldType="text"
          fieldName="Observacao"
          condition={null}
          onChange={onChange}
          users={mockUsers}
        />
      )
      fireEvent.click(screen.getByText('Condição de Não Conformidade'))
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          conditionType: 'empty',
          conditionValue: {},
        })
      )
    })
  })

  // ============================================
  // Modal — Remover condição
  // ============================================

  describe('remover condicao', () => {
    it('chama onChange(null) ao clicar em remover', () => {
      const onChange = vi.fn()
      render(
        <FieldConditionEditor
          fieldType="yes_no"
          fieldName="Piso limpo?"
          condition={defaultCondition}
          onChange={onChange}
          users={mockUsers}
        />
      )
      // Open modal
      fireEvent.click(screen.getByText('Condição de Não Conformidade'))
      // Click remove
      fireEvent.click(screen.getByText('Remover condição'))
      expect(onChange).toHaveBeenCalledWith(null)
    })
  })

  // ============================================
  // Modal — Campos comuns
  // ============================================

  describe('campos comuns do modal', () => {
    function renderWithModal(fieldType = 'yes_no', condition = defaultCondition) {
      const onChange = vi.fn()
      render(
        <FieldConditionEditor
          fieldType={fieldType}
          fieldName="Campo Teste"
          condition={condition}
          onChange={onChange}
          users={mockUsers}
          presets={mockPresets}
          onSaveAsPreset={vi.fn()}
        />
      )
      fireEvent.click(screen.getByText('Condição de Não Conformidade'))
      return onChange
    }

    it('mostra campo de severidade', () => {
      renderWithModal()
      expect(screen.getByText('Severidade')).toBeInTheDocument()
    })

    it('mostra campo de prazo', () => {
      renderWithModal()
      expect(screen.getByText('Prazo (dias)')).toBeInTheDocument()
    })

    it('mostra campo de responsavel padrao', () => {
      renderWithModal()
      expect(screen.getByText('Responsável padrão')).toBeInTheDocument()
    })

    it('mostra campo de descricao do plano', () => {
      renderWithModal()
      expect(screen.getByText('Descrição do plano')).toBeInTheDocument()
    })

    it('mostra variaveis disponiveis para descricao', () => {
      renderWithModal()
      // Variables text may appear in both the description template value and the hint;
      // use getAllByText to account for multiple matches
      expect(screen.getAllByText(/\{field_name\}/).length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText(/\{store_name\}/).length).toBeGreaterThanOrEqual(1)
    })

    it('mostra secao de exigencias para conclusao', () => {
      renderWithModal()
      expect(screen.getByText('Exigências para Conclusão')).toBeInTheDocument()
    })

    it('mostra campo de max caracteres', () => {
      renderWithModal()
      expect(screen.getByText('Max. caracteres do texto')).toBeInTheDocument()
    })

    it('atualiza prazo ao digitar', () => {
      const onChange = renderWithModal()
      const deadlineInput = screen.getByDisplayValue('7')
      fireEvent.change(deadlineInput, { target: { value: '14' } })
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ deadlineDays: 14 })
      )
    })

    it('atualiza descricao ao digitar', () => {
      const onChange = renderWithModal()
      const textarea = screen.getByDisplayValue('Nao conformidade: Campo - {store_name}')
      fireEvent.change(textarea, { target: { value: 'Nova descricao' } })
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ descriptionTemplate: 'Nova descricao' })
      )
    })

    it('atualiza max chars', () => {
      const onChange = renderWithModal()
      const maxCharsInput = screen.getByDisplayValue('800')
      fireEvent.change(maxCharsInput, { target: { value: '1500' } })
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ completionMaxChars: 1500 })
      )
    })
  })

  // ============================================
  // Type-specific: yes_no
  // ============================================

  describe('yes_no config', () => {
    it('mostra select de valor Nao/Sim no modal', () => {
      const onChange = vi.fn()
      render(
        <FieldConditionEditor
          fieldType="yes_no"
          fieldName="Piso limpo?"
          condition={defaultCondition}
          onChange={onChange}
          users={mockUsers}
        />
      )
      fireEvent.click(screen.getByText('Condição de Não Conformidade'))
      expect(screen.getByText('Valor que indica não conformidade')).toBeInTheDocument()
    })
  })

  // ============================================
  // Type-specific: number
  // ============================================

  describe('number config', () => {
    const numberCondition: ConditionConfig = {
      ...defaultCondition,
      conditionType: 'less_than',
      conditionValue: { min: 5 },
    }

    it('mostra campo Minimo para less_than', () => {
      render(
        <FieldConditionEditor
          fieldType="number"
          fieldName="Temperatura"
          condition={numberCondition}
          onChange={vi.fn()}
          users={mockUsers}
        />
      )
      fireEvent.click(screen.getByText('Condição de Não Conformidade'))
      expect(screen.getByText('Mínimo')).toBeInTheDocument()
    })

    it('mostra campo Maximo para greater_than', () => {
      render(
        <FieldConditionEditor
          fieldType="number"
          fieldName="Temperatura"
          condition={{ ...numberCondition, conditionType: 'greater_than', conditionValue: { max: 100 } }}
          onChange={vi.fn()}
          users={mockUsers}
        />
      )
      fireEvent.click(screen.getByText('Condição de Não Conformidade'))
      expect(screen.getByText('Máximo')).toBeInTheDocument()
    })

    it('mostra campos Min e Max para between', () => {
      render(
        <FieldConditionEditor
          fieldType="number"
          fieldName="Temperatura"
          condition={{ ...numberCondition, conditionType: 'between', conditionValue: { min: 0, max: 100 } }}
          onChange={vi.fn()}
          users={mockUsers}
        />
      )
      fireEvent.click(screen.getByText('Condição de Não Conformidade'))
      expect(screen.getByText('Mínimo')).toBeInTheDocument()
      expect(screen.getByText('Máximo')).toBeInTheDocument()
    })

    it('atualiza valor min', () => {
      const onChange = vi.fn()
      render(
        <FieldConditionEditor
          fieldType="number"
          fieldName="Temperatura"
          condition={numberCondition}
          onChange={onChange}
          users={mockUsers}
        />
      )
      fireEvent.click(screen.getByText('Condição de Não Conformidade'))
      const minInput = screen.getByDisplayValue('5')
      fireEvent.change(minInput, { target: { value: '10' } })
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          conditionValue: expect.objectContaining({ min: 10 }),
        })
      )
    })
  })

  // ============================================
  // Type-specific: rating
  // ============================================

  describe('rating config', () => {
    const ratingCondition: ConditionConfig = {
      ...defaultCondition,
      conditionType: 'less_than',
      conditionValue: { threshold: 3 },
    }

    it('mostra campo de threshold', () => {
      render(
        <FieldConditionEditor
          fieldType="rating"
          fieldName="Avaliacao"
          condition={ratingCondition}
          onChange={vi.fn()}
          users={mockUsers}
        />
      )
      fireEvent.click(screen.getByText('Condição de Não Conformidade'))
      // "menor que" appears in both the label and the description text
      expect(screen.getAllByText(/menor que/).length).toBeGreaterThanOrEqual(1)
      expect(screen.getByDisplayValue('3')).toBeInTheDocument()
    })

    it('atualiza threshold', () => {
      const onChange = vi.fn()
      render(
        <FieldConditionEditor
          fieldType="rating"
          fieldName="Avaliacao"
          condition={ratingCondition}
          onChange={onChange}
          users={mockUsers}
        />
      )
      fireEvent.click(screen.getByText('Condição de Não Conformidade'))
      const input = screen.getByDisplayValue('3')
      fireEvent.change(input, { target: { value: '4' } })
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          conditionType: 'less_than',
          conditionValue: { threshold: 4 },
        })
      )
    })
  })

  // ============================================
  // Type-specific: dropdown
  // ============================================

  describe('dropdown config', () => {
    const dropdownCondition: ConditionConfig = {
      ...defaultCondition,
      conditionType: 'in_list',
      conditionValue: { values: [] },
    }

    it('mostra opcoes do dropdown como checkboxes', () => {
      render(
        <FieldConditionEditor
          fieldType="dropdown"
          fieldName="Estado"
          dropdownOptions={['Bom', 'Regular', 'Ruim']}
          condition={dropdownCondition}
          onChange={vi.fn()}
          users={mockUsers}
        />
      )
      fireEvent.click(screen.getByText('Condição de Não Conformidade'))
      expect(screen.getByText('Valores que indicam não conformidade')).toBeInTheDocument()
      expect(screen.getByText('Bom')).toBeInTheDocument()
      expect(screen.getByText('Regular')).toBeInTheDocument()
      expect(screen.getByText('Ruim')).toBeInTheDocument()
    })

    it('mostra mensagem quando sem opcoes', () => {
      render(
        <FieldConditionEditor
          fieldType="dropdown"
          fieldName="Estado"
          dropdownOptions={[]}
          condition={dropdownCondition}
          onChange={vi.fn()}
          users={mockUsers}
        />
      )
      fireEvent.click(screen.getByText('Condição de Não Conformidade'))
      expect(screen.getByText(/Adicione opções ao dropdown primeiro/)).toBeInTheDocument()
    })

    it('adiciona valor nao conforme ao marcar checkbox', () => {
      const onChange = vi.fn()
      render(
        <FieldConditionEditor
          fieldType="dropdown"
          fieldName="Estado"
          dropdownOptions={['Bom', 'Regular', 'Ruim']}
          condition={dropdownCondition}
          onChange={onChange}
          users={mockUsers}
        />
      )
      fireEvent.click(screen.getByText('Condição de Não Conformidade'))
      // Find the checkbox for "Ruim" inside the dropdown config
      const checkboxes = screen.getAllByRole('checkbox')
      const ruimCheckbox = checkboxes.find(cb => {
        const label = cb.closest('label')
        return label?.textContent?.includes('Ruim')
      })
      expect(ruimCheckbox).toBeDefined()
      fireEvent.click(ruimCheckbox!)
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          conditionType: 'in_list',
          conditionValue: { values: ['Ruim'] },
        })
      )
    })

    it('remove valor nao conforme ao desmarcar checkbox', () => {
      const onChange = vi.fn()
      const conditionWithValues = {
        ...dropdownCondition,
        conditionValue: { values: ['Ruim', 'Regular'] },
      }
      render(
        <FieldConditionEditor
          fieldType="dropdown"
          fieldName="Estado"
          dropdownOptions={['Bom', 'Regular', 'Ruim']}
          condition={conditionWithValues}
          onChange={onChange}
          users={mockUsers}
        />
      )
      fireEvent.click(screen.getByText('Condição de Não Conformidade'))
      const checkboxes = screen.getAllByRole('checkbox')
      const ruimCheckbox = checkboxes.find(cb => {
        const label = cb.closest('label')
        return label?.textContent?.includes('Ruim')
      })
      fireEvent.click(ruimCheckbox!)
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          conditionValue: { values: ['Regular'] },
        })
      )
    })
  })

  // ============================================
  // Type-specific: checkbox_multiple
  // ============================================

  describe('checkbox_multiple config', () => {
    const checkboxCondition: ConditionConfig = {
      ...defaultCondition,
      conditionType: 'in_list',
      conditionValue: { required: [], forbidden: [] },
    }

    it('mostra secoes de itens obrigatorios e proibidos', () => {
      render(
        <FieldConditionEditor
          fieldType="checkbox_multiple"
          fieldName="Itens"
          checkboxOptions={['EPI', 'Luvas', 'Oculos']}
          condition={checkboxCondition}
          onChange={vi.fn()}
          users={mockUsers}
        />
      )
      fireEvent.click(screen.getByText('Condição de Não Conformidade'))
      expect(screen.getByText(/Itens obrigatórios/)).toBeInTheDocument()
      expect(screen.getByText(/Itens proibidos/)).toBeInTheDocument()
    })

    it('mostra mensagem quando sem opcoes de checkbox', () => {
      render(
        <FieldConditionEditor
          fieldType="checkbox_multiple"
          fieldName="Itens"
          checkboxOptions={[]}
          condition={checkboxCondition}
          onChange={vi.fn()}
          users={mockUsers}
        />
      )
      fireEvent.click(screen.getByText('Condição de Não Conformidade'))
      expect(screen.getByText(/Adicione opções ao checkbox primeiro/)).toBeInTheDocument()
    })

    it('adiciona item obrigatorio ao marcar', () => {
      const onChange = vi.fn()
      render(
        <FieldConditionEditor
          fieldType="checkbox_multiple"
          fieldName="Itens"
          checkboxOptions={['EPI', 'Luvas']}
          condition={checkboxCondition}
          onChange={onChange}
          users={mockUsers}
        />
      )
      fireEvent.click(screen.getByText('Condição de Não Conformidade'))
      // The first set of checkboxes are "required", second set are "forbidden"
      const checkboxes = screen.getAllByRole('checkbox')
      // First checkbox in the required section should be "EPI"
      fireEvent.click(checkboxes[0])
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          conditionValue: expect.objectContaining({ required: ['EPI'] }),
        })
      )
    })
  })

  // ============================================
  // Type-specific: text
  // ============================================

  describe('text config', () => {
    const textCondition: ConditionConfig = {
      ...defaultCondition,
      conditionType: 'empty',
      conditionValue: {},
    }

    it('mostra select de tipo de condicao', () => {
      render(
        <FieldConditionEditor
          fieldType="text"
          fieldName="Observacao"
          condition={textCondition}
          onChange={vi.fn()}
          users={mockUsers}
        />
      )
      fireEvent.click(screen.getByText('Condição de Não Conformidade'))
      expect(screen.getByText('Tipo de condição')).toBeInTheDocument()
    })

    it('nao mostra campo de valor para condicao empty', () => {
      render(
        <FieldConditionEditor
          fieldType="text"
          fieldName="Observacao"
          condition={textCondition}
          onChange={vi.fn()}
          users={mockUsers}
        />
      )
      fireEvent.click(screen.getByText('Condição de Não Conformidade'))
      expect(screen.queryByPlaceholderText('Valor para comparação')).not.toBeInTheDocument()
    })

    it('mostra campo de valor para condicao equals', () => {
      render(
        <FieldConditionEditor
          fieldType="text"
          fieldName="Observacao"
          condition={{ ...textCondition, conditionType: 'equals', conditionValue: { value: '' } }}
          onChange={vi.fn()}
          users={mockUsers}
        />
      )
      fireEvent.click(screen.getByText('Condição de Não Conformidade'))
      expect(screen.getByPlaceholderText('Valor para comparação')).toBeInTheDocument()
    })

    it('mostra campo de valor para condicao not_equals', () => {
      render(
        <FieldConditionEditor
          fieldType="text"
          fieldName="Observacao"
          condition={{ ...textCondition, conditionType: 'not_equals', conditionValue: { value: '' } }}
          onChange={vi.fn()}
          users={mockUsers}
        />
      )
      fireEvent.click(screen.getByText('Condição de Não Conformidade'))
      expect(screen.getByPlaceholderText('Valor para comparação')).toBeInTheDocument()
    })
  })

  // ============================================
  // Preset system
  // ============================================

  describe('preset system', () => {
    it('mostra selector de modelo quando presets disponiveis', () => {
      render(
        <FieldConditionEditor
          fieldType="yes_no"
          fieldName="Piso limpo?"
          condition={defaultCondition}
          onChange={vi.fn()}
          users={mockUsers}
          presets={mockPresets}
        />
      )
      fireEvent.click(screen.getByText('Condição de Não Conformidade'))
      expect(screen.getByText('Usar modelo')).toBeInTheDocument()
    })

    it('nao mostra selector de modelo quando sem presets', () => {
      render(
        <FieldConditionEditor
          fieldType="yes_no"
          fieldName="Piso limpo?"
          condition={defaultCondition}
          onChange={vi.fn()}
          users={mockUsers}
          presets={[]}
        />
      )
      fireEvent.click(screen.getByText('Condição de Não Conformidade'))
      expect(screen.queryByText('Usar modelo')).not.toBeInTheDocument()
    })

    it('mostra botao salvar como modelo quando onSaveAsPreset fornecido', () => {
      render(
        <FieldConditionEditor
          fieldType="yes_no"
          fieldName="Piso limpo?"
          condition={defaultCondition}
          onChange={vi.fn()}
          users={mockUsers}
          onSaveAsPreset={vi.fn()}
        />
      )
      fireEvent.click(screen.getByText('Condição de Não Conformidade'))
      expect(screen.getByText('Salvar como modelo reutilizável')).toBeInTheDocument()
    })

    it('nao mostra botao salvar quando onSaveAsPreset nao fornecido', () => {
      render(
        <FieldConditionEditor
          fieldType="yes_no"
          fieldName="Piso limpo?"
          condition={defaultCondition}
          onChange={vi.fn()}
          users={mockUsers}
        />
      )
      fireEvent.click(screen.getByText('Condição de Não Conformidade'))
      expect(screen.queryByText('Salvar como modelo reutilizável')).not.toBeInTheDocument()
    })

    it('mostra input de nome ao clicar em salvar como modelo', () => {
      render(
        <FieldConditionEditor
          fieldType="yes_no"
          fieldName="Piso limpo?"
          condition={defaultCondition}
          onChange={vi.fn()}
          users={mockUsers}
          onSaveAsPreset={vi.fn()}
        />
      )
      fireEvent.click(screen.getByText('Condição de Não Conformidade'))
      fireEvent.click(screen.getByText('Salvar como modelo reutilizável'))
      expect(screen.getByPlaceholderText('Nome do modelo')).toBeInTheDocument()
    })

    it('chama onSaveAsPreset com dados corretos', () => {
      const onSaveAsPreset = vi.fn()
      render(
        <FieldConditionEditor
          fieldType="yes_no"
          fieldName="Piso limpo?"
          condition={defaultCondition}
          onChange={vi.fn()}
          users={mockUsers}
          onSaveAsPreset={onSaveAsPreset}
        />
      )
      fireEvent.click(screen.getByText('Condição de Não Conformidade'))
      fireEvent.click(screen.getByText('Salvar como modelo reutilizável'))

      const nameInput = screen.getByPlaceholderText('Nome do modelo')
      fireEvent.change(nameInput, { target: { value: 'Meu Modelo' } })
      fireEvent.click(screen.getByText('Salvar'))

      expect(onSaveAsPreset).toHaveBeenCalledWith({
        name: 'Meu Modelo',
        severity: 'media',
        deadlineDays: 7,
        defaultAssigneeId: null,
        descriptionTemplate: 'Nao conformidade: Campo - {store_name}',
      })
    })

    it('botao Salvar desabilitado quando nome vazio', () => {
      render(
        <FieldConditionEditor
          fieldType="yes_no"
          fieldName="Piso limpo?"
          condition={defaultCondition}
          onChange={vi.fn()}
          users={mockUsers}
          onSaveAsPreset={vi.fn()}
        />
      )
      fireEvent.click(screen.getByText('Condição de Não Conformidade'))
      fireEvent.click(screen.getByText('Salvar como modelo reutilizável'))

      const saveBtn = screen.getByText('Salvar')
      expect(saveBtn).toBeDisabled()
    })

    it('cancelar salvar como modelo volta ao estado inicial', () => {
      render(
        <FieldConditionEditor
          fieldType="yes_no"
          fieldName="Piso limpo?"
          condition={defaultCondition}
          onChange={vi.fn()}
          users={mockUsers}
          onSaveAsPreset={vi.fn()}
        />
      )
      fireEvent.click(screen.getByText('Condição de Não Conformidade'))
      fireEvent.click(screen.getByText('Salvar como modelo reutilizável'))
      expect(screen.getByPlaceholderText('Nome do modelo')).toBeInTheDocument()

      fireEvent.click(screen.getByText('Cancelar'))
      expect(screen.queryByPlaceholderText('Nome do modelo')).not.toBeInTheDocument()
      expect(screen.getByText('Salvar como modelo reutilizável')).toBeInTheDocument()
    })
  })
})
