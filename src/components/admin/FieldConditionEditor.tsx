'use client'

import { useState } from 'react'
import { FiAlertTriangle, FiTrash2, FiLayers, FiCamera, FiFileText } from 'react-icons/fi'
import type { ConditionType, Severity } from '@/types/database'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'

export type ConditionConfig = {
  enabled: boolean
  conditionType: ConditionType
  conditionValue: Record<string, unknown>
  severity: Severity
  defaultAssigneeId: string | null
  deadlineDays: number
  descriptionTemplate: string
  requirePhotoOnCompletion: boolean
  requireTextOnCompletion: boolean
  completionMaxChars: number
}

export type PresetOption = {
  id: number
  name: string
  severity: Severity
  deadlineDays: number
  defaultAssigneeId: string | null
  descriptionTemplate: string
  requirePhotoOnCompletion: boolean
  requireTextOnCompletion: boolean
  completionMaxChars: number
}

type UserOption = {
  id: string
  name: string
}

type Props = {
  fieldType: string
  fieldName: string
  dropdownOptions?: string[]
  checkboxOptions?: string[]
  condition: ConditionConfig | null
  onChange: (condition: ConditionConfig | null) => void
  users: UserOption[]
  presets?: PresetOption[]
  onSaveAsPreset?: (data: { name: string; severity: Severity; deadlineDays: number; defaultAssigneeId: string | null; descriptionTemplate: string }) => void
}

const SEVERITY_OPTIONS: { value: Severity; label: string; color: string }[] = [
  { value: 'baixa', label: 'Baixa', color: 'text-success' },
  { value: 'media', label: 'Media', color: 'text-warning' },
  { value: 'alta', label: 'Alta', color: 'text-orange-500' },
  { value: 'critica', label: 'Critica', color: 'text-error' },
]

const DEFAULT_CONDITION: ConditionConfig = {
  enabled: true,
  conditionType: 'equals',
  conditionValue: {},
  severity: 'media',
  defaultAssigneeId: null,
  deadlineDays: 7,
  descriptionTemplate: '',
  requirePhotoOnCompletion: true,
  requireTextOnCompletion: true,
  completionMaxChars: 800,
}

