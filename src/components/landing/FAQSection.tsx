'use client'

import { useRef, useState } from 'react'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import { FiChevronDown } from 'react-icons/fi'
import { AnimatedTitle, TitleWord } from './AnimatedTitle'
import { easeOut } from './animations'
import { TRIAL_DAYS } from '@/lib/plans'

const faqs = [
  {
    q: 'O que é o OpereCheck?',
    a: 'O OpereCheck é um sistema de checklists digitais para restaurantes e redes de alimentação. Substitui formulários em papel por checklists interativos com fotos, assinaturas, GPS e planos de ação automáticos.',
  },
  {
    q: 'Como funciona o trial gratuito?',
    a: `Você tem ${TRIAL_DAYS} dias para testar todas as funcionalidades do plano Professional sem precisar de cartão de crédito. Ao final do período, pode escolher um plano pago ou continuar no plano gratuito com funções básicas.`,
  },
  {
    q: 'Posso cancelar a qualquer momento?',
    a: 'Sim! Não há fidelidade ou multa. Você pode cancelar pelo portal de assinatura e continuará tendo acesso até o fim do período pago.',
  },
  {
    q: 'Os dados ficam seguros?',
    a: 'Sim. Usamos Supabase (infraestrutura baseada em PostgreSQL) com Row Level Security, criptografia em trânsito (TLS) e backups automáticos. Cada organização tem seus dados completamente isolados.',
  },
  {
    q: 'Funciona no celular?',
    a: 'Sim! O OpereCheck é uma PWA (Progressive Web App) que funciona como um app nativo no celular. Funciona até offline — os dados são sincronizados quando a conexão voltar.',
  },
  {
    q: 'Posso personalizar os checklists?',
    a: 'Totalmente. Você cria templates com campos de texto, fotos, Sim/Não, assinaturas, GPS, cálculos automáticos, e muito mais. Pode definir horários permitidos, regras de não-conformidade e planos de ação automáticos.',
  },
  {
    q: 'Quantas lojas posso ter?',
    a: 'Depende do plano: Starter até 3 lojas, Professional até 10, e Enterprise ilimitado. Cada loja pode ter setores, funcionários e checklists independentes.',
  },
]

export function FAQSection() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })
  const [open, setOpen] = useState<number | null>(null)

  return (
    <section id="faq" ref={ref} className="py-32 px-6">
      <div className="max-w-3xl mx-auto">
        <AnimatedTitle label="Dúvidas" className="mb-16">
          <TitleWord word="Perguntas" delay={0.1} />
          <TitleWord word="frequentes" delay={0.22} gradient />
        </AnimatedTitle>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.1 + i * 0.08, ease: easeOut }}
              className="rounded-xl border border-white/[0.06] overflow-hidden"
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-white/[0.02] transition-colors"
              >
                <span className="text-sm font-medium text-white/90">{faq.q}</span>
                <FiChevronDown className={`w-4 h-4 text-white/40 transition-transform ${open === i ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {open === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: easeOut }}
                    className="overflow-hidden"
                  >
                    <p className="px-6 pb-5 text-sm text-white/50 leading-relaxed">{faq.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
