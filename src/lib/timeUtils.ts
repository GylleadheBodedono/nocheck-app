/**
 * Utilitarios de horario — suporte a ranges overnight (ex: 21:00 → 02:00)
 */

export function parseTimeToMinutes(timeStr: string): number {
  const parts = timeStr.split(':')
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10)
}

/**
 * Verifica se o horario atual esta dentro de um range [start, end].
 * Suporta ranges overnight (quando start > end, ex: 21:00 → 02:00).
 *
 * @param startTime - formato "HH:MM" ou "HH:MM:SS"
 * @param endTime   - formato "HH:MM" ou "HH:MM:SS"
 * @param now       - opcional, para testes (default: new Date())
 */
export function isWithinTimeRange(startTime: string, endTime: string, now?: Date): boolean {
  const d = now || new Date()
  const currentMinutes = d.getHours() * 60 + d.getMinutes()
  const startMinutes = parseTimeToMinutes(startTime)
  const endMinutes = parseTimeToMinutes(endTime)

  const pad = (n: number) => String(n).padStart(2, '0')
  const currentTimeStr = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  const isOvernight = startMinutes > endMinutes

  let result: boolean
  if (!isOvernight) {
    // Mesmo dia: ex 08:00 → 18:00
    result = currentMinutes >= startMinutes && currentMinutes <= endMinutes
  } else {
    // Overnight: ex 21:00 → 02:00
    result = currentMinutes >= startMinutes || currentMinutes <= endMinutes
  }

  const tzOffset = d.getTimezoneOffset()
  console.log(
    `[TimeCheck] Dispositivo: ${currentTimeStr} (${currentMinutes}min) | ` +
    `Range: ${startTime}→${endTime} (${startMinutes}-${endMinutes}min) | ` +
    `Tipo: ${isOvernight ? 'OVERNIGHT' : 'NORMAL'} | ` +
    `Resultado: ${result ? 'PERMITIDO' : 'BLOQUEADO'} | ` +
    `TZ offset: UTC${tzOffset > 0 ? '-' : '+'}${Math.abs(tzOffset / 60)}`
  )

  return result
}
