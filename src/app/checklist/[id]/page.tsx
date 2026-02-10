'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'
import { APP_CONFIG } from '@/lib/config'
import { LoadingPage, Header } from '@/components/ui'
import { ReadOnlyFieldRenderer } from '@/components/fields/ReadOnlyFieldRenderer'
import type { TemplateField, GPSValue } from '@/types/database'
import {
  FiMapPin,
  FiUser,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiTag,
} from 'react-icons/fi'

type ChecklistDetail = {
  id: number
  template_id: number
  store_id: number
  sector_id: number | null
  status: string
  created_by: string
  started_at: string | null
  completed_at: string | null
  latitude: number | null
  longitude: number | null
  accuracy: number | null
  created_at: string
  store: { id: number; name: string } | null
  sector: { id: number; name: string } | null
  user: { id: string; name: string } | null
  template: { id: number; name: string; category: string | null } | null
}

type ResponseRow = {
  id: number
  field_id: number
  value_text: string | null
  value_number: number | null
  value_json: unknown
}

export default function ChecklistViewPage() {
  const [loading, setLoading] = useState(true)
  const [checklist, setChecklist] = useState<ChecklistDetail | null>(null)
  const [fields, setFields] = useState<TemplateField[]>([])
  const [responses, setResponses] = useState<ResponseRow[]>([])
  const [error, setError] = useState<string | null>(null)

  const router = useRouter()
  const params = useParams()
  const checklistId = params.id as string
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    fetchChecklist()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checklistId])

  const fetchChecklist = async () => {
    if (!isSupabaseConfigured || !supabase) {
      setError('Supabase nao configurado')
      setLoading(false)
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push(APP_CONFIG.routes.login)
        return
      }

      // Fetch user profile for auth check
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profile } = await (supabase as any)
        .from('users')
        .select('is_admin, is_manager, store_id')
        .eq('id', user.id)
        .single()

      // Fetch checklist with relations
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: checklistData, error: checklistError } = await (supabase as any)
        .from('checklists')
        .select(`
          *,
          store:stores(id, name),
          sector:sectors(id, name),
          user:users!checklists_created_by_fkey(id, name),
          template:checklist_templates(id, name, category)
        `)
        .eq('id', Number(checklistId))
        .single()

      if (checklistError || !checklistData) {
        setError('Checklist nao encontrado')
        setLoading(false)
        return
      }

      // Auth check: admin, manager of the store, or creator
      const isAdmin = profile?.is_admin === true
      const isManager = profile?.is_manager === true
      const isCreator = checklistData.created_by === user.id

      if (!isAdmin && !isCreator) {
        if (isManager) {
          // Check if manager is assigned to this store
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: managerStores } = await (supabase as any)
            .from('store_managers')
            .select('store_id')
            .eq('user_id', user.id)

          const managerStoreIds = (managerStores || []).map((s: { store_id: number }) => s.store_id)
          // Also check user's primary store
          if (profile?.store_id) managerStoreIds.push(profile.store_id)

          if (!managerStoreIds.includes(checklistData.store_id)) {
            setError('Voce nao tem permissao para ver este checklist')
            setLoading(false)
            return
          }
        } else {
          setError('Voce nao tem permissao para ver este checklist')
          setLoading(false)
          return
        }
      }

      setChecklist(checklistData)

      // Fetch template fields
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: fieldsData } = await (supabase as any)
        .from('template_fields')
        .select('*')
        .eq('template_id', checklistData.template_id)
        .order('display_order', { ascending: true })

      setFields(fieldsData || [])

      // Fetch responses
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: responsesData } = await (supabase as any)
        .from('checklist_responses')
        .select('id, field_id, value_text, value_number, value_json')
        .eq('checklist_id', Number(checklistId))

      setResponses(responsesData || [])
    } catch (err) {
      console.error('[ChecklistView] Erro:', err)
      setError('Erro ao carregar checklist')
    }

    setLoading(false)
  }

  const getFieldValue = (field: TemplateField): unknown => {
    const response = responses.find(r => r.field_id === field.id)
    if (!response) return null

    switch (field.field_type) {
      case 'number':
        if (response.value_json && typeof response.value_json === 'object' && 'subtype' in (response.value_json as Record<string, unknown>)) {
          return { subtype: (response.value_json as Record<string, unknown>).subtype, number: response.value_number }
        }
        return response.value_number
      case 'calculated':
        return response.value_number
      case 'photo': {
        const json = response.value_json as { photos?: string[] } | null
        return json?.photos || []
      }
      case 'checkbox_multiple':
      case 'signature':
      case 'gps':
        return response.value_json
      default:
        return response.value_text
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  const statusLabel: Record<string, { text: string; color: string }> = {
    concluido: { text: 'Concluido', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    em_andamento: { text: 'Em andamento', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
    rascunho: { text: 'Rascunho', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  }

  if (loading) return <LoadingPage />

  if (error) {
    return (
      <div className="min-h-screen bg-page">
        <Header variant="page" title="Checklist" backHref={APP_CONFIG.routes.dashboard} />
        <main className="max-w-2xl mx-auto px-4 py-8">
          <div className="card p-8 text-center">
            <p className="text-red-400 mb-4">{error}</p>
            <button onClick={() => router.back()} className="btn-primary px-6 py-2 rounded-xl">
              Voltar
            </button>
          </div>
        </main>
      </div>
    )
  }

  if (!checklist) return null

  const status = statusLabel[checklist.status] || { text: checklist.status, color: 'bg-gray-500/20 text-gray-400' }

  return (
    <div className="min-h-screen bg-page">
      <Header
        variant="page"
        title={checklist.template?.name || 'Checklist'}
        backHref={APP_CONFIG.routes.dashboard}
      />

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Metadata Card */}
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-main text-lg">{checklist.template?.name}</h2>
            <span className={`px-3 py-1 rounded-lg text-xs font-medium border ${status.color}`}>
              {status.text}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            {checklist.user && (
              <div className="flex items-center gap-2 text-secondary">
                <FiUser className="w-4 h-4 text-muted" />
                <span>{checklist.user.name}</span>
              </div>
            )}
            {checklist.store && (
              <div className="flex items-center gap-2 text-secondary">
                <FiMapPin className="w-4 h-4 text-muted" />
                <span>{checklist.store.name}</span>
              </div>
            )}
            {checklist.sector && (
              <div className="flex items-center gap-2 text-secondary">
                <FiTag className="w-4 h-4 text-muted" />
                <span>{checklist.sector.name}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-secondary">
              <FiCalendar className="w-4 h-4 text-muted" />
              <span>{formatDate(checklist.created_at)}</span>
            </div>
            {checklist.completed_at && (
              <div className="flex items-center gap-2 text-secondary">
                <FiCheckCircle className="w-4 h-4 text-emerald-400" />
                <span>Concluido {formatDate(checklist.completed_at)}</span>
              </div>
            )}
            {checklist.started_at && !checklist.completed_at && (
              <div className="flex items-center gap-2 text-secondary">
                <FiClock className="w-4 h-4 text-amber-400" />
                <span>Iniciado {formatDate(checklist.started_at)}</span>
              </div>
            )}
          </div>

          {/* GPS info */}
          {checklist.latitude && checklist.longitude && (
            <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl">
              <div className="flex items-center gap-2 text-primary text-sm">
                <FiMapPin className="w-4 h-4" />
                <span className="font-medium">GPS do checklist</span>
              </div>
              <p className="text-xs text-secondary mt-1">
                Lat: {(checklist.latitude as number).toFixed(6)}, Lng: {(checklist.longitude as number).toFixed(6)}
                {checklist.accuracy && ` (precisao: ${(checklist.accuracy as number).toFixed(0)}m)`}
              </p>
            </div>
          )}
        </div>

        {/* Fields */}
        <div className="space-y-4">
          <h3 className="font-semibold text-main">Respostas ({responses.length}/{fields.length})</h3>

          {fields.map((field) => {
            const value = getFieldValue(field)
            const gpsVal = field.field_type === 'gps' ? value as GPSValue : null

            return (
              <div key={field.id} className="card p-4">
                <ReadOnlyFieldRenderer field={field} value={value} />
                {/* Show GPS mini-map hint */}
                {gpsVal?.latitude && gpsVal?.longitude && (
                  <a
                    href={`https://www.google.com/maps?q=${gpsVal.latitude},${gpsVal.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline mt-2 inline-block"
                  >
                    Ver no Google Maps
                  </a>
                )}
              </div>
            )
          })}

          {fields.length === 0 && (
            <div className="card p-8 text-center text-muted">
              Nenhum campo encontrado neste template
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
