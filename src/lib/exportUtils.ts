/**
 * Utilitarios de exportacao client-side para relatorios.
 * Compativel com Cloudflare Pages (sem Node.js APIs).
 */

import type { NCPhotoItem } from './ncPhotoReportQueries'

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
  pendente: 'Pendente',
  em_andamento: 'Em Andamento',
  concluido: 'Concluido',
  vencido: 'Vencido',
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
    'Reincidencia', 'Status', 'Responsavel', 'Fotos NC', 'Fotos Evidencia',
  ]

  const rows = items.map(item => [
    new Date(item.createdAt).toLocaleDateString('pt-BR'),
    item.storeName,
    item.templateName,
    item.fieldName,
    severityLabel[item.severity] || item.severity,
    `"${(item.nonConformityValue || '').replace(/"/g, '""')}"`,
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
