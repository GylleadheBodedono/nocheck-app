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

  // Range overnight ocorre quando horario de inicio e maior que o de fim (ex: 21:00 → 02:00)
  const isOvernight = startMinutes > endMinutes

  let result: boolean
  if (!isOvernight) {
    // Mesmo dia: ex 08:00 → 18:00
    result = currentMinutes >= startMinutes && currentMinutes <= endMinutes
  } else {
    // Overnight: ex 21:00 → 02:00 (cruza meia-noite)
    result = currentMinutes >= startMinutes || currentMinutes <= endMinutes
  }

  return result
}
