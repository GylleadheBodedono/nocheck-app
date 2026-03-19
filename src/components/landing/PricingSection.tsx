'use client'

import { useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import Link from 'next/link'
import { FiCheck } from 'react-icons/fi'
import { PLAN_CONFIGS } from '@/types/tenant'
import { TRIAL_DAYS } from '@/lib/plans'
import { AnimatedTitle, TitleWord } from './AnimatedTitle'
import { easeOut } from './animations'

const FEATURE_LABELS: Record<string, string> = {
  basic_orders: 'Checklists ilimitados',
  basic_reports: 'Relatórios básicos',
  cancellations: 'Gestão de não-conformidades',
  kpi_dashboard: 'Painel de indicadores (KPI)',
  bi_dashboard: 'Dashboard avançado de BI',
  export_excel: 'Exportar para Excel',
  export_pdf: 'Exportar para PDF',
  integrations_ifood: 'Integração com iFood',
  integrations_teknisa: 'Integração com Teknisa',
  white_label: 'Sua marca personalizada',
  api_access: 'Acesso à API',
  custom_domain: 'Domínio personalizado',
  audit_logs: 'Registro de auditoria',
  advanced_analytics: 'Análises avançadas',
}

const PLAN_DESCRIPTIONS: Record<string, string> = {
  starter: 'Ideal para pequenas operações que estão começando',
  professional: 'Para operações em crescimento com múltiplas lojas',
  enterprise: 'Controle total com personalização completa',
}

const PLAN_LIMITS: Record<string, string> = {
  starter: 'Até 5 usuários · 3 lojas',
  professional: 'Até 15 usuários · 10 lojas',
  enterprise: 'Usuários e lojas ilimitados',
}

const plans = [
  { key: 'starter' as const, popular: false },
  { key: 'professional' as const, popular: true },
  { key: 'enterprise' as const, popular: false },
]

export function PricingSection() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })
  const [annual, setAnnual] = useState(false)

  return (
    <section id="precos" ref={ref} className="py-32 px-6 relative">
      <div className="max-w-6xl mx-auto">
        <AnimatedTitle label="Preços" className="mb-16">
          <TitleWord word="Planos" delay={0.1} />
          <TitleWord word="simples" delay={0.22} gradient />
        </AnimatedTitle>

        {/* Toggle anual/mensal */}
        <div className="flex items-center justify-center gap-4 mb-12">
          <span className={`text-sm ${!annual ? 'text-white' : 'text-white/40'}`}>Mensal</span>
          <button onClick={() => setAnnual(!annual)}
            className={`w-12 h-6 rounded-full transition-colors relative ${annual ? 'bg-[#0D9488]' : 'bg-white/10'}`}>
            <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${annual ? 'translate-x-[26px]' : 'translate-x-0.5'}`} />
          </button>
          <span className={`text-sm ${annual ? 'text-white' : 'text-white/40'}`}>
            Anual <span className="text-[#0D9488] text-xs font-semibold">-20%</span>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 ">
          {plans.map(({ key, popular }, i) => {
            const config = PLAN_CONFIGS[key]
            const price = annual ? Math.round(config.price * 0.8) : config.price

            return (
              <motion.div
                key={key}
                initial={{ opacity: 80, y: 40 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.7, delay: 0.1 + i * 0.15, ease: easeOut }}
                className={`relative rounded-2xl border p-8 ${
                  popular
                    ? 'border-[#0D9488]/30 bg-gradient-to-b from-[#0D9488]/[0.36] to-transparent'
                    : 'border-white/[0.06] bg-white/4 backdrop-blur-2xl border  rounded-2xl shadow-lg shadow-black/10 '

                    
                }`}
              >
                {popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#0D9488] text-black text-[11px] font-bold rounded-full uppercase">
                    Mais Popular
                  </span>
                )}

                <h3 className="text-lg font-bold text-white capitalize mb-1">{config.name}</h3>
                <p className="text-sm text-white/50 mb-4">{PLAN_DESCRIPTIONS[key]}</p>

                <div className="mb-6">
                  <span className="text-4xl font-bold text-white">R$ {price}</span>
                  <span className="text-white/40 text-sm">/{annual ? 'ano' : 'mês'}</span>
                </div>

                <p className="text-sm text-white/50 mb-6">
                  {PLAN_LIMITS[key]}
                </p>

                <Link href="/cadastro"
                  className={`block w-full py-3 rounded-xl text-center text-sm font-semibold transition-all ${
                    popular
                      ? 'bg-[#0D9488] text-black hover:bg-[#0F766E]'
                      : 'bg-white/5 text-white border border-white/10 hover:bg-white/10'
                  }`}>
                  Começar {TRIAL_DAYS} dias grátis
                </Link>

                <ul className="mt-8 space-y-3">
                  {config.features.map(f => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-white/70">
                      <FiCheck className="w-4 h-4 text-[#0D9488]/40 shrink-0" />
                      <span>{FEATURE_LABELS[f] || f.replace(/_/g, ' ')}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
