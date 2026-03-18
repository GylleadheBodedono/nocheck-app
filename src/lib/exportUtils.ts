/**
 * Utilitarios de exportacao client-side para relatorios.
 * Compativel com Cloudflare Pages (sem Node.js APIs).
 */

import type { NCPhotoItem } from './ncPhotoReportQueries'
import type { ActionPlanReportItem } from './actionPlanReportQueries'
import type { ComplianceSummary, FieldComplianceRow, StoreComplianceRow, ReincidenciaSummary, ReincidenciaRow, AssigneeStats } from './analyticsQueries'
import type { AdherenceMetrics, TemplateAdherence, StoreAdherence, UserAdherence, CoverageGap } from './adherenceCalculations'
import { formatMinutes } from './adherenceCalculations'

// ═══════════════════════════════════════════════════════════════════════════════
// TIPOS PARA EXPORTACAO DAS TABS DE RELATORIOS
// ═══════════════════════════════════════════════════════════════════════════════

export type OverviewExportData = {
  summary: { totalChecklists: number; completedToday: number; avgPerDay: number; activeUsers: number; activeStores: number; activeTemplates: number }
  storeStats: { store_name: string; total_checklists: number; completed_today: number; completion_rate: number }[]
  templateStats: { template_name: string; total_uses: number }[]
  dailyStats: { date: string; count: number }[]
  period: string
  // Enhanced adherence data (optional for backward compat)
  overallMetrics?: AdherenceMetrics
  templateAdherence?: TemplateAdherence[]
  storeAdherence?: StoreAdherence[]
  userAdherence?: UserAdherence[]
  coverageGaps?: CoverageGap[]
  avgCompletionTimeMinutes?: number | null
}

export type UserChecklistExport = {
  id: number
  status: string
  created_at: string
  completed_at: string | null
  user_name: string
  user_email: string
  store_name: string
  template_name: string
}

export type ComplianceExportData = {
  summary: ComplianceSummary
  byField: FieldComplianceRow[]
  byStore: StoreComplianceRow[]
}

export type ReincidenciaExportData = {
  summary: ReincidenciaSummary
  rows: ReincidenciaRow[]
  assigneeStats: AssigneeStats[]
}

