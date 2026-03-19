'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import {
  FiUsers, FiHome, FiClipboard, FiShield, FiDollarSign, FiCalendar,
  FiToggleLeft, FiToggleRight, FiEye, FiTrash2,
  FiChevronLeft, FiChevronRight,
} from 'react-icons/fi'
import { PLAN_CONFIGS, type Plan, type Feature } from '@/types/tenant'
import { Modal } from '@/components/ui'

type OrgDetail = {
  id: string; name: string; slug: string; plan: string; is_active: boolean
  max_users: number; max_stores: number; features: string[]
  trial_ends_at: string | null; created_at: string
}
type Member = { id: string; user_id: string; role: string; accepted_at: string | null; email?: string; full_name?: string }
type Store = { id: string; name: string; address: string | null; created_at: string }
type Checklist = {
  id: string; status: string; created_at: string; completed_at: string | null
  template_name: string; store_name: string; user_name: string
}

type Tab = 'overview' | 'members' | 'stores' | 'checklists' | 'features'

type Props = {
  orgId: string | null
  onClose: () => void
  onOrgUpdate?: (org: { id: string; plan: string; is_active: boolean; max_users: number; max_stores: number }) => void
}

const PAGE_SIZE = 20

export function ClientDetailModal({ orgId, onClose, onOrgUpdate }: Props) {
  const [modalOrg, setModalOrg] = useState<OrgDetail | null>(null)
  const [modalMembers, setModalMembers] = useState<Member[]>([])
  const [modalStoreCount, setModalStoreCount] = useState(0)
  const [modalChecklistCount, setModalChecklistCount] = useState(0)
  const [modalLoading, setModalLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  // Stores tab
  const [stores, setStores] = useState<Store[]>([])
  const [storesLoading, setStoresLoading] = useState(false)

  // Checklists tab
  const [checklists, setChecklists] = useState<Checklist[]>([])
  const [checklistsLoading, setChecklistsLoading] = useState(false)
  const [checklistPage, setChecklistPage] = useState(0)
  const [checklistTotal, setChecklistTotal] = useState(0)
  const [expandedChecklist, setExpandedChecklist] = useState<string | null>(null)
  const [checklistResponses, setChecklistResponses] = useState<Record<string, unknown[]>>({})
  const [deletingChecklist, setDeletingChecklist] = useState<string | null>(null)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = useCallback(() => createClient() as any, [])

  // Load org data when orgId changes
  useEffect(() => {
    if (!orgId) return
    setActiveTab('overview')
    setModalLoading(true)
    setModalOrg(null)
    setModalMembers([])
    setStores([])
    setChecklists([])

    const load = async () => {
      try {
        const supabase = sb()
        const { data: orgData } = await supabase.from('organizations').select('*').eq('id', orgId).single()
        if (orgData) setModalOrg(orgData)

        const { data: memberData } = await supabase.from('organization_members').select('*').eq('organization_id', orgId)
        if (memberData) {
          const userIds = memberData.map((m: Member) => m.user_id)
          const { data: users } = await supabase.from('users').select('id, email, full_name').in('id', userIds)
          const userMap = new Map((users || []).map((u: { id: string; email: string; full_name: string }) => [u.id, u]))
          setModalMembers(memberData.map((m: Member) => ({
            ...m,
            email: (userMap.get(m.user_id) as { email?: string } | undefined)?.email || '',
            full_name: (userMap.get(m.user_id) as { full_name?: string } | undefined)?.full_name || '',
          })))
        }

        const { count: sc } = await supabase.from('stores').select('id', { count: 'exact', head: true }).eq('tenant_id', orgId)
        setModalStoreCount(sc || 0)
        const { count: cc } = await supabase.from('checklists').select('id', { count: 'exact', head: true }).eq('tenant_id', orgId)
        setModalChecklistCount(cc || 0)
      } catch (e) { console.error(e) }
      setModalLoading(false)
    }
    load()
  }, [orgId, sb])

  // Load stores when tab selected
  useEffect(() => {
    if (activeTab !== 'stores' || !orgId || stores.length > 0) return
    setStoresLoading(true)
    sb().from('stores').select('id, name, address, created_at').eq('tenant_id', orgId).order('created_at', { ascending: false })
      .then(({ data }: { data: Store[] | null }) => { setStores(data || []); setStoresLoading(false) })
  }, [activeTab, orgId, sb, stores.length])

  // Load checklists when tab selected
  const loadChecklists = useCallback(async (page: number) => {
    if (!orgId) return
    setChecklistsLoading(true)
    const supabase = sb()
    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    const { data, count } = await supabase
      .from('checklists')
      .select('id, status, created_at, completed_at, template_id, store_id, created_by, tenant_id', { count: 'exact' })
      .eq('tenant_id', orgId)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (data) {
      // Fetch template names
      const templateIds = [...new Set(data.map((c: { template_id: string }) => c.template_id).filter(Boolean))]
      const storeIds = [...new Set(data.map((c: { store_id: string }) => c.store_id).filter(Boolean))]
      const userIds = [...new Set(data.map((c: { created_by: string }) => c.created_by).filter(Boolean))]

      const [templates, storeNames, userNames] = await Promise.all([
        templateIds.length > 0 ? supabase.from('checklist_templates').select('id, name').in('id', templateIds) : { data: [] },
        storeIds.length > 0 ? supabase.from('stores').select('id, name').in('id', storeIds) : { data: [] },
        userIds.length > 0 ? supabase.from('users').select('id, full_name, email').in('id', userIds) : { data: [] },
      ])

      const tMap = new Map((templates.data || []).map((t: { id: string; name: string }) => [t.id, t.name]))
      const sMap = new Map((storeNames.data || []).map((s: { id: string; name: string }) => [s.id, s.name]))
      const uMap = new Map((userNames.data || []).map((u: { id: string; full_name: string; email: string }) => [u.id, u.full_name || u.email]))

      setChecklists(data.map((c: { id: string; status: string; created_at: string; completed_at: string | null; template_id: string; store_id: string; created_by: string }) => ({
        id: c.id,
        status: c.status,
        created_at: c.created_at,
        completed_at: c.completed_at,
        template_name: tMap.get(c.template_id) || 'Sem template',
        store_name: sMap.get(c.store_id) || 'Sem loja',
        user_name: uMap.get(c.created_by) || 'Desconhecido',
      })))
    }
    setChecklistTotal(count || 0)
    setChecklistPage(page)
    setChecklistsLoading(false)
  }, [orgId, sb])

  useEffect(() => {
    if (activeTab === 'checklists' && orgId && checklists.length === 0) {
      loadChecklists(0)
    }
  }, [activeTab, orgId, checklists.length, loadChecklists])

  // View checklist responses
  const viewChecklist = async (checklistId: string) => {
    if (expandedChecklist === checklistId) { setExpandedChecklist(null); return }
    setExpandedChecklist(checklistId)
    if (checklistResponses[checklistId]) return

    const { data } = await sb().from('checklist_responses').select('*').eq('checklist_id', checklistId).order('created_at', { ascending: true })
    setChecklistResponses(prev => ({ ...prev, [checklistId]: data || [] }))
  }

  // Delete checklist
  const deleteChecklist = async (checklistId: string) => {
    setDeletingChecklist(checklistId)
    await sb().from('checklist_responses').delete().eq('checklist_id', checklistId)
    await sb().from('checklists').delete().eq('id', checklistId)
    setChecklists(prev => prev.filter(c => c.id !== checklistId))
    setChecklistTotal(prev => prev - 1)
    setModalChecklistCount(prev => prev - 1)
    setDeletingChecklist(null)
    setExpandedChecklist(null)
  }

  // Org actions
  const toggleActive = async () => {
    if (!modalOrg) return
    setSaving(true)
    await sb().from('organizations').update({ is_active: !modalOrg.is_active }).eq('id', modalOrg.id)
    const updated = { ...modalOrg, is_active: !modalOrg.is_active }
    setModalOrg(updated)
    onOrgUpdate?.({ id: updated.id, plan: updated.plan, is_active: updated.is_active, max_users: updated.max_users, max_stores: updated.max_stores })
    setSaving(false)
  }

  const changePlan = async (newPlan: Plan) => {
    if (!modalOrg) return
    setSaving(true)
    const planConfig = PLAN_CONFIGS[newPlan]
    await sb().from('organizations').update({
      plan: newPlan, features: planConfig.features,
      max_users: planConfig.maxUsers, max_stores: planConfig.maxStores,
    }).eq('id', modalOrg.id)
    const updated = { ...modalOrg, plan: newPlan, features: planConfig.features as string[], max_users: planConfig.maxUsers, max_stores: planConfig.maxStores }
    setModalOrg(updated)
    onOrgUpdate?.({ id: updated.id, plan: updated.plan, is_active: updated.is_active, max_users: updated.max_users, max_stores: updated.max_stores })
    setSaving(false)
  }

  const extendTrial = async (days: number) => {
    if (!modalOrg) return
    setSaving(true)
    const base = modalOrg.trial_ends_at ? new Date(modalOrg.trial_ends_at) : new Date()
    base.setDate(base.getDate() + days)
    await sb().from('organizations').update({ trial_ends_at: base.toISOString() }).eq('id', modalOrg.id)
    setModalOrg({ ...modalOrg, trial_ends_at: base.toISOString() })
    setSaving(false)
  }

  const updateLimits = async (maxUsers: number, maxStores: number) => {
    if (!modalOrg) return
    setSaving(true)
    await sb().from('organizations').update({ max_users: maxUsers, max_stores: maxStores }).eq('id', modalOrg.id)
    const updated = { ...modalOrg, max_users: maxUsers, max_stores: maxStores }
    setModalOrg(updated)
    onOrgUpdate?.({ id: updated.id, plan: updated.plan, is_active: updated.is_active, max_users: updated.max_users, max_stores: updated.max_stores })
    setSaving(false)
  }

  const toggleFeature = async (feature: string) => {
    if (!modalOrg) return
    setSaving(true)
    const newFeatures = modalOrg.features.includes(feature)
      ? modalOrg.features.filter(f => f !== feature)
      : [...modalOrg.features, feature]
    await sb().from('organizations').update({ features: newFeatures }).eq('id', modalOrg.id)
    setModalOrg({ ...modalOrg, features: newFeatures })
    setSaving(false)
  }

  const planColors: Record<string, { bg: string; text: string }> = {
    trial: { bg: 'bg-amber-50', text: 'text-amber-600' },
    starter: { bg: 'bg-blue-50', text: 'text-blue-600' },
    professional: { bg: 'bg-teal-50', text: 'text-teal-600' },
    enterprise: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  }

  const roleColor: Record<string, string> = {
    owner: 'text-warning', admin: 'text-accent', manager: 'text-info', member: 'text-muted', viewer: 'text-muted',
  }

  const statusColor: Record<string, string> = {
    completed: 'bg-emerald-100 text-emerald-700',
    pending: 'bg-amber-100 text-amber-700',
    in_progress: 'bg-blue-100 text-blue-700',
    draft: 'bg-gray-100 text-gray-600',
  }

  const allFeatures: Feature[] = [
    'basic_orders', 'basic_reports', 'cancellations', 'kpi_dashboard',
    'bi_dashboard', 'export_excel', 'export_pdf',
    'integrations_ifood', 'integrations_teknisa',
    'white_label', 'api_access', 'custom_domain', 'audit_logs', 'advanced_analytics',
  ]

  const featureLabels: Record<string, string> = {
    basic_orders: 'Pedidos basicos', basic_reports: 'Relatorios basicos',
    cancellations: 'Nao-conformidades', kpi_dashboard: 'Dashboard KPI',
    bi_dashboard: 'Dashboard BI', export_excel: 'Exportar Excel',
    export_pdf: 'Exportar PDF', integrations_ifood: 'iFood',
    integrations_teknisa: 'Teknisa', white_label: 'White Label',
    api_access: 'API', custom_domain: 'Dominio personalizado',
    audit_logs: 'Auditoria', advanced_analytics: 'Analises avancadas',
  }

  const tabs: { key: Tab; label: string; icon: typeof FiUsers }[] = [
    { key: 'overview', label: 'Visao Geral', icon: FiClipboard },
    { key: 'members', label: 'Membros', icon: FiUsers },
    { key: 'stores', label: 'Lojas', icon: FiHome },
    { key: 'checklists', label: 'Checklists', icon: FiClipboard },
    { key: 'features', label: 'Features', icon: FiShield },
  ]

  return (
    <Modal isOpen={!!orgId} onClose={onClose} title={modalOrg?.name || 'Detalhes do Cliente'} size="xl">
      {modalLoading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : modalOrg ? (
        <div className="space-y-5">
          {/* Header info */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${planColors[modalOrg.plan]?.bg || ''} ${planColors[modalOrg.plan]?.text || ''}`}>{modalOrg.plan}</span>
            <button onClick={toggleActive} disabled={saving}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${modalOrg.is_active ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}>
              {modalOrg.is_active ? <FiToggleRight className="w-4 h-4" /> : <FiToggleLeft className="w-4 h-4" />}
              {modalOrg.is_active ? 'Ativo' : 'Inativo'}
            </button>
            <span className="text-xs text-muted font-mono">{modalOrg.slug}</span>
          </div>

          {/* Stats row — clickable cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {([
              { key: 'members' as Tab, icon: FiUsers, label: 'Membros', val: modalMembers.length, max: modalOrg.max_users },
              { key: 'stores' as Tab, icon: FiHome, label: 'Lojas', val: modalStoreCount, max: modalOrg.max_stores },
              { key: 'checklists' as Tab, icon: FiClipboard, label: 'Checklists', val: modalChecklistCount },
              { key: 'features' as Tab, icon: FiShield, label: 'Features', val: modalOrg.features?.length || 0 },
            ]).map((s) => (
              <button key={s.key} onClick={() => setActiveTab(s.key)}
                className={`p-3 rounded-xl text-left transition-all ${activeTab === s.key ? 'bg-accent/10 ring-1 ring-accent/30' : 'bg-surface-hover hover:bg-surface-hover/80'}`}>
                <div className="flex items-center gap-2 mb-1"><s.icon className="w-3.5 h-3.5 text-accent" /><span className="text-[10px] text-muted uppercase">{s.label}</span></div>
                <p className="text-lg font-bold text-main">{s.val}{s.max ? <span className="text-xs text-muted font-normal">/{s.max}</span> : null}</p>
              </button>
            ))}
          </div>

          {/* Tab navigation */}
          <div className="flex gap-1 border-b border-subtle overflow-x-auto">
            {tabs.map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === t.key ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-main'
                }`}>
                <t.icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Change Plan */}
              <div className="p-4 bg-surface-hover rounded-xl">
                <h3 className="text-xs font-semibold text-main mb-2 flex items-center gap-2"><FiDollarSign className="w-3.5 h-3.5" /> Mudar Plano</h3>
                <div className="flex gap-2 flex-wrap">
                  {(['trial', 'starter', 'professional', 'enterprise'] as Plan[]).map(p => (
                    <button key={p} onClick={() => changePlan(p)} disabled={saving || modalOrg.plan === p}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
                        modalOrg.plan === p ? 'bg-accent text-white' : 'bg-surface border border-subtle text-muted hover:text-main hover:border-accent'
                      }`}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Extend Trial */}
              {modalOrg.plan === 'trial' && (
                <div className="p-4 bg-surface-hover rounded-xl">
                  <h3 className="text-xs font-semibold text-main mb-2 flex items-center gap-2"><FiCalendar className="w-3.5 h-3.5" /> Estender Trial</h3>
                  <p className="text-[10px] text-muted mb-2">
                    Trial ate: {modalOrg.trial_ends_at ? new Date(modalOrg.trial_ends_at).toLocaleDateString('pt-BR') : 'N/A'}
                  </p>
                  <div className="flex gap-2">
                    {[7, 14, 30].map(d => (
                      <button key={d} onClick={() => extendTrial(d)} disabled={saving}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface border border-subtle text-muted hover:text-main hover:border-accent transition-colors">
                        +{d} dias
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Adjust Limits */}
              <div className="p-4 bg-surface-hover rounded-xl">
                <h3 className="text-xs font-semibold text-main mb-2 flex items-center gap-2"><FiUsers className="w-3.5 h-3.5" /> Ajustar Limites</h3>
                <div className="flex gap-4 items-end">
                  <div>
                    <label className="text-[10px] text-muted block mb-1">Max. Usuarios</label>
                    <input type="number" value={modalOrg.max_users} min={1}
                      onChange={e => setModalOrg({ ...modalOrg, max_users: parseInt(e.target.value) || 1 })}
                      className="w-20 px-2 py-1.5 bg-surface border border-subtle rounded-lg text-sm text-main" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted block mb-1">Max. Lojas</label>
                    <input type="number" value={modalOrg.max_stores} min={1}
                      onChange={e => setModalOrg({ ...modalOrg, max_stores: parseInt(e.target.value) || 1 })}
                      className="w-20 px-2 py-1.5 bg-surface border border-subtle rounded-lg text-sm text-main" />
                  </div>
                  <button onClick={() => updateLimits(modalOrg.max_users, modalOrg.max_stores)} disabled={saving}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-accent text-white hover:bg-accent/80 transition-colors">
                    Salvar
                  </button>
                </div>
              </div>

              {/* Info */}
              <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-subtle">
                <div><span className="text-muted">ID:</span> <span className="text-secondary font-mono text-[10px]">{modalOrg.id}</span></div>
                <div><span className="text-muted">Criada:</span> <span className="text-secondary">{new Date(modalOrg.created_at).toLocaleDateString('pt-BR')}</span></div>
                <div><span className="text-muted">Trial ate:</span> <span className="text-secondary">{modalOrg.trial_ends_at ? new Date(modalOrg.trial_ends_at).toLocaleDateString('pt-BR') : 'N/A'}</span></div>
                <div><span className="text-muted">Limites:</span> <span className="text-secondary">{modalOrg.max_users} usuarios / {modalOrg.max_stores} lojas</span></div>
              </div>
            </div>
          )}

          {activeTab === 'members' && (
            <div>
              {modalMembers.length === 0 ? (
                <p className="text-sm text-muted text-center py-6">Nenhum membro encontrado</p>
              ) : (
                <div className="divide-y divide-subtle rounded-xl border border-subtle overflow-hidden">
                  {modalMembers.map(m => (
                    <div key={m.id} className="px-4 py-2.5 flex items-center gap-4 bg-surface">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-main truncate">{m.full_name || 'Sem nome'}</p>
                        <p className="text-[10px] text-muted truncate">{m.email}</p>
                      </div>
                      <span className={`text-xs font-medium uppercase ${roleColor[m.role] || ''}`}>{m.role}</span>
                      {m.accepted_at && (
                        <span className="text-[10px] text-muted">{new Date(m.accepted_at).toLocaleDateString('pt-BR')}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'stores' && (
            <div>
              {storesLoading ? (
                <div className="flex items-center justify-center h-20">
                  <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                </div>
              ) : stores.length === 0 ? (
                <p className="text-sm text-muted text-center py-6">Nenhuma loja encontrada</p>
              ) : (
                <div className="divide-y divide-subtle rounded-xl border border-subtle overflow-hidden">
                  {stores.map(s => (
                    <div key={s.id} className="px-4 py-2.5 flex items-center gap-4 bg-surface">
                      <FiHome className="w-4 h-4 text-accent shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-main truncate">{s.name}</p>
                        {s.address && <p className="text-[10px] text-muted truncate">{s.address}</p>}
                      </div>
                      <span className="text-[10px] text-muted">{new Date(s.created_at).toLocaleDateString('pt-BR')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'checklists' && (
            <div className="space-y-3">
              {checklistsLoading ? (
                <div className="flex items-center justify-center h-20">
                  <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                </div>
              ) : checklists.length === 0 ? (
                <p className="text-sm text-muted text-center py-6">Nenhum checklist encontrado</p>
              ) : (
                <>
                  <div className="divide-y divide-subtle rounded-xl border border-subtle overflow-hidden">
                    {checklists.map(c => (
                      <div key={c.id}>
                        <div className="px-4 py-2.5 flex items-center gap-3 bg-surface">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-main truncate">{c.template_name}</p>
                            <p className="text-[10px] text-muted truncate">{c.store_name} &middot; {c.user_name}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColor[c.status] || 'bg-gray-100 text-gray-600'}`}>
                            {c.status}
                          </span>
                          <span className="text-[10px] text-muted whitespace-nowrap">{new Date(c.created_at).toLocaleDateString('pt-BR')}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => viewChecklist(c.id)} title="Ver respostas"
                              className="p-1.5 text-muted hover:text-accent rounded-lg hover:bg-surface-hover transition-colors">
                              <FiEye className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => { if (confirm('Excluir este checklist?')) deleteChecklist(c.id) }}
                              disabled={deletingChecklist === c.id} title="Excluir"
                              className="p-1.5 text-muted hover:text-red-500 rounded-lg hover:bg-surface-hover transition-colors">
                              <FiTrash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        {/* Expanded responses */}
                        {expandedChecklist === c.id && (
                          <div className="px-6 py-3 bg-surface-hover border-t border-subtle">
                            {!checklistResponses[c.id] ? (
                              <div className="flex items-center justify-center h-12">
                                <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                              </div>
                            ) : (checklistResponses[c.id] as { id: string; field_label?: string; value?: unknown }[]).length === 0 ? (
                              <p className="text-xs text-muted">Sem respostas registradas</p>
                            ) : (
                              <div className="space-y-1.5">
                                {(checklistResponses[c.id] as { id: string; field_label?: string; value?: unknown }[]).map((r) => (
                                  <div key={r.id} className="flex items-start gap-2 text-xs">
                                    <span className="text-muted font-medium min-w-[120px]">{r.field_label || 'Campo'}:</span>
                                    <span className="text-main">{typeof r.value === 'object' ? JSON.stringify(r.value) : String(r.value ?? '-')}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Pagination */}
                  {checklistTotal > PAGE_SIZE && (
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-xs text-muted">
                        {checklistPage * PAGE_SIZE + 1}-{Math.min((checklistPage + 1) * PAGE_SIZE, checklistTotal)} de {checklistTotal}
                      </span>
                      <div className="flex gap-1">
                        <button onClick={() => loadChecklists(checklistPage - 1)} disabled={checklistPage === 0}
                          className="p-1.5 rounded-lg text-muted hover:text-main hover:bg-surface-hover disabled:opacity-30 transition-colors">
                          <FiChevronLeft className="w-4 h-4" />
                        </button>
                        <button onClick={() => loadChecklists(checklistPage + 1)} disabled={(checklistPage + 1) * PAGE_SIZE >= checklistTotal}
                          className="p-1.5 rounded-lg text-muted hover:text-main hover:bg-surface-hover disabled:opacity-30 transition-colors">
                          <FiChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'features' && (
            <div className="p-4 bg-surface-hover rounded-xl">
              <div className="grid grid-cols-2 gap-2">
                {allFeatures.map(f => (
                  <button key={f} onClick={() => toggleFeature(f)} disabled={saving}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors text-left ${
                      modalOrg.features.includes(f) ? 'bg-accent/10 text-accent border border-accent/20' : 'bg-surface border border-subtle text-muted hover:text-main'
                    }`}>
                    <span className={`w-3 h-3 rounded-sm border flex items-center justify-center shrink-0 ${
                      modalOrg.features.includes(f) ? 'bg-accent border-accent text-white' : 'border-subtle'
                    }`}>
                      {modalOrg.features.includes(f) && <span className="text-[8px]">✓</span>}
                    </span>
                    {featureLabels[f] || f}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </Modal>
  )
}
