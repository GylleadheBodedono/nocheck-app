/**
 * Shared types, constants, and utilities for the /admin/relatorios feature.
 * All tab components and the data hook import from here.
 */

// ── Domain types ──────────────────────────────────────────────────────────────

export type Period = '7d' | '30d' | '90d'

export type ActiveTab = 'overview' | 'responses' | 'conformidade' | 'reincidencias'

export type StoreStats = {
  store_id: number
  store_name: string
  total_checklists: number
  completed_today: number
  completion_rate: number
}

export type TemplateStats = {
  template_id: number
  template_name: string
  total_uses: number
  avg_completion_time: number
}

export type DailyStats = {
  date: string
  count: number
}

export type SectorStats = {
  sector_id: number
  sector_name: string
  store_name: string
  total_checklists: number
  completed: number
  completion_rate: number
}

export type RequiredAction = {
  text: string
  responsible: string
  deadline: string
  deadlineColor: string
}

export type UserChecklist = {
  id: number
  status: string
  created_at: string
  completed_at: string | null
  created_by: string
  user_name: string
  user_email: string
  store_name: string
  template_name: string
}

export type RawChecklist = {
  id: number
  store_id: number
  template_id: number
  sector_id: number | null
  status: string
  created_by: string
  started_at: string | null
  created_at: string
  completed_at: string | null
}

// ── Module-level constants (replaces getStatusBadge recreating Record per call) ─

export const STATUS_BADGES: Record<string, { label: string; cls: string }> = {
  validado:     { label: 'Validado',     cls: 'bg-success/20 text-success'       },
  concluido:    { label: 'Concluído',    cls: 'bg-primary/20 text-primary'       },
  em_andamento: { label: 'Em Andamento', cls: 'bg-warning/20 text-warning'       },
  incompleto:   { label: 'Incompleto',   cls: 'bg-error/20 text-error'           },
  rascunho:     { label: 'Rascunho',     cls: 'bg-surface-hover text-muted'      },
}

export function getStatusBadge(status: string): { label: string; cls: string } {
  return STATUS_BADGES[status] ?? { label: status, cls: 'bg-surface-hover text-muted' }
}

// ── Module-level utilities ────────────────────────────────────────────────────

/** Formats an ISO date string as dd/mm/yy HH:mm in pt-BR locale. */
export function formatDateShort(dateString: string): string {
  return new Date(dateString).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}
