// ============================================
// Utilitarios de manipulacao de cores
// ============================================

/**
 * Escurece uma cor hexadecimal pela porcentagem especificada.
 * Usado para gerar hover states automaticamente a partir da cor primaria.
 *
 * @param hex - Cor em formato hexadecimal (ex: "#0D9488")
 * @param amount - Fator de escurecimento entre 0 e 1 (padrao: 0.15 = 15%)
 * @returns Cor escurecida em formato hexadecimal
 *
 * @example
 * ```ts
 * darkenColor('#0D9488')       // ~15% mais escuro
 * darkenColor('#0D9488', 0.3)  // 30% mais escuro
 * ```
 */
export function darkenColor(hex: string, amount = 0.15): string {
  const h = hex.replace('#', '')
  const r = Math.max(0, Math.round(parseInt(h.substring(0, 2), 16) * (1 - amount)))
  const g = Math.max(0, Math.round(parseInt(h.substring(2, 4), 16) * (1 - amount)))
  const b = Math.max(0, Math.round(parseInt(h.substring(4, 6), 16) * (1 - amount)))
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

/**
 * Converte uma cor hexadecimal para componentes RGB.
 *
 * @param hex - Cor em formato hexadecimal (ex: "#0D9488")
 * @returns Objeto com componentes r, g, b (0-255)
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '')
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  }
}
