'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { APP_CONFIG } from '@/lib/config'
import { ThemeToggle, LoadingInline } from '@/components/ui'
import { FiMail, FiArrowLeft, FiCheckCircle, FiLock, FiEye, FiEyeOff } from 'react-icons/fi'

type Step = 'email' | 'otp' | 'password' | 'success'

export default function EsqueciSenhaPage() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', ''])
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  // --- OTP handlers (mesmo padrao do cadastro) ---
  const handleOtpChange = useCallback((index: number, value: string) => {
    if (value.length > 1) value = value.slice(-1)
    if (value && !/^\d$/.test(value)) return

    const newCode = [...otpCode]
    newCode[index] = value
    setOtpCode(newCode)

    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus()
    }
  }, [otpCode])

  const handleOtpKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
  }, [otpCode])

  const handleOtpPaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return
    const newCode = [...otpCode]
    for (let i = 0; i < pasted.length; i++) {
      newCode[i] = pasted[i]
    }
    setOtpCode(newCode)
    const focusIndex = Math.min(pasted.length, 5)
    otpRefs.current[focusIndex]?.focus()
  }, [otpCode])

  // --- Step 1: Enviar email de recuperacao ---
  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Verificar se o email existe
      const checkRes = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const { exists } = await checkRes.json()

      if (!exists) {
        setError('Este email nao existe no nosso banco de dados. Primeiro crie sua conta.')
        setLoading(false)
        return
      }

      const supabase = createClient()
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })

      if (error) {
        setError('Erro ao enviar email. Tente novamente.')
        setLoading(false)
        return
      }

      setStep('otp')
    } catch {
      setError('Erro ao enviar email. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  // --- Step 2: Verificar codigo OTP ---
  const handleVerifyOtp = async () => {
    const code = otpCode.join('')
    if (code.length !== 6) {
      setError('Digite o codigo completo de 6 digitos.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'recovery',
      })

      if (verifyError) {
        setError('Codigo invalido ou expirado. Tente novamente.')
        setLoading(false)
        return
      }

      setStep('password')
    } catch {
      setError('Erro ao verificar codigo. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  // --- Step 3: Definir nova senha ---
  const handleResetPassword = async (e: React.FormEvent) => {
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
      setStep('success')
    } catch {
      setError('Erro ao alterar senha. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  // --- Reenviar codigo ---
  const handleResendCode = async () => {
    setResending(true)
    setError(null)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })
      if (error) {
        setError(error.message)
      } else {
        setOtpCode(['', '', '', '', '', ''])
        otpRefs.current[0]?.focus()
      }
    } catch {
      setError('Erro ao reenviar codigo.')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="min-h-screen bg-page flex items-center justify-center p-4">
      <div className="absolute top-5 right-5 z-10">
        <ThemeToggle />
      </div>

      <div className="card p-8 max-w-md w-full">

        {/* === STEP: SUCCESS === */}
        {step === 'success' && (
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
        )}

        {/* === STEP: EMAIL === */}
        {step === 'email' && (
          <>
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-main mb-2">
                Esqueci minha senha
              </h1>
              <p className="text-muted text-[15px]">
                Informe seu email e enviaremos um codigo para redefinir sua senha.
              </p>
            </div>

            <form onSubmit={handleSendEmail} className="space-y-5">
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
                  'Enviar codigo de recuperacao'
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

        {/* === STEP: OTP === */}
        {step === 'otp' && (
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <FiMail className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-main mb-2">
              Verifique seu email
            </h1>
            <p className="text-muted mb-2">
              Enviamos um codigo de 6 digitos para
            </p>
            <p className="text-main font-semibold mb-8">{email}</p>

            {/* OTP Input */}
            <div className="flex justify-center gap-2 mb-6" onPaste={handleOtpPaste}>
              {otpCode.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { otpRefs.current[i] = el }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  className="w-12 h-14 text-center text-2xl font-bold rounded-xl border-2 border-subtle bg-surface text-main focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  autoFocus={i === 0}
                />
              ))}
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/20 mb-4">
                <p className="text-red-500 text-sm">{error}</p>
              </div>
            )}

            {/* Verify button */}
            <button
              onClick={handleVerifyOtp}
              disabled={loading || otpCode.join('').length !== 6}
              className="btn-primary w-full py-3.5 flex items-center justify-center gap-2 text-[15px] font-semibold mb-4 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <LoadingInline />
                  Verificando...
                </>
              ) : (
                'Confirmar codigo'
              )}
            </button>

            {/* Resend */}
            <p className="text-sm text-muted">
              Nao recebeu o codigo?{' '}
              <button
                onClick={handleResendCode}
                disabled={resending}
                className="text-primary font-medium hover:underline disabled:opacity-50"
              >
                {resending ? 'Reenviando...' : 'Reenviar'}
              </button>
            </p>

            {/* Back */}
            <button
              onClick={() => { setStep('email'); setError(null); setOtpCode(['', '', '', '', '', '']) }}
              className="mt-4 inline-flex items-center gap-1 text-sm text-muted hover:text-main transition-colors"
            >
              <FiArrowLeft className="w-3.5 h-3.5" />
              Voltar ao email
            </button>
          </div>
        )}

        {/* === STEP: PASSWORD === */}
        {step === 'password' && (
          <>
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <FiLock className="w-8 h-8 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-main mb-2">
                Definir nova senha
              </h1>
              <p className="text-muted text-[15px]">
                Escolha uma nova senha para sua conta.
              </p>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-5">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-secondary mb-2">
                  Nova senha
                </label>
                <div className="relative">
                  <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted pointer-events-none" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className="input"
                    style={{ paddingLeft: '2.75rem', paddingRight: '2.75rem' }}
                    placeholder="Minimo 6 caracteres"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(prev => !prev)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-main transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showPassword ? <FiEyeOff className="w-[18px] h-[18px]" /> : <FiEye className="w-[18px] h-[18px]" />}
                  </button>
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
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className="input"
                    style={{ paddingLeft: '2.75rem', paddingRight: '2.75rem' }}
                    placeholder="Repita a nova senha"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(prev => !prev)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-main transition-colors"
                    tabIndex={-1}
                    aria-label={showConfirmPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showConfirmPassword ? <FiEyeOff className="w-[18px] h-[18px]" /> : <FiEye className="w-[18px] h-[18px]" />}
                  </button>
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
