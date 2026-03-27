// ============================================
// Detalhe do Cliente — Gerenciar organizacao
// ============================================

'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { FiArrowLeft, FiUsers, FiHome, FiClipboard, FiToggleLeft, FiToggleRight } from 'react-icons/fi'
import Link from 'next/link'

type OrgDetail = { id: string; name: string; slug: string; plan: string; is_active: boolean; max_users: number; max_stores: number; features: string[]; trial_ends_at: string | null; created_at: string }
type Member = { id: string; user_id: string; role: string; accepted_at: string | null; email?: string; full_name?: string }

export default function ClienteDetailPage() {
  const { orgId } = useParams<{ orgId: string }>()
  const [org, setOrg] = useState<OrgDetail | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [storeCount, setStoreCount] = useState(0)
  const [checklistCount, setChecklistCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = createClient() as any
      const { data: orgData } = await sb.from('organizations').select('*').eq('id', orgId).single()
      if (!orgData) { router.push('/platform/clientes'); return }
      setOrg(orgData)

      const { data: memberData } = await sb.from('organization_members').select('*').eq('organization_id', orgId)
      if (memberData) {
        const userIds = memberData.map((m: Member) => m.user_id)
        const { data: users } = await sb.from('users').select('id, email, full_name').in('id', userIds)
        const userMap = new Map((users || []).map((u: { id: string; email: string; full_name: string }) => [u.id, u]))
        setMembers(memberData.map((m: Member) => ({
          ...m,
          email: (userMap.get(m.user_id) as { email?: string } | undefined)?.email || '',
          full_name: (userMap.get(m.user_id) as { full_name?: string } | undefined)?.full_name || '',
        })))
      }

      const { count: sc } = await sb.from('stores').select('id', { count: 'exact', head: true }).eq('tenant_id', orgId)
      setStoreCount(sc || 0)
      const { count: cc } = await sb.from('checklists').select('id', { count: 'exact', head: true }).eq('tenant_id', orgId)
      setChecklistCount(cc || 0)
      setLoading(false)
    }
    load()
  }, [orgId, router])

  const toggleActive = async () => {
    if (!org) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (createClient() as any).from('organizations').update({ is_active: !org.is_active }).eq('id', org.id)
    setOrg({ ...org, is_active: !org.is_active })
  }

  const planBadge: Record<string, string> = {
    trial: 'bg-warning/20 text-warning', starter: 'bg-info/20 text-info',
    professional: 'bg-accent/20 text-accent', enterprise: 'bg-success/20 text-success',
  }
  const roleColor: Record<string, string> = {
    owner: 'text-warning', admin: 'text-accent', manager: 'text-info', member: 'text-muted', viewer: 'text-muted',
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
  if (!org) return null

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/platform/clientes" className="p-2 text-muted hover:text-main rounded-xl"><FiArrowLeft className="w-5 h-5" /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-main">{org.name}</h1>
          <p className="text-sm text-muted">{org.slug}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${planBadge[org.plan] || ''}`}>{org.plan}</span>
        <button onClick={toggleActive} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium ${org.is_active ? 'bg-success/20 text-success' : 'bg-error/20 text-error'}`}>
          {org.is_active ? <FiToggleRight className="w-4 h-4" /> : <FiToggleLeft className="w-4 h-4" />}
          {org.is_active ? 'Ativo' : 'Inativo'}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: FiUsers, label: 'Membros', val: members.length, max: org.max_users },
          { icon: FiHome, label: 'Lojas', val: storeCount, max: org.max_stores },
          { icon: FiClipboard, label: 'Checklists', val: checklistCount },
          { icon: FiClipboard, label: 'Features', val: org.features?.length || 0 },
        ].map((s, i) => (
          <div key={i} className="card p-4">
            <div className="flex items-center gap-2 mb-1"><s.icon className="w-3.5 h-3.5 text-accent" /><span className="text-[10px] text-muted uppercase">{s.label}</span></div>
            <p className="text-lg font-bold text-main">{s.val}{s.max ? <span className="text-xs text-muted font-normal">/{s.max}</span> : null}</p>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-subtle">
          <h2 className="text-sm font-semibold text-main flex items-center gap-2"><FiUsers className="w-4 h-4 text-accent" /> Membros</h2>
        </div>
        <div className="divide-y divide-subtle">
          {members.map(m => (
            <div key={m.id} className="px-6 py-3 flex items-center gap-4">
              <div className="flex-1">
                <p className="text-sm text-main">{m.full_name || 'Sem nome'}</p>
                <p className="text-[10px] text-muted">{m.email}</p>
              </div>
              <span className={`text-xs font-medium uppercase ${roleColor[m.role] || ''}`}>{m.role}</span>
              <span className="text-[10px] text-muted">{m.accepted_at ? new Date(m.accepted_at).toLocaleDateString('pt-BR') : 'Pendente'}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-6 space-y-3 text-sm">
        <h2 className="text-sm font-semibold text-main mb-4">Informações</h2>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div><span className="text-muted">ID:</span> <span className="text-secondary font-mono text-[10px]">{org.id}</span></div>
          <div><span className="text-muted">Criada:</span> <span className="text-secondary">{new Date(org.created_at).toLocaleDateString('pt-BR')}</span></div>
          <div><span className="text-muted">Trial até:</span> <span className="text-secondary">{org.trial_ends_at ? new Date(org.trial_ends_at).toLocaleDateString('pt-BR') : 'N/A'}</span></div>
          <div><span className="text-muted">Limites:</span> <span className="text-secondary">{org.max_users} users / {org.max_stores} lojas</span></div>
        </div>
      </div>
    </div>
  )
}