function downloadFile(content: string | ArrayBuffer, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const severityLabel: Record<string, string> = {
  critica: 'Critica',
  alta: 'Alta',
  media: 'Media',
  baixa: 'Baixa',
}

const statusLabel: Record<string, string> = {
  aberto: 'Aberto',
  pendente: 'Pendente',
  em_andamento: 'Em Andamento',
  concluido: 'Concluido',
  vencido: 'Vencido',
  cancelado: 'Cancelado',
}

function allPhotoUrls(item: NCPhotoItem): string {
  return [...item.photos, ...item.conditionalPhotos].join(' | ') || '-'
}

function evidenceUrls(item: NCPhotoItem): string {
  return item.evidencePhotos.join(' | ') || '-'
}

/**
 * Exporta dados NC em formato CSV
 */
export function exportToCSV(items: NCPhotoItem[], filename: string) {
  const headers = [
    'Data', 'Loja', 'Template', 'Campo', 'Severidade', 'Valor NC',
    'Texto da Resposta', 'Reincidencia', 'Status', 'Responsavel', 'Fotos NC', 'Fotos Evidencia',
  ]

  const rows = items.map(item => [
    new Date(item.createdAt).toLocaleDateString('pt-BR'),
    item.storeName,
    item.templateName,
    item.fieldName,
    severityLabel[item.severity] || item.severity,
    `"${(item.nonConformityValue || '').replace(/"/g, '""')}"`,
    `"${(item.conditionalText || '').replace(/"/g, '""')}"`,
    item.isReincidencia ? `Sim (${item.reincidenciaCount}x)` : 'Nao',
    statusLabel[item.status] || item.status,
    item.assignedUserName,
    `"${allPhotoUrls(item).replace(/"/g, '""')}"`,
    `"${evidenceUrls(item).replace(/"/g, '""')}"`,
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map(r => r.join(',')),
  ].join('\n')

  // BOM for UTF-8 in Excel
  downloadFile('\uFEFF' + csvContent, filename, 'text/csv;charset=utf-8')
}

/**
 * Exporta dados NC em formato TXT legivel
 */
export function exportToTXT(items: NCPhotoItem[], filename: string) {
  const lines: string[] = [
    '=====================================================',
    ' RELATORIO FOTOGRAFICO DE NAO-CONFORMIDADES',
    ` Gerado em: ${new Date().toLocaleString('pt-BR')}`,
    ` Total de NCs: ${items.length}`,
    '=====================================================',
    '',
  ]

  for (const item of items) {
    const severityBadge = `[${(severityLabel[item.severity] || item.severity).toUpperCase()}]`
    lines.push(`--- NC #${item.actionPlanId} ${severityBadge} ---`)
    lines.push(`  Campo: ${item.fieldName}`)
    lines.push(`  Loja: ${item.storeName}`)
    lines.push(`  Template: ${item.templateName}`)
    lines.push(`  Valor: ${item.nonConformityValue || '-'}`)
    if (item.conditionalText) {
      lines.push(`  Texto da Resposta: ${item.conditionalText}`)
    }
    lines.push(`  Data: ${new Date(item.createdAt).toLocaleDateString('pt-BR')}`)
    lines.push(`  Responsavel: ${item.assignedUserName}`)
    lines.push(`  Status: ${statusLabel[item.status] || item.status}`)
    if (item.isReincidencia) {
      lines.push(`  Reincidencia: ${item.reincidenciaCount}x`)
    }

    const ncPhotos = [...item.photos, ...item.conditionalPhotos]
    if (ncPhotos.length > 0) {
      lines.push(`  Fotos NC (${ncPhotos.length}):`)
      ncPhotos.forEach((url, i) => lines.push(`    ${i + 1}. ${url}`))
    }

    if (item.evidencePhotos.length > 0) {
      lines.push(`  Fotos Evidencia (${item.evidencePhotos.length}):`)
      item.evidencePhotos.forEach((url, i) => lines.push(`    ${i + 1}. ${url}`))
    }

    if (ncPhotos.length === 0 && item.evidencePhotos.length === 0) {
      lines.push('  (Sem fotos)')
    }

    lines.push('')
  }

  downloadFile(lines.join('\n'), filename, 'text/plain;charset=utf-8')
}

// ─── PDF helpers ────────────────────────────────────────────────────────────

/** Remove diacritics so jsPDF (no UTF-8 font) renders text correctly */
const n = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/** Fetch a remote URL and return it as a base64 data URL, or null on failure */
async function fetchAsBase64(url: string): Promise<string | null> {
  try {
    const blob = await fetch(url).then(r => r.blob())
    return await new Promise<string | null>(res => {
      const reader = new FileReader()
      reader.onload = () => res(reader.result as string)
      reader.onerror = () => res(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

const MARGIN = 14
const CONTENT_W = 182
const IMG_W = 55
const IMG_H = 40
const IMG_GAP = 4
const PHOTOS_PER_ROW = 3
const PAGE_BOTTOM = 270

type PdfMeta = {
  dateFrom: string
  dateTo: string
  storeName?: string
  templateName?: string
  severityLabel?: string
}

/**
 * Exporta dados NC em formato PDF com fotos embutidas.
 * Usa dynamic import para lazy-load do jsPDF (~300 KB).
 */
export async function exportToPDF(items: NCPhotoItem[], meta: PdfMeta): Promise<void> {
  const { jsPDF } = await import('jspdf')

  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })

  // ── Collect all photo URLs ───────────────────────────────────────────────
  const allUrls = new Set<string>()
  for (const item of items) {
    for (const url of [...item.photos, ...item.conditionalPhotos, ...item.evidencePhotos]) {
      if (url && !url.startsWith('data:')) allUrls.add(url)
    }
  }

  // Fetch all images in parallel
  const base64Map = new Map<string, string | null>()
  const fetched = await Promise.allSettled(
    Array.from(allUrls).map(async url => {
      const b64 = await fetchAsBase64(url)
      base64Map.set(url, b64)
    })
  )
  void fetched // suppress unused warning

  // ── Helpers ──────────────────────────────────────────────────────────────
  let y = MARGIN

  const ensureSpace = (needed: number) => {
    if (y + needed > PAGE_BOTTOM) {
      doc.addPage()
      y = MARGIN
    }
  }

  const addText = (text: string, size: number, bold: boolean, x = MARGIN, color = '#000000') => {
    doc.setFontSize(size)
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setTextColor(color)
    doc.text(n(text), x, y)
  }

  const addLine = (x1 = MARGIN, x2 = MARGIN + CONTENT_W, color = '#CCCCCC') => {
    doc.setDrawColor(color)
    doc.line(x1, y, x2, y)
  }

  // ── Helper: draw a photo grid ────────────────────────────────────────────
  const drawPhotoGrid = (urls: string[], label: string) => {
    if (urls.length === 0) return

    ensureSpace(8)
    addText(label, 8, false, MARGIN, '#666666')
    y += 5

    let col = 0
    for (const url of urls) {
      if (col === PHOTOS_PER_ROW) {
        col = 0
        y += IMG_H + IMG_GAP
        ensureSpace(IMG_H + 8)
      }
      const x = MARGIN + col * (IMG_W + IMG_GAP)
      const b64 = base64Map.get(url)
      if (b64) {
        try {
          const format = b64.startsWith('data:image/png') ? 'PNG' : 'JPEG'
          doc.addImage(b64, format, x, y, IMG_W, IMG_H)
        } catch {
          // draw placeholder on image error
          doc.setFillColor('#F0F0F0')
          doc.rect(x, y, IMG_W, IMG_H, 'F')
          doc.setFontSize(7)
          doc.setTextColor('#999999')
          doc.text('Foto indisponivel', x + 2, y + IMG_H / 2)
        }
      } else {
        // URL failed to load — draw placeholder
        doc.setFillColor('#F0F0F0')
        doc.rect(x, y, IMG_W, IMG_H, 'F')
        doc.setFontSize(7)
        doc.setTextColor('#999999')
        doc.text('Foto indisponivel', x + 2, y + IMG_H / 2)
      }
      col++
    }
    y += IMG_H + IMG_GAP
  }

  // ── Page 1: Header ───────────────────────────────────────────────────────
  addText('RELATORIO FOTOGRAFICO DE NAO-CONFORMIDADES', 14, true)
  y += 7

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor('#333333')

  const fmtDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString('pt-BR') } catch { return iso }
  }

  doc.text(n(`Periodo: ${fmtDate(meta.dateFrom)} a ${fmtDate(meta.dateTo)}`), MARGIN, y)
  y += 5
  if (meta.storeName) { doc.text(n(`Loja: ${meta.storeName}`), MARGIN, y); y += 5 }
  if (meta.templateName) { doc.text(n(`Template: ${meta.templateName}`), MARGIN, y); y += 5 }
  if (meta.severityLabel) { doc.text(n(`Severidade: ${meta.severityLabel}`), MARGIN, y); y += 5 }

  doc.text(n(`Gerado em: ${new Date().toLocaleString('pt-BR')}`), MARGIN, y)
  y += 5

  // Counters
  const withPhotos = items.filter(i => i.photos.length + i.conditionalPhotos.length + i.evidencePhotos.length > 0).length
  const totalPhotos = items.reduce((acc, i) => acc + i.photos.length + i.conditionalPhotos.length + i.evidencePhotos.length, 0)
  doc.text(n(`Total de NCs: ${items.length}   Com fotos: ${withPhotos}   Total de fotos: ${totalPhotos}`), MARGIN, y)
  y += 8

  addLine()
  y += 6

  // ── Per-NC blocks ────────────────────────────────────────────────────────
  const sevLabel: Record<string, string> = { critica: 'CRITICA', alta: 'ALTA', media: 'MEDIA', baixa: 'BAIXA' }
  const stLabel: Record<string, string> = { pendente: 'Pendente', em_andamento: 'Em Andamento', concluido: 'Concluido', vencido: 'Vencido' }

  for (const item of items) {
    ensureSpace(24)

    // Separator + severity badge
    addLine()
    y += 5

    const sev = sevLabel[item.severity] || item.severity.toUpperCase()
    addText(`[${sev}]  ${item.fieldName}`, 10, true)
    y += 5

    // Metadata row
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor('#444444')
    const metaLine = [
      fmtDate(item.createdAt),
      item.storeName,
      item.templateName,
      stLabel[item.status] || item.status,
      item.assignedUserName,
    ].filter(Boolean).join('  |  ')
    doc.text(n(metaLine), MARGIN, y)
    y += 4

    if (item.nonConformityValue) {
      doc.text(n(`Valor: ${item.nonConformityValue}`), MARGIN, y)
      y += 4
    }
    if (item.conditionalText) {
      doc.text(n(`Texto da Resposta: ${item.conditionalText}`), MARGIN, y)
      y += 4
    }
    if (item.isReincidencia) {
      doc.text(n(`Reincidencia: ${item.reincidenciaCount}x`), MARGIN, y)
      y += 4
    }
    y += 2

    // NC photos
    const ncPhotos = [...item.photos, ...item.conditionalPhotos]
    drawPhotoGrid(ncPhotos, `Fotos NC (${ncPhotos.length})`)

    // Evidence photos
    drawPhotoGrid(item.evidencePhotos, `Fotos Evidencia (${item.evidencePhotos.length})`)

    y += 4
  }

  // ── Footers ──────────────────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor('#999999')
    doc.text(n(`Pagina ${p} de ${totalPages}`), MARGIN, 290)
  }

  // ── Save ─────────────────────────────────────────────────────────────────
  const timestamp = new Date().toISOString().split('T')[0]
  doc.save(`relatorio_fotos_nc_${timestamp}.pdf`)
}

/**
 * Exporta dados NC em formato Excel (xlsx)
 * Usa dynamic import para lazy-load do SheetJS (~300KB)
 */
export async function exportToExcel(items: NCPhotoItem[], filename: string) {
  const XLSX = await import('xlsx')

  const data = items.map(item => ({
    'Data': new Date(item.createdAt).toLocaleDateString('pt-BR'),
    'Loja': item.storeName,
    'Template': item.templateName,
    'Campo': item.fieldName,
    'Severidade': severityLabel[item.severity] || item.severity,
    'Valor NC': item.nonConformityValue || '-',
    'Texto da Resposta': item.conditionalText || '-',
    'Reincidencia': item.isReincidencia ? `Sim (${item.reincidenciaCount}x)` : 'Nao',
    'Status': statusLabel[item.status] || item.status,
    'Responsavel': item.assignedUserName,
    'Fotos NC': allPhotoUrls(item),
    'Fotos Evidencia': evidenceUrls(item),
  }))

  const ws = XLSX.utils.json_to_sheet(data)

  // Auto-width columns
  const colWidths = Object.keys(data[0] || {}).map(key => ({
    wch: Math.max(
      key.length,
      ...data.map(row => String((row as Record<string, string>)[key] || '').length).slice(0, 50)
    ) + 2,
  }))
  ws['!cols'] = colWidths

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'NCs com Fotos')

  const xlsxBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  downloadFile(xlsxBuffer, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTACOES DE PLANOS DE ACAO
// ═══════════════════════════════════════════════════════════════════════════════

function apStoreNames(item: ActionPlanReportItem): string {
  return item.storeNames.join(', ') || '-'
}

function apEvidenceUrls(item: ActionPlanReportItem): string {
  return item.evidencePhotos.join(' | ') || '-'
}

function fmtDateBR(iso: string | null): string {
  if (!iso) return '-'
  try { return new Date(iso).toLocaleDateString('pt-BR') } catch { return iso }
}

/**
 * Exporta planos de acao em formato CSV
 */
export function exportActionPlanToCSV(items: ActionPlanReportItem[], filename: string) {
  const headers = [
    'Data Criacao', 'Titulo', 'Loja(s)', 'Template', 'Campo', 'Severidade',
    'Status', 'Responsavel', 'Prazo', 'Inicio', 'Conclusao',
    'Texto Conclusao', 'Reincidencia', 'Valor NC', 'Fotos Evidencia',
  ]

  const esc = (val: string) => `"${val.replace(/"/g, '""')}"`

  const rows = items.map(item => [
    esc(fmtDateBR(item.createdAt)),
    esc(item.title),
    esc(apStoreNames(item)),
    esc(item.templateName),
    esc(item.fieldName),
    esc(severityLabel[item.severity] || item.severity),
    esc(statusLabel[item.status] || item.status),
    esc(item.assignedUserName),
    esc(fmtDateBR(item.deadline)),
    esc(fmtDateBR(item.startedAt)),
    esc(fmtDateBR(item.completedAt)),
    esc(item.completionText || '-'),
    esc(item.isReincidencia ? `Sim (${item.reincidenciaCount}x)` : 'Nao'),
    esc(item.nonConformityValue || '-'),
    esc(apEvidenceUrls(item)),
  ].join(','))

  const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n')
  downloadFile(csv, filename, 'text/csv;charset=utf-8')
}

/**
 * Exporta planos de acao em formato TXT legivel
 */
export function exportActionPlanToTXT(items: ActionPlanReportItem[], filename: string) {
  const lines: string[] = [
    '═'.repeat(80),
    'RELATORIO DE PLANOS DE ACAO',
    `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
    `Total de planos: ${items.length}`,
    '═'.repeat(80),
    '',
  ]

  for (const item of items) {
    lines.push('─'.repeat(60))
    lines.push(`[${(severityLabel[item.severity] || item.severity).toUpperCase()}] ${item.title}`)
    lines.push(`  Loja(s):      ${apStoreNames(item)}`)
    lines.push(`  Template:     ${item.templateName}`)
    lines.push(`  Campo:        ${item.fieldName}`)
    lines.push(`  Status:       ${statusLabel[item.status] || item.status}`)
    lines.push(`  Responsavel:  ${item.assignedUserName}`)
    lines.push(`  Criado em:    ${fmtDateBR(item.createdAt)}`)
    lines.push(`  Prazo:        ${fmtDateBR(item.deadline)}`)
    if (item.startedAt) lines.push(`  Inicio:       ${fmtDateBR(item.startedAt)}`)
    if (item.completedAt) lines.push(`  Conclusao:    ${fmtDateBR(item.completedAt)}`)
    if (item.nonConformityValue) lines.push(`  Valor NC:     ${item.nonConformityValue}`)
    if (item.isReincidencia) lines.push(`  Reincidencia: ${item.reincidenciaCount}x`)
    if (item.completionText) {
      lines.push(`  Texto Conclusao:`)
      lines.push(`    ${item.completionText}`)
    }
    if (item.evidencePhotos.length > 0) {
      lines.push(`  Fotos Evidencia (${item.evidencePhotos.length}):`)
      for (const url of item.evidencePhotos) lines.push(`    ${url}`)
    }
    lines.push('')
  }

  downloadFile(lines.join('\n'), filename, 'text/plain;charset=utf-8')
}

/**
 * Exporta planos de acao em formato Excel
 */
export async function exportActionPlanToExcel(items: ActionPlanReportItem[], filename: string) {
  const XLSX = await import('xlsx')

  const data = items.map(item => ({
    'Data Criacao': fmtDateBR(item.createdAt),
    'Titulo': item.title,
    'Loja(s)': apStoreNames(item),
    'Template': item.templateName,
    'Campo': item.fieldName,
    'Severidade': severityLabel[item.severity] || item.severity,
    'Status': statusLabel[item.status] || item.status,
    'Responsavel': item.assignedUserName,
    'Prazo': fmtDateBR(item.deadline),
    'Inicio': fmtDateBR(item.startedAt),
    'Conclusao': fmtDateBR(item.completedAt),
    'Texto Conclusao': item.completionText || '-',
    'Reincidencia': item.isReincidencia ? `Sim (${item.reincidenciaCount}x)` : 'Nao',
    'Valor NC': item.nonConformityValue || '-',
    'Fotos Evidencia': apEvidenceUrls(item),
  }))

  const ws = XLSX.utils.json_to_sheet(data)

  const colWidths = Object.keys(data[0] || {}).map(key => ({
    wch: Math.max(
      key.length,
      ...data.map(row => String((row as Record<string, string>)[key] || '').length).slice(0, 50)
    ) + 2,
  }))
  ws['!cols'] = colWidths

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Planos de Acao')

  const xlsxBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  downloadFile(xlsxBuffer, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
}

type ActionPlanPdfMeta = {
  dateFrom: string
  dateTo: string
  storeName?: string
  templateName?: string
  severityLabel?: string
  statusLabel?: string
  assigneeName?: string
}

/**
 * Exporta planos de acao em formato PDF com fotos de evidencia embutidas.
 */
export async function exportActionPlanToPDF(items: ActionPlanReportItem[], meta: ActionPlanPdfMeta): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })

  // Collect all evidence photo URLs
  const allUrls = new Set<string>()
  for (const item of items) {
    for (const url of item.evidencePhotos) {
      if (url && !url.startsWith('data:')) allUrls.add(url)
    }
  }

  // Fetch all images in parallel
  const base64Map = new Map<string, string | null>()
  await Promise.allSettled(
    Array.from(allUrls).map(async url => {
      const b64 = await fetchAsBase64(url)
      base64Map.set(url, b64)
    })
  )

  // Helpers
  let y = MARGIN

  const ensureSpace = (needed: number) => {
    if (y + needed > PAGE_BOTTOM) {
      doc.addPage()
      y = MARGIN
    }
  }

  const addText = (text: string, size: number, bold: boolean, x = MARGIN, color = '#000000') => {
    doc.setFontSize(size)
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setTextColor(color)
    doc.text(n(text), x, y)
  }

  const addLine = (x1 = MARGIN, x2 = MARGIN + CONTENT_W, color = '#CCCCCC') => {
    doc.setDrawColor(color)
    doc.line(x1, y, x2, y)
  }

  const drawPhotoGrid = (urls: string[], label: string) => {
    if (urls.length === 0) return

    ensureSpace(8)
    addText(label, 8, false, MARGIN, '#666666')
    y += 5

    let col = 0
    for (const url of urls) {
      if (col === PHOTOS_PER_ROW) {
        col = 0
        y += IMG_H + IMG_GAP
        ensureSpace(IMG_H + 8)
      }
      const x = MARGIN + col * (IMG_W + IMG_GAP)
      const b64 = base64Map.get(url)
      if (b64) {
        try {
          const format = b64.startsWith('data:image/png') ? 'PNG' : 'JPEG'
          doc.addImage(b64, format, x, y, IMG_W, IMG_H)
        } catch {
          doc.setFillColor('#F0F0F0')
          doc.rect(x, y, IMG_W, IMG_H, 'F')
          doc.setFontSize(7)
          doc.setTextColor('#999999')
          doc.text('Foto indisponivel', x + 2, y + IMG_H / 2)
        }
      } else {
        doc.setFillColor('#F0F0F0')
        doc.rect(x, y, IMG_W, IMG_H, 'F')
        doc.setFontSize(7)
        doc.setTextColor('#999999')
        doc.text('Foto indisponivel', x + 2, y + IMG_H / 2)
      }
      col++
    }
    y += IMG_H + IMG_GAP
  }

  // Header
  addText('RELATORIO DE PLANOS DE ACAO', 14, true)
  y += 7

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor('#333333')

  const fmtD = (iso: string) => {
    try { return new Date(iso).toLocaleDateString('pt-BR') } catch { return iso }
  }

  doc.text(n(`Periodo: ${fmtD(meta.dateFrom)} a ${fmtD(meta.dateTo)}`), MARGIN, y)
  y += 5
  if (meta.storeName) { doc.text(n(`Loja: ${meta.storeName}`), MARGIN, y); y += 5 }
  if (meta.templateName) { doc.text(n(`Template: ${meta.templateName}`), MARGIN, y); y += 5 }
  if (meta.severityLabel) { doc.text(n(`Severidade: ${meta.severityLabel}`), MARGIN, y); y += 5 }
  if (meta.statusLabel) { doc.text(n(`Status: ${meta.statusLabel}`), MARGIN, y); y += 5 }
  if (meta.assigneeName) { doc.text(n(`Responsavel: ${meta.assigneeName}`), MARGIN, y); y += 5 }

  doc.text(n(`Gerado em: ${new Date().toLocaleString('pt-BR')}`), MARGIN, y)
  y += 5

  // Summary counts
  const concluidos = items.filter(i => i.status === 'concluido').length
  const vencidos = items.filter(i => !['concluido', 'cancelado'].includes(i.status) && i.deadline && i.deadline < new Date().toISOString().split('T')[0]).length
  const emAndamento = items.filter(i => i.status === 'em_andamento').length
  doc.text(n(`Total: ${items.length}   Concluidos: ${concluidos}   Vencidos: ${vencidos}   Em Andamento: ${emAndamento}`), MARGIN, y)
  y += 8

  addLine()
  y += 6

  // Per-item blocks
  const sevLabel: Record<string, string> = { critica: 'CRITICA', alta: 'ALTA', media: 'MEDIA', baixa: 'BAIXA' }
  const stLabel: Record<string, string> = { aberto: 'Aberto', em_andamento: 'Em Andamento', concluido: 'Concluido', vencido: 'Vencido', cancelado: 'Cancelado' }

  for (const item of items) {
    ensureSpace(28)

    addLine()
    y += 5

    const sev = sevLabel[item.severity] || item.severity.toUpperCase()
    addText(`[${sev}]  ${item.title}`, 10, true)
    y += 5

    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor('#444444')

    const metaLine = [
      fmtD(item.createdAt),
      apStoreNames(item),
      item.templateName,
      stLabel[item.status] || item.status,
      item.assignedUserName,
      `Prazo: ${fmtD(item.deadline)}`,
    ].filter(Boolean).join('  |  ')
    doc.text(n(metaLine), MARGIN, y)
    y += 4

    if (item.nonConformityValue) {
      doc.text(n(`Valor NC: ${item.nonConformityValue}`), MARGIN, y)
      y += 4
    }
    if (item.isReincidencia) {
      doc.text(n(`Reincidencia: ${item.reincidenciaCount}x`), MARGIN, y)
      y += 4
    }
    if (item.completionText) {
      y += 2
      // Wrap long completion text
      doc.setFontSize(8)
      doc.setTextColor('#2E7D32')
      const maxWidth = CONTENT_W - 4
      const textLines = doc.splitTextToSize(n(`Conclusao: ${item.completionText}`), maxWidth)
      for (const line of textLines) {
        ensureSpace(5)
        doc.text(line, MARGIN, y)
        y += 4
      }
      doc.setTextColor('#444444')
    }
    y += 2

    // Evidence photos
    drawPhotoGrid(item.evidencePhotos, `Fotos Evidencia (${item.evidencePhotos.length})`)

    y += 4
  }

  // Footers
  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor('#999999')
    doc.text(n(`Pagina ${p} de ${totalPages}`), MARGIN, 290)
  }

  const timestamp = new Date().toISOString().split('T')[0]
  doc.save(`relatorio_planos_acao_${timestamp}.pdf`)
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTACOES DAS TABS DE RELATORIOS (VISAO GERAL, RESPOSTAS, CONFORMIDADE, REINCIDENCIAS)
// ═══════════════════════════════════════════════════════════════════════════════

const periodLabel: Record<string, string> = { '7d': '7 dias', '30d': '30 dias', '90d': '90 dias' }

// ─── PDF table helper ────────────────────────────────────────────────────────

type PdfCol = { header: string; width: number; align?: 'right' }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawPdfTable(doc: any, columns: PdfCol[], rows: string[][], startY: number): number {
  let y = startY
  const ROW_H = 6

  const ensurePage = (need: number) => {
    if (y + need > PAGE_BOTTOM) { doc.addPage(); y = MARGIN }
  }

  // Header row
  ensurePage(ROW_H + 2)
  doc.setFillColor('#E0E0E0')
  doc.rect(MARGIN, y - 4, CONTENT_W, ROW_H, 'F')
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor('#333333')
  let x = MARGIN + 2
  for (const col of columns) {
    doc.text(n(col.header), col.align === 'right' ? x + col.width - 2 : x, y, col.align === 'right' ? { align: 'right' } : undefined)
    x += col.width
  }
  y += ROW_H

  // Data rows
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  for (let i = 0; i < rows.length; i++) {
    ensurePage(ROW_H)
    if (i % 2 === 1) {
      doc.setFillColor('#F8F8F8')
      doc.rect(MARGIN, y - 4, CONTENT_W, ROW_H, 'F')
    }
    doc.setTextColor('#444444')
    x = MARGIN + 2
    for (let c = 0; c < columns.length; c++) {
      const val = rows[i][c] || ''
      const col = columns[c]
      doc.text(n(val), col.align === 'right' ? x + col.width - 2 : x, y, col.align === 'right' ? { align: 'right' } : undefined)
      x += col.width
    }
    y += ROW_H
  }

  return y
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addPdfFooters(doc: any) {
  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor('#999999')
    doc.text(n(`Pagina ${p} de ${totalPages}`), MARGIN, 290)
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addPdfHeader(doc: any, title: string, meta: string[], orgName?: string): number {
  let y = MARGIN
  // Org name (if white-label)
  if (orgName) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor('#666666')
    doc.text(n(orgName), MARGIN, y)
    y += 6
  }
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor('#000000')
  doc.text(n(title), MARGIN, y)
  y += 7
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor('#333333')
  for (const line of meta) {
    doc.text(n(line), MARGIN, y)
    y += 5
  }
  y += 3
  doc.setDrawColor('#CCCCCC')
  doc.line(MARGIN, y, MARGIN + CONTENT_W, y)
  y += 6
  return y
}

// ─── VISAO GERAL ─────────────────────────────────────────────────────────────

export function exportOverviewToCSV(data: OverviewExportData, filename: string) {
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`
  const lines: string[] = []

  lines.push('=== RESUMO ===')
  lines.push('Total Checklists,Hoje,Media/Dia,Usuarios Ativos,Lojas Ativas,Templates Ativos')
  lines.push([data.summary.totalChecklists, data.summary.completedToday, data.summary.avgPerDay, data.summary.activeUsers, data.summary.activeStores, data.summary.activeTemplates].join(','))
  lines.push('')

  // Enhanced status distribution
  if (data.overallMetrics) {
    const m = data.overallMetrics
    const b = m.statusBreakdown
    lines.push('=== DISTRIBUICAO DE STATUS ===')
    lines.push('Taxa Conclusao (%),Validados,Concluidos,Em Andamento,Incompletos,Rascunhos,Total,Tempo Medio')
    lines.push([m.completionRate, b.validado, b.concluido, b.em_andamento, b.incompleto, b.rascunho, b.total, formatMinutes(data.avgCompletionTimeMinutes ?? null)].join(','))
    lines.push('')
  }

  // Enhanced template adherence
  if (data.templateAdherence && data.templateAdherence.length > 0) {
    lines.push('=== ADESAO POR TEMPLATE ===')
    lines.push('Template,Total,Validados,Concluidos,Em Andamento,Incompletos,Rascunhos,Taxa (%),Tempo Medio,Lojas sem Preenchimento')
    for (const t of data.templateAdherence) {
      const b = t.metrics.statusBreakdown
      lines.push([esc(t.templateName), b.total, b.validado, b.concluido, b.em_andamento, b.incompleto, b.rascunho, t.metrics.completionRate, formatMinutes(t.avgCompletionTimeMinutes), `${t.storesWithZero}/${t.totalAssignedStores}`].join(','))
    }
    lines.push('')
  }

  // Enhanced store adherence
  if (data.storeAdherence && data.storeAdherence.length > 0) {
    lines.push('=== ADESAO POR LOJA ===')
    lines.push('Loja,Total,Validados,Concluidos,Em Andamento,Incompletos,Rascunhos,Taxa (%),Templates Faltando')
    for (const s of data.storeAdherence) {
      const b = s.metrics.statusBreakdown
      lines.push([esc(s.storeName), b.total, b.validado, b.concluido, b.em_andamento, b.incompleto, b.rascunho, s.metrics.completionRate, esc(s.templatesNeverFilled.join('; ') || '-')].join(','))
    }
    lines.push('')
  }

  // User adherence
  if (data.userAdherence && data.userAdherence.length > 0) {
    lines.push('=== ADESAO POR USUARIO ===')
    lines.push('Usuario,Total,Validados,Concluidos,Em Andamento,Incompletos,Rascunhos,Taxa (%),Tempo Medio')
    for (const u of data.userAdherence) {
      const b = u.metrics.statusBreakdown
      lines.push([esc(u.userName), b.total, b.validado, b.concluido, b.em_andamento, b.incompleto, b.rascunho, u.metrics.completionRate, formatMinutes(u.avgCompletionTimeMinutes)].join(','))
    }
    lines.push('')
  }

  // Coverage gaps
  if (data.coverageGaps && data.coverageGaps.length > 0) {
    lines.push('=== LACUNAS DE COBERTURA ===')
    lines.push('Template,Loja,Ultimo Preenchimento,Dias sem Preenchimento')
    for (const g of data.coverageGaps) {
      lines.push([esc(g.templateName), esc(g.storeName), g.lastFilledAt ? fmtDateBR(g.lastFilledAt) : 'Nunca', g.daysSinceLastFilled !== null ? String(g.daysSinceLastFilled) : '-'].join(','))
    }
    lines.push('')
  }

  // Legacy sections (keep for compat)
  lines.push('=== DESEMPENHO POR LOJA ===')
  lines.push('Loja,Total Checklists,Hoje,Media/Dia')
  for (const s of data.storeStats) {
    lines.push([esc(s.store_name), s.total_checklists, s.completed_today, s.completion_rate].join(','))
  }
  lines.push('')

  lines.push('=== DADOS DIARIOS ===')
  lines.push('Data,Quantidade')
  for (const d of data.dailyStats) {
    lines.push([d.date, d.count].join(','))
  }

  downloadFile('\uFEFF' + lines.join('\n'), filename, 'text/csv;charset=utf-8')
}

export function exportOverviewToTXT(data: OverviewExportData, filename: string) {
  const s = data.summary
  const lines: string[] = [
    '═'.repeat(80),
    'RELATORIO VISAO GERAL',
    `Periodo: ${periodLabel[data.period] || data.period}`,
    `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
    '═'.repeat(80),
    '',
    '--- RESUMO ---',
    `  Total Checklists:  ${s.totalChecklists}`,
    `  Concluidos Hoje:   ${s.completedToday}`,
    `  Media por Dia:     ${s.avgPerDay}`,
    `  Usuarios Ativos:   ${s.activeUsers}`,
    `  Lojas Ativas:      ${s.activeStores}`,
    `  Templates Ativos:  ${s.activeTemplates}`,
    '',
  ]

  // Enhanced status distribution
  if (data.overallMetrics) {
    const m = data.overallMetrics
    const b = m.statusBreakdown
    lines.push('--- DISTRIBUICAO DE STATUS ---')
    lines.push(`  Taxa de Conclusao:  ${m.completionRate}%`)
    lines.push(`  Validados:          ${b.validado}`)
    lines.push(`  Concluidos:         ${b.concluido}`)
    lines.push(`  Em Andamento:       ${b.em_andamento}`)
    lines.push(`  Incompletos:        ${b.incompleto}`)
    lines.push(`  Rascunhos:          ${b.rascunho}`)
    lines.push(`  Total:              ${b.total}`)
    lines.push(`  Tempo Medio:        ${formatMinutes(data.avgCompletionTimeMinutes ?? null)}`)
    lines.push('')
  }

  // Template adherence
  if (data.templateAdherence && data.templateAdherence.length > 0) {
    lines.push('--- ADESAO POR TEMPLATE ---')
    for (const t of data.templateAdherence) {
      const b = t.metrics.statusBreakdown
      lines.push(`  ${t.templateName.padEnd(35)} Taxa: ${String(t.metrics.completionRate).padStart(3)}%  V:${b.validado} C:${b.concluido} A:${b.em_andamento} I:${b.incompleto} R:${b.rascunho}  Lojas s/preench: ${t.storesWithZero}/${t.totalAssignedStores}`)
    }
    lines.push('')
  }

  // Store adherence
  if (data.storeAdherence && data.storeAdherence.length > 0) {
    lines.push('--- ADESAO POR LOJA ---')
    for (const st of data.storeAdherence) {
      const b = st.metrics.statusBreakdown
      lines.push(`  ${st.storeName.padEnd(35)} Taxa: ${String(st.metrics.completionRate).padStart(3)}%  V:${b.validado} C:${b.concluido} A:${b.em_andamento} I:${b.incompleto} R:${b.rascunho}`)
      if (st.templatesNeverFilled.length > 0) {
        lines.push(`    Templates faltando: ${st.templatesNeverFilled.join(', ')}`)
      }
    }
    lines.push('')
  }

  // User adherence
  if (data.userAdherence && data.userAdherence.length > 0) {
    lines.push('--- ADESAO POR USUARIO ---')
    for (const u of data.userAdherence) {
      const b = u.metrics.statusBreakdown
      lines.push(`  ${u.userName.padEnd(30)} Taxa: ${String(u.metrics.completionRate).padStart(3)}%  V:${b.validado} C:${b.concluido} A:${b.em_andamento} I:${b.incompleto} R:${b.rascunho}  Tempo: ${formatMinutes(u.avgCompletionTimeMinutes)}`)
    }
    lines.push('')
  }

  // Coverage gaps
  if (data.coverageGaps && data.coverageGaps.length > 0) {
    lines.push('--- LACUNAS DE COBERTURA ---')
    for (const g of data.coverageGaps) {
      const lastFilled = g.lastFilledAt ? fmtDateBR(g.lastFilledAt) : 'NUNCA'
      lines.push(`  ${g.templateName.padEnd(30)} ${g.storeName.padEnd(25)} Ultimo: ${lastFilled}`)
    }
    lines.push('')
  }

  lines.push('--- DADOS DIARIOS ---')
  for (const d of data.dailyStats) {
    const bar = '█'.repeat(Math.min(d.count, 50))
    lines.push(`  ${d.date}  ${String(d.count).padStart(4)}  ${bar}`)
  }

  downloadFile(lines.join('\n'), filename, 'text/plain;charset=utf-8')
}

export async function exportOverviewToExcel(data: OverviewExportData, filename: string) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()

  // Sheet 1: Template adherence (enhanced) or legacy template stats
  if (data.templateAdherence && data.templateAdherence.length > 0) {
    const tmplRows = data.templateAdherence.map(t => ({
      'Template': t.templateName,
      'Total': t.metrics.statusBreakdown.total,
      'Validados': t.metrics.statusBreakdown.validado,
      'Concluidos': t.metrics.statusBreakdown.concluido,
      'Em Andamento': t.metrics.statusBreakdown.em_andamento,
      'Incompletos': t.metrics.statusBreakdown.incompleto,
      'Rascunhos': t.metrics.statusBreakdown.rascunho,
      'Taxa (%)': t.metrics.completionRate,
      'Tempo Medio': formatMinutes(t.avgCompletionTimeMinutes),
      'Lojas s/ Preench.': `${t.storesWithZero}/${t.totalAssignedStores}`,
    }))
    const ws = XLSX.utils.json_to_sheet(tmplRows)
    ws['!cols'] = [{ wch: 35 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 16 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Adesao por Template')
  } else {
    const tmplData = data.templateStats.map(t => ({ 'Template': t.template_name, 'Utilizacoes': t.total_uses }))
    const ws = XLSX.utils.json_to_sheet(tmplData.length ? tmplData : [{ 'Template': 'Sem dados' }])
    ws['!cols'] = [{ wch: 40 }, { wch: 14 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Uso de Checklists')
  }

  // Sheet 2: Store adherence (enhanced) or legacy store stats
  if (data.storeAdherence && data.storeAdherence.length > 0) {
    const storeRows = data.storeAdherence.map(s => ({
      'Loja': s.storeName,
      'Total': s.metrics.statusBreakdown.total,
      'Validados': s.metrics.statusBreakdown.validado,
      'Concluidos': s.metrics.statusBreakdown.concluido,
      'Em Andamento': s.metrics.statusBreakdown.em_andamento,
      'Incompletos': s.metrics.statusBreakdown.incompleto,
      'Rascunhos': s.metrics.statusBreakdown.rascunho,
      'Taxa (%)': s.metrics.completionRate,
      'Templates Faltando': s.templatesNeverFilled.join('; ') || '-',
    }))
    const ws = XLSX.utils.json_to_sheet(storeRows)
    ws['!cols'] = [{ wch: 30 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 40 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Adesao por Loja')
  } else {
    const storeData = data.storeStats.map(s => ({ 'Loja': s.store_name, 'Total Checklists': s.total_checklists, 'Hoje': s.completed_today, 'Media/Dia': s.completion_rate }))
    const ws = XLSX.utils.json_to_sheet(storeData.length ? storeData : [{ 'Loja': 'Sem dados' }])
    ws['!cols'] = [{ wch: 30 }, { wch: 16 }, { wch: 8 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Desempenho por Loja')
  }

  // Sheet 3: User adherence (new)
  if (data.userAdherence && data.userAdherence.length > 0) {
    const userRows = data.userAdherence.map(u => ({
      'Usuario': u.userName,
      'Total': u.metrics.statusBreakdown.total,
      'Validados': u.metrics.statusBreakdown.validado,
      'Concluidos': u.metrics.statusBreakdown.concluido,
      'Em Andamento': u.metrics.statusBreakdown.em_andamento,
      'Incompletos': u.metrics.statusBreakdown.incompleto,
      'Rascunhos': u.metrics.statusBreakdown.rascunho,
      'Taxa (%)': u.metrics.completionRate,
      'Tempo Medio': formatMinutes(u.avgCompletionTimeMinutes),
    }))
    const ws = XLSX.utils.json_to_sheet(userRows)
    ws['!cols'] = [{ wch: 30 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Adesao por Usuario')
  }

  // Sheet 4: Coverage gaps (new)
  if (data.coverageGaps && data.coverageGaps.length > 0) {
    const gapRows = data.coverageGaps.map(g => ({
      'Template': g.templateName,
      'Loja': g.storeName,
      'Ultimo Preenchimento': g.lastFilledAt ? fmtDateBR(g.lastFilledAt) : 'Nunca',
      'Dias sem Preenchimento': g.daysSinceLastFilled !== null ? g.daysSinceLastFilled : '-',
    }))
    const ws = XLSX.utils.json_to_sheet(gapRows)
    ws['!cols'] = [{ wch: 35 }, { wch: 30 }, { wch: 22 }, { wch: 22 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Lacunas de Cobertura')
  }

  // Sheet 5: Daily stats
  const dailyData = data.dailyStats.map(d => ({
    'Data': d.date,
    'Quantidade': d.count,
  }))
  const ws = XLSX.utils.json_to_sheet(dailyData.length ? dailyData : [{ 'Data': 'Sem dados' }])
  ws['!cols'] = [{ wch: 12 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(wb, ws, 'Dados Diarios')

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  downloadFile(buf, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
}

export async function exportOverviewToPDF(data: OverviewExportData): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' })
  const s = data.summary

  const metas = [
    `Periodo: ${periodLabel[data.period] || data.period}`,
    `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
    `Total: ${s.totalChecklists}  |  Hoje: ${s.completedToday}  |  Media/dia: ${s.avgPerDay}  |  Usuarios: ${s.activeUsers}  |  Lojas: ${s.activeStores}  |  Templates: ${s.activeTemplates}`,
  ]

  // Add status distribution if available
  if (data.overallMetrics) {
    const m = data.overallMetrics
    const b = m.statusBreakdown
    metas.push(`Taxa Conclusao: ${m.completionRate}%  |  V:${b.validado}  C:${b.concluido}  A:${b.em_andamento}  I:${b.incompleto}  R:${b.rascunho}  |  Tempo Medio: ${formatMinutes(data.avgCompletionTimeMinutes ?? null)}`)
  }

  let y = addPdfHeader(doc, 'RELATORIO VISAO GERAL', metas)

  // Template adherence table (enhanced or legacy)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor('#000000')

  if (data.templateAdherence && data.templateAdherence.length > 0) {
    doc.text(n('Adesao por Template'), MARGIN, y)
    y += 6
    y = drawPdfTable(doc, [
      { header: 'Template', width: 60 },
      { header: 'Total', width: 18, align: 'right' },
      { header: 'Valid.', width: 18, align: 'right' },
      { header: 'Concl.', width: 18, align: 'right' },
      { header: 'Andam.', width: 18, align: 'right' },
      { header: 'Incomp.', width: 20, align: 'right' },
      { header: 'Rasc.', width: 18, align: 'right' },
      { header: 'Taxa', width: 18, align: 'right' },
      { header: 'Tempo', width: 22, align: 'right' },
      { header: 'Lacunas', width: 22, align: 'right' },
    ], data.templateAdherence.map(t => {
      const b = t.metrics.statusBreakdown
      return [t.templateName, String(b.total), String(b.validado), String(b.concluido), String(b.em_andamento), String(b.incompleto), String(b.rascunho), `${t.metrics.completionRate}%`, formatMinutes(t.avgCompletionTimeMinutes), `${t.storesWithZero}/${t.totalAssignedStores}`]
    }), y)
  } else {
    doc.text(n('Uso de Checklists'), MARGIN, y)
    y += 6
    y = drawPdfTable(doc, [
      { header: 'Template', width: 120 },
      { header: 'Utilizacoes', width: 62, align: 'right' },
    ], data.templateStats.map(t => [t.template_name, String(t.total_uses)]), y)
  }

  y += 8
  if (y > PAGE_BOTTOM - 20) { doc.addPage(); y = MARGIN }

  // Store adherence table (enhanced or legacy)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor('#000000')

  if (data.storeAdherence && data.storeAdherence.length > 0) {
    doc.text(n('Adesao por Loja'), MARGIN, y)
    y += 6
    y = drawPdfTable(doc, [
      { header: 'Loja', width: 50 },
      { header: 'Total', width: 18, align: 'right' },
      { header: 'Valid.', width: 18, align: 'right' },
      { header: 'Concl.', width: 18, align: 'right' },
      { header: 'Andam.', width: 18, align: 'right' },
      { header: 'Incomp.', width: 20, align: 'right' },
      { header: 'Rasc.', width: 18, align: 'right' },
      { header: 'Taxa', width: 18, align: 'right' },
      { header: 'Tmpl Faltando', width: 55 },
    ], data.storeAdherence.map(st => {
      const b = st.metrics.statusBreakdown
      return [st.storeName, String(b.total), String(b.validado), String(b.concluido), String(b.em_andamento), String(b.incompleto), String(b.rascunho), `${st.metrics.completionRate}%`, st.templatesNeverFilled.join(', ') || '-']
    }), y)
  } else {
    doc.text(n('Desempenho por Loja'), MARGIN, y)
    y += 6
    y = drawPdfTable(doc, [
      { header: 'Loja', width: 80 },
      { header: 'Total', width: 30, align: 'right' },
      { header: 'Hoje', width: 30, align: 'right' },
      { header: 'Media/Dia', width: 42, align: 'right' },
    ], data.storeStats.map(s => [s.store_name, String(s.total_checklists), String(s.completed_today), String(s.completion_rate)]), y)
  }

  y += 8
  if (y > PAGE_BOTTOM - 20) { doc.addPage(); y = MARGIN }

  // User adherence table (new)
  if (data.userAdherence && data.userAdherence.length > 0) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor('#000000')
    doc.text(n('Adesao por Usuario'), MARGIN, y)
    y += 6
    y = drawPdfTable(doc, [
      { header: 'Usuario', width: 50 },
      { header: 'Total', width: 20, align: 'right' },
      { header: 'Valid.', width: 20, align: 'right' },
      { header: 'Concl.', width: 20, align: 'right' },
      { header: 'Andam.', width: 22, align: 'right' },
      { header: 'Incomp.', width: 22, align: 'right' },
      { header: 'Rasc.', width: 20, align: 'right' },
      { header: 'Taxa', width: 20, align: 'right' },
      { header: 'Tempo', width: 25, align: 'right' },
    ], data.userAdherence.map(u => {
      const b = u.metrics.statusBreakdown
      return [u.userName, String(b.total), String(b.validado), String(b.concluido), String(b.em_andamento), String(b.incompleto), String(b.rascunho), `${u.metrics.completionRate}%`, formatMinutes(u.avgCompletionTimeMinutes)]
    }), y)

    y += 8
    if (y > PAGE_BOTTOM - 20) { doc.addPage(); y = MARGIN }
  }

  // Coverage gaps table (new)
  if (data.coverageGaps && data.coverageGaps.length > 0) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor('#000000')
    doc.text(n('Lacunas de Cobertura'), MARGIN, y)
    y += 6
    drawPdfTable(doc, [
      { header: 'Template', width: 80 },
      { header: 'Loja', width: 60 },
      { header: 'Ultimo Preench.', width: 50, align: 'right' },
    ], data.coverageGaps.map(g => [
      g.templateName,
      g.storeName,
      g.lastFilledAt ? fmtDateBR(g.lastFilledAt) : 'Nunca',
    ]), y)
  }

  addPdfFooters(doc)
  const timestamp = new Date().toISOString().split('T')[0]
  doc.save(`relatorio_visao_geral_${timestamp}.pdf`)
}

// ─── RESPOSTAS POR USUARIO ──────────────────────────────────────────────────

export function exportResponsesToCSV(items: UserChecklistExport[], filename: string) {
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`
  const headers = ['Usuario', 'Email', 'Checklist', 'Loja', 'Status', 'Data Criacao', 'Data Conclusao']
  const rows = items.map(i => [
    esc(i.user_name), esc(i.user_email), esc(i.template_name), esc(i.store_name),
    esc(statusLabel[i.status] || i.status),
    esc(fmtDateBR(i.created_at)), esc(fmtDateBR(i.completed_at)),
  ].join(','))

  downloadFile('\uFEFF' + [headers.join(','), ...rows].join('\n'), filename, 'text/csv;charset=utf-8')
}

export function exportResponsesToTXT(items: UserChecklistExport[], filename: string) {
  const lines: string[] = [
    '═'.repeat(80),
    'RELATORIO DE RESPOSTAS POR USUARIO',
    `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
    `Total de respostas: ${items.length}`,
    '═'.repeat(80),
    '',
  ]
  for (const i of items) {
    lines.push('─'.repeat(60))
    lines.push(`  Usuario:    ${i.user_name} (${i.user_email})`)
    lines.push(`  Checklist:  ${i.template_name}`)
    lines.push(`  Loja:       ${i.store_name}`)
    lines.push(`  Status:     ${statusLabel[i.status] || i.status}`)
    lines.push(`  Criado em:  ${fmtDateBR(i.created_at)}`)
    if (i.completed_at) lines.push(`  Concluido:  ${fmtDateBR(i.completed_at)}`)
    lines.push('')
  }

  downloadFile(lines.join('\n'), filename, 'text/plain;charset=utf-8')
}

export async function exportResponsesToExcel(items: UserChecklistExport[], filename: string) {
  const XLSX = await import('xlsx')
  const data = items.map(i => ({
    'Usuario': i.user_name,
    'Email': i.user_email,
    'Checklist': i.template_name,
    'Loja': i.store_name,
    'Status': statusLabel[i.status] || i.status,
    'Data Criacao': fmtDateBR(i.created_at),
    'Data Conclusao': fmtDateBR(i.completed_at),
  }))

  const ws = XLSX.utils.json_to_sheet(data.length ? data : [{ 'Usuario': 'Sem dados' }])
  ws['!cols'] = [{ wch: 25 }, { wch: 30 }, { wch: 30 }, { wch: 20 }, { wch: 14 }, { wch: 16 }, { wch: 16 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Respostas por Usuario')

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  downloadFile(buf, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
}

export async function exportResponsesToPDF(items: UserChecklistExport[]): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })

  const y = addPdfHeader(doc, 'RELATORIO DE RESPOSTAS POR USUARIO', [
    `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
    `Total de respostas: ${items.length}`,
  ])

  drawPdfTable(doc, [
    { header: 'Usuario', width: 45 },
    { header: 'Checklist', width: 45 },
    { header: 'Loja', width: 35 },
    { header: 'Status', width: 25 },
    { header: 'Data', width: 32, align: 'right' },
  ], items.map(i => [
    i.user_name,
    i.template_name,
    i.store_name,
    statusLabel[i.status] || i.status,
    fmtDateBR(i.created_at),
  ]), y)

  addPdfFooters(doc)
  const timestamp = new Date().toISOString().split('T')[0]
  doc.save(`relatorio_respostas_${timestamp}.pdf`)
}

// ─── CONFORMIDADE ────────────────────────────────────────────────────────────

export function exportComplianceToCSV(data: ComplianceExportData, filename: string) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
  const lines: string[] = []

  lines.push('=== RESUMO ===')
  lines.push('Nao Conformidades,Taxa Conformidade (%),Planos Criados,Resolvidos,Vencidos')
  lines.push([data.summary.totalNonConformities, data.summary.complianceRate, data.summary.plansCreated, data.summary.plansResolved, data.summary.plansOverdue].join(','))
  lines.push('')

  lines.push('=== CONFORMIDADE POR CAMPO ===')
  lines.push('Campo,Template,Total,Resolvidos,Taxa Conformidade (%)')
  for (const f of data.byField) {
    lines.push([esc(f.fieldName), esc(f.templateName), f.totalPlans, f.resolvedPlans, f.complianceRate].join(','))
  }
  lines.push('')

  lines.push('=== RANKING POR LOJA ===')
  lines.push('Loja,Total,Resolvidos,Vencidos,Taxa (%)')
  for (const s of data.byStore) {
    lines.push([esc(s.storeName), s.totalPlans, s.resolvedPlans, s.overduePlans, s.rate].join(','))
  }

  downloadFile('\uFEFF' + lines.join('\n'), filename, 'text/csv;charset=utf-8')
}

export function exportComplianceToTXT(data: ComplianceExportData, filename: string) {
  const sm = data.summary
  const lines: string[] = [
    '═'.repeat(80),
    'RELATORIO DE CONFORMIDADE',
    `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
    '═'.repeat(80),
    '',
    '--- RESUMO ---',
    `  Nao Conformidades:  ${sm.totalNonConformities}`,
    `  Taxa Conformidade:  ${sm.complianceRate}%`,
    `  Planos Criados:     ${sm.plansCreated}`,
    `  Resolvidos:         ${sm.plansResolved}`,
    `  Vencidos:           ${sm.plansOverdue}`,
    '',
    '--- CONFORMIDADE POR CAMPO ---',
  ]
  for (const f of data.byField) {
    lines.push(`  ${f.fieldName.padEnd(30)} (${f.templateName})  Total: ${f.totalPlans}  Resolvidos: ${f.resolvedPlans}  Taxa: ${f.complianceRate}%`)
  }
  lines.push('')
  lines.push('--- RANKING POR LOJA ---')
  for (const s of data.byStore) {
    lines.push(`  ${s.storeName.padEnd(30)} Total: ${String(s.totalPlans).padStart(4)}  Resolvidos: ${String(s.resolvedPlans).padStart(4)}  Vencidos: ${String(s.overduePlans).padStart(4)}  Taxa: ${s.rate}%`)
  }

  downloadFile(lines.join('\n'), filename, 'text/plain;charset=utf-8')
}

export async function exportComplianceToExcel(data: ComplianceExportData, filename: string) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()

  const fieldData = data.byField.map(f => ({
    'Campo': f.fieldName,
    'Template': f.templateName,
    'Total': f.totalPlans,
    'Resolvidos': f.resolvedPlans,
    'Taxa Conformidade (%)': f.complianceRate,
  }))
  const ws1 = XLSX.utils.json_to_sheet(fieldData.length ? fieldData : [{ 'Campo': 'Sem dados' }])
  ws1['!cols'] = [{ wch: 30 }, { wch: 30 }, { wch: 8 }, { wch: 12 }, { wch: 20 }]
  XLSX.utils.book_append_sheet(wb, ws1, 'Por Campo')

  const storeData = data.byStore.map(s => ({
    'Loja': s.storeName,
    'Total': s.totalPlans,
    'Resolvidos': s.resolvedPlans,
    'Vencidos': s.overduePlans,
    'Taxa (%)': s.rate,
  }))
  const ws2 = XLSX.utils.json_to_sheet(storeData.length ? storeData : [{ 'Loja': 'Sem dados' }])
  ws2['!cols'] = [{ wch: 30 }, { wch: 8 }, { wch: 12 }, { wch: 10 }, { wch: 10 }]
  XLSX.utils.book_append_sheet(wb, ws2, 'Por Loja')

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  downloadFile(buf, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
}

export async function exportComplianceToPDF(data: ComplianceExportData): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
  const sm = data.summary

  let y = addPdfHeader(doc, 'RELATORIO DE CONFORMIDADE', [
    `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
    `NCs: ${sm.totalNonConformities}  |  Taxa: ${sm.complianceRate}%  |  Criados: ${sm.plansCreated}  |  Resolvidos: ${sm.plansResolved}  |  Vencidos: ${sm.plansOverdue}`,
  ])

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor('#000000')
  doc.text(n('Conformidade por Campo'), MARGIN, y)
  y += 6

  y = drawPdfTable(doc, [
    { header: 'Campo', width: 55 },
    { header: 'Template', width: 50 },
    { header: 'Total', width: 22, align: 'right' },
    { header: 'Resolvidos', width: 27, align: 'right' },
    { header: 'Taxa (%)', width: 28, align: 'right' },
  ], data.byField.map(f => [f.fieldName, f.templateName, String(f.totalPlans), String(f.resolvedPlans), `${f.complianceRate}%`]), y)

  y += 8
  if (y > PAGE_BOTTOM - 20) { doc.addPage(); y = MARGIN }

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor('#000000')
  doc.text(n('Ranking por Loja'), MARGIN, y)
  y += 6

  drawPdfTable(doc, [
    { header: 'Loja', width: 60 },
    { header: 'Total', width: 25, align: 'right' },
    { header: 'Resolvidos', width: 30, align: 'right' },
    { header: 'Vencidos', width: 30, align: 'right' },
    { header: 'Taxa (%)', width: 37, align: 'right' },
  ], data.byStore.map(s => [s.storeName, String(s.totalPlans), String(s.resolvedPlans), String(s.overduePlans), `${s.rate}%`]), y)

  addPdfFooters(doc)
  const timestamp = new Date().toISOString().split('T')[0]
  doc.save(`relatorio_conformidade_${timestamp}.pdf`)
}

// ─── REINCIDENCIAS ───────────────────────────────────────────────────────────

export function exportReincidenciasToCSV(data: ReincidenciaExportData, filename: string) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
  const lines: string[] = []

  lines.push('=== RESUMO ===')
  lines.push('Total Reincidencias,Media por Campo,Pior Campo,Pior Loja')
  lines.push([data.summary.totalReincidencias, data.summary.avgReincidenciaRate, esc(data.summary.worstField || '-'), esc(data.summary.worstStore || '-')].join(','))
  lines.push('')

  lines.push('=== CAMPOS COM REINCIDENCIA ===')
  lines.push('Campo,Loja,Template,Ocorrencias,Ultima Ocorrencia')
  for (const r of data.rows) {
    lines.push([esc(r.fieldName), esc(r.storeName), esc(r.templateName), r.occurrences, esc(fmtDateBR(r.lastOccurrence))].join(','))
  }
  lines.push('')

  lines.push('=== DESEMPENHO POR RESPONSAVEL ===')
  lines.push('Responsavel,Total Planos,Concluidos,Vencidos,Media Dias Resolucao')
  for (const a of data.assigneeStats) {
    lines.push([esc(a.userName), a.totalPlans, a.completedPlans, a.overduePlans, a.avgResolutionDays !== null ? a.avgResolutionDays : '-'].join(','))
  }

  downloadFile('\uFEFF' + lines.join('\n'), filename, 'text/csv;charset=utf-8')
}

export function exportReincidenciasToTXT(data: ReincidenciaExportData, filename: string) {
  const sm = data.summary
  const lines: string[] = [
    '═'.repeat(80),
    'RELATORIO DE REINCIDENCIAS',
    `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
    '═'.repeat(80),
    '',
    '--- RESUMO ---',
    `  Total Reincidencias:  ${sm.totalReincidencias}`,
    `  Media por Campo:      ${sm.avgReincidenciaRate}`,
    `  Pior Campo:           ${sm.worstField || '-'}`,
    `  Pior Loja:            ${sm.worstStore || '-'}`,
    '',
    '--- CAMPOS COM REINCIDENCIA ---',
  ]
  for (const r of data.rows) {
    lines.push(`  ${r.fieldName.padEnd(25)} ${r.storeName.padEnd(20)} ${r.templateName.padEnd(20)} ${String(r.occurrences).padStart(3)}x  Ultima: ${fmtDateBR(r.lastOccurrence)}`)
  }
  lines.push('')
  lines.push('--- DESEMPENHO POR RESPONSAVEL ---')
  for (const a of data.assigneeStats) {
    const dias = a.avgResolutionDays !== null ? `${a.avgResolutionDays} dias` : '-'
    lines.push(`  ${a.userName.padEnd(30)} Total: ${String(a.totalPlans).padStart(4)}  Concl: ${String(a.completedPlans).padStart(4)}  Venc: ${String(a.overduePlans).padStart(4)}  Media: ${dias}`)
  }

  downloadFile(lines.join('\n'), filename, 'text/plain;charset=utf-8')
}

export async function exportReincidenciasToExcel(data: ReincidenciaExportData, filename: string) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()

  const reincData = data.rows.map(r => ({
    'Campo': r.fieldName,
    'Loja': r.storeName,
    'Template': r.templateName,
    'Ocorrencias': r.occurrences,
    'Ultima Ocorrencia': fmtDateBR(r.lastOccurrence),
  }))
  const ws1 = XLSX.utils.json_to_sheet(reincData.length ? reincData : [{ 'Campo': 'Sem dados' }])
  ws1['!cols'] = [{ wch: 30 }, { wch: 25 }, { wch: 25 }, { wch: 14 }, { wch: 18 }]
  XLSX.utils.book_append_sheet(wb, ws1, 'Reincidencias')

  const assigneeData = data.assigneeStats.map(a => ({
    'Responsavel': a.userName,
    'Total Planos': a.totalPlans,
    'Concluidos': a.completedPlans,
    'Vencidos': a.overduePlans,
    'Media Dias Resolucao': a.avgResolutionDays !== null ? a.avgResolutionDays : '-',
  }))
  const ws2 = XLSX.utils.json_to_sheet(assigneeData.length ? assigneeData : [{ 'Responsavel': 'Sem dados' }])
  ws2['!cols'] = [{ wch: 30 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 22 }]
  XLSX.utils.book_append_sheet(wb, ws2, 'Desempenho Responsaveis')

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  downloadFile(buf, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
}

export async function exportReincidenciasToPDF(data: ReincidenciaExportData): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
  const sm = data.summary

  let y = addPdfHeader(doc, 'RELATORIO DE REINCIDENCIAS', [
    `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
    `Total: ${sm.totalReincidencias}  |  Media/campo: ${sm.avgReincidenciaRate}  |  Pior campo: ${sm.worstField || '-'}  |  Pior loja: ${sm.worstStore || '-'}`,
  ])

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor('#000000')
  doc.text(n('Campos com Reincidencia'), MARGIN, y)
  y += 6

  y = drawPdfTable(doc, [
    { header: 'Campo', width: 45 },
    { header: 'Loja', width: 35 },
    { header: 'Template', width: 40 },
    { header: 'Ocorr.', width: 22, align: 'right' },
    { header: 'Ultima', width: 40, align: 'right' },
  ], data.rows.map(r => [r.fieldName, r.storeName, r.templateName, String(r.occurrences), fmtDateBR(r.lastOccurrence)]), y)

  y += 8
  if (y > PAGE_BOTTOM - 20) { doc.addPage(); y = MARGIN }

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor('#000000')
  doc.text(n('Desempenho por Responsavel'), MARGIN, y)
  y += 6

  drawPdfTable(doc, [
    { header: 'Responsavel', width: 50 },
    { header: 'Total', width: 25, align: 'right' },
    { header: 'Concluidos', width: 30, align: 'right' },
    { header: 'Vencidos', width: 28, align: 'right' },
    { header: 'Media Dias', width: 49, align: 'right' },
  ], data.assigneeStats.map(a => [
    a.userName, String(a.totalPlans), String(a.completedPlans), String(a.overduePlans),
    a.avgResolutionDays !== null ? String(a.avgResolutionDays) : '-',
  ]), y)

  addPdfFooters(doc)
  const timestamp = new Date().toISOString().split('T')[0]
  doc.save(`relatorio_reincidencias_${timestamp}.pdf`)
}
