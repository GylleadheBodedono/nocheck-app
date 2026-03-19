'use client'

import { useState } from 'react'
import { FiClock, FiZap, FiMail, FiGlobe, FiSave, FiCheck } from 'react-icons/fi'

export default function PlatformConfigPage() {
  const [trialDays, setTrialDays] = useState(14)
  const [platformName, setPlatformName] = useState('OpereCheck')
  const [supportEmail, setSupportEmail] = useState('suporte@operecheck.com.br')
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-main">Configurações da Plataforma</h1>
        <p className="text-sm text-muted mt-1">Ajuste parâmetros globais que afetam todas as organizações</p>
      </div>

      {/* Trial */}
      <Section icon={FiClock} title="Trial" desc="Configurações do período de teste gratuito">
        <div>
          <label className="text-xs font-medium text-secondary mb-1.5 block">Dias de trial</label>
          <input type="number" value={trialDays} onChange={e => setTrialDays(Number(e.target.value))}
            className="input" />
          <p className="text-[11px] text-muted mt-1">Novos clientes terão {trialDays} dias grátis no plano Professional</p>
        </div>
      </Section>

      {/* Plataforma */}
      <Section icon={FiGlobe} title="Plataforma" desc="Informações básicas da plataforma">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-secondary mb-1.5 block">Nome da plataforma</label>
            <input type="text" value={platformName} onChange={e => setPlatformName(e.target.value)}
              className="input" />
          </div>
          <div>
            <label className="text-xs font-medium text-secondary mb-1.5 block">Email de suporte</label>
            <input type="email" value={supportEmail} onChange={e => setSupportEmail(e.target.value)}
              className="input" />
          </div>
        </div>
      </Section>

      {/* Email */}
      <Section icon={FiMail} title="Email" desc="Templates de email para notificações da plataforma">
        <div className="space-y-3 text-sm text-muted">
          <div className="flex items-center justify-between py-2 border-b border-subtle">
            <div>
              <p className="font-medium text-secondary">Boas-vindas</p>
              <p className="text-[11px] text-muted">Enviado quando um novo cliente cria conta</p>
            </div>
            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] font-semibold rounded-full">Ativo</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-subtle">
            <div>
              <p className="font-medium text-secondary">Trial expirando</p>
              <p className="text-[11px] text-muted">3 dias antes do fim do trial</p>
            </div>
            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] font-semibold rounded-full">Ativo</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="font-medium text-secondary">Pagamento falhou</p>
              <p className="text-[11px] text-muted">Quando uma cobrança é recusada</p>
            </div>
            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] font-semibold rounded-full">Ativo</span>
          </div>
        </div>
      </Section>

      {/* Planos */}
      <Section icon={FiZap} title="Planos" desc="Preços e limites de cada plano">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] text-muted uppercase tracking-wider border-b border-subtle">
                <th className="text-left py-2 font-medium">Plano</th>
                <th className="text-left py-2 font-medium">Preço</th>
                <th className="text-left py-2 font-medium">Usuários</th>
                <th className="text-left py-2 font-medium">Lojas</th>
              </tr>
            </thead>
            <tbody className="text-secondary">
              <tr className="border-b border-subtle">
                <td className="py-2.5"><span className="px-2 py-0.5 bg-amber-50 text-amber-600 text-[10px] font-bold rounded-full uppercase">Trial</span></td>
                <td className="py-2.5">Grátis</td><td className="py-2.5">3</td><td className="py-2.5">1</td>
              </tr>
              <tr className="border-b border-subtle">
                <td className="py-2.5"><span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-full uppercase">Starter</span></td>
                <td className="py-2.5">R$ 297/mês</td><td className="py-2.5">5</td><td className="py-2.5">3</td>
              </tr>
              <tr className="border-b border-subtle">
                <td className="py-2.5"><span className="px-2 py-0.5 bg-teal-50 text-teal-600 text-[10px] font-bold rounded-full uppercase">Professional</span></td>
                <td className="py-2.5">R$ 597/mês</td><td className="py-2.5">15</td><td className="py-2.5">10</td>
              </tr>
              <tr>
                <td className="py-2.5"><span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-full uppercase">Enterprise</span></td>
                <td className="py-2.5">R$ 997/mês</td><td className="py-2.5">Ilimitado</td><td className="py-2.5">Ilimitado</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      {/* Save */}
      <div className="flex justify-end">
        <button onClick={handleSave}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
            saved
              ? 'bg-emerald-500 text-white'
              : 'btn-primary'
          }`}>
          {saved ? <><FiCheck className="w-4 h-4" /> Salvo!</> : <><FiSave className="w-4 h-4" /> Salvar Configurações</>}
        </button>
      </div>
    </div>
  )
}

function Section({ icon: Icon, title, desc, children }: { icon: React.ElementType; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="card p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-main">{title}</h2>
          <p className="text-[11px] text-muted">{desc}</p>
        </div>
      </div>
      {children}
    </div>
  )
}
