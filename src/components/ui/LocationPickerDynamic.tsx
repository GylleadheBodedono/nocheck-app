'use client'

import dynamic from 'next/dynamic'

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
