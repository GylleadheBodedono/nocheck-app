'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { APP_CONFIG } from '@/lib/config'
import { ThemeToggle, LoadingInline } from '@/components/ui'
import { FiMail, FiArrowLeft, FiCheckCircle } from 'react-icons/fi'

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })

      if (error) {
        setError('Erro ao enviar email. Tente novamente.')
        setLoading(false)
        return
      }

      setSent(true)
    } catch {
      setError('Erro ao enviar email. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-page flex items-center justify-center p-4">
      <div className="absolute top-5 right-5 z-10">
        <ThemeToggle />
      </div>

      <div className="card p-8 max-w-md w-full">
        {sent ? (
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-6">
              <FiCheckCircle className="w-10 h-10 text-success" />
            </div>
            <h1 className="text-2xl font-bold text-main mb-2">
              Email enviado
            </h1>
            <p className="text-muted mb-8">
              Se existe uma conta com esse email, voce recebera um link para redefinir sua senha. Verifique sua caixa de entrada e spam.
            </p>
            <Link
              href={APP_CONFIG.routes.login}
              className="btn-primary inline-flex items-center gap-2 px-6 py-3 text-base"
            >
              <FiArrowLeft className="w-5 h-5" />
              Voltar para Login
            </Link>
          </div>
        ) : (
          <>
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-main mb-2">
                Esqueci minha senha
              </h1>
              <p className="text-muted text-[15px]">
                Informe seu email e enviaremos um link para redefinir sua senha.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-secondary mb-2">
                  Email
                </label>
                <div className="relative">
                  <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted pointer-events-none" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="input"
                    style={{ paddingLeft: '2.75rem' }}
                    placeholder="seu@email.com"
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
                    Enviando...
                  </>
                ) : (
                  'Enviar link de recuperacao'
                )}
              </button>
            </form>

            <p className="text-center text-sm text-muted mt-6">
              <Link href={APP_CONFIG.routes.login} className="text-primary font-medium hover:underline inline-flex items-center gap-1">
                <FiArrowLeft className="w-4 h-4" />
                Voltar para Login
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
