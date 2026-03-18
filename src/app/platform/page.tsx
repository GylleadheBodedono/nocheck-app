'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { FiUsers, FiClipboard, FiTrendingUp, FiArrowRight, FiArrowUpRight, FiArrowDownRight } from 'react-icons/fi'
import Link from 'next/link'
import { PLAN_CONFIGS } from '@/types/tenant'

type Stats = { totalOrgs: number; activeOrgs: number; trialOrgs: number; totalUsers: number; totalStores: number; totalChecklists: number; mrr: number }
type OrgRow = { id: string; name: string; slug: string; plan: string; is_active: boolean; created_at: string; member_count: number }

export default function PlatformDashboard() {
  const [stats, setStats] = useState<Stats>({ totalOrgs: 0, activeOrgs: 0, trialOrgs: 0, totalUsers: 0, totalStores: 0, totalChecklists: 0, mrr: 0 })
  const [orgs, setOrgs] = useState<OrgRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = createClient() as any
      try {
        const { data: orgList } = await sb.from('organizations').select('id, name, slug, plan, is_active, created_at')
        const all = orgList || []
        const active = all.filter((o: { is_active: boolean }) => o.is_active)
        const trial = all.filter((o: { plan: string }) => o.plan === 'trial')
        let mrr = 0
        for (const o of active) { const p = PLAN_CONFIGS[o.plan as keyof typeof PLAN_CONFIGS]; if (p) mrr += p.price }
        const { count: uc } = await sb.from('users').select('id', { count: 'exact', head: true })
        const { count: sc } = await sb.from('stores').select('id', { count: 'exact', head: true })
        const { count: cc } = await sb.from('checklists').select('id', { count: 'exact', head: true })
        setStats({ totalOrgs: all.length, activeOrgs: active.length, trialOrgs: trial.length, totalUsers: uc || 0, totalStores: sc || 0, totalChecklists: cc || 0, mrr })

        const { data: members } = await sb.from('organization_members').select('organization_id')
        const mm: Record<string, number> = {}
        for (const m of (members || [])) mm[m.organization_id] = (mm[m.organization_id] || 0) + 1
        setOrgs(all.sort((a: { created_at: string }, b: { created_at: string }) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 6).map((o: OrgRow) => ({ ...o, member_count: mm[o.id] || 0 })))
      } catch (e) { console.error(e) }
      setLoading(false)
    }
    load()
  }, [])

  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

  const planColors: Record<string, { bg: string; text: string }> = {
    trial: { bg: 'bg-amber-50', text: 'text-amber-600' },
    starter: { bg: 'bg-blue-50', text: 'text-blue-600' },
    professional: { bg: 'bg-teal-50', text: 'text-teal-600' },
    enterprise: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>

  const convRate = stats.totalOrgs > 0 ? Math.round(((stats.activeOrgs - stats.trialOrgs) / Math.max(stats.totalOrgs, 1)) * 100) : 0

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Summary Cards — 2 cols on top */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Task Summary style */}
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-main mb-5 flex items-center gap-2">
            <FiClipboard className="w-4 h-4 text-muted" /> Resumo da Plataforma
          </h2>
          <div className="grid grid-cols-2 gap-5">
            <StatCard label="Ativas" value={stats.activeOrgs} change={20} positive color="bg-emerald-500" />
            <StatCard label="Em Trial" value={stats.trialOrgs} change={5} positive={false} color="bg-amber-500" />
            <StatCard label="Usuarios" value={stats.totalUsers} change={10} positive color="bg-blue-500" />
            <StatCard label="Checklists" value={stats.totalChecklists} change={15} positive color="bg-teal-500" />
          </div>
        </div>

        {/* Progress Summary — donut style */}
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-main mb-5 flex items-center gap-2">
            <FiTrendingUp className="w-4 h-4 text-muted" /> Conversao & Receita
          </h2>
          <div className="flex items-center gap-8">
            {/* Donut visual */}
            <div className="relative w-32 h-32 shrink-0">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--border-subtle)" strokeWidth="3" />
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none" stroke="url(#grad)" strokeWidth="3" strokeDasharray={`${convRate}, 100`} strokeLinecap="round" />
                <defs><linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#0D9488" /><stop offset="100%" stopColor="#14B8A6" />
                </linearGradient></defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-2xl font-bold text-main">{convRate}%</p>
                <p className="text-[10px] text-muted">Conversao</p>
              </div>
            </div>

            <div className="flex-1 space-y-4">
              <div>
                <p className="text-xs text-muted mb-1">MRR</p>
                <p className="text-xl font-bold text-main">{fmt(stats.mrr)}</p>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">Organizacoes</p>
                <p className="text-xl font-bold text-main">{stats.totalOrgs}</p>
                <p className="text-[10px] text-muted">{stats.activeOrgs} ativas · {stats.trialOrgs} trial</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Clients Table */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 flex items-center justify-between border-b border-subtle">
          <h2 className="text-sm font-semibold text-main flex items-center gap-2">
            <FiUsers className="w-4 h-4 text-muted" /> Clientes Recentes
          </h2>
          <Link href="/platform/clientes" className="text-xs text-primary hover:text-primary-hover flex items-center gap-1 font-medium">
            Ver todos <FiArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] text-muted uppercase tracking-wider border-b border-subtle">
              <th className="px-6 py-3 font-medium">Organizacao</th>
              <th className="px-6 py-3 font-medium">Plano</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium">Membros</th>
              <th className="px-6 py-3 font-medium">Data</th>
            </tr>
          </thead>
          <tbody>
            {orgs.map(org => {
              const pc = planColors[org.plan] || { bg: 'bg-surface-hover', text: 'text-muted' }
              return (
                <tr key={org.id} className="border-b border-subtle last:border-0 hover:bg-surface-hover transition-colors">
                  <td className="px-6 py-3.5">
                    <Link href={`/platform/clientes/${org.id}`} className="font-medium text-main hover:text-primary transition-colors">
                      {org.name}
                    </Link>
                    <p className="text-[10px] text-muted">{org.slug}</p>
                  </td>
                  <td className="px-6 py-3.5">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase ${pc.bg} ${pc.text}`}>
                      {org.plan}
                    </span>
                  </td>
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${org.is_active ? 'bg-emerald-500' : 'bg-red-400'}`} />
                      <span className="text-xs text-muted">{org.is_active ? 'Ativo' : 'Inativo'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3.5 text-muted">{org.member_count}</td>
                  <td className="px-6 py-3.5 text-muted text-xs">{new Date(org.created_at).toLocaleDateString('pt-BR')}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatCard({ label, value, change, positive, color }: { label: string; value: number; change: number; positive: boolean; color: string }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`w-2 h-2 rounded-full ${color}`} />
        <span className="text-xs text-muted font-medium">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-main">{value}</span>
        <span className={`flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded ${
          positive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
        }`}>
          {positive ? <FiArrowUpRight className="w-2.5 h-2.5" /> : <FiArrowDownRight className="w-2.5 h-2.5" />}
          {change}%
        </span>
      </div>
      <p className="text-[10px] text-muted mt-0.5">
        {change}% {positive ? 'mais que ontem' : 'menos que ontem'}
      </p>
    </div>
  )
}
