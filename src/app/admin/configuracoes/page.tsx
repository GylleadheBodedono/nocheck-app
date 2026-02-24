'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient, isSupabaseConfigured } from '@/lib/supabase'
import { FiSettings, FiCopy, FiEye, FiSave, FiRotateCcw, FiSend, FiChevronDown, FiChevronUp, FiCheck } from 'react-icons/fi'
import { APP_CONFIG } from '@/lib/config'
import { LoadingPage, Header } from '@/components/ui'
import { getAuthCache, getUserCache } from '@/lib/offlineCache'
import {
  TEMPLATE_VARIABLES,
  DEFAULT_ACTION_PLAN_EMAIL_HTML,
  DEFAULT_ACTION_PLAN_EMAIL_SUBJECT,
  replaceTemplatePlaceholders,
  getSampleVariables,
} from '@/lib/emailTemplateEngine'

export default function ConfiguracoesPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sendingTest, setSendingTest] = useState(false)
  const [userEmail, setUserEmail] = useState<string>('')
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  // Template state
  const [emailSubject, setEmailSubject] = useState(DEFAULT_ACTION_PLAN_EMAIL_SUBJECT)
  const [emailTemplate, setEmailTemplate] = useState(DEFAULT_ACTION_PLAN_EMAIL_HTML)
  const [showPreview, setShowPreview] = useState(false)
  const [showVariables, setShowVariables] = useState(false)
  const [copiedVar, setCopiedVar] = useState<string | null>(null)

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
            .select('is_admin, email')
            .eq('id', user.id)
            .single()
          isAdmin = profile && 'is_admin' in profile ? (profile as { is_admin: boolean }).is_admin : false
          if (profile && 'email' in profile) setUserEmail((profile as { email: string }).email || user.email || '')
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
            if (cachedUser?.email) setUserEmail(cachedUser.email)
          }
        } catch { /* ignore */ }
      }

      if (!currentUserId) { router.push(APP_CONFIG.routes.login); return }
      if (!isAdmin) { router.push(APP_CONFIG.routes.dashboard); return }

      // Load existing templates from app_settings
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sb = supabase as any
        const [tplRes, subjRes] = await Promise.all([
          sb.from('app_settings').select('value').eq('key', 'action_plan_email_template').maybeSingle(),
          sb.from('app_settings').select('value').eq('key', 'action_plan_email_subject').maybeSingle(),
        ])
        if (tplRes.data?.value) setEmailTemplate(tplRes.data.value)
        if (subjRes.data?.value) setEmailSubject(subjRes.data.value)
      } catch {
        console.log('[Config] Usando templates padrao')
      }

      setLoading(false)
    }

    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSave = useCallback(async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }

      // Get auth token for the API
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }

      const [tplRes, subjRes] = await Promise.all([
        fetch('/api/settings', {
          method: 'PUT',
          headers,
          body: JSON.stringify({ key: 'action_plan_email_template', value: emailTemplate }),
        }),
        fetch('/api/settings', {
          method: 'PUT',
          headers,
          body: JSON.stringify({ key: 'action_plan_email_subject', value: emailSubject }),
        }),
      ])

      if (!tplRes.ok || !subjRes.ok) {
        throw new Error('Erro ao salvar configuracoes')
      }

      setSuccess('Configuracoes salvas com sucesso!')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }, [supabase, emailTemplate, emailSubject])

  const handleRestore = useCallback(() => {
    if (!confirm('Restaurar template padrao? Suas alteracoes serao perdidas.')) return
    setEmailSubject(DEFAULT_ACTION_PLAN_EMAIL_SUBJECT)
    setEmailTemplate(DEFAULT_ACTION_PLAN_EMAIL_HTML)
    setSuccess('Template restaurado para o padrao. Clique em "Salvar" para aplicar.')
    setTimeout(() => setSuccess(null), 4000)
  }, [])

  const handleSendTest = useCallback(async () => {
    if (!userEmail) {
      setError('Email do usuario nao encontrado')
      return
    }
    setSendingTest(true)
    setError(null)
    setSuccess(null)

    try {
      const sample = getSampleVariables()
      const html = replaceTemplatePlaceholders(emailTemplate, sample)
      const subject = replaceTemplatePlaceholders(emailSubject, sample) + ' [TESTE]'

      const response = await fetch('/api/notifications/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: userEmail, subject, htmlBody: html }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error || 'Erro ao enviar email')
      }

      setSuccess(`Email de teste enviado para ${userEmail}`)
      setTimeout(() => setSuccess(null), 4000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar email de teste')
    } finally {
      setSendingTest(false)
    }
  }, [userEmail, emailTemplate, emailSubject])

  const handleCopyVariable = useCallback((varKey: string) => {
    navigator.clipboard.writeText(`{{${varKey}}}`)
    setCopiedVar(varKey)
    setTimeout(() => setCopiedVar(null), 1500)
  }, [])

  const previewHtml = useMemo(() => {
    const sample = getSampleVariables()
    return replaceTemplatePlaceholders(emailTemplate, sample)
  }, [emailTemplate])

  if (loading) return <LoadingPage />

  return (
    <div className="min-h-screen bg-page">
      <Header
        title="Configuracoes"
        icon={FiSettings}
        backHref="/admin"
      />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Variaveis Disponiveis */}
        <div className="card overflow-hidden">
          <button
            onClick={() => setShowVariables(!showVariables)}
            className="w-full flex items-center justify-between p-5 hover:bg-surface-hover transition-colors"
          >
            <div className="text-left">
              <h2 className="text-base font-semibold text-main">Variaveis Disponiveis</h2>
              <p className="text-sm text-muted mt-0.5">
                Clique para ver as variaveis que podem ser usadas no template
              </p>
            </div>
            {showVariables ? <FiChevronUp className="w-5 h-5 text-muted" /> : <FiChevronDown className="w-5 h-5 text-muted" />}
          </button>

          {showVariables && (
            <div className="border-t border-subtle px-5 pb-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                {TEMPLATE_VARIABLES.map((v) => (
                  <div
                    key={v.key}
                    className="flex items-center justify-between p-3 rounded-lg bg-surface-hover/50 border border-subtle group"
                  >
                    <div className="min-w-0 flex-1 mr-3">
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                          {`{{${v.key}}}`}
                        </code>
                      </div>
                      <p className="text-xs text-muted mt-1 truncate">{v.description}</p>
                    </div>
                    <button
                      onClick={() => handleCopyVariable(v.key)}
                      className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-surface-hover transition-colors shrink-0"
                      title="Copiar variavel"
                    >
                      {copiedVar === v.key ? (
                        <FiCheck className="w-3.5 h-3.5 text-success" />
                      ) : (
                        <FiCopy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Assunto do Email */}
        <div className="card p-5">
          <h2 className="text-base font-semibold text-main mb-1">Assunto do Email</h2>
          <p className="text-sm text-muted mb-4">
            Template para o assunto do email. Use variaveis como {`{{field_name}}`}.
          </p>
          <input
            type="text"
            value={emailSubject}
            onChange={(e) => setEmailSubject(e.target.value)}
            className="input font-mono text-sm"
            placeholder="[NoCheck] Plano de Acao: {{field_name}}"
          />
        </div>

        {/* Template HTML */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-semibold text-main">Template do Email (HTML)</h2>
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="text-sm text-primary hover:text-primary/80 flex items-center gap-1.5 transition-colors"
            >
              <FiEye className="w-4 h-4" />
              {showPreview ? 'Ocultar Preview' : 'Preview'}
            </button>
          </div>
          <p className="text-sm text-muted mb-4">
            HTML completo do email. Use as variaveis {`{{variavel}}`} para inserir dados dinamicos.
          </p>

          <textarea
            value={emailTemplate}
            onChange={(e) => setEmailTemplate(e.target.value)}
            rows={18}
            className="input font-mono text-xs leading-relaxed resize-y"
            spellCheck={false}
          />
        </div>

        {/* Preview */}
        {showPreview && (
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-subtle bg-surface-hover/50">
              <h3 className="text-sm font-semibold text-main">Preview do Email (dados de exemplo)</h3>
            </div>
            <div className="bg-white">
              <iframe
                srcDoc={previewHtml}
                className="w-full border-0"
                style={{ minHeight: 500 }}
                title="Email Preview"
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        )}

        {/* Messages */}
        {success && (
          <div className="p-4 bg-success/10 border border-success/30 rounded-xl">
            <p className="text-success text-sm">{success}</p>
          </div>
        )}
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
            <p className="text-red-500 text-sm">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <FiSave className="w-4 h-4" />
                Salvar Configuracoes
              </>
            )}
          </button>

          <button
            onClick={handleSendTest}
            disabled={sendingTest}
            className="btn-secondary flex items-center justify-center gap-2"
          >
            {sendingTest ? (
              <>
                <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <FiSend className="w-4 h-4" />
                Enviar Email de Teste
              </>
            )}
          </button>

          <button
            onClick={handleRestore}
            className="btn-ghost flex items-center justify-center gap-2 text-muted hover:text-warning"
          >
            <FiRotateCcw className="w-4 h-4" />
            Restaurar Padrao
          </button>
        </div>

        {/* Info */}
        {userEmail && (
          <p className="text-xs text-muted">
            O email de teste sera enviado para: <span className="font-medium text-secondary">{userEmail}</span>
          </p>
        )}
      </main>
    </div>
  )
}
