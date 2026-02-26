'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { APP_CONFIG } from '@/lib/config'
import { ThemeToggle, LoadingInline } from '@/components/ui'
import { FiLock, FiCheckCircle, FiAlertCircle } from 'react-icons/fi'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [checking, setChecking] = useState(true)
  const [hasSession, setHasSession] = useState(false)

  useEffect(() => {
    const checkSession = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      setHasSession(!!session)
      setChecking(false)
    }
    checkSession()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('A senha deve ter no minimo 6 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      setError('As senhas nao coincidem.')
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password })

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      await supabase.auth.signOut()
      setSuccess(true)
    } catch {
      setError('Erro ao alterar senha. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center p-4">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!hasSession && !success) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center p-4">
        <div className="card p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
            <FiAlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-main mb-2">
            Link expirado
          </h1>
          <p className="text-muted mb-8">
            Este link de recuperacao expirou ou ja foi utilizado. Solicite um novo link.
          </p>
          <Link
            href={APP_CONFIG.routes.esqueciSenha}
            className="btn-primary inline-flex items-center gap-2 px-6 py-3 text-base"
          >
            Solicitar novo link
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-page flex items-center justify-center p-4">
      <div className="absolute top-5 right-5 z-10">
        <ThemeToggle />
      </div>

      <div className="card p-8 max-w-md w-full">
        {success ? (
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-6">
              <FiCheckCircle className="w-10 h-10 text-success" />
            </div>
            <h1 className="text-2xl font-bold text-main mb-2">
              Senha alterada!
            </h1>
            <p className="text-muted mb-8">
              Sua senha foi redefinida com sucesso. Faca login com a nova senha.
            </p>
            <Link
              href={APP_CONFIG.routes.login}
              className="btn-primary inline-flex items-center gap-2 px-6 py-3 text-base"
            >
              Ir para Login
            </Link>
          </div>
        ) : (
          <>
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-main mb-2">
                Definir nova senha
              </h1>
              <p className="text-muted text-[15px]">
                Escolha uma nova senha para sua conta.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-secondary mb-2">
                  Nova senha
                </label>
                <div className="relative">
                  <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted pointer-events-none" />
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className="input"
                    style={{ paddingLeft: '2.75rem' }}
                    placeholder="Minimo 6 caracteres"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-secondary mb-2">
                  Confirmar nova senha
                </label>
                <div className="relative">
                  <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted pointer-events-none" />
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className="input"
                    style={{ paddingLeft: '2.75rem' }}
                    placeholder="Repita a nova senha"
                  />
                </div>
              </div>

              {error && (
                <div className="p-3.5 bg-red-500/10 rounded-xl border border-red-500/20">
                  <p className="text-red-500 text-sm text-center">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-3.5 flex items-center justify-center gap-2 text-[15px] font-semibold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300"
              >
                {loading ? (
                  <>
                    <LoadingInline />
                    Alterando senha...
                  </>
                ) : (
                  'Alterar senha'
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
