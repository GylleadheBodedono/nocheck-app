'use client'

import { useRef, useState } from 'react'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import { FiChevronDown } from 'react-icons/fi'
import { AnimatedTitle, TitleWord } from './AnimatedTitle'
import { easeOut } from './animations'
import { TRIAL_DAYS } from '@/lib/plans'

const faqs = [
  {
    q: 'O que e o OpereCheck?',
    a: 'O OpereCheck e um sistema de checklists digitais para restaurantes e redes de alimentacao. Substitui formularios em papel por checklists interativos com fotos, assinaturas, GPS e planos de acao automaticos.',
  },
  {
    q: 'Como funciona o trial gratuito?',
    a: `Voce tem ${TRIAL_DAYS} dias para testar todas as funcionalidades do plano Professional sem precisar de cartao de credito. Ao final do periodo, pode escolher um plano pago ou continuar no plano gratuito com funcoes basicas.`,
  },
  {
    q: 'Posso cancelar a qualquer momento?',
    a: 'Sim! Nao ha fidelidade ou multa. Voce pode cancelar pelo portal de assinatura e continuara tendo acesso ate o fim do periodo pago.',
  },
  {
    q: 'Os dados ficam seguros?',
    a: 'Sim. Usamos Supabase (infraestrutura baseada em PostgreSQL) com Row Level Security, criptografia em transito (TLS) e backups automaticos. Cada organizacao tem seus dados completamente isolados.',
  },
  {
    q: 'Funciona no celular?',
    a: 'Sim! O OpereCheck e uma PWA (Progressive Web App) que funciona como um app nativo no celular. Funciona ate offline — os dados sao sincronizados quando a conexao voltar.',
  },
  {
    q: 'Posso personalizar os checklists?',
    a: 'Totalmente. Voce cria templates com campos de texto, fotos, Sim/Nao, assinaturas, GPS, calculos automaticos, e muito mais. Pode definir horarios permitidos, regras de nao-conformidade e planos de acao automaticos.',
  },
  {
    q: 'Quantas lojas posso ter?',
    a: 'Depende do plano: Starter ate 3 lojas, Professional ate 10, e Enterprise ilimitado. Cada loja pode ter setores, funcionarios e checklists independentes.',
  },
]

export function FAQSection() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })
  const [open, setOpen] = useState<number | null>(null)

  return (
    <section id="faq" ref={ref} className="py-32 px-6">
      <div className="max-w-3xl mx-auto">
        <AnimatedTitle label="Duvidas" className="mb-16">
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
