 'use client'

import { useState, useRef, useCallback, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { APP_CONFIG } from '@/lib/config'
import { ThemeToggle, LoadingInline } from '@/components/ui'
import { FiLock, FiMail, FiUser, FiPhone, FiArrowLeft, FiArrowRight, FiEye, FiEyeOff, FiBriefcase, FiMapPin, FiCheck, FiClock, FiZap, FiDollarSign, FiLink, FiLoader } from 'react-icons/fi'
import { CheckoutFlow } from '@/components/billing/CheckoutModal'
import type { ValidateInviteResponseDTO } from '@/dtos'

/**
 * Página de cadastro de novo usuário (`/cadastro`).
 * Registra via Supabase Auth com verificação prévia de e-mail duplicado.
 * Após o registro, exibe instrução para confirmar o e-mail.
 */
export default function CadastroPage() {
  return (
    <Suspense fallback={<div className="h-screen w-screen flex items-center justify-center bg-page"><FiLoader className="w-6 h-6 animate-spin text-primary" /></div>}>
      <CadastroContent />
    </Suspense>
  )
}

function CadastroContent() {
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
  const [step, setStep] = useState<0 | 1 | 2>(0)
  const [userType, setUserType] = useState<'empresa' | 'funcionario' | null>(null)
  const [cpf, setCpf] = useState('')
  const [cpfError, setCpfError] = useState<string | null>(null)
  // Step 2 — Dados da empresa
  const [companyName, setCompanyName] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [businessType, setBusinessType] = useState('')
  const [employeeRange, setEmployeeRange] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [cnpjError, setCnpjError] = useState<string | null>(null)
  const [postSignupStep, setPostSignupStep] = useState<'welcome' | 'checkout' | null>(null)
  const [userOrgId, setUserOrgId] = useState<string | null>(null)
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])
  const router = useRouter()
  const searchParams = useSearchParams()

  // ── Invite State ──
  const inviteToken = searchParams.get('invite')
  const [inviteData, setInviteData] = useState<{ email: string; role: string; orgName: string } | null>(null)
  const [inviteLoading, setInviteLoading] = useState(!!inviteToken)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [acceptingInvite, setAcceptingInvite] = useState(false)
  // Manual invite code input (when funcionario clicks without URL token)
  const [manualInviteCode, setManualInviteCode] = useState('')
  const [validatingManualCode, setValidatingManualCode] = useState(false)

  // ── Validate invite token on mount ──
  useEffect(() => {
    if (!inviteToken) return
    async function validate() {
      try {
        const res = await fetch(`/api/invites/validate?token=${inviteToken}`)
        const data = (await res.json()) as ValidateInviteResponseDTO
        if (data.valid && data.email && data.orgName) {
          setInviteData({ email: data.email, role: data.role || 'member', orgName: data.orgName })
          setEmail(data.email)
          setUserType('funcionario')
          setStep(1) // Go directly to personal info
        } else {
          setInviteError('Convite invalido ou expirado. Solicite um novo convite ao administrador.')
        }
      } catch {
        setInviteError('Erro ao validar convite. Tente novamente.')
      } finally {
        setInviteLoading(false)
      }
    }
    validate()
  }, [inviteToken])

  // ── Validate manual invite code ──
  const handleValidateManualCode = async () => {
    if (!manualInviteCode.trim()) return
    setValidatingManualCode(true)
    setInviteError(null)
    try {
      const res = await fetch(`/api/invites/validate?token=${manualInviteCode.trim()}`)
      const data = (await res.json()) as ValidateInviteResponseDTO
      if (data.valid && data.email && data.orgName) {
        setInviteData({ email: data.email, role: data.role || 'member', orgName: data.orgName })
        setEmail(data.email)
        setStep(1) // Go to personal info
      } else {
        setInviteError('Codigo de convite invalido ou expirado.')
      }
    } catch {
      setInviteError('Erro ao validar codigo.')
    } finally {
      setValidatingManualCode(false)
    }
  }

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
      // Invite flow: verify via our custom OTP endpoint, then sign in
      if (inviteData) {
        const res = await fetch('/api/invites/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, otp: code }),
        })
        const result = await res.json()
        if (!res.ok || !result.success) {
          setError(result.error || 'Código inválido ou expirado.')
          setVerifying(false)
          return
        }

        // Email confirmed — now sign in to get a session
        const supabase = createClient()
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) {
          setError('Email confirmado, mas erro ao fazer login. Tente fazer login manualmente.')
          setVerifying(false)
          return
        }

        setVerified(true)
        return
      }

      // Normal flow: verify via Supabase OTP
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
      // Invite flow: use our custom resend endpoint
      if (inviteData) {
        const res = await fetch('/api/invites/resend-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        })
        const result = await res.json()
        if (!res.ok || !result.success) {
          setError(result.error || 'Erro ao reenviar codigo.')
        } else {
          setOtpCode(['', '', '', '', '', ''])
          otpRefs.current[0]?.focus()
        }
      } else {
        // Normal flow: use Supabase resend
        const supabase = createClient()
        const { error: resendError } = await supabase.auth.resend({
          type: 'signup',
          email,
        })
        if (resendError) {
          setError(resendError.message)
        } else {
          setOtpCode(['', '', '', '', '', ''])
          otpRefs.current[0]?.focus()
        }
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

  const validateCnpj = (value: string): boolean => {
    const digits = value.replace(/\D/g, '')
    if (digits.length !== 14) return false
    // Reject sequences of all-same digits (00000000000000, 11111111111111, etc.)
    if (/^(\d)\1{13}$/.test(digits)) return false
    const calc = (d: string, weights: number[]) => {
      const sum = weights.reduce((acc, w, i) => acc + parseInt(d[i]) * w, 0)
      const rem = sum % 11
      return rem < 2 ? 0 : 11 - rem
    }
    const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    return (
      calc(digits, w1) === parseInt(digits[12]) &&
      calc(digits, w2) === parseInt(digits[13])
    )
  }

  const formatCpf = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11)
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
  }

  const validateCpf = (value: string): boolean => {
    const digits = value.replace(/\D/g, '')
    if (digits.length !== 11) return false
    if (/^(\d)\1{10}$/.test(digits)) return false
    const calc = (d: string, len: number) => {
      let sum = 0
      for (let i = 0; i < len; i++) sum += parseInt(d[i]) * (len + 1 - i)
      const rem = (sum * 10) % 11
      return rem === 10 ? 0 : rem
    }
    return calc(digits, 9) === parseInt(digits[9]) && calc(digits, 10) === parseInt(digits[10])
  }

  const formatCnpj = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 14)
    if (digits.length <= 2) return digits
    if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`
    if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`
    if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`
  }

  const handleNextStep = () => {
    setError(null)
    if (!fullName || !email || !phone) { setError('Preencha todos os campos obrigatorios.'); return }
    if (password.length < 8) { setError('A senha deve ter no minimo 8 caracteres com maiuscula e numero.'); return }
    if (password !== confirmPassword) { setError('As senhas nao coincidem.'); return }
    if (userType === 'funcionario') {
      if (!validateCpf(cpf)) { setCpfError('CPF invalido. Verifique os digitos informados.'); return }
      // Funcionário skips company step — submit directly
      const fakeEvent = { preventDefault: () => {} } as React.FormEvent
      handleSubmit(fakeEvent)
      return
    }
    setStep(2)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (userType === 'empresa') {
      if (!companyName) {
        setError('Nome da empresa e obrigatorio.')
        return
      }
      const cnpjDigits = cnpj.replace(/\D/g, '')
      if (!cnpjDigits) {
        setCnpjError('CNPJ e obrigatorio.')
        return
      }
      if (!validateCnpj(cnpj)) {
        setCnpjError('CNPJ invalido. Verifique os digitos informados.')
        return
      }
    }

    setLoading(true)

    try {
      // Invite flow: use server-side registration (sends both OTP + link)
      const activeInviteToken = inviteToken || manualInviteCode.trim()
      if (inviteData && activeInviteToken) {
        const res = await fetch('/api/invites/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password,
            fullName,
            phone: phone.replace(/\D/g, ''),
            cpf: cpf.replace(/\D/g, '') || null,
            inviteToken: activeInviteToken,
          }),
        })
        const result = await res.json()
        if (!res.ok || !result.success) {
          setError(result.error || 'Erro ao criar conta.')
          setLoading(false)
          return
        }
        setSuccess(true)
        return
      }

      // Normal flow: use Supabase signUp (empresa users)
      const supabase = createClient()
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone: phone.replace(/\D/g, ''),
            user_type: userType,
            ...(userType === 'empresa' ? { company_name: companyName } : {}),
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

  // Buscar orgId quando verificado — ou aceitar convite se for funcionario
  useEffect(() => {
    if (!verified) return

    // Funcionario com convite — aceitar invite automaticamente
    const tokenToAccept = inviteToken || (inviteData ? manualInviteCode.trim() : null)
    if (inviteData && tokenToAccept) {
      setAcceptingInvite(true)
      async function acceptInvite() {
        try {
          const supabase = createClient()
          const { data: { session } } = await supabase.auth.getSession()
          if (!session?.access_token) {
            setError('Sessao nao encontrada. Faca login novamente.')
            setAcceptingInvite(false)
            return
          }
          const res = await fetch('/api/invites/accept', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ token: tokenToAccept }),
          })
          const result = await res.json()
          if (result.success) {
            router.push('/dashboard')
          } else {
            setError(result.error || 'Erro ao aceitar convite.')
            setAcceptingInvite(false)
          }
        } catch {
          setError('Erro ao aceitar convite. Tente novamente.')
          setAcceptingInvite(false)
        }
      }
      acceptInvite()
      return
    }

    // Empresa — fluxo normal (checkout/trial)
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
        if (data?.organization_id) {
          setUserOrgId(data.organization_id)
          // Salvar dados da empresa na org (apenas para tipo empresa)
          if (userType === 'empresa' && (companyName || cnpj)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any).from('organizations').update({
              name: companyName || undefined,
              business_info: {
                cnpj: cnpj.replace(/\D/g, '') || null,
                businessType: businessType || null,
                employeeRange: employeeRange || null,
                city: city || null,
                state: state || null,
              },
            }).eq('id', data.organization_id)
          }
        }
      } catch(error) {
        console.error(error)
      }
    }
    fetchOrgId()
  }, [verified])

  // Invite loading screen
  if (inviteLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-page">
        <div className="text-center">
          <FiLoader className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted">Validando convite...</p>
        </div>
      </div>
    )
  }

  // Invalid invite token — block registration
  if (inviteToken && inviteError && !inviteData) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-page p-4">
        <div className="card p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6">
            <FiLink className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-main mb-2">Convite invalido</h1>
          <p className="text-muted mb-6">{inviteError}</p>
          <Link href={APP_CONFIG.routes.login} className="btn-primary inline-flex items-center gap-2 px-6 py-3">
            Ir para login
          </Link>
        </div>
      </div>
    )
  }

  // Tela de confirmacao concluida — fluxo de assinatura inline
  if (verified) {
    // Funcionario com convite — mostra tela de aceite
    if (inviteData) {
      return (
        <div className="h-screen w-screen flex items-center justify-center bg-page p-4">
          <div className="card p-8 max-w-md w-full text-center">
            {acceptingInvite ? (
              <>
                <FiLoader className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
                <h1 className="text-xl font-bold text-main mb-2">Vinculando sua conta...</h1>
                <p className="text-muted">Entrando na organizacao {inviteData.orgName}</p>
              </>
            ) : error ? (
              <>
                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6">
                  <FiLink className="w-8 h-8 text-red-500" />
                </div>
                <h1 className="text-xl font-bold text-main mb-2">Erro ao aceitar convite</h1>
                <p className="text-red-500 text-sm mb-6">{error}</p>
                <button onClick={() => router.push('/dashboard')} className="btn-primary px-6 py-3">
                  Ir para o dashboard
                </button>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-6">
                  <FiCheck className="w-8 h-8 text-success" />
                </div>
                <h1 className="text-xl font-bold text-main mb-2">Conta criada com sucesso!</h1>
                <p className="text-muted">Redirecionando...</p>
              </>
            )}
          </div>
        </div>
      )
    }

    // Empresa — fluxo normal
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
      <div className="h-screen w-screen p-4">
        <div className="h-full w-full flex overflow-hidden">
          <div className="flex-1 flex flex-col relative bg-page rounded-[20px]">
            <div className="absolute top-5 right-5 z-10"><ThemeToggle /></div>
            <div className="flex-1 flex items-center justify-center px-6 sm:px-12">
              <div className="w-full max-w-lg text-center">
                <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-6">
                  <FiCheck className="w-8 h-8 text-success" />
                </div>
                <h1 className="text-2xl font-bold text-main mb-2">Conta criada com sucesso!</h1>
                <p className="text-muted mb-8">Escolha como deseja comecar a usar o OpereCheck</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                  {/* Trial */}
                  <button
                    onClick={() => router.push('/dashboard')}
                    className="card p-5 border-2 border-subtle hover:border-primary/30 transition-all text-left"
                  >
                    <FiClock className="w-6 h-6 text-muted mb-3" />
                    <h3 className="font-bold text-main mb-1">Testar 14 dias gratis</h3>
                    <p className="text-xs text-muted mb-3">Explore o sistema sem compromisso. Sem cartao de credito.</p>
                    <ul className="text-xs text-muted space-y-1">
                      <li className="flex items-center gap-1.5"><FiCheck className="w-3 h-3 text-success" /> Ate 3 usuarios</li>
                      <li className="flex items-center gap-1.5"><FiCheck className="w-3 h-3 text-success" /> 1 loja</li>
                      <li className="flex items-center gap-1.5"><FiCheck className="w-3 h-3 text-success" /> Checklists e relatorios</li>
                    </ul>
                  </button>

                  {/* Assinar */}
                  <button
                    onClick={() => {
                      if (userOrgId) setPostSignupStep('checkout')
                      else router.push('/onboarding')
                    }}
                    className="card p-5 border-2 border-accent hover:border-accent/80 transition-all text-left relative"
                  >
                    <span className="absolute -top-2.5 right-3 px-2 py-0.5 bg-accent text-[10px] font-bold text-white rounded-full uppercase">Recomendado</span>
                    <FiZap className="w-6 h-6 text-accent mb-3" />
                    <h3 className="font-bold text-main mb-1">Assinar agora</h3>
                    <p className="text-xs text-muted mb-3">Desbloqueie todos os recursos e escale seu negocio.</p>
                    <ul className="text-xs text-muted space-y-1">
                      <li className="flex items-center gap-1.5"><FiDollarSign className="w-3 h-3 text-accent" /> A partir de R$ 297/mes</li>
                      <li className="flex items-center gap-1.5"><FiCheck className="w-3 h-3 text-success" /> Ate 999 usuarios</li>
                      <li className="flex items-center gap-1.5"><FiCheck className="w-3 h-3 text-success" /> Todas as integracoes</li>
                    </ul>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
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
                  {step === 0 ? 'Como você vai usar o OpereCheck?' : step === 1 ? 'Preencha seus dados pessoais' : 'Dados da sua empresa'}
                </p>
              </div>

              {/* Step indicator — only shown after type selection */}
              {step > 0 && (
                <div className="flex items-center justify-center gap-3 mb-6">
                  <div className={`flex items-center gap-1.5 ${step === 1 ? 'text-primary' : 'text-muted'}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step === 1 ? 'bg-primary text-primary-foreground' : 'bg-surface-hover text-muted'}`}>1</div>
                    <span className="text-xs font-medium hidden sm:inline">Pessoal</span>
                  </div>
                  {userType === 'empresa' && (<>
                    <div className="w-8 h-0.5 bg-subtle rounded" />
                    <div className={`flex items-center gap-1.5 ${step === 2 ? 'text-primary' : 'text-muted'}`}>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step === 2 ? 'bg-primary text-primary-foreground' : 'bg-surface-hover text-muted'}`}>2</div>
                      <span className="text-xs font-medium hidden sm:inline">Empresa</span>
                    </div>
                  </>)}
                </div>
              )}

              {/* Step 0 — Seleção de tipo */}
              {step === 0 && (
                <div className="space-y-3">
                  {/* Empresa — always available */}
                  {!inviteData && (
                    <button
                      type="button"
                      onClick={() => { setUserType('empresa'); setStep(1) }}
                      className="w-full card p-5 border-2 border-subtle hover:border-primary hover:bg-primary/15 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:shadow-sm transition-all duration-150 text-left flex items-start gap-4 group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center shrink-0 mt-0.5 transition-colors duration-150">
                        <FiBriefcase className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-main group-hover:text-primary text-[15px] transition-colors duration-150">Empresa</p>
                        <p className="text-xs text-muted mt-0.5">Gerencio uma equipe e quero usar o OpereCheck no meu negocio</p>
                      </div>
                    </button>
                  )}

                  {/* Funcionario — requires invite */}
                  <button
                    type="button"
                    onClick={() => { setUserType('funcionario'); if (inviteData) setStep(1) }}
                    className="w-full card p-5 border-2 border-subtle hover:border-primary hover:bg-primary/15 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:shadow-sm transition-all duration-150 text-left flex items-start gap-4 group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center shrink-0 mt-0.5 transition-colors duration-150">
                      <FiUser className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-main group-hover:text-primary text-[15px] transition-colors duration-150">Funcionario</p>
                      <p className="text-xs text-muted mt-0.5">Sou colaborador e fui convidado a usar o sistema</p>
                    </div>
                  </button>

                  {/* Invite gate — shown when funcionario is selected without invite */}
                  {userType === 'funcionario' && !inviteData && (
                    <div className="card p-5 border-2 border-amber-500/30 bg-amber-500/5 space-y-3">
                      <p className="text-sm text-main font-medium">
                        Funcionarios precisam de um convite para se cadastrar.
                      </p>
                      <p className="text-xs text-muted">
                        Solicite ao administrador da sua empresa ou insira o codigo de convite abaixo.
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={manualInviteCode}
                          onChange={(e) => setManualInviteCode(e.target.value)}
                          placeholder="Cole o codigo do convite"
                          className="input flex-1 text-sm"
                        />
                        <button
                          type="button"
                          onClick={handleValidateManualCode}
                          disabled={validatingManualCode || !manualInviteCode.trim()}
                          className="btn-primary px-4 py-2 text-sm whitespace-nowrap disabled:opacity-50"
                        >
                          {validatingManualCode ? <LoadingInline /> : 'Validar'}
                        </button>
                      </div>
                      {inviteError && (
                        <p className="text-red-500 text-xs">{inviteError}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className={`space-y-4${step === 0 ? ' hidden' : ''}`}>
                {/* Invite banner */}
                {step === 1 && inviteData && (
                  <div className="p-3.5 bg-primary/10 rounded-xl border border-primary/20 mb-2">
                    <p className="text-sm text-main font-medium">
                      Convite para <strong>{inviteData.orgName}</strong>
                    </p>
                    <p className="text-xs text-muted mt-0.5">
                      Cargo: {inviteData.role === 'admin' ? 'Administrador' : inviteData.role === 'manager' ? 'Gerente' : inviteData.role === 'viewer' ? 'Visualizador' : 'Membro'}
                    </p>
                  </div>
                )}

                {step === 1 && (<>
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
                      onChange={(e) => { if (!inviteData) setEmail(e.target.value) }}
                      required
                      readOnly={!!inviteData}
                      autoComplete="email"
                      className={`input${inviteData ? ' bg-surface-hover cursor-not-allowed opacity-70' : ''}`}
                      style={{ paddingLeft: '2.75rem' }}
                      placeholder="seu@email.com"
                    />
                  </div>
                  {inviteData && (
                    <p className="text-xs text-muted mt-1">Email vinculado ao convite (nao pode ser alterado)</p>
                  )}
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

                {/* CPF — apenas para funcionário */}
                {userType === 'funcionario' && (
                  <div>
                    <label htmlFor="cpf" className="block text-sm font-medium text-secondary mb-2">
                      CPF *
                    </label>
                    <div className="relative">
                      <FiUser className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted pointer-events-none" />
                      <input
                        id="cpf"
                        type="text"
                        inputMode="numeric"
                        value={cpf}
                        onChange={(e) => { setCpf(formatCpf(e.target.value)); setCpfError(null) }}
                        onBlur={() => {
                          if (cpf && !validateCpf(cpf)) setCpfError('CPF invalido. Verifique os digitos informados.')
                        }}
                        className={`input${cpfError ? ' ring-2 ring-red-500/50 border-red-500/50' : ''}`}
                        style={{ paddingLeft: '2.75rem' }}
                        placeholder="000.000.000-00"
                      />
                    </div>
                    {cpfError && <p className="text-red-500 text-xs mt-1">{cpfError}</p>}
                  </div>
                )}

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
                      minLength={8}
                      autoComplete="new-password"
                      className="input"
                      style={{ paddingLeft: '2.75rem', paddingRight: '2.75rem' }}
                      placeholder="Min 8 chars, maiuscula + numero"
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
                      minLength={8}
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

                </>)}

                {step === 2 && (<>
                {/* Nome da empresa */}
                <div>
                  <label className="block text-sm font-medium text-secondary mb-2">Nome da empresa *</label>
                  <div className="relative">
                    <FiBriefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted pointer-events-none" />
                    <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} required
                      className="input" style={{ paddingLeft: '2.75rem' }} placeholder="Nome do restaurante ou empresa" />
                  </div>
                </div>

                {/* CNPJ */}
                <div>
                  <label className="block text-sm font-medium text-secondary mb-2">CNPJ *</label>
                  <input
                    type="text"
                    value={cnpj}
                    onChange={e => { setCnpj(formatCnpj(e.target.value)); setCnpjError(null) }}
                    onBlur={() => {
                      if (!cnpj) { setCnpjError('CNPJ e obrigatorio.'); return }
                      if (!validateCnpj(cnpj)) setCnpjError('CNPJ invalido. Verifique os digitos informados.')
                    }}
                    className={`input${cnpjError ? ' ring-2 ring-red-500/50 border-red-500/50' : ''}`}
                    placeholder="00.000.000/0000-00"
                  />
                  {cnpjError && <p className="text-red-500 text-xs mt-1">{cnpjError}</p>}
                </div>

                {/* Tipo de empresa */}
                <div>
                  <label className="block text-sm font-medium text-secondary mb-2">Tipo de empresa</label>
                  <select value={businessType} onChange={e => setBusinessType(e.target.value)}
                    className="input">
                    <option value="">Selecione...</option>
                    <option value="restaurante">Restaurante</option>
                    <option value="bar">Bar</option>
                    <option value="lanchonete">Lanchonete</option>
                    <option value="padaria">Padaria</option>
                    <option value="hotel">Hotel</option>
                    <option value="industria">Industria Alimenticia</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>

                {/* Funcionarios */}
                <div>
                  <label className="block text-sm font-medium text-secondary mb-2">Quantidade de funcionarios</label>
                  <select value={employeeRange} onChange={e => setEmployeeRange(e.target.value)}
                    className="input">
                    <option value="">Selecione...</option>
                    <option value="1-10">1 a 10</option>
                    <option value="11-50">11 a 50</option>
                    <option value="51-200">51 a 200</option>
                    <option value="200+">Mais de 200</option>
                  </select>
                </div>

                {/* Cidade / Estado */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-secondary mb-2">Cidade</label>
                    <div className="relative">
                      <FiMapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted pointer-events-none" />
                      <input type="text" value={city} onChange={e => setCity(e.target.value)}
                        className="input" style={{ paddingLeft: '2.75rem' }} placeholder="Recife" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-secondary mb-2">UF</label>
                    <input type="text" value={state} onChange={e => setState(e.target.value.toUpperCase().slice(0, 2))}
                      className="input text-center" placeholder="PE" maxLength={2} />
                  </div>
                </div>
                </>)}

                {/* Error */}
                {error && (
                  <div className="p-3.5 bg-red-500/10 rounded-xl border border-red-500/20">
                    <p className="text-red-500 text-sm text-center">{error}</p>
                  </div>
                )}

                {/* Botoes */}
                {step === 1 ? (
                  <div className="flex gap-3">
                    {!inviteData && (
                      <button type="button" onClick={() => { setStep(0); setError(null) }}
                        className="btn-secondary py-3.5 px-4 flex items-center justify-center gap-2 text-[15px]">
                        <FiArrowLeft className="w-4 h-4" />
                      </button>
                    )}
                    <button type="button" onClick={handleNextStep} disabled={loading}
                      className="btn-primary flex-1 py-3.5 flex items-center justify-center gap-2 text-[15px] font-semibold shadow-lg shadow-primary/20">
                      {loading ? (<><LoadingInline /> Criando...</>) : userType === 'funcionario' ? 'Criar conta' : (<>Proximo <FiArrowRight className="w-4 h-4" /></>)}
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <button type="button" onClick={() => { setStep(1); setError(null) }}
                      className="btn-secondary flex-1 py-3.5 flex items-center justify-center gap-2 text-[15px]">
                      <FiArrowLeft className="w-4 h-4" /> Voltar
                    </button>
                    <button type="submit" disabled={loading}
                      className="btn-primary flex-1 py-3.5 flex items-center justify-center gap-2 text-[15px] font-semibold shadow-lg shadow-primary/20">
                      {loading ? (<><LoadingInline /> Criando...</>) : 'Criar conta'}
                    </button>
                  </div>
                )}
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
      </div>
    </div>
  )
}
