'use client'

import { useEffect, useRef, useState } from 'react'
import { FiMapPin, FiCrosshair, FiSearch } from 'react-icons/fi'

interface LocationPickerProps {
  value: { lat: number; lng: number } | null
  onChange: (coords: { lat: number; lng: number } | null) => void
}

// Load Leaflet CSS from CDN (avoids bundler CSS conflicts)
function ensureLeafletCSS() {
  if (document.getElementById('leaflet-css')) return
  const link = document.createElement('link')
  link.id = 'leaflet-css'
  link.rel = 'stylesheet'
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
  document.head.appendChild(link)
}

// Geocoding via Nominatim (OpenStreetMap) - gratuito, sem API key
async function searchAddress(query: string): Promise<{ lat: number; lng: number; display: string } | null> {
  try {
    const encoded = encodeURIComponent(query)
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1&countrycodes=br`,
      { headers: { 'Accept-Language': 'pt-BR' } }
    )
    const data = await res.json()
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        display: data[0].display_name,
      }
    }
    return null
  } catch {
    return null
  }
}

export function LocationPicker({ value, onChange }: LocationPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null)
  const [locating, setLocating] = useState(false)
  const [ready, setReady] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    ensureLeafletCSS()

    // Import leaflet dynamically to avoid SSR issues
    import('leaflet').then((L) => {
      if (!mapRef.current || mapInstanceRef.current) return

      const defaultIcon = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      })

      // Default center: Recife, PE
      const center = value
        ? [value.lat, value.lng] as [number, number]
        : [-8.0476, -34.877] as [number, number]

      const map = L.map(mapRef.current!, {
        center,
        zoom: value ? 16 : 12,
        zoomControl: true,
      })

      // Detect theme for tile style
      const theme = document.documentElement.getAttribute('data-theme')
      const tileUrl = theme === 'dark'
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'

      L.tileLayer(tileUrl, {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        maxZoom: 19,
      }).addTo(map)

      // Add existing marker if value is set
      if (value) {
        markerRef.current = L.marker([value.lat, value.lng], { icon: defaultIcon }).addTo(map)
      }

      // Click to place marker
      map.on('click', (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng

        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng])
        } else {
          markerRef.current = L.marker([lat, lng], { icon: defaultIcon }).addTo(map)
        }

        onChange({ lat, lng })
      })

      mapInstanceRef.current = map
      // Store the icon for later use
      mapInstanceRef.current._defaultIcon = defaultIcon
      setReady(true)

      // Fix map size when rendered inside a modal
      setTimeout(() => map.invalidateSize(), 200)
    })

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
        markerRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync marker when value changes externally
  useEffect(() => {
    if (!mapInstanceRef.current || !ready) return

    if (value) {
      if (markerRef.current) {
        markerRef.current.setLatLng([value.lat, value.lng])
      } else {
        import('leaflet').then((L) => {
          if (!mapInstanceRef.current) return
          markerRef.current = L.marker(
            [value.lat, value.lng],
            { icon: mapInstanceRef.current._defaultIcon }
          ).addTo(mapInstanceRef.current)
        })
      }
    } else if (markerRef.current) {
      markerRef.current.remove()
      markerRef.current = null
    }
  }, [value, ready])

  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    setSearching(true)
    setSearchError('')

    const result = await searchAddress(searchQuery.trim())

    if (result) {
      const map = mapInstanceRef.current
      if (map) {
        map.setView([result.lat, result.lng], 17)

        if (markerRef.current) {
          markerRef.current.setLatLng([result.lat, result.lng])
        } else {
          import('leaflet').then((L) => {
            if (!map) return
            markerRef.current = L.marker(
              [result.lat, result.lng],
              { icon: map._defaultIcon }
            ).addTo(map)
          })
        }

        onChange({ lat: result.lat, lng: result.lng })
      }
    } else {
      setSearchError('Endereco nao encontrado')
    }

    setSearching(false)
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSearch()
    }
  }

  const handleLocateMe = () => {
    if (!navigator.geolocation) return

    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        const map = mapInstanceRef.current
        if (map) {
          map.setView([latitude, longitude], 16)

          if (markerRef.current) {
            markerRef.current.setLatLng([latitude, longitude])
          } else {
            import('leaflet').then((L) => {
              if (!map) return
              markerRef.current = L.marker(
                [latitude, longitude],
                { icon: map._defaultIcon }
              ).addTo(map)
            })
          }

          onChange({ lat: latitude, lng: longitude })
        }
        setLocating(false)
      },
      () => {
        setLocating(false)
        alert('Nao foi possivel obter sua localizacao.')
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const handleClear = () => {
    if (markerRef.current) {
      markerRef.current.remove()
      markerRef.current = null
    }
    onChange(null)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-secondary">
          Localizacao no Mapa
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleLocateMe}
            disabled={locating}
            className="btn-ghost text-xs flex items-center gap-1 px-2 py-1"
          >
            <FiCrosshair className="w-3 h-3" />
            {locating ? 'Localizando...' : 'Minha localizacao'}
          </button>
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-error hover:underline px-2 py-1"
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Search bar */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setSearchError('') }}
            onKeyDown={handleSearchKeyDown}
            className="input pl-9 text-sm"
            placeholder="Rua, numero, bairro, CEP..."
          />
        </div>
        <button
          type="button"
          onClick={handleSearch}
          disabled={searching || !searchQuery.trim()}
          className="btn-primary px-4 text-sm disabled:opacity-50"
        >
          {searching ? 'Buscando...' : 'Buscar'}
        </button>
      </div>
      {searchError && (
        <p className="text-xs text-error">{searchError}</p>
      )}

      <div
        ref={mapRef}
        className="w-full h-[300px] rounded-xl border border-subtle overflow-hidden"
        style={{ zIndex: 0 }}
      />

      {value ? (
        <div className="flex items-center gap-2 text-xs text-muted">
          <FiMapPin className="w-3 h-3 text-primary" />
          <span>Lat: {value.lat.toFixed(6)}, Lng: {value.lng.toFixed(6)}</span>
        </div>
      ) : (
        <p className="text-xs text-muted">
          Busque um endereco ou clique no mapa para marcar a localizacao da loja
        </p>
      )}
    </div>
  )
}
