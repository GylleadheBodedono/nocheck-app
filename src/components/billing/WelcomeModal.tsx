'use client'

import { FiZap, FiCreditCard, FiCheck, FiClock } from 'react-icons/fi'

type Props = {
  onTrial: () => void
  onSubscribe: () => void
}

export function WelcomeModal({ onTrial, onSubscribe }: Props) {
  return (
    <div className="min-h-screen bg-page flex items-center justify-center p-4">
      <div className="card p-8 max-w-lg w-full text-center">
        {/* Icon */}
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <FiCheck className="w-10 h-10 text-primary" />
        </div>

        <h1 className="text-2xl font-bold text-main mb-2">
          Conta criada com sucesso!
        </h1>
        <p className="text-muted mb-8">
          Escolha como deseja começar a usar o OpereCheck
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Trial */}
          <button
            onClick={onTrial}
            className="group p-6 rounded-2xl border-2 border-subtle hover:border-primary bg-surface hover:bg-primary/5 transition-all text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
              <FiClock className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-base font-bold text-main mb-1">
              Testar 14 dias grátis
            </h3>
            <p className="text-xs text-muted leading-relaxed">
              Explore o sistema sem compromisso. Sem cartão de crédito.
            </p>
            <ul className="mt-3 space-y-1.5">
              <li className="flex items-center gap-1.5 text-xs text-secondary">
                <FiCheck className="w-3 h-3 text-success shrink-0" />
                Até 3 usuários
              </li>
              <li className="flex items-center gap-1.5 text-xs text-secondary">
                <FiCheck className="w-3 h-3 text-success shrink-0" />
                1 loja
              </li>
              <li className="flex items-center gap-1.5 text-xs text-secondary">
                <FiCheck className="w-3 h-3 text-success shrink-0" />
                Checklists e relatórios
              </li>
            </ul>
          </button>

          {/* Subscribe */}
          <button
            onClick={onSubscribe}
            className="group p-6 rounded-2xl border-2 border-accent bg-accent/5 hover:bg-accent/10 transition-all text-left relative overflow-hidden"
          >
            <div className="absolute top-3 right-3">
              <span className="px-2 py-0.5 bg-accent text-white text-[10px] font-bold rounded-full uppercase">
                Recomendado
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors">
              <FiZap className="w-6 h-6 text-accent" />
            </div>
            <h3 className="text-base font-bold text-main mb-1">
              Assinar agora
            </h3>
            <p className="text-xs text-muted leading-relaxed">
              Desbloqueie todos os recursos e escale seu negócio.
            </p>
            <ul className="mt-3 space-y-1.5">
              <li className="flex items-center gap-1.5 text-xs text-secondary">
                <FiCreditCard className="w-3 h-3 text-accent shrink-0" />
                A partir de R$ 297/mês
              </li>
              <li className="flex items-center gap-1.5 text-xs text-secondary">
                <FiCheck className="w-3 h-3 text-success shrink-0" />
                Até 999 usuários
              </li>
              <li className="flex items-center gap-1.5 text-xs text-secondary">
                <FiCheck className="w-3 h-3 text-success shrink-0" />
                Todas as integrações
              </li>
            </ul>
          </button>
        </div>
      </div>
    </div>
  )
}
