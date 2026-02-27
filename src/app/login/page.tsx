'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { APP_CONFIG } from '@/lib/config'
import { ThemeToggle, LoadingInline } from '@/components/ui'
import { triggerPrecache } from '@/hooks/usePrecache'
import { cacheAllDataForOffline } from '@/lib/offlineCache'
import { FiLock, FiMail } from 'react-icons/fi'

function LoginForm() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string>('')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash
      if (hash && (hash.includes('type=signup') || hash.includes('type=invite'))) {
        window.location.href = '/auth/confirmed'
        return
      }
    }
  }, [])

  useEffect(() => {
    const errorParam = searchParams.get('error')
    const messageParam = searchParams.get('message')
    if (errorParam) setError(decodeURIComponent(errorParam))
    if (messageParam) setSuccessMsg(decodeURIComponent(messageParam))
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    setStatus('Autenticando...')

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        if (error.message.includes('Invalid login')) {
          setError(APP_CONFIG.messages.loginError)
        } else {
          setError(error.message)
        }
        setLoading(false)
        setStatus('')
        return
      }

      setStatus('Verificando sessao...')
      const { data: session } = await supabase.auth.getSession()

      if (session?.session) {
        setStatus('Salvando dados para modo offline...')
        try {
          await cacheAllDataForOffline(session.session.user.id)
        } catch (err) {
          console.error('[Login] Erro ao cachear dados:', err)
        }

        setStatus('Preparando aplicacao offline...')
        try {
          await triggerPrecache()
        } catch (err) {
          console.error('[Login] Erro no precache:', err)
        }

        setStatus('Redirecionando...')
        window.location.href = APP_CONFIG.routes.dashboard
      } else {
        window.location.href = APP_CONFIG.routes.dashboard
      }
    } catch {
      setError(APP_CONFIG.messages.loginErrorGeneric)
      setLoading(false)
      setStatus('')
    }
  }

  return (
    <div className="h-screen w-screen p-4">
      <div className="h-full w-full flex  overflow-hidden">

        {/* Left Side - Decorative Panel */}
        <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden rounded-[20px]">
          {/* Animated gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#B8935A] via-[#8B6E3B] to-[#2C1810] animate-gradient" />

          {/* Mesh overlay */}
          <div className="absolute inset-0 opacity-30"
            style={{
              backgroundImage: `radial-gradient(at 20% 30%, rgba(255,255,255,0.15) 0%, transparent 50%),
                                radial-gradient(at 80% 70%, rgba(196,122,74,0.3) 0%, transparent 50%),
                                radial-gradient(at 50% 10%, rgba(255,255,255,0.1) 0%, transparent 40%)`
            }}
          />

          {/* Floating glass orbs */}
          <div className="absolute top-[15%] left-[10%] w-64 h-64 rounded-full bg-white/5 backdrop-blur-3xl border border-white/10 animate-float-slow" />
          <div className="absolute bottom-[20%] right-[15%] w-48 h-48 rounded-full bg-white/5 backdrop-blur-3xl border border-white/10 animate-float-delayed" />
          <div className="absolute top-[60%] left-[30%] w-32 h-32 rounded-full bg-white/8 backdrop-blur-3xl border border-white/5 animate-float-slow-reverse" />

          {/* Grain texture overlay */}
          <div className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            }}
          />

          {/* Content */}
          <div className="relative z-10 flex flex-col justify-between p-12 w-full">
            {/* Top */}
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                  <span className="text-white font-bold text-lg">N</span>
                </div>
                <span className="text-white/90 font-semibold text-lg tracking-tight">NoCheck</span>
              </div>
            </div>

            {/* Center */}
            <div className="max-w-md">
              <h1 className="text-5xl xl:text-6xl font-bold text-white leading-[1.1] tracking-tight mb-6">
                Gestao
                <br />
                inteligente
                <br />
                <span className="text-white/50">de checklists</span>
              </h1>
              <p className="text-white/60 text-lg leading-relaxed max-w-sm">
                Controle completo das operacoes da sua empresa com checklists digitais, validacoes e planos de acao.
              </p>
            </div>

            {/* Bottom stats */}
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

        {/* Right Side - Login Form */}
        <div className="flex-1 flex flex-col relative bg-page rounded-[20px] ">
          {/* Theme toggle */}
          <div className="absolute top-5 right-5 z-10">
            <ThemeToggle />
          </div>

          {/* Form container */}
          <div className="flex-1 flex items-center rounded-[20px] justify-center px-6 sm:px-12 lg:px-16">
            <div className="w-full max-w-[400px]">
              {/* Logo */}
              <div className="mb-10">
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
                  Entre com suas credenciais para acessar o painel
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-5">
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

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="password" className="block text-sm font-medium text-secondary">
                      Senha
                    </label>
                    <Link href={APP_CONFIG.routes.esqueciSenha} className="text-sm text-primary hover:underline">
                      Esqueci minha senha
                    </Link>
                  </div>
                  <div className="relative">
                    <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted pointer-events-none" />
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      className="input"
                      style={{ paddingLeft: '2.75rem' }}
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                {/* Success */}
                {successMsg && (
                  <div className="p-3.5 bg-success/10 rounded-xl border border-success/20">
                    <p className="text-success text-sm text-center">{successMsg}</p>
                  </div>
                )}

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
                      {status || 'Entrando...'}
                    </>
                  ) : (
                    'Entrar'
                  )}
                </button>
              </form>

              {/* Link para cadastro */}
              <p className="text-center text-sm text-muted mt-6">
                Nao tem conta?{' '}
                <Link href={APP_CONFIG.routes.cadastro} className="text-primary font-medium hover:underline">
                  Criar conta
                </Link>
              </p>

              {/* Footer */}
              <p className="text-center text-muted text-xs mt-10">
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

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="h-screen w-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="w-8 h-8 border-2 border-[#B8935A] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
