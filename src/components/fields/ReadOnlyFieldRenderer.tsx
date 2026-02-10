'use client'

import type { TemplateField, GPSValue, SignatureValue } from '@/types/database'
import { FiMapPin, FiCheckCircle } from 'react-icons/fi'

type NumberSubtype = 'monetario' | 'quantidade' | 'decimal' | 'porcentagem'

const RATING_OPTIONS: Record<string, { label: string; face: string; color: string; bgColor: string }> = {
  pessimo: { label: 'Pessimo', face: '\u{1F621}', color: 'rgb(239, 68, 68)', bgColor: 'rgba(239, 68, 68, 0.15)' },
  ruim: { label: 'Ruim', face: '\u{1F61F}', color: 'rgb(249, 115, 22)', bgColor: 'rgba(249, 115, 22, 0.15)' },
  regular: { label: 'Regular', face: '\u{1F610}', color: 'rgb(234, 179, 8)', bgColor: 'rgba(234, 179, 8, 0.15)' },
  bom: { label: 'Bom', face: '\u{1F60A}', color: 'rgb(34, 197, 94)', bgColor: 'rgba(34, 197, 94, 0.15)' },
}

interface ReadOnlyFieldRendererProps {
  field: TemplateField
  value: unknown
}

export function ReadOnlyFieldRenderer({ field, value }: ReadOnlyFieldRendererProps) {
  const renderValue = () => {
    if (value === null || value === undefined || value === '') {
      return <span className="text-muted italic">Nao preenchido</span>
    }

    switch (field.field_type) {
      case 'text':
      case 'barcode':
        return <p className="text-main">{String(value)}</p>

      case 'number':
        return <NumberReadOnly field={field} value={value} />

      case 'photo':
        return <PhotoReadOnly value={value as string[]} />

      case 'dropdown':
        return (
          <span className="inline-block px-3 py-1 rounded-lg bg-primary/10 text-primary font-medium text-sm">
            {String(value)}
          </span>
        )

      case 'signature':
        return <SignatureReadOnly value={value as SignatureValue} />

      case 'datetime':
        return <DateTimeReadOnly value={String(value)} />

      case 'checkbox_multiple':
        return <CheckboxReadOnly value={value as string[]} />

      case 'gps':
        return <GPSReadOnly value={value as GPSValue} />

      case 'calculated':
        return (
          <div className="px-4 py-3 bg-surface border border-default rounded-xl text-main">
            {typeof value === 'number' ? value.toFixed(2) : String(value)}
            <span className="text-xs text-muted ml-2">(calculado)</span>
          </div>
        )

      case 'yes_no':
        return <YesNoReadOnly value={String(value)} />

      case 'rating':
        return <RatingReadOnly value={String(value)} />

      default:
        return <p className="text-muted">Tipo nao suportado: {field.field_type}</p>
    }
  }

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2">
        <span className="font-medium text-main">{field.name}</span>
        {field.is_required && <span className="text-muted text-xs">(obrigatorio)</span>}
      </label>
      {field.help_text && (
        <p className="text-sm text-muted">{field.help_text}</p>
      )}
      {renderValue()}
    </div>
  )
}

function NumberReadOnly({ field, value }: { field: TemplateField; value: unknown }) {
  const subtype: NumberSubtype = (field.options as { numberSubtype?: NumberSubtype } | null)?.numberSubtype || 'decimal'

  const numValue = (typeof value === 'object' && value !== null && 'number' in (value as Record<string, unknown>))
    ? (value as Record<string, unknown>).number as number
    : (typeof value === 'number' ? value : 0)

  const formatNumber = (n: number): string => {
    switch (subtype) {
      case 'monetario':
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
      case 'quantidade':
        return `${n} un`
      case 'porcentagem':
        return `${n.toFixed(1)}%`
      default:
        return n.toFixed(2).replace('.', ',')
    }
  }

  return (
    <p className="text-main font-medium text-lg">{formatNumber(numValue)}</p>
  )
}

function PhotoReadOnly({ value }: { value: string[] }) {
  const photos = value || []
  if (photos.length === 0) return <span className="text-muted italic">Nenhuma foto</span>

  return (
    <div className="grid grid-cols-3 gap-2">
      {photos.map((photo, index) => (
        <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-surface border border-subtle">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt={`Foto ${index + 1}`} className="w-full h-full object-cover" />
        </div>
      ))}
    </div>
  )
}

function SignatureReadOnly({ value }: { value: SignatureValue }) {
  if (!value?.dataUrl) return <span className="text-muted italic">Sem assinatura</span>

  return (
    <div className="border border-default rounded-xl overflow-hidden bg-surface p-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={value.dataUrl} alt="Assinatura" className="max-h-32 mx-auto" />
      {value.timestamp && (
        <p className="text-xs text-muted text-center mt-1">
          Assinado em {new Date(value.timestamp).toLocaleString('pt-BR')}
        </p>
      )}
    </div>
  )
}

function DateTimeReadOnly({ value }: { value: string }) {
  try {
    const date = new Date(value)
    return (
      <p className="text-main">
        {date.toLocaleDateString('pt-BR', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        })}
      </p>
    )
  } catch {
    return <p className="text-main">{value}</p>
  }
}

function CheckboxReadOnly({ value }: { value: string[] }) {
  const items = value || []
  if (items.length === 0) return <span className="text-muted italic">Nenhum selecionado</span>

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-sm font-medium"
        >
          <FiCheckCircle className="w-3.5 h-3.5" />
          {item}
        </span>
      ))}
    </div>
  )
}

function GPSReadOnly({ value }: { value: GPSValue }) {
  if (!value?.latitude) return <span className="text-muted italic">Sem localizacao</span>

  return (
    <div className="p-3 bg-primary/10 border border-primary/30 rounded-xl">
      <div className="flex items-center gap-2 text-primary mb-1">
        <FiMapPin className="w-4 h-4" />
        <span className="font-medium text-sm">Localizacao registrada</span>
      </div>
      <p className="text-sm text-secondary">
        Lat: {value.latitude.toFixed(6)}, Lng: {value.longitude.toFixed(6)}
      </p>
      <p className="text-xs text-muted mt-0.5">
        Precisao: {value.accuracy?.toFixed(0) || '?'}m
      </p>
    </div>
  )
}

function YesNoReadOnly({ value }: { value: string }) {
  const isSim = value === 'sim'
  return (
    <span
      className={`inline-block px-4 py-2 rounded-xl font-semibold text-sm border-2 ${
        isSim
          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
          : 'bg-red-500/20 border-red-500 text-red-400'
      }`}
    >
      {isSim ? 'Sim' : 'Nao'}
    </span>
  )
}

function RatingReadOnly({ value }: { value: string }) {
  const option = RATING_OPTIONS[value]
  if (!option) return <span className="text-muted italic">{value || 'Nao avaliado'}</span>

  return (
    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border-2"
      style={{ backgroundColor: option.bgColor, borderColor: option.color }}
    >
      <span className="text-2xl">{option.face}</span>
      <span className="font-semibold" style={{ color: option.color }}>{option.label}</span>
    </div>
  )
}
