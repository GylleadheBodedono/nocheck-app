'use client'

import { useEffect, useState } from 'react'
import { FiCheckCircle, FiClock, FiCalendar, FiRefreshCw, FiWifi, FiGrid, FiHome } from 'react-icons/fi'

type Stats = {
    total: number
    today: number
    week: number
    month: number
    pendingSync: number
    templates: number
    stores: number
    isAdmin: boolean
}

export function DashboardStats() {
    const [stats, setStats] = useState<Stats | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch('/api/dashboard/stats')
                if (!res.ok) throw new Error('Erro ao carregar estatísticas')
                const data = await res.json()
                setStats(data)
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Erro desconhecido')
            } finally {
                setLoading(false)
            }
        }

        fetchStats()
    }, [])

    if (loading) {
        return (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
                {[...Array(7)].map((_, i) => (
                    <div key={i} className="card p-4 animate-pulse">
                        <div className="h-4 bg-surface-hover rounded w-20 mb-2"></div>
                        <div className="h-8 bg-surface-hover rounded w-12"></div>
                    </div>
                ))}
            </div>
        )
    }

    if (error || !stats) {
        return null // Não mostra nada se houver erro
    }

    const statCards = [
        {
            label: 'Hoje',
            value: stats.today,
            icon: FiClock,
            color: 'text-primary',
            bg: 'bg-primary/10',
            description: 'Checklists respondidos'
        },
        {
            label: 'Esta Semana',
            value: stats.week,
            icon: FiCalendar,
            color: 'text-secondary',
            bg: 'bg-secondary/10',
            description: 'Checklists respondidos'
        },
        {
            label: 'Este Mês',
            value: stats.month,
            icon: FiCheckCircle,
            color: 'text-success',
            bg: 'bg-success/10',
            description: 'Checklists respondidos'
        },
        {
            label: 'Total',
            value: stats.total,
            icon: FiGrid,
            color: 'text-info',
            bg: 'bg-info/10',
            description: 'Todos os checklists'
        },
        {
            label: 'Pendentes',
            value: stats.pendingSync,
            icon: FiRefreshCw,
            color: stats.pendingSync > 0 ? 'text-warning' : 'text-muted',
            bg: stats.pendingSync > 0 ? 'bg-warning/10' : 'bg-surface-hover',
            description: 'Aguardando sync'
        },
        {
            label: 'Templates',
            value: stats.templates,
            icon: FiCheckCircle,
            color: 'text-accent',
            bg: 'bg-accent/10',
            description: 'Modelos ativos'
        },
        {
            label: 'Lojas',
            value: stats.stores,
            icon: FiHome,
            color: 'text-main',
            bg: 'bg-surface-hover',
            description: 'Lojas ativas'
        },
    ]

    return (
        <div className="mb-8">
            <h2 className="text-lg font-bold text-main mb-4 flex items-center gap-2">
                <FiGrid className="w-5 h-5 text-primary" />
                Panorama Geral
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                {statCards.map((stat) => (
                    <div
                        key={stat.label}
                        className="card p-4 hover:shadow-theme-lg transition-all duration-200 group"
                    >
                        <div className="flex items-center gap-2 mb-2">
                            <div className={`p-1.5 rounded-lg ${stat.bg}`}>
                                <stat.icon className={`w-4 h-4 ${stat.color}`} />
                            </div>
                            <span className="text-xs font-bold text-muted uppercase tracking-wide">
                                {stat.label}
                            </span>
                        </div>

                        <p className={`text-2xl font-black ${stat.color}`}>
                            {stat.value}
                        </p>

                        <p className="text-[10px] text-muted mt-1 group-hover:text-main transition-colors">
                            {stat.description}
                        </p>
                    </div>
                ))}
            </div>

            {stats.pendingSync > 0 && (
                <div className="mt-4 flex items-center gap-2 text-warning text-sm bg-warning/10 border border-warning/20 rounded-xl px-4 py-2">
                    <FiWifi className="w-4 h-4" />
                    <span>
                        <strong>{stats.pendingSync}</strong> {stats.pendingSync === 1 ? 'checklist aguardando' : 'checklists aguardando'} sincronização
                    </span>
                </div>
            )}
        </div>
    )
}
