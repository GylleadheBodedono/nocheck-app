'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'
import { FiImage, FiSave, FiUpload, FiX, FiCheck, FiLock } from 'react-icons/fi'
import { APP_CONFIG } from '@/lib/config'
import { LoadingPage, Header, PageContainer } from '@/components/ui'
import { getAuthCache, getUserCache } from '@/lib/offlineCache'
import { useTenant } from '@/hooks/useTenant'

function BrandingContent() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [blocked, setBlocked] = useState(false)
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const { organization } = useTenant()

  // Form state
  const [appName, setAppName] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#0D9488')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingFavicon, setUploadingFavicon] = useState(false)

  const logoInputRef = useRef<HTMLInputElement>(null)
  const faviconInputRef = useRef<HTMLInputElement>(null)

  // Load current settings
  useEffect(() => {
    const init = async () => {
      if (!isSupabaseConfigured || !supabase) {
        setLoading(false)
        return
      }

      let currentUserId: string | null = null
      let isAdmin = false

      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          currentUserId = user.id
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: profile } = await (supabase as any)
            .from('users')
            .select('is_admin')
            .eq('id', user.id)
            .single()
          isAdmin = profile && 'is_admin' in profile ? (profile as { is_admin: boolean }).is_admin : false
        }
      } catch {
        // Fallback cache
      }

      if (!currentUserId) {
        try {
          const cachedAuth = await getAuthCache()
          if (cachedAuth) {
            currentUserId = cachedAuth.userId
            const cachedUser = await getUserCache(cachedAuth.userId)
            isAdmin = cachedUser?.is_admin || false
          }
        } catch { /* ignore */ }
      }

      if (!currentUserId) { router.push(APP_CONFIG.routes.login); return }
      if (!isAdmin) { router.push(APP_CONFIG.routes.dashboard); return }

      // Check if org has white_label feature
      if (currentUserId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: memberData } = await (supabase as any)
          .from('organization_members')
          .select('organization_id')
          .eq('user_id', currentUserId)
          .limit(1)
          .single()
        if (memberData?.organization_id) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: orgData } = await (supabase as any)
            .from('organizations')
            .select('features')
            .eq('id', memberData.organization_id)
            .single()
          if (orgData && !orgData.features?.includes('white_label')) {
            setBlocked(true)
            setLoading(false)
            return
          }
        }
      }

      // Populate form from org settings
      if (organization?.settings?.theme) {
        const theme = organization.settings.theme
        setAppName(theme.appName || '')
        setPrimaryColor(theme.primaryColor || '#0D9488')
        setLogoUrl(theme.logoUrl || null)
        setFaviconUrl(theme.faviconUrl || null)
      }

      setLoading(false)
    }

    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization])

  // Apply preview in real-time (only if user has white_label feature)
  const originalPrimaryRef = useRef<string | null>(null)
  useEffect(() => {
    if (blocked || !primaryColor) return
    // Save original color on first apply
    if (!originalPrimaryRef.current) {
      originalPrimaryRef.current = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim()
    }
    document.documentElement.style.setProperty('--primary', primaryColor)
    const h = primaryColor.replace('#', '')
    const r = Math.max(0, Math.round(parseInt(h.substring(0, 2), 16) * 0.85))
    const g = Math.max(0, Math.round(parseInt(h.substring(2, 4), 16) * 0.85))
    const b = Math.max(0, Math.round(parseInt(h.substring(4, 6), 16) * 0.85))
    const hover = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
    document.documentElement.style.setProperty('--primary-hover', hover)
    // Cleanup: restore original colors when leaving page
    return () => {
      if (originalPrimaryRef.current) {
        document.documentElement.style.setProperty('--primary', originalPrimaryRef.current)
      }
    }
  }, [primaryColor, blocked])

  const handleUpload = useCallback(async (file: File, type: 'logo' | 'favicon') => {
    if (!organization?.id) return

    const maxSize = 2 * 1024 * 1024 // 2MB
    const allowedTypes = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']

    if (!allowedTypes.includes(file.type)) {
      setError('Formato inválido. Use PNG, JPG, SVG ou WebP.')
      return
    }
    if (file.size > maxSize) {
      setError('Arquivo muito grande. Máximo 2MB.')
      return
    }

    const setter = type === 'logo' ? setUploadingLogo : setUploadingFavicon
    setter(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Sessão expirada')

      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', type)
      formData.append('orgId', organization.id)

      const res = await fetch('/api/organizations/upload-logo', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error || 'Erro no upload')
      }

      const result = await res.json() as { url: string }

      if (type === 'logo') {
        setLogoUrl(result.url)
      } else {
        setFaviconUrl(result.url)
      }

      setSuccess(`${type === 'logo' ? 'Logo' : 'Favicon'} enviado com sucesso!`)
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro no upload')
    } finally {
      setter(false)
    }
  }, [organization, supabase])

  const handleSave = useCallback(async () => {
    if (!organization?.id) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Sessão expirada')

      const newSettings = {
        ...organization.settings,
        theme: {
          ...organization.settings.theme,
          primaryColor,
          appName: appName || APP_CONFIG.name,
          logoUrl,
          faviconUrl,
        },
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase as any)
        .from('organizations')
        .update({ settings: newSettings, updated_at: new Date().toISOString() })
        .eq('id', organization.id)

      if (updateError) throw new Error(updateError.message)

      setSuccess('Branding salvo com sucesso! Recarregue a página para ver as alterações.')
      setTimeout(() => setSuccess(null), 5000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }, [organization, supabase, primaryColor, appName, logoUrl, faviconUrl])

  if (loading) return <LoadingPage />

  if (blocked) {
    return (
      <div className="min-h-screen bg-page">
        <Header
          title="Branding"
          subtitle="Personalize a aparência do sistema"
          icon={FiImage}
          backHref="/admin/configuracoes"
        />
        <PageContainer size="md">
          <div className="card p-8 text-center space-y-4 mt-8">
            <FiLock className="w-12 h-12 text-muted mx-auto" />
            <h2 className="text-lg font-semibold text-main">Recurso indisponível no seu plano</h2>
            <p className="text-sm text-muted max-w-md mx-auto">
              A personalização de marca (White Label) está disponível apenas no plano <span className="font-semibold text-accent">Enterprise</span>.
              Faça upgrade para desbloquear este recurso.
            </p>
            <button onClick={() => router.push('/admin/configuracoes')} className="btn-primary mt-2">
              Voltar para Configurações
            </button>
          </div>
        </PageContainer>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-page">
      <Header
        title="Branding"
        subtitle="Personalize a aparência do sistema"
        icon={FiImage}
        backHref="/admin/configuracoes"
      />

      <PageContainer size="md" className="space-y-6">
        {/* Nome do App */}
        <div className="card p-5">
          <h2 className="text-base font-semibold text-main mb-1">Nome do Aplicativo</h2>
          <p className="text-sm text-muted mb-4">
            Exibido no header, título da aba e emails do sistema.
          </p>
          <input
            type="text"
            value={appName}
            onChange={(e) => setAppName(e.target.value)}
            placeholder={APP_CONFIG.name}
            className="input"
          />
        </div>

        {/* Cor Primaria */}
        <div className="card p-5">
          <h2 className="text-base font-semibold text-main mb-1">Cor Primária</h2>
          <p className="text-sm text-muted mb-4">
            Usada em botões, links e destaques. A mudança é visualizada em tempo real.
          </p>
          <div className="flex items-center gap-4">
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="w-12 h-12 rounded-xl border border-subtle cursor-pointer"
            />
            <input
              type="text"
              value={primaryColor}
              onChange={(e) => {
                if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) {
                  setPrimaryColor(e.target.value)
                }
              }}
              className="input w-32 font-mono text-sm"
              placeholder="#0D9488"
            />
            <div className="flex items-center gap-2">
              <div
                className="w-10 h-10 rounded-lg border border-subtle"
                style={{ backgroundColor: primaryColor }}
                title="Cor primária"
              />
              <span className="text-xs text-muted">Preview</span>
            </div>
          </div>
          {/* Live preview of button */}
          <div className="mt-4 flex items-center gap-3">
            <button className="btn-primary text-sm">Botão Primário</button>
            <span className="text-primary text-sm font-medium">Texto primário</span>
          </div>
        </div>

        {/* Upload Logo */}
        <div className="card p-5">
          <h2 className="text-base font-semibold text-main mb-1">Logo</h2>
          <p className="text-sm text-muted mb-4">
            Exibido no header. Recomendado: PNG/SVG transparente, max 2MB.
          </p>

          {logoUrl && (
            <div className="mb-4 flex items-center gap-4 p-3 bg-surface-hover rounded-xl">
              <img src={logoUrl} alt="Logo atual" className="h-10 max-w-[160px] object-contain" />
              <button
                onClick={() => setLogoUrl(null)}
                className="p-1.5 text-muted hover:text-error rounded-lg transition-colors"
                title="Remover logo"
              >
                <FiX className="w-4 h-4" />
              </button>
            </div>
          )}

          <input
            ref={logoInputRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleUpload(file, 'logo')
            }}
          />
          <button
            onClick={() => logoInputRef.current?.click()}
            disabled={uploadingLogo}
            className="btn-secondary flex items-center gap-2"
          >
            {uploadingLogo ? (
              <>
                <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <FiUpload className="w-4 h-4" />
                {logoUrl ? 'Trocar Logo' : 'Enviar Logo'}
              </>
            )}
          </button>
        </div>

        {/* Upload Favicon */}
        <div className="card p-5">
          <h2 className="text-base font-semibold text-main mb-1">Favicon</h2>
          <p className="text-sm text-muted mb-4">
            Ícone da aba do navegador. Recomendado: PNG 32x32 ou 64x64.
          </p>

          {faviconUrl && (
            <div className="mb-4 flex items-center gap-4 p-3 bg-surface-hover rounded-xl">
              <img src={faviconUrl} alt="Favicon atual" className="w-8 h-8 object-contain" />
              <button
                onClick={() => setFaviconUrl(null)}
                className="p-1.5 text-muted hover:text-error rounded-lg transition-colors"
                title="Remover favicon"
              >
                <FiX className="w-4 h-4" />
              </button>
            </div>
          )}

          <input
            ref={faviconInputRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp,image/x-icon"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleUpload(file, 'favicon')
            }}
          />
          <button
            onClick={() => faviconInputRef.current?.click()}
            disabled={uploadingFavicon}
            className="btn-secondary flex items-center gap-2"
          >
            {uploadingFavicon ? (
              <>
                <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <FiUpload className="w-4 h-4" />
                {faviconUrl ? 'Trocar Favicon' : 'Enviar Favicon'}
              </>
            )}
          </button>
        </div>

        {/* Messages */}
        {success && (
          <div className="p-4 bg-success/10 border border-success/30 rounded-xl flex items-center gap-2">
            <FiCheck className="w-4 h-4 text-success shrink-0" />
            <p className="text-success text-sm">{success}</p>
          </div>
        )}
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
            <p className="text-red-500 text-sm">{error}</p>
          </div>
        )}

        {/* Save */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <FiSave className="w-4 h-4" />
                Salvar Branding
              </>
            )}
          </button>
        </div>

        <p className="text-xs text-muted">
          Organização: <span className="font-medium text-secondary">{organization?.name || '-'}</span>
          {' '}&middot;{' '}
          Plano: <span className="font-medium text-secondary">{organization?.plan || '-'}</span>
        </p>
      </PageContainer>
    </div>
  )
}

export default function BrandingPage() {
  return <BrandingContent />
}
