'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'
import {
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiSave,
  FiX,
  FiLayers,
  FiAlertTriangle,
  FiCamera,
  FiFileText,
} from 'react-icons/fi'
import { APP_CONFIG } from '@/lib/config'
import { LoadingPage, Header } from '@/components/ui'
import { getAuthCache, getUserCache } from '@/lib/offlineCache'
import type { Severity } from '@/types/database'

// ============================================
// TYPES
// ============================================

type Preset = {
  id: number
  name: string
  description_template: string | null
  severity: Severity
  default_assignee_id: string | null
  deadline_days: number
  is_active: boolean
  require_photo_on_completion: boolean
  require_text_on_completion: boolean
  completion_max_chars: number
  created_at: string
}

type UserOption = {
  id: string
  full_name: string
}

type PresetForm = {
  name: string
  description_template: string
  severity: Severity
  default_assignee_id: string
  deadline_days: number
  require_photo_on_completion: boolean
  require_text_on_completion: boolean
  completion_max_chars: number
}

const EMPTY_FORM: PresetForm = {
  name: '',
  description_template: '',
  severity: 'media',
  default_assignee_id: '',
  deadline_days: 7,
  require_photo_on_completion: false,
  require_text_on_completion: false,
  completion_max_chars: 800,
}

const SEVERITY_OPTIONS: { value: Severity; label: string; color: string }[] = [
  { value: 'baixa', label: 'Baixa', color: 'text-success' },
  { value: 'media', label: 'Media', color: 'text-warning' },
  { value: 'alta', label: 'Alta', color: 'text-orange-500' },
  { value: 'critica', label: 'Critica', color: 'text-error' },
]

const SEVERITY_BADGE: Record<string, string> = {
  baixa: 'bg-success/20 text-success',
  media: 'bg-warning/20 text-warning',
  alta: 'bg-orange-500/20 text-orange-400',
  critica: 'bg-error/20 text-error',
}

// ============================================
// COMPONENT
// ============================================

