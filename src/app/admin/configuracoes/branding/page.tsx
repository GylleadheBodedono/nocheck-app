'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'
import { FiImage, FiSave, FiUpload, FiX, FiCheck, FiLock, FiZap } from 'react-icons/fi'
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

  // Todas as variaveis CSS editaveis, organizadas por grupo
  const COLOR_GROUPS = [
    { label: 'Principal', keys: ['primary', 'primaryHover', 'primaryForeground'] },
    { label: 'Secundaria', keys: ['secondary', 'secondaryHover', 'secondaryForeground'] },
    { label: 'Destaque', keys: ['accent', 'accentHover', 'accentForeground'] },
    { label: 'Fundos', keys: ['bgPage', 'bgSurface', 'bgSurfaceHover', 'bgSurfaceActive'] },
    { label: 'Textos', keys: ['textMain', 'textSecondary', 'textMuted', 'textInverse'] },
    { label: 'Bordas', keys: ['borderSubtle', 'borderDefault', 'borderStrong'] },
    { label: 'Sucesso', keys: ['statusSuccessBg', 'statusSuccessText', 'statusSuccessBorder'] },
    { label: 'Erro', keys: ['statusErrorBg', 'statusErrorText', 'statusErrorBorder'] },
    { label: 'Aviso', keys: ['statusWarningBg', 'statusWarningText', 'statusWarningBorder'] },
    { label: 'Info', keys: ['statusInfoBg', 'statusInfoText', 'statusInfoBorder'] },
  ] as const

  const COLOR_LABELS: Record<string, string> = {
    primary: 'Primaria', primaryHover: 'Primaria Hover', primaryForeground: 'Texto Primaria',
    secondary: 'Secundaria', secondaryHover: 'Secundaria Hover', secondaryForeground: 'Texto Secundaria',
    accent: 'Destaque', accentHover: 'Destaque Hover', accentForeground: 'Texto Destaque',
    bgPage: 'Fundo Pagina', bgSurface: 'Fundo Cards', bgSurfaceHover: 'Fundo Hover', bgSurfaceActive: 'Fundo Ativo',
    textMain: 'Texto Principal', textSecondary: 'Texto Secundario', textMuted: 'Texto Suave', textInverse: 'Texto Inverso',
    borderSubtle: 'Borda Sutil', borderDefault: 'Borda Padrao', borderStrong: 'Borda Forte',
    statusSuccessBg: 'Fundo', statusSuccessText: 'Texto', statusSuccessBorder: 'Borda',
    statusErrorBg: 'Fundo', statusErrorText: 'Texto', statusErrorBorder: 'Borda',
    statusWarningBg: 'Fundo', statusWarningText: 'Texto', statusWarningBorder: 'Borda',
    statusInfoBg: 'Fundo', statusInfoText: 'Texto', statusInfoBorder: 'Borda',
  }

  // Map de camelCase para CSS variable name
  const CSS_VAR_MAP: Record<string, string> = {
    primary: '--primary', primaryHover: '--primary-hover', primaryForeground: '--primary-foreground',
    secondary: '--secondary', secondaryHover: '--secondary-hover', secondaryForeground: '--secondary-foreground',
    accent: '--accent', accentHover: '--accent-hover', accentForeground: '--accent-foreground',
    bgPage: '--bg-page', bgSurface: '--bg-surface', bgSurfaceHover: '--bg-surface-hover', bgSurfaceActive: '--bg-surface-active',
    textMain: '--text-main', textSecondary: '--text-secondary', textMuted: '--text-muted', textInverse: '--text-inverse',
    borderSubtle: '--border-subtle', borderDefault: '--border-default', borderStrong: '--border-strong',
    statusSuccessBg: '--status-success-bg', statusSuccessText: '--status-success-text', statusSuccessBorder: '--status-success-border',
    statusErrorBg: '--status-error-bg', statusErrorText: '--status-error-text', statusErrorBorder: '--status-error-border',
    statusWarningBg: '--status-warning-bg', statusWarningText: '--status-warning-text', statusWarningBorder: '--status-warning-border',
    statusInfoBg: '--status-info-bg', statusInfoText: '--status-info-text', statusInfoBorder: '--status-info-border',
  }

  const LIGHT_DEFAULTS: Record<string, string> = {
    primary: '#0D9488', primaryHover: '#0F766E', primaryForeground: '#FFFFFF',
    secondary: '#334155', secondaryHover: '#1E293B', secondaryForeground: '#FFFFFF',
    accent: '#F59E0B', accentHover: '#D97706', accentForeground: '#FFFFFF',
    bgPage: '#F8FAFC', bgSurface: '#FFFFFF', bgSurfaceHover: '#F1F5F9', bgSurfaceActive: '#E2E8F0',
    textMain: '#0F172A', textSecondary: '#475569', textMuted: '#94A3B8', textInverse: '#FFFFFF',
    borderSubtle: '#E2E8F0', borderDefault: '#CBD5E1', borderStrong: '#94A3B8',
    statusSuccessBg: '#F2F8F0', statusSuccessText: '#3D7A2E', statusSuccessBorder: '#A3D492',
    statusErrorBg: '#FDF2F0', statusErrorText: '#C03525', statusErrorBorder: '#E8A49B',
    statusWarningBg: '#FDF6ED', statusWarningText: '#B5651D', statusWarningBorder: '#E8C98A',
    statusInfoBg: '#F0F4FA', statusInfoText: '#3B6AA0', statusInfoBorder: '#A0C0E0',
  }

  const DARK_DEFAULTS: Record<string, string> = {
    primary: '#fafafa', primaryHover: '#e4e4e7', primaryForeground: '#18181b',
    secondary: '#27272a', secondaryHover: '#3f3f46', secondaryForeground: '#fafafa',
    accent: '#F59E0B', accentHover: '#D97706', accentForeground: '#18181b',
    bgPage: '#09090b', bgSurface: '#18181b', bgSurfaceHover: '#27272a', bgSurfaceActive: '#3f3f46',
    textMain: '#fafafa', textSecondary: '#a1a1aa', textMuted: '#71717a', textInverse: '#09090b',
    borderSubtle: '#27272a', borderDefault: '#3f3f46', borderStrong: '#52525b',
    statusSuccessBg: '#14532d', statusSuccessText: '#4ade80', statusSuccessBorder: '#22c55e',
    statusErrorBg: '#450a0a', statusErrorText: '#f87171', statusErrorBorder: '#ef4444',
    statusWarningBg: '#422006', statusWarningText: '#fbbf24', statusWarningBorder: '#f59e0b',
    statusInfoBg: '#1e3a5f', statusInfoText: '#60a5fa', statusInfoBorder: '#3b82f6',
  }

  // Form state
  const [appName, setAppName] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#0D9488')
  const [lightColors, setLightColors] = useState<Record<string, string>>({ ...LIGHT_DEFAULTS })
  const [darkColors, setDarkColors] = useState<Record<string, string>>({ ...DARK_DEFAULTS })
  const [colorTab, setColorTab] = useState<'light' | 'dark'>('light')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingFavicon, setUploadingFavicon] = useState(false)

  const logoInputRef = useRef<HTMLInputElement>(null)
  const faviconInputRef = useRef<HTMLInputElement>(null)
  const [suggestingColors, setSuggestingColors] = useState(false)
  const savedRef = useRef(false) // true quando usuario clicou "Salvar"

  // Snapshot das CSS variables ao entrar na pagina (para restaurar se nao salvar)
  const cssSnapshotRef = useRef<Record<string, string>>({})
  useEffect(() => {
    const root = document.documentElement
    const snapshot: Record<string, string> = {}
    Object.values(CSS_VAR_MAP).forEach(cssVar => {
      snapshot[cssVar] = getComputedStyle(root).getPropertyValue(cssVar).trim()
    })
    cssSnapshotRef.current = snapshot

    // Cleanup: restaurar ao sair se nao salvou
    return () => {
      if (!savedRef.current) {
        Object.entries(cssSnapshotRef.current).forEach(([cssVar, val]) => {
          if (val) root.style.setProperty(cssVar, val)
        })
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  type ThemePalette = { primary: string; primaryHover: string; secondary: string; secondaryHover: string; accent: string; accentHover: string; bgPage: string; bgSurface: string }
  const [suggestion, setSuggestion] = useState<{ light: ThemePalette; dark: ThemePalette; reasoning?: string } | null>(null)

  // Extrair cores dominantes da logo via canvas e enviar para IA
  const handleSuggestColors = useCallback(async () => {
    if (!logoUrl) return
    setSuggestingColors(true)
    setSuggestion(null)
    try {
      // Carregar imagem num canvas para extrair cores dominantes
      const img = new Image()
      img.crossOrigin = 'anonymous'
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('Falha ao carregar logo'))
        img.src = logoUrl
      })

      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!
      canvas.width = Math.min(img.width, 100)
      canvas.height = Math.min(img.height, 100)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data

      // Pixel sampling para cores dominantes (ignorar branco/preto/transparente)
      const colorCounts = new Map<string, number>()
      for (let i = 0; i < imageData.length; i += 16) { // Sample every 4th pixel
        const r = imageData[i], g = imageData[i + 1], b = imageData[i + 2], a = imageData[i + 3]
        if (a < 128) continue // Transparente
        if (r > 240 && g > 240 && b > 240) continue // Branco
        if (r < 15 && g < 15 && b < 15) continue // Preto
        // Quantizar para reduzir variações
        const qr = Math.round(r / 32) * 32, qg = Math.round(g / 32) * 32, qb = Math.round(b / 32) * 32
        const hex = `#${qr.toString(16).padStart(2, '0')}${qg.toString(16).padStart(2, '0')}${qb.toString(16).padStart(2, '0')}`
        colorCounts.set(hex, (colorCounts.get(hex) || 0) + 1)
      }

      const dominantColors = [...colorCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([hex]) => hex)

      if (dominantColors.length === 0) {
        setError('Nao foi possivel extrair cores da logo. Tente outra imagem.')
        setSuggestingColors(false)
        return
      }

      // Enviar para IA
      const res = await fetch('/api/branding/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dominantColors }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error || 'Erro na sugestao')
      }

      const result = await res.json()
      setSuggestion(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao sugerir cores')
    } finally {
      setSuggestingColors(false)
    }
  }, [logoUrl])

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
            .select('features, plan')
            .eq('id', memberData.organization_id)
            .single()
          const hasWhiteLabel = orgData?.features?.includes('white_label') || orgData?.plan === 'enterprise'
          if (orgData && !hasWhiteLabel) {
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
        // Carregar cores customizadas salvas
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const t = theme as any
        if (t.lightColors) setLightColors({ ...LIGHT_DEFAULTS, ...t.lightColors })
        if (t.darkColors) setDarkColors({ ...DARK_DEFAULTS, ...t.darkColors })
      }

      setLoading(false)
    }

    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization])

  // Preview em tempo real agora e feito diretamente no onChange de cada color picker
  // O SessionTenantProvider reaplica do banco ao navegar

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
          primaryColor: lightColors.primary,
          appName: appName || APP_CONFIG.name,
          logoUrl,
          faviconUrl,
          lightColors,
          darkColors,
        },
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase as any)
        .from('organizations')
        .update({ settings: newSettings, updated_at: new Date().toISOString() })
        .eq('id', organization.id)

      if (updateError) throw new Error(updateError.message)

      savedRef.current = true
      setSuccess('Branding salvo! Aplicando...')
      setTimeout(() => window.location.reload(), 1000)
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

        {/* Editor de Cores Completo */}
        <div className="card p-5">
          <h2 className="text-base font-semibold text-main mb-1">Cores do Tema</h2>
          <p className="text-sm text-muted mb-4">
            Customize todas as cores da aplicacao para os temas light e dark.
          </p>

          {/* Abas Light / Dark */}
          <div className="flex gap-1 mb-4 p-1 bg-surface-hover rounded-xl w-fit">
            <button onClick={() => setColorTab('light')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${colorTab === 'light' ? 'bg-surface text-main shadow-sm' : 'text-muted hover:text-main'}`}>
              Light
            </button>
            <button onClick={() => setColorTab('dark')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${colorTab === 'dark' ? 'bg-surface text-main shadow-sm' : 'text-muted hover:text-main'}`}>
              Dark
            </button>
          </div>

          {/* Grupos de cores */}
          <div className="space-y-4">
            {COLOR_GROUPS.map((group) => {
              const colors = colorTab === 'light' ? lightColors : darkColors
              const setColors = colorTab === 'light' ? setLightColors : setDarkColors
              return (
                <div key={group.label}>
                  <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">{group.label}</p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {group.keys.map((key) => (
                      <div key={key} className="flex items-center gap-1.5">
                        <label className="relative cursor-pointer group">
                          <input
                            type="color"
                            value={colors[key] || '#000000'}
                            onChange={e => {
                              setColors(prev => ({ ...prev, [key]: e.target.value }))
                              // Preview em tempo real na variavel CSS correspondente
                              const cssVar = CSS_VAR_MAP[key]
                              if (cssVar) document.documentElement.style.setProperty(cssVar, e.target.value)
                              if (key === 'primary') setPrimaryColor(e.target.value)
                            }}
                            className="w-7 h-7 rounded-md border border-subtle cursor-pointer"
                          />
                        </label>
                        <span className="text-[9px] text-muted truncate">{COLOR_LABELS[key]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Reset para defaults */}
          <button
            onClick={() => {
              if (colorTab === 'light') setLightColors({ ...LIGHT_DEFAULTS })
              else setDarkColors({ ...DARK_DEFAULTS })
            }}
            className="mt-4 text-xs text-muted hover:text-error transition-colors underline underline-offset-2"
          >
            Resetar {colorTab} para cores padrao
          </button>
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

        {/* Sugerir cores com IA */}
        {logoUrl && (
          <div className="card p-5">
            <h2 className="text-base font-semibold text-main mb-1 flex items-center gap-2">
              <FiZap className="w-4 h-4 text-primary" />
              Sugerir Cores com IA
            </h2>
            <p className="text-sm text-muted mb-4">
              A IA analisa as cores da sua logo e sugere uma paleta completa para o app.
            </p>

            <button
              onClick={handleSuggestColors}
              disabled={suggestingColors}
              className="btn-secondary flex items-center gap-2"
            >
              {suggestingColors ? (
                <>
                  <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                  Analisando logo...
                </>
              ) : (
                <>
                  <FiZap className="w-4 h-4" />
                  Sugerir cores a partir da logo
                </>
              )}
            </button>

            {/* Preview da sugestao — light + dark side by side */}
            {suggestion && (
              <div className="mt-4 p-4 bg-surface-hover rounded-xl space-y-4">
                <p className="text-xs font-semibold text-main uppercase tracking-wide">Sugestao da IA</p>

                <div className="grid grid-cols-2 gap-3">
                  {/* Light theme preview */}
                  <div className="rounded-xl p-3 space-y-2" style={{ backgroundColor: suggestion.light.bgPage }}>
                    <p className="text-[10px] font-bold uppercase" style={{ color: suggestion.light.primary }}>Light</p>
                    <div className="rounded-lg p-2 space-y-1.5" style={{ backgroundColor: suggestion.light.bgSurface }}>
                      <div className="flex gap-1.5">
                        {Object.entries(suggestion.light).filter(([k]) => !k.includes('bg')).map(([key, color]) => (
                          <div key={key} className="text-center">
                            <div className="w-6 h-6 rounded border border-black/10" style={{ backgroundColor: color }} />
                            <p className="text-[7px] mt-0.5" style={{ color: suggestion.light.secondary }}>{key.replace('Hover', '')}</p>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-1.5 items-center">
                        <span className="px-2 py-0.5 rounded text-[8px] text-white font-bold" style={{ backgroundColor: suggestion.light.primary }}>Botao</span>
                        <span className="px-2 py-0.5 rounded text-[8px] text-white font-bold" style={{ backgroundColor: suggestion.light.accent }}>Accent</span>
                      </div>
                    </div>
                  </div>

                  {/* Dark theme preview */}
                  <div className="rounded-xl p-3 space-y-2" style={{ backgroundColor: suggestion.dark.bgPage }}>
                    <p className="text-[10px] font-bold uppercase" style={{ color: suggestion.dark.primary }}>Dark</p>
                    <div className="rounded-lg p-2 space-y-1.5" style={{ backgroundColor: suggestion.dark.bgSurface }}>
                      <div className="flex gap-1.5">
                        {Object.entries(suggestion.dark).filter(([k]) => !k.includes('bg')).map(([key, color]) => (
                          <div key={key} className="text-center">
                            <div className="w-6 h-6 rounded border border-white/10" style={{ backgroundColor: color }} />
                            <p className="text-[7px] mt-0.5" style={{ color: suggestion.dark.secondary }}>{key.replace('Hover', '')}</p>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-1.5 items-center">
                        <span className="px-2 py-0.5 rounded text-[8px] font-bold" style={{ backgroundColor: suggestion.dark.primary, color: suggestion.dark.bgPage }}>Botao</span>
                        <span className="px-2 py-0.5 rounded text-[8px] font-bold" style={{ backgroundColor: suggestion.dark.accent, color: suggestion.dark.bgPage }}>Accent</span>
                      </div>
                    </div>
                  </div>
                </div>

                {suggestion.reasoning && (
                  <p className="text-xs text-muted italic">{suggestion.reasoning}</p>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      // Aplicar TODAS as cores light no state + CSS variables
                      const s = suggestion.light
                      setLightColors(prev => ({ ...prev, ...s }))
                      setPrimaryColor(s.primary)
                      // Aplicar em tempo real
                      Object.entries(s).forEach(([key, val]) => {
                        const cssVar = CSS_VAR_MAP[key]
                        if (cssVar) document.documentElement.style.setProperty(cssVar, val)
                      })
                      setSuggestion(null)
                      setSuccess('Paleta light aplicada! Clique em "Salvar" para confirmar.')
                      setTimeout(() => setSuccess(null), 3000)
                    }}
                    className="btn-primary text-sm flex items-center gap-2"
                  >
                    <FiCheck className="w-4 h-4" />
                    Aplicar Light
                  </button>
                  <button
                    onClick={() => {
                      // Aplicar TODAS as cores dark no state + CSS variables
                      const s = suggestion.dark
                      setDarkColors(prev => ({ ...prev, ...s }))
                      setPrimaryColor(s.primary)
                      Object.entries(s).forEach(([key, val]) => {
                        const cssVar = CSS_VAR_MAP[key]
                        if (cssVar) document.documentElement.style.setProperty(cssVar, val)
                      })
                      setSuggestion(null)
                      setSuccess('Paleta dark aplicada! Clique em "Salvar" para confirmar.')
                      setTimeout(() => setSuccess(null), 3000)
                    }}
                    className="btn-secondary text-sm flex items-center gap-2"
                  >
                    <FiCheck className="w-4 h-4" />
                    Aplicar Dark
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

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

        {/* Save + Reset */}
        <div className="flex items-center gap-3">
          <button
            onClick={async () => {
              if (!organization?.id || !confirm('Resetar todas as cores para o tema padrao? Isso sera salvo imediatamente.')) return
              setSaving(true)
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (supabase as any).from('organizations').update({
                  settings: { ...organization.settings, theme: { primaryColor: '#0D9488', logoUrl, faviconUrl, appName: appName || APP_CONFIG.name } },
                  updated_at: new Date().toISOString(),
                }).eq('id', organization.id)
                savedRef.current = true
                window.location.reload()
              } catch { setSaving(false) }
            }}
            disabled={saving}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            Resetar tema padrao
          </button>
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