export function FieldConditionEditor({
  fieldType,
  fieldName,
  dropdownOptions = [],
  checkboxOptions = [],
  condition,
  onChange,
  users,
  presets = [],
  onSaveAsPreset,
}: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [showSavePreset, setShowSavePreset] = useState(false)
  const [presetName, setPresetName] = useState('')
  const [selectedPreset, setSelectedPreset] = useState('')

  const handleToggle = () => {
    if (!condition) {
      // Ativar com defaults baseados no tipo
      const defaults = { ...DEFAULT_CONDITION }
      switch (fieldType) {
        case 'yes_no':
          defaults.conditionType = 'equals'
          defaults.conditionValue = { value: 'Nao' }
          break
        case 'number':
          defaults.conditionType = 'less_than'
          defaults.conditionValue = { min: 0 }
          break
        case 'rating':
          defaults.conditionType = 'less_than'
          defaults.conditionValue = { threshold: 3 }
          break
        case 'dropdown':
          defaults.conditionType = 'in_list'
          defaults.conditionValue = { values: [] }
          break
        case 'checkbox_multiple':
          defaults.conditionType = 'in_list'
          defaults.conditionValue = { required: [], forbidden: [] }
          break
        case 'text':
          defaults.conditionType = 'empty'
          defaults.conditionValue = {}
          break
      }
      defaults.descriptionTemplate = `Nao conformidade: ${fieldName} - {store_name}`
      onChange(defaults)
    }
    setIsModalOpen(true)
  }

  const handleRemove = () => {
    onChange(null)
    setIsModalOpen(false)
  }

  const update = (partial: Partial<ConditionConfig>) => {
    if (!condition) return
    onChange({ ...condition, ...partial })
  }

  const handlePresetSelect = (presetId: string) => {
    if (!presetId || !condition) return
    const preset = presets.find(p => String(p.id) === presetId)
    if (!preset) return

    update({
      severity: preset.severity,
      deadlineDays: preset.deadlineDays,
      defaultAssigneeId: preset.defaultAssigneeId,
      descriptionTemplate: preset.descriptionTemplate || condition.descriptionTemplate,
      requirePhotoOnCompletion: preset.requirePhotoOnCompletion,
      requireTextOnCompletion: preset.requireTextOnCompletion,
      completionMaxChars: preset.completionMaxChars,
    })
  }

  const handleSaveAsPreset = () => {
    if (!condition || !presetName.trim() || !onSaveAsPreset) return
    onSaveAsPreset({
      name: presetName.trim(),
      severity: condition.severity,
      deadlineDays: condition.deadlineDays,
      defaultAssigneeId: condition.defaultAssigneeId,
      descriptionTemplate: condition.descriptionTemplate,
    })
    setPresetName('')
    setShowSavePreset(false)
  }

  // Tipos de campo suportados para condicoes
  const supportedTypes = ['yes_no', 'number', 'rating', 'dropdown', 'checkbox_multiple', 'text']
  if (!supportedTypes.includes(fieldType)) return null

  return (
    <div className="px-2 sm:px-3 py-2">
      <button
        type="button"
        onClick={handleToggle}
        className="flex items-center justify-center gap-2 text-sm font-medium w-full"
      >
        <FiAlertTriangle className={`w-4 h-4 ${condition ? 'text-warning' : 'text-muted'}`} />
        <span className={condition ? 'text-warning' : 'text-muted'}>
          Condicao de Nao Conformidade
        </span>
        {condition && (
          <span className="text-xs text-success bg-success/10 px-2 py-0.5 rounded-full">
            Ativa
          </span>
        )}
      </button>

      <Modal
        isOpen={isModalOpen && !!condition}
        onClose={() => setIsModalOpen(false)}
        title="Condição de Não Conformidade"
        size="md"
      >
        {condition && (
        <div className="space-y-4">
          {/* Condicao especifica por tipo */}
          {fieldType === 'yes_no' && (
            <div>
              <label className="block text-xs font-medium text-secondary mb-1">
                Valor que indica nao conformidade
              </label>
              <Select
                value={(condition.conditionValue.value as string) || 'Nao'}
                onChange={(v) => update({ conditionType: 'equals', conditionValue: { value: v } })}
                options={[
                  { value: 'Nao', label: 'Quando resposta for "Nao"' },
                  { value: 'Sim', label: 'Quando resposta for "Sim"' },
                  { value: 'N/A', label: 'Quando resposta for "N/A"' },
                ]}
              />
            </div>
          )}

          {fieldType === 'number' && (
            <div>
              <label className="block text-xs font-medium text-secondary mb-1">
                Tipo de condicao
              </label>
              <Select
                value={condition.conditionType}
                onChange={(v) => {
                  const ct = v as ConditionType
                  update({
                    conditionType: ct,
                    conditionValue: ct === 'between' ? { min: 0, max: 100 } : ct === 'less_than' ? { min: 0 } : { max: 100 },
                  })
                }}
                className="mb-2"
                options={[
                  { value: 'less_than', label: 'Menor que (valor minimo)' },
                  { value: 'greater_than', label: 'Maior que (valor maximo)' },
                  { value: 'between', label: 'Fora da faixa (min-max)' },
                ]}
              />
              <div className="grid grid-cols-2 gap-2">
                {(condition.conditionType === 'less_than' || condition.conditionType === 'between') && (
                  <div>
                    <label className="block text-xs text-muted mb-1">Minimo</label>
                    <input
                      type="number"
                      value={(condition.conditionValue.min as number) ?? 0}
                      onChange={(e) => update({
                        conditionValue: { ...condition.conditionValue, min: Number(e.target.value) },
                      })}
                      className="input"
                    />
                  </div>
                )}
                {(condition.conditionType === 'greater_than' || condition.conditionType === 'between') && (
                  <div>
                    <label className="block text-xs text-muted mb-1">Maximo</label>
                    <input
                      type="number"
                      value={(condition.conditionValue.max as number) ?? 100}
                      onChange={(e) => update({
                        conditionValue: { ...condition.conditionValue, max: Number(e.target.value) },
                      })}
                      className="input"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {fieldType === 'rating' && (
            <div>
              <label className="block text-xs font-medium text-secondary mb-1">
                Nao conforme quando menor que (estrelas)
              </label>
              <input
                type="number"
                min={1}
                max={5}
                value={(condition.conditionValue.threshold as number) ?? 3}
                onChange={(e) => update({
                  conditionType: 'less_than',
                  conditionValue: { threshold: Number(e.target.value) },
                })}
                className="input w-24"
              />
              <p className="text-xs text-muted mt-1">
                Se a nota for menor que {(condition.conditionValue.threshold as number) ?? 3} estrelas, sera considerado nao conforme.
              </p>
            </div>
          )}

          {fieldType === 'dropdown' && (
            <div>
              <label className="block text-xs font-medium text-secondary mb-1">
                Valores que indicam nao conformidade
              </label>
              {dropdownOptions.length === 0 ? (
                <p className="text-xs text-muted italic">Adicione opcoes ao dropdown primeiro.</p>
              ) : (
                <div className="space-y-1.5">
                  {dropdownOptions.map((opt) => {
                    const selected = ((condition.conditionValue.values as string[]) || []).includes(opt)
                    return (
                      <label key={opt} className="flex items-center gap-2 text-sm text-main cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={(e) => {
                            const current = (condition.conditionValue.values as string[]) || []
                            const newValues = e.target.checked
                              ? [...current, opt]
                              : current.filter(v => v !== opt)
                            update({
                              conditionType: 'in_list',
                              conditionValue: { values: newValues },
                            })
                          }}
                          className="rounded border-subtle"
                        />
                        {opt}
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {fieldType === 'checkbox_multiple' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-secondary mb-1">
                  Itens obrigatorios (nao conforme se NAO marcado)
                </label>
                {checkboxOptions.length === 0 ? (
                  <p className="text-xs text-muted italic">Adicione opcoes ao checkbox primeiro.</p>
                ) : (
                  <div className="space-y-1.5">
                    {checkboxOptions.map((opt) => {
                      const selected = ((condition.conditionValue.required as string[]) || []).includes(opt)
                      return (
                        <label key={`req-${opt}`} className="flex items-center gap-2 text-sm text-main cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={(e) => {
                              const current = (condition.conditionValue.required as string[]) || []
                              const newReq = e.target.checked
                                ? [...current, opt]
                                : current.filter(v => v !== opt)
                              update({
                                conditionValue: { ...condition.conditionValue, required: newReq },
                              })
                            }}
                            className="rounded border-subtle"
                          />
                          {opt}
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-secondary mb-1">
                  Itens proibidos (nao conforme se marcado)
                </label>
                {checkboxOptions.map((opt) => {
                  const selected = ((condition.conditionValue.forbidden as string[]) || []).includes(opt)
                  return (
                    <label key={`forb-${opt}`} className="flex items-center gap-2 text-sm text-main cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(e) => {
                          const current = (condition.conditionValue.forbidden as string[]) || []
                          const newForb = e.target.checked
                            ? [...current, opt]
                            : current.filter(v => v !== opt)
                          update({
                            conditionValue: { ...condition.conditionValue, forbidden: newForb },
                          })
                        }}
                        className="rounded border-subtle"
                      />
                      {opt}
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          {fieldType === 'text' && (
            <div>
              <label className="block text-xs font-medium text-secondary mb-1">
                Tipo de condicao
              </label>
              <Select
                value={condition.conditionType}
                onChange={(v) => {
                  const ct = v as ConditionType
                  update({ conditionType: ct, conditionValue: ct === 'empty' ? {} : { value: '' } })
                }}
                options={[
                  { value: 'empty', label: 'Campo vazio' },
                  { value: 'equals', label: 'Igual a valor especifico' },
                  { value: 'not_equals', label: 'Diferente de valor especifico' },
                ]}
              />
              {(condition.conditionType === 'equals' || condition.conditionType === 'not_equals') && (
                <input
                  type="text"
                  value={(condition.conditionValue.value as string) || ''}
                  onChange={(e) => update({ conditionValue: { value: e.target.value } })}
                  className="input mt-2"
                  placeholder="Valor para comparacao"
                />
              )}
            </div>
          )}

          {/* Campos comuns */}
          <div className="border-t border-subtle pt-3 mt-3 space-y-3">

            {/* Selector de modelo */}
            {presets.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-secondary mb-1 flex items-center gap-1.5">
                  <FiLayers className="w-3.5 h-3.5" />
                  Usar modelo
                </label>
                <Select
                  value={selectedPreset}
                  onChange={(v) => {
                    if (!v) return
                    handlePresetSelect(v)
                    setSelectedPreset('')
                  }}
                  placeholder="-- Selecione um modelo para preencher --"
                  options={presets.map((p) => ({
                    value: String(p.id),
                    label: `${p.name} (${SEVERITY_OPTIONS.find(s => s.value === p.severity)?.label}, ${p.deadlineDays}d)`,
                  }))}
                />
                <p className="text-xs text-muted mt-1">
                  Selecionar um modelo preenche severidade, prazo, responsavel e descricao automaticamente.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-secondary mb-1">Severidade</label>
                <Select
                  value={condition.severity}
                  onChange={(v) => update({ severity: v as Severity })}
                  options={SEVERITY_OPTIONS.map(s => ({ value: s.value, label: s.label }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-secondary mb-1">Prazo (dias)</label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={condition.deadlineDays}
                  onChange={(e) => update({ deadlineDays: Number(e.target.value) || 7 })}
                  className="input"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-secondary mb-1">Responsavel padrao</label>
              <Select
                value={condition.defaultAssigneeId || ''}
                onChange={(v) => update({ defaultAssigneeId: v || null })}
                placeholder="Quem preencheu o checklist"
                options={users.map(u => ({ value: u.id, label: u.name }))}
              />
              <p className="text-xs text-muted mt-1">
                Se nao selecionado, o plano sera atribuido ao usuario que preencheu o checklist.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-secondary mb-1">Descricao do plano</label>
              <textarea
                value={condition.descriptionTemplate}
                onChange={(e) => update({ descriptionTemplate: e.target.value })}
                className="input min-h-[60px]"
                placeholder="Ex: Nao conformidade: {field_name} com valor {value} na {store_name}"
                rows={2}
              />
              <p className="text-xs text-muted mt-1">
                Variaveis: {'{field_name}'}, {'{value}'}, {'{store_name}'}
              </p>
            </div>

            {/* Exigencias para conclusao */}
            <div className="border-t border-subtle pt-3 mt-1">
              <label className="block text-xs font-medium text-secondary mb-2">Exigencias para Conclusao</label>
              <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg mb-3">
                <div className="flex items-center gap-2 text-xs text-primary">
                  <FiCamera className="w-3.5 h-3.5" />
                  <FiFileText className="w-3.5 h-3.5" />
                  <span>Foto e texto sao obrigatorios para concluir o plano de acao.</span>
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Max. caracteres do texto</label>
                <input
                  type="number"
                  min={50}
                  max={5000}
                  value={condition.completionMaxChars}
                  onChange={(e) => update({ completionMaxChars: Number(e.target.value) || 800 })}
                  className="input w-28 text-sm"
                />
              </div>
            </div>

            {/* Salvar como modelo */}
            {onSaveAsPreset && (
              <div>
                {showSavePreset ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={presetName}
                      onChange={(e) => setPresetName(e.target.value)}
                      placeholder="Nome do modelo"
                      className="input flex-1 text-sm"
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSaveAsPreset() } }}
                    />
                    <button
                      type="button"
                      onClick={handleSaveAsPreset}
                      disabled={!presetName.trim()}
                      className="px-3 py-2 text-xs rounded-lg font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                    >
                      Salvar
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowSavePreset(false); setPresetName('') }}
                      className="px-3 py-2 text-xs rounded-lg text-muted hover:text-main hover:bg-surface-hover transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowSavePreset(true)}
                    className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
                  >
                    <FiLayers className="w-3.5 h-3.5" />
                    Salvar como modelo reutilizavel
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Remover condicao */}
          <button
            type="button"
            onClick={handleRemove}
            className="flex items-center gap-2 text-sm text-error hover:text-error/80 transition-colors"
          >
            <FiTrash2 className="w-3.5 h-3.5" />
            Remover condicao
          </button>
        </div>
        )}
      </Modal>
    </div>
  )
}
