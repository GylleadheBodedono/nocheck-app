// ============================================
// Clientes — Lista de todas as organizacoes
// ============================================

'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { FiSearch } from 'react-icons/fi'
import { ClientDetailModal } from '@/components/platform/ClientDetailModal'

type OrgRow = { id: string; name: string; slug: string; plan: string; is_active: boolean; max_users: number; max_stores: number; created_at: string }

export default function ClientesPage() {
  const [orgs, setOrgs] = useState<OrgRow[]>([])
  const [search, setSearch] = useState('')
  const [filterPlan, setFilterPlan] = useState('all')
  const [loading, setLoading] = useState(true)
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const sb = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (sb as any).from('organizations').select('*').order('created_at', { ascending: false })
      // Esconder a org do superadmin
      const { data: { user } } = await sb.auth.getUser()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profile } = await (sb as any).from('users').select('tenant_id').eq('id', user?.id).single()
      const adminOrgId = profile?.tenant_id
      setOrgs((data || []).filter((o: OrgRow) => o.id !== adminOrgId))
      setLoading(false)
    }
    load()
  }, [])

  const filtered = orgs.filter(o => {
    const s = o.name.toLowerCase().includes(search.toLowerCase()) || o.slug.toLowerCase().includes(search.toLowerCase())
    const p = filterPlan === 'all' || o.plan === filterPlan
    return s && p
  })

  const handleOrgUpdate = useCallback((updated: { id: string; plan: string; is_active: boolean; max_users: number; max_stores: number }) => {
    setOrgs(prev => prev.map(o => o.id === updated.id ? { ...o, ...updated } : o))
  }, [])

  const planBadge: Record<string, string> = {
    trial: 'bg-warning/20 text-warning', starter: 'bg-info/20 text-info',
    professional: 'bg-accent/20 text-accent', enterprise: 'bg-success/20 text-success',
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-main">Clientes</h1>
        <p className="text-sm text-muted mt-1">{orgs.length} organizacoes</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input type="text" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-surface border border-subtle rounded-xl text-sm text-main placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div className="flex gap-1.5">
          {['all', 'trial', 'starter', 'professional', 'enterprise'].map(p => (
            <button key={p} onClick={() => setFilterPlan(p)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors capitalize ${filterPlan === p ? 'btn-primary' : 'btn-secondary'}`}>
              {p === 'all' ? 'Todos' : p}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted">Nenhuma organizacao encontrada</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted text-xs uppercase tracking-wider border-b border-subtle">
                  <th className="px-6 py-3">Organizacao</th>
                  <th className="px-6 py-3">Plano</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Limites</th>
                  <th className="px-6 py-3">Criada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-subtle">
                {filtered.map(org => (
                  <tr key={org.id} className="hover:bg-surface-hover transition-colors cursor-pointer" onClick={() => setSelectedOrgId(org.id)}>
                    <td className="px-6 py-3">
                      <span className="text-main hover:text-accent font-medium">{org.name}</span>
                      <p className="text-[10px] text-muted">{org.slug}</p>
                    </td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${planBadge[org.plan] || ''}`}>{org.plan}</span>
                    </td>
                    <td className="px-6 py-3">
                      <span className={`w-2 h-2 rounded-full inline-block mr-2 ${org.is_active ? 'bg-success' : 'bg-error'}`} />
                      <span className="text-muted text-xs">{org.is_active ? 'Ativo' : 'Inativo'}</span>
                    </td>
                    <td className="px-6 py-3 text-muted text-xs">{org.max_users} usuarios / {org.max_stores} lojas</td>
                    <td className="px-6 py-3 text-muted text-xs">{new Date(org.created_at).toLocaleDateString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ClientDetailModal
        orgId={selectedOrgId}
        onClose={() => setSelectedOrgId(null)}
        onOrgUpdate={handleOrgUpdate}
      />
    </div>
  )
}
