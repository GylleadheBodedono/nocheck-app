 'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { APP_CONFIG } from '@/lib/config'
import { ThemeToggle, LoadingInline } from '@/components/ui'
import { FiLock, FiMail, FiUser, FiPhone, FiCheckCircle, FiArrowLeft, FiEye, FiEyeOff } from 'react-icons/fi'
import { WelcomeModal } from '@/components/billing/WelcomeModal'
import { CheckoutFlow } from '@/components/billing/CheckoutModal'

export default function CadastroPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', ''])
  const [verifying, setVerifying] = useState(false)
  const [verified, setVerified] = useState(false)
  const [resending, setResending] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [postSignupStep, setPostSignupStep] = useState<'welcome' | 'checkout' | null>(null)
  const [userOrgId, setUserOrgId] = useState<string | null>(null)
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])
  const router = useRouter()

  const handleOtpChange = useCallback((index: number, value: string) => {
    if (value.length > 1) value = value.slice(-1)
    if (value && !/^\d$/.test(value)) return

    const newCode = [...otpCode]
    newCode[index] = value
    setOtpCode(newCode)

    // Auto-focus next input
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

  const handleVerifyOtp = async () => {
    const code = otpCode.join('')
    if (code.length !== 6) {
      setError('Digite o código completo de 6 dígitos.')
      return
    }

    setVerifying(true)
    setError(null)

    try {
      const supabase = createClient()
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'signup',
      })

      if (verifyError) {
        setError('Código inválido ou expirado. Tente novamente.')
        setVerifying(false)
        return
      }

      setVerified(true)
    } catch {
      setError('Erro ao verificar código. Tente novamente.')
    } finally {
      setVerifying(false)
    }
  }

  const handleResendCode = async () => {
    setResending(true)
    setError(null)
    try {
      const supabase = createClient()
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email,
      })
      if (resendError) {
        setError(resendError.message)
      } else {
        setError(null)
        setOtpCode(['', '', '', '', '', ''])
        otpRefs.current[0]?.focus()
      }
    } catch {
      setError('Erro ao reenviar código.')
    } finally {
      setResending(false)
    }
  }

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11)
    if (digits.length <= 2) return digits
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.')
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone: phone.replace(/\D/g, ''),
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        if (error.message.includes('already registered')) {
          setError('Este email já está cadastrado. Tente fazer login.')
        } else {
          setError(error.message)
        }
        setLoading(false)
        return
      }

      setSuccess(true)
    } catch {
      setError('Erro ao criar conta. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  // Buscar orgId quando verificado
  useEffect(() => {
    if (!verified) return
    setPostSignupStep('welcome')
    async function fetchOrgId() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase as any)
          .from('organization_members')
          .select('organization_id')
          .eq('user_id', user.id)
          .limit(1)
          .single()
        if (data?.organization_id) setUserOrgId(data.organization_id)
      } catch {
        // org may not exist yet — will be created in onboarding
      }
    }
    fetchOrgId()
  }, [verified])

  // Tela de confirmacao concluida — fluxo de assinatura
  if (verified) {
    if (postSignupStep === 'checkout' && userOrgId) {
      return (
        <CheckoutFlow
          orgId={userOrgId}
          onBack={() => setPostSignupStep('welcome')}
          onSuccess={() => router.push('/dashboard')}
          onSkip={() => router.push('/dashboard')}
        />
      )
    }

    return (
      <WelcomeModal
        onTrial={() => router.push('/dashboard')}
        onSubscribe={() => {
          if (userOrgId) {
            setPostSignupStep('checkout')
          } else {
            // Sem org ainda — vai para onboarding primeiro, depois billing
            router.push('/onboarding')
          }
        }}
      />
    )
  }

  // Tela de verificacao OTP
  if (success) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center p-4">
        <div className="card p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <FiMail className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-main mb-2">
            Verifique seu email
          </h1>
          <p className="text-muted mb-2">
            Enviamos um código de 6 dígitos para
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
            disabled={verifying || otpCode.join('').length !== 6}
            className="btn-primary w-full py-3.5 flex items-center justify-center gap-2 text-[15px] font-semibold mb-4 disabled:opacity-50"
          >
            {verifying ? (
              <>
                <LoadingInline />
                Verificando...
              </>
            ) : (
              'Confirmar código'
            )}
          </button>

          {/* Resend */}
          <p className="text-sm text-muted">
            Não recebeu o código?{' '}
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
            onClick={() => { setSuccess(false); setError(null); setOtpCode(['', '', '', '', '', '']) }}
            className="mt-4 inline-flex items-center gap-1 text-sm text-muted hover:text-main transition-colors"
          >
            <FiArrowLeft className="w-3.5 h-3.5" />
            Voltar ao cadastro
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen w-screen p-4">
      <div className="h-full w-full flex overflow-hidden">

        {/* Left Side - Decorative Panel */}
        <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden rounded-[20px]">
          <div className="absolute inset-0 bg-gradient-to-br from-[#0D9488] via-[#115E59] to-[#0F172A] animate-gradient" />
          <div className="absolute inset-0 opacity-30"
            style={{
              backgroundImage: `radial-gradient(at 20% 30%, rgba(255,255,255,0.15) 0%, transparent 50%),
                                radial-gradient(at 80% 70%, rgba(13,148,136,0.3) 0%, transparent 50%),
                                radial-gradient(at 50% 10%, rgba(255,255,255,0.1) 0%, transparent 40%)`
            }}
          />
          <div className="absolute top-[15%] left-[10%] w-64 h-64 rounded-full bg-white/5 backdrop-blur-3xl border border-white/10 animate-float-slow" />
          <div className="absolute bottom-[20%] right-[15%] w-48 h-48 rounded-full bg-white/5 backdrop-blur-3xl border border-white/10 animate-float-delayed" />
          <div className="absolute top-[60%] left-[30%] w-32 h-32 rounded-full bg-white/8 backdrop-blur-3xl border border-white/5 animate-float-slow-reverse" />
          <div className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            }}
          />
          <div className="relative z-10 flex flex-col justify-between p-12 w-full">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                  <span className="text-white font-bold text-lg">O</span>
                </div>
                <span className="text-white/90 font-semibold text-lg tracking-tight">OpereCheck</span>
              </div>
            </div>
            <div className="max-w-md">
              <h1 className="text-5xl xl:text-6xl font-bold text-white leading-[1.1] tracking-tight mb-6">
                Crie sua
                <br />
                conta
                <br />
                <span className="text-white/50">agora</span>
              </h1>
              <p className="text-white/60 text-lg leading-relaxed max-w-sm">
                Cadastre-se para acessar o sistema de checklists digitais da sua empresa.
              </p>
            </div>
            <div className="flex gap-8">
              <div>
                <p className="text-3xl font-bold text-white">100%</p>
                <p className="text-sm text-white/40 mt-1">Digital</p>
              </div>
              <div className="w-px bg-white/10" />
              <div>
                <p className="text-3xl font-bold text-white">24/7</p>
                <p className="text-sm text-white/40 mt-1">Offline</p>
              </div>
              <div className="w-px bg-white/10" />
              <div>
                <p className="text-3xl font-bold text-white">Real</p>
                <p className="text-sm text-white/40 mt-1">Time Sync</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Signup Form */}
        <div className="flex-1 flex flex-col relative bg-page rounded-[20px]">
          <div className="absolute top-5 right-5 z-10">
            <ThemeToggle />
          </div>

          <div className="flex-1 flex items-center rounded-[20px] justify-center px-6 sm:px-12 lg:px-16">
            <div className="w-full max-w-[400px]">
              {/* Logo */}
              <div className="mb-8">
                <div className="flex justify-center mb-6">
                  <span className="text-3xl font-bold tracking-tight">
                    <span className="text-secondary">Opere</span><span className="text-primary">Check</span>
                  </span>
                </div>
                <p className="text-muted text-center mt-1.5 text-[15px]">
                  Preencha os dados abaixo para criar sua conta
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Nome */}
                <div>
                  <label htmlFor="fullName" className="block text-sm font-medium text-secondary mb-2">
                    Nome completo
                  </label>
                  <div className="relative">
                    <FiUser className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted pointer-events-none" />
                    <input
                      id="fullName"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      autoComplete="name"
                      className="input"
                      style={{ paddingLeft: '2.75rem' }}
                      placeholder="Seu nome completo"
                    />
                  </div>
                </div>

                {/* Email */}
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

                {/* Telefone */}
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-secondary mb-2">
                    Telefone
                  </label>
                  <div className="relative">
                    <FiPhone className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted pointer-events-none" />
                    <input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(formatPhone(e.target.value))}
                      required
                      autoComplete="tel"
                      className="input"
                      style={{ paddingLeft: '2.75rem' }}
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                </div>

                {/* Senha */}
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-secondary mb-2">
                    Senha
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
                      placeholder="Mínimo 6 caracteres"
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

                {/* Confirmar Senha */}
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-secondary mb-2">
                    Confirmar senha
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
                      placeholder="Repita a senha"
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

                {/* Error */}
                {error && (
                  <div className="p-3.5 bg-red-500/10 rounded-xl border border-red-500/20">
                    <p className="text-red-500 text-sm text-center">{error}</p>
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full py-3.5 flex items-center justify-center gap-2 text-[15px] font-semibold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300"
                >
                  {loading ? (
                    <>
                      <LoadingInline />
                      Criando conta...
                    </>
                  ) : (
                    'Criar conta'
                  )}
                </button>
              </form>

              {/* Link para login */}
              <p className="text-center text-sm text-muted mt-6">
                Já tem conta?{' '}
                <Link href={APP_CONFIG.routes.login} className="text-primary font-medium hover:underline">
                  Entrar
                </Link>
              </p>

              {/* Footer */}
              <p className="text-center text-muted text-xs mt-8">
                {APP_CONFIG.company} &middot; {APP_CONFIG.year}
              </p>
            </div>
          </div>

          {/* Mobile decorative bar */}
          <div className="lg:hidden h-1.5 mx-6 mb-6 rounded-full bg-gradient-to-r from-[#0D9488] via-[#14B8A6] to-[#115E59] opacity-60" />
        </div>
      </div>
    </div>
  )
}
