'use client'

import { useState, useCallback } from 'react'
import { FiUsers, FiClipboard, FiTrendingUp, FiArrowRight, FiAward, FiClock, FiAlertTriangle, FiWifi, FiWifiOff } from 'react-icons/fi'
import Link from 'next/link'
import { ClientDetailModal } from '@/components/platform/ClientDetailModal'

type Stats = { totalOrgs: number; activeOrgs: number; trialOrgs: number; totalUsers: number; totalStores: number; totalChecklists: number; mrr: number }
type OrgRow = { id: string; name: string; slug: string; plan: string; is_active: boolean; created_at: string; member_count: number; store_count: number; trial_ends_at: string | null }
type RankingItem = { org_id: string; org_name: string; value: string | number }

type PlatformDashboardClientProps = {
  initialStats: Stats
  initialOrgs: OrgRow[]
  initialMostLoyal: RankingItem[]
  initialOldest: RankingItem[]
  initialMostDelayed: RankingItem[]
  initialMostActive: RankingItem[]
  initialLeastActive: RankingItem[]
}

export default function PlatformDashboardClient({
  initialStats,
  initialOrgs,
  initialMostLoyal,
  initialOldest,
  initialMostDelayed,
  initialMostActive,
  initialLeastActive,
}: PlatformDashboardClientProps) {
  const [stats] = useState<Stats>(initialStats)
  const [orgs, setOrgs] = useState<OrgRow[]>(initialOrgs)
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null)

  const [mostLoyal] = useState<RankingItem[]>(initialMostLoyal)
  const [oldest] = useState<RankingItem[]>(initialOldest)
  const [mostDelayed] = useState<RankingItem[]>(initialMostDelayed)
  const [mostActive] = useState<RankingItem[]>(initialMostActive)
  const [leastActive] = useState<RankingItem[]>(initialLeastActive)

  const handleOrgUpdate = useCallback((updated: { id: string; plan: string; is_active: boolean }) => {
    setOrgs(prev => prev.map(o => o.id === updated.id ? { ...o, plan: updated.plan, is_active: updated.is_active } : o))
  }, [])

  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

  const planColors: Record<string, { bg: string; text: string }> = {
    trial: { bg: 'bg-amber-50', text: 'text-amber-600' },
    starter: { bg: 'bg-blue-50', text: 'text-blue-600' },
    professional: { bg: 'bg-teal-50', text: 'text-teal-600' },
    enterprise: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  }

  const convRate = stats.totalOrgs > 0 ? Math.round(((stats.activeOrgs - stats.trialOrgs) / Math.max(stats.totalOrgs, 1)) * 100) : 0
  const arr = stats.mrr * 12
  const paidOrgs = stats.activeOrgs - stats.trialOrgs
  const ticketMedio = paidOrgs > 0 ? stats.mrr / paidOrgs : 0

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-main mb-5 flex items-center gap-2">
            <FiClipboard className="w-4 h-4 text-muted" /> Resumo da Plataforma
          </h2>
          <div className="grid grid-cols-2 gap-5">
            <StatCard label="Organizacoes Ativas" value={stats.activeOrgs} color="bg-emerald-500" />
            <StatCard label="Em Trial" value={stats.trialOrgs} color="bg-amber-500" />
            <StatCard label="Usuarios" value={stats.totalUsers} color="bg-blue-500" />
            <StatCard label="Lojas" value={stats.totalStores} color="bg-purple-500" />
            <StatCard label="Checklists" value={stats.totalChecklists} color="bg-teal-500" />
            <StatCard label="Churn" value="0%" color="bg-red-400" isText />
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-sm font-semibold text-main mb-5 flex items-center gap-2">
            <FiTrendingUp className="w-4 h-4 text-muted" /> Conversao & Receita
          </h2>
          <div className="flex items-center gap-8">
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

            <div className="flex-1 space-y-3">
              <div>
                <p className="text-xs text-muted mb-0.5">MRR</p>
                <p className="text-xl font-bold text-main">{fmt(stats.mrr)}</p>
              </div>
              <div>
                <p className="text-xs text-muted mb-0.5">ARR</p>
                <p className="text-lg font-bold text-main">{fmt(arr)}</p>
              </div>
              <div>
                <p className="text-xs text-muted mb-0.5">Ticket Medio</p>
                <p className="text-lg font-bold text-main">{fmt(ticketMedio)}</p>
              </div>
              <div>
                <p className="text-xs text-muted mb-0.5">Organizacoes</p>
                <p className="text-sm text-main">{stats.totalOrgs} total · {stats.activeOrgs} ativas · {stats.trialOrgs} trial</p>
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
              <th className="px-6 py-3 font-medium">Lojas</th>
              <th className="px-6 py-3 font-medium">Trial ate</th>
              <th className="px-6 py-3 font-medium">Data</th>
            </tr>
          </thead>
          <tbody>
            {orgs.map(org => {
              const pc = planColors[org.plan] || { bg: 'bg-surface-hover', text: 'text-muted' }
              return (
                <tr key={org.id} className="border-b border-subtle last:border-0 hover:bg-surface-hover transition-colors cursor-pointer" onClick={() => setSelectedOrgId(org.id)}>
                  <td className="px-6 py-3.5">
                    <span className="font-medium text-main hover:text-primary transition-colors">
                      {org.name}
                    </span>
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
                  <td className="px-6 py-3.5 text-muted">{org.store_count}</td>
                  <td className="px-6 py-3.5 text-muted text-xs">
                    {org.plan === 'trial' && org.trial_ends_at
                      ? new Date(org.trial_ends_at).toLocaleDateString('pt-BR')
                      : '\u2014'}
                  </td>
                  <td className="px-6 py-3.5 text-muted text-xs">{new Date(org.created_at).toLocaleDateString('pt-BR')}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Rankings Section */}
      <div>
        <h2 className="text-sm font-semibold text-main mb-4 flex items-center gap-2">
          <FiTrendingUp className="w-4 h-4 text-muted" /> Rankings
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <RankingCard icon={FiAward} title="Clientes Mais Fieis" subtitle="Ultimos 30 dias" items={mostLoyal} onClickItem={setSelectedOrgId} />
          <RankingCard icon={FiClock} title="Clientes Mais Antigos" items={oldest} onClickItem={setSelectedOrgId} />
          <RankingCard icon={FiAlertTriangle} title="Mais Atrasam" subtitle="Checklists pendentes" items={mostDelayed} onClickItem={setSelectedOrgId} />
          <RankingCard icon={FiWifi} title="Mais Frequencia Online" subtitle="Ultimos 7 dias" items={mostActive} onClickItem={setSelectedOrgId} />
          <RankingCard icon={FiWifiOff} title="Menos Frequencia Online" subtitle="Ultimos 7 dias" items={leastActive} onClickItem={setSelectedOrgId} />
        </div>
      </div>

      {/* Client Detail Modal */}
      <ClientDetailModal
        orgId={selectedOrgId}
        onClose={() => setSelectedOrgId(null)}
        onOrgUpdate={handleOrgUpdate}
      />
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number | string; color: string; isText?: boolean }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`w-2 h-2 rounded-full ${color}`} />
        <span className="text-xs text-muted font-medium">{label}</span>
      </div>
      <span className="text-2xl font-bold text-main">{value}</span>
    </div>
  )
}

function RankingCard({ icon: Icon, title, subtitle, items, onClickItem }: {
  icon: typeof FiAward; title: string; subtitle?: string; items: RankingItem[]
  onClickItem: (orgId: string) => void
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-accent" />
        <div>
          <h3 className="text-xs font-semibold text-main">{title}</h3>
          {subtitle && <p className="text-[10px] text-muted">{subtitle}</p>}
        </div>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted text-center py-3">Sem dados</p>
      ) : (
        <div className="space-y-1.5">
          {items.map((item, i) => (
            <button key={item.org_id} onClick={() => onClickItem(item.org_id)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-hover transition-colors text-left">
              <span className="text-[10px] text-muted font-bold w-4">{i + 1}.</span>
              <span className="text-xs text-main truncate flex-1">{item.org_name}</span>
              <span className="text-[10px] text-muted whitespace-nowrap">{item.value}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
