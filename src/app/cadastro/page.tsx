'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { APP_CONFIG } from '@/lib/config'
import { ThemeToggle, LoadingInline } from '@/components/ui'
import { FiLock, FiMail, FiUser, FiPhone, FiCheckCircle } from 'react-icons/fi'

export default function CadastroPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

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
          setError('Este email ja esta cadastrado. Tente fazer login.')
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

  if (success) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center p-4">
        <div className="card p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-6">
            <FiCheckCircle className="w-10 h-10 text-success" />
          </div>
          <h1 className="text-2xl font-bold text-main mb-2">
            Verifique seu email
          </h1>
          <p className="text-muted mb-8">
            Enviamos um link de confirmacao para <strong className="text-main">{email}</strong>. Clique no link para ativar sua conta.
          </p>
          <Link
            href={APP_CONFIG.routes.login}
            className="btn-primary inline-flex items-center gap-2 px-6 py-3 text-base"
          >
            Voltar para Login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen w-screen p-4">
      <div className="h-full w-full flex overflow-hidden">

        {/* Left Side - Decorative Panel */}
        <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden rounded-[20px]">
          <div className="absolute inset-0 bg-gradient-to-br from-[#B8935A] via-[#8B6E3B] to-[#2C1810] animate-gradient" />
          <div className="absolute inset-0 opacity-30"
            style={{
              backgroundImage: `radial-gradient(at 20% 30%, rgba(255,255,255,0.15) 0%, transparent 50%),
                                radial-gradient(at 80% 70%, rgba(196,122,74,0.3) 0%, transparent 50%),
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
                  <span className="text-white font-bold text-lg">N</span>
                </div>
                <span className="text-white/90 font-semibold text-lg tracking-tight">NoCheck</span>
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
                  <Image
                    src="/Logo-dark.png"
                    alt={APP_CONFIG.name}
                    width={300}
                    height={75}
                    className="logo-for-light"
                    priority
                  />
                  <Image
                    src="/Logo.png"
                    alt={APP_CONFIG.name}
                    width={300}
                    height={75}
                    className="logo-for-dark"
                    priority
                  />
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

                {/* Confirmar Senha */}
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-secondary mb-2">
                    Confirmar senha
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
                      placeholder="Repita a senha"
                    />
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
                Ja tem conta?{' '}
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
          <div className="lg:hidden h-1.5 mx-6 mb-6 rounded-full bg-gradient-to-r from-[#B8935A] via-[#C47A4A] to-[#8B6E3B] opacity-60" />
        </div>
      </div>
    </div>
  )
}
