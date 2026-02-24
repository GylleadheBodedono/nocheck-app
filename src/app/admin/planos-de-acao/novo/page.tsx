'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'
import { FiSave, FiFileText } from 'react-icons/fi'
import { APP_CONFIG } from '@/lib/config'
import { LoadingPage, Header } from '@/components/ui'
import { getAuthCache, getUserCache } from '@/lib/offlineCache'
import { createNotification, sendEmailNotification } from '@/lib/notificationService'
import { buildEmailFromTemplate, SEVERITY_COLORS, type EmailTemplateVariables } from '@/lib/emailTemplateEngine'
import Link from 'next/link'

type StoreOption = {
  id: number
  name: string
}

type UserOption = {
  id: string
  full_name: string
}

export default function NovoPlanoDeAcaoPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [stores, setStores] = useState<StoreOption[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedStoreIds, setSelectedStoreIds] = useState<number[]>([])
  const [severity, setSeverity] = useState<string>('media')
  const [assigneeId, setAssigneeId] = useState<string>('')
  const [deadlineDate, setDeadlineDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return d.toISOString().split('T')[0]
  })

  useEffect(() => {
    const init = async () => {
      if (!isSupabaseConfigured || !supabase) {
        setLoading(false)
        return
      }

      let currentUserId: string | null = null
      let isAdmin = false

      // Try online auth
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
        console.log('[PlanoDeAcao] Falha ao verificar online, tentando cache...')
      }

      // Fallback to cache if offline
      if (!currentUserId) {
        try {
          const cachedAuth = await getAuthCache()
          if (cachedAuth) {
            currentUserId = cachedAuth.userId
            const cachedUser = await getUserCache(cachedAuth.userId)
            isAdmin = cachedUser?.is_admin || false
          }
        } catch {
          console.log('[PlanoDeAcao] Falha ao buscar cache')
        }
      }

      if (!currentUserId) {
        router.push(APP_CONFIG.routes.login)
        return
      }

      if (!isAdmin) {
        router.push(APP_CONFIG.routes.dashboard)
        return
      }

      setUserId(currentUserId)

      // Fetch stores and users for the form
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const [storesRes, usersRes] = await Promise.all([
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase as any).from('stores').select('id, name').eq('is_active', true).order('name'),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase as any).from('users').select('id, full_name').eq('is_active', true).order('full_name'),
        ])

        if (storesRes.data) setStores(storesRes.data as StoreOption[])
        if (usersRes.data) setUsers(usersRes.data as UserOption[])
      } catch {
        console.log('[PlanoDeAcao] Falha ao buscar dados do formulario')
      }

      setLoading(false)
    }

    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)

    if (selectedStoreIds.length === 0) {
      setError('Selecione pelo menos uma loja')
      setSaving(false)
      return
    }

    if (!assigneeId) {
      setError('Selecione um responsavel')
      setSaving(false)
      return
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: plan, error: insertError } = await (supabase as any)
        .from('action_plans')
        .insert({
          title,
          description: description || null,
          store_id: selectedStoreIds[0],
          severity,
          status: 'aberto',
          assigned_to: assigneeId,
          assigned_by: userId,
          deadline: deadlineDate,
          created_by: userId,
        })
        .select('id')
        .single()

      if (insertError) throw insertError

      // Insert multi-store associations
      if (plan?.id && selectedStoreIds.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('action_plan_stores')
          .insert(
            selectedStoreIds.map(sid => ({
              action_plan_id: plan.id,
              store_id: sid,
            }))
          )
      }

      // Notificar usuario assignado
      if (plan?.id && assigneeId) {
        const assigneeName = users.find(u => u.id === assigneeId)?.full_name || ''
        await createNotification(supabase, assigneeId, {
          type: 'action_plan_assigned',
          title: 'Novo Plano de Acao atribuido a voce',
          message: `${title} | Severidade: ${severity} | Prazo: ${deadlineDate}`,
          link: `/admin/planos-de-acao/${plan.id}`,
          metadata: { plan_id: plan.id, severity, deadline: deadlineDate, assignee_name: assigneeName },
        }).catch(err => console.warn('[PlanoDeAcao] Erro ao criar notificacao:', err))

        // Enviar email ao responsavel
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const sb = supabase as any
          const [assigneeRes, emailTplRes, emailSubjRes, creatorRes] = await Promise.all([
            sb.from('users').select('email, full_name').eq('id', assigneeId).single(),
            sb.from('app_settings').select('value').eq('key', 'action_plan_email_template').maybeSingle(),
            sb.from('app_settings').select('value').eq('key', 'action_plan_email_subject').maybeSingle(),
            sb.from('users').select('full_name').eq('id', userId).single(),
          ])

          const assigneeEmail = assigneeRes.data?.email
          if (assigneeEmail) {
            const storeNames = selectedStoreIds.map(sid => stores.find(s => s.id === sid)?.name || `Loja #${sid}`).join(', ')
            const creatorName = creatorRes.data?.full_name || 'Admin'

            const emailVars: EmailTemplateVariables = {
              plan_title: title,
              field_name: 'N/A (plano manual)',
              store_name: storeNames,
              sector_name: '',
              template_name: 'Manual',
              respondent_name: creatorName,
              respondent_time: new Date().toLocaleString('pt-BR'),
              assignee_name: assigneeName,
              severity,
              severity_label: severity.charAt(0).toUpperCase() + severity.slice(1),
              severity_color: SEVERITY_COLORS[severity] || '#f59e0b',
              deadline: new Date(deadlineDate).toLocaleDateString('pt-BR'),
              non_conformity_value: 'N/A',
              description: description || '',
              plan_url: `${window.location.origin}/admin/planos-de-acao/${plan.id}`,
              plan_id: String(plan.id),
              is_reincidencia: 'Nao',
              reincidencia_count: '0',
              reincidencia_prefix: '',
              app_name: 'NoCheck',
            }

            const { html, subject } = buildEmailFromTemplate(
              emailTplRes.data?.value || null,
              emailSubjRes.data?.value || null,
              emailVars
            )

            const { data: { session } } = await supabase.auth.getSession()
            const emailResult = await sendEmailNotification(assigneeEmail, subject, html, session?.access_token || undefined)
            console.log('[PlanoDeAcao] Email para', assigneeEmail, ':', emailResult.success ? 'OK' : emailResult.error)
          }
        } catch (emailErr) {
          console.warn('[PlanoDeAcao] Erro ao enviar email:', emailErr)
        }
      }

      router.push(`/admin/planos-de-acao/${plan.id}`)
    } catch (err) {
      console.error('Error creating action plan:', err)
      const supaErr = err as { message?: string; details?: string }
      setError(supaErr?.message || supaErr?.details || 'Erro ao criar plano de acao')
      setSaving(false)
    }
  }

  if (loading) {
    return <LoadingPage />
  }

  return (
    <div className="min-h-screen bg-page">
      <Header
        title="Novo Plano de Acao"
        icon={FiFileText}
        backHref="/admin/planos-de-acao"
      />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-main mb-4">Informacoes do Plano</h2>

            <div className="space-y-4">
              {/* Titulo */}
              <div>
                <label className="block text-sm font-medium text-main mb-1">
                  Titulo *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="input"
                  placeholder="Ex: Corrigir temperatura do freezer"
                />
              </div>

              {/* Descricao */}
              <div>
                <label className="block text-sm font-medium text-main mb-1">
                  Descricao
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="input resize-none"
                  placeholder="Descreva o problema e as acoes necessarias..."
                />
              </div>

              {/* Lojas (multi-select) */}
              <div>
                <label className="block text-sm font-medium text-main mb-1">
                  Lojas * <span className="text-muted font-normal text-xs">(selecione uma ou mais)</span>
                </label>
                <div className="border border-subtle rounded-xl p-3 max-h-48 overflow-y-auto space-y-1 bg-surface">
                  {stores.map((store) => (
                    <label key={store.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-hover cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedStoreIds.includes(store.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedStoreIds(prev => [...prev, store.id])
                          } else {
                            setSelectedStoreIds(prev => prev.filter(id => id !== store.id))
                          }
                        }}
                        className="w-4 h-4 rounded border-default bg-surface text-primary focus:ring-primary"
                      />
                      <span className="text-sm text-main">{store.name}</span>
                    </label>
                  ))}
                  {stores.length === 0 && (
                    <p className="text-sm text-muted py-2">Nenhuma loja encontrada</p>
                  )}
                </div>
                {selectedStoreIds.length > 0 && (
                  <p className="text-xs text-muted mt-1">{selectedStoreIds.length} loja{selectedStoreIds.length !== 1 ? 's' : ''} selecionada{selectedStoreIds.length !== 1 ? 's' : ''}</p>
                )}
              </div>

              {/* Severidade */}
              <div>
                <label className="block text-sm font-medium text-main mb-1">
                  Severidade
                </label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                  className="input"
                >
                  <option value="baixa">Baixa</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                  <option value="critica">Critica</option>
                </select>
              </div>

              {/* Responsavel */}
              <div>
                <label className="block text-sm font-medium text-main mb-1">
                  Responsavel *
                </label>
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  required
                  className="input"
                >
                  <option value="">Selecione o responsavel</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Prazo */}
              <div>
                <label className="block text-sm font-medium text-main mb-1">
                  Prazo *
                </label>
                <input
                  type="date"
                  value={deadlineDate}
                  onChange={(e) => setDeadlineDate(e.target.value)}
                  required
                  className="input"
                />
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-4">
            <Link
              href="/admin/planos-de-acao"
              className="btn-secondary"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <FiSave className="w-4 h-4" />
                  Criar Plano de Acao
                </>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