export default function ModelosPlanoDeAcaoPage() {
  const [loading, setLoading] = useState(true)
  const [presets, setPresets] = useState<Preset[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<PresetForm>(EMPTY_FORM)

  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  // ============================================
  // FETCH DATA
  // ============================================

  const fetchData = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false)
      return
    }

    let currentUserId: string | null = null
    let isAdmin = false

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        currentUserId = user.id
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: profile } = await (supabase as any)
          .from('users')
          .select('is_admin')
          .eq('id', user.id)
          .single()
        isAdmin = profile && 'is_admin' in profile ? (profile as { is_admin: boolean }).is_admin : false
      }
    } catch {
      // Fallback cache
    }

    if (!currentUserId) {
      try {
        const cachedAuth = await getAuthCache()
        if (cachedAuth) {
          currentUserId = cachedAuth.userId
          const cachedUser = await getUserCache(cachedAuth.userId)
          isAdmin = cachedUser?.is_admin || false
        }
      } catch { /* ignore */ }
    }

    if (!currentUserId) { router.push(APP_CONFIG.routes.login); return }
    if (!isAdmin) { router.push(APP_CONFIG.routes.dashboard); return }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any

    try {
      const [presetsRes, usersRes] = await Promise.all([
        sb.from('action_plan_presets')
          .select('*')
          .order('name'),
        sb.from('users')
          .select('id, full_name')
          .eq('is_active', true)
          .order('full_name'),
      ])

      if (presetsRes.data) setPresets(presetsRes.data)
      if (usersRes.data) setUsers(usersRes.data)
    } catch (err) {
      console.error('[Modelos] Erro ao buscar dados:', err)
    }

    setLoading(false)
  }, [supabase, router])

  useEffect(() => {
    fetchData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ============================================
  // FORM HANDLERS
  // ============================================

  const handleNew = () => {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setShowForm(true)
    setError(null)
  }

  const handleEdit = (preset: Preset) => {
    setForm({
      name: preset.name,
      description_template: preset.description_template || '',
      severity: preset.severity,
      default_assignee_id: preset.default_assignee_id || '',
      deadline_days: preset.deadline_days,
      require_photo_on_completion: preset.require_photo_on_completion || false,
      require_text_on_completion: preset.require_text_on_completion || false,
      completion_max_chars: preset.completion_max_chars || 800,
    })
    setEditingId(preset.id)
    setShowForm(true)
    setError(null)
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
    setError(null)
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('Nome do modelo e obrigatorio')
      return
    }

    setSaving(true)
    setError(null)

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any
      const payload = {
        name: form.name.trim(),
        description_template: form.description_template.trim() || null,
        severity: form.severity,
        default_assignee_id: form.default_assignee_id || null,
        deadline_days: form.deadline_days,
        require_photo_on_completion: form.require_photo_on_completion,
        require_text_on_completion: form.require_text_on_completion,
        completion_max_chars: form.completion_max_chars,
        updated_at: new Date().toISOString(),
      }

      if (editingId) {
        const { error: updateErr } = await sb
          .from('action_plan_presets')
          .update(payload)
          .eq('id', editingId)
        if (updateErr) throw updateErr
        setSuccess('Modelo atualizado com sucesso!')
      } else {
        const { error: insertErr } = await sb
          .from('action_plan_presets')
          .insert({ ...payload, is_active: true })
        if (insertErr) throw insertErr
        setSuccess('Modelo criado com sucesso!')
      }

      setShowForm(false)
      setEditingId(null)
      setForm(EMPTY_FORM)
      await fetchData()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('[Modelos] Erro ao salvar:', err)
      setError(err instanceof Error ? err.message : 'Erro ao salvar modelo')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (preset: Preset) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateErr } = await (supabase as any)
        .from('action_plan_presets')
        .update({ is_active: !preset.is_active, updated_at: new Date().toISOString() })
        .eq('id', preset.id)
      if (updateErr) throw updateErr
      await fetchData()
    } catch (err) {
      console.error('[Modelos] Erro ao alternar status:', err)
      setError('Erro ao alternar status do modelo')
    }
  }

  const handleDelete = async (preset: Preset) => {
    if (!confirm(`Excluir o modelo "${preset.name}"? Esta acao nao pode ser desfeita.`)) return

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: delErr } = await (supabase as any)
        .from('action_plan_presets')
        .delete()
        .eq('id', preset.id)
      if (delErr) throw delErr
      await fetchData()
      setSuccess('Modelo excluido')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('[Modelos] Erro ao excluir:', err)
      setError('Erro ao excluir modelo')
    }
  }

  // ============================================
  // RENDER
  // ============================================

  if (loading) return <LoadingPage />

  const activePresets = presets.filter(p => p.is_active)
  const inactivePresets = presets.filter(p => !p.is_active)

  return (
    <div className="min-h-screen bg-page">
      <Header
        title="Modelos de Plano de Acao"
        icon={FiLayers}
        backHref="/admin/planos-de-acao"
      />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Messages */}
        {success && (
          <div className="p-4 bg-success/10 border border-success/30 rounded-xl">
            <p className="text-success text-sm">{success}</p>
          </div>
        )}
        {error && !showForm && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
            <p className="text-red-500 text-sm">{error}</p>
          </div>
        )}

        {/* Header actions */}
        {!showForm && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted">
              {activePresets.length} modelo(s) ativo(s)
            </p>
            <button onClick={handleNew} className="btn-primary flex items-center gap-2">
              <FiPlus className="w-4 h-4" />
              Novo Modelo
            </button>
          </div>
        )}

        {/* Form */}
        {showForm && (
          <div className="card p-6 space-y-4 border-2 border-primary/30">
            <h2 className="text-lg font-semibold text-main">
              {editingId ? 'Editar Modelo' : 'Novo Modelo'}
            </h2>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-500 text-sm">{error}</p>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-secondary mb-1">Nome do modelo *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                className="input"
                placeholder="Ex: Camera com problema, Temperatura fora do padrao"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-secondary mb-1">Severidade</label>
                <select
                  value={form.severity}
                  onChange={(e) => setForm(f => ({ ...f, severity: e.target.value as Severity }))}
                  className="input"
                >
                  {SEVERITY_OPTIONS.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-secondary mb-1">Prazo (dias)</label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={form.deadline_days}
                  onChange={(e) => setForm(f => ({ ...f, deadline_days: Number(e.target.value) || 7 }))}
                  className="input"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-secondary mb-1">Responsavel padrao</label>
              <select
                value={form.default_assignee_id}
                onChange={(e) => setForm(f => ({ ...f, default_assignee_id: e.target.value }))}
                className="input"
              >
                <option value="">Quem preencheu o checklist</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.full_name}</option>
                ))}
              </select>
              <p className="text-xs text-muted mt-1">
                Se nao selecionado, o plano sera atribuido a quem preencheu o checklist.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-secondary mb-1">Descricao do plano</label>
              <textarea
                value={form.description_template}
                onChange={(e) => setForm(f => ({ ...f, description_template: e.target.value }))}
                className="input min-h-[80px]"
                placeholder="Ex: Nao conformidade: {field_name} com valor {value} na {store_name}"
                rows={3}
              />
              <p className="text-xs text-muted mt-1">
                Variaveis disponiveis: {'{field_name}'}, {'{value}'}, {'{store_name}'}
              </p>
            </div>

            {/* Exigencias para conclusao */}
            <div className="border-t border-subtle pt-4 mt-2">
              <label className="block text-xs font-medium text-secondary mb-3">Exigencias para Conclusao</label>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.require_photo_on_completion}
                    onChange={(e) => setForm(f => ({ ...f, require_photo_on_completion: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-600 text-primary focus:ring-primary bg-surface"
                  />
                  <div className="flex items-center gap-2">
                    <FiCamera className="w-4 h-4 text-muted" />
                    <span className="text-sm text-main">Exigir foto ao concluir</span>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.require_text_on_completion}
                    onChange={(e) => setForm(f => ({ ...f, require_text_on_completion: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-600 text-primary focus:ring-primary bg-surface"
                  />
                  <div className="flex items-center gap-2">
                    <FiFileText className="w-4 h-4 text-muted" />
                    <span className="text-sm text-main">Exigir texto ao concluir</span>
                  </div>
                </label>
                {form.require_text_on_completion && (
                  <div className="ml-7">
                    <label className="block text-xs font-medium text-secondary mb-1">Maximo de caracteres</label>
                    <input
                      type="number"
                      min={50}
                      max={5000}
                      value={form.completion_max_chars}
                      onChange={(e) => setForm(f => ({ ...f, completion_max_chars: Number(e.target.value) || 800 }))}
                      className="input w-32"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <FiSave className="w-4 h-4" />
                    {editingId ? 'Salvar Alteracoes' : 'Criar Modelo'}
                  </>
                )}
              </button>
              <button onClick={handleCancel} className="btn-ghost flex items-center gap-2">
                <FiX className="w-4 h-4" />
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Active presets list */}
        {activePresets.length === 0 && !showForm ? (
          <div className="card p-8 text-center">
            <FiLayers className="w-12 h-12 text-muted mx-auto mb-4 opacity-50" />
            <p className="text-muted mb-2">Nenhum modelo criado ainda.</p>
            <p className="text-xs text-muted mb-4">
              Crie modelos para agilizar a configuracao de condicoes de nao-conformidade nos templates de checklist.
            </p>
            <button onClick={handleNew} className="btn-primary inline-flex items-center gap-2">
              <FiPlus className="w-4 h-4" />
              Criar Primeiro Modelo
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {activePresets.map(preset => (
              <div key={preset.id} className="card p-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <FiAlertTriangle className="w-4 h-4 text-warning shrink-0" />
                    <h3 className="text-sm font-semibold text-main truncate">{preset.name}</h3>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${SEVERITY_BADGE[preset.severity] || SEVERITY_BADGE.media}`}>
                      {SEVERITY_OPTIONS.find(s => s.value === preset.severity)?.label || preset.severity}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted">
                    <span>Prazo: {preset.deadline_days} dia(s)</span>
                    <span>
                      Responsavel: {
                        preset.default_assignee_id
                          ? users.find(u => u.id === preset.default_assignee_id)?.full_name || 'Usuario'
                          : 'Quem preencheu'
                      }
                    </span>
                    {(preset.require_photo_on_completion || preset.require_text_on_completion) && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-primary/10 text-primary">
                        {preset.require_photo_on_completion && <FiCamera className="w-3 h-3" />}
                        {preset.require_text_on_completion && <FiFileText className="w-3 h-3" />}
                        Exigencia
                      </span>
                    )}
                  </div>
                  {preset.description_template && (
                    <p className="text-xs text-muted mt-1 truncate">{preset.description_template}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleEdit(preset)}
                    className="p-2 rounded-lg text-muted hover:text-primary hover:bg-surface-hover transition-colors"
                    title="Editar"
                  >
                    <FiEdit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleToggleActive(preset)}
                    className="p-2 rounded-lg text-muted hover:text-warning hover:bg-surface-hover transition-colors"
                    title="Desativar"
                  >
                    <FiX className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(preset)}
                    className="p-2 rounded-lg text-muted hover:text-error hover:bg-surface-hover transition-colors"
                    title="Excluir"
                  >
                    <FiTrash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Inactive presets */}
        {inactivePresets.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">
              Modelos Inativos ({inactivePresets.length})
            </h3>
            {inactivePresets.map(preset => (
              <div key={preset.id} className="card p-4 opacity-60 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-muted truncate">{preset.name}</h3>
                    <span className="text-xs text-muted bg-surface-hover px-2 py-0.5 rounded">Inativo</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleToggleActive(preset)}
                    className="px-3 py-1.5 text-xs rounded-lg text-primary bg-primary/10 hover:bg-primary/20 transition-colors"
                  >
                    Reativar
                  </button>
                  <button
                    onClick={() => handleDelete(preset)}
                    className="p-2 rounded-lg text-muted hover:text-error hover:bg-surface-hover transition-colors"
                    title="Excluir"
                  >
                    <FiTrash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
