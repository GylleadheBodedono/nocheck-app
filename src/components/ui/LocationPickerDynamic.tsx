'use client'

import dynamic from 'next/dynamic'

/**
 * Wrapper de importação dinâmica do `LocationPicker` com `ssr: false`.
 * Necessário porque o Leaflet acessa `window` diretamente e não funciona em SSR.
 * Exibe um placeholder "Carregando mapa..." enquanto o componente é carregado.
 */
const LocationPicker = dynamic(
  () => import('./LocationPicker').then(mod => ({ default: mod.LocationPicker })),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-2">
        <p className="block text-sm font-medium text-secondary">Localizacao no Mapa</p>
        <div className="w-full h-[300px] rounded-xl border border-subtle bg-surface-hover flex items-center justify-center">
          <p className="text-sm text-muted">Carregando mapa...</p>
        </div>
      </div>
    ),
  }
)

export { LocationPicker }
