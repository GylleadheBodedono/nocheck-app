/**
 * Utilitarios de exportacao client-side para relatorios.
 * Compativel com Cloudflare Pages (sem Node.js APIs).
 */

import type { NCPhotoItem } from './ncPhotoReportQueries'
import type { ActionPlanReportItem } from './actionPlanReportQueries'

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
