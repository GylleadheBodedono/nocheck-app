'use client'

import { FiMail, FiMessageCircle, FiBook, FiZap, FiExternalLink, FiCheckCircle } from 'react-icons/fi'

const FAQ = [
  {
    q: 'Como ativar o plano de um cliente manualmente?',
    a: 'Vá em Clientes → selecione o cliente → aba Billing → altere o plano diretamente. O Stripe será sincronizado pelo webhook.',
  },
  {
    q: 'Por que um cliente não consegue acessar a plataforma?',
    a: 'Verifique se a organização está ativa (is_active = true) e se o trial não expirou. Em Clientes → selecione o cliente para ver o status.',
  },
  {
    q: 'Como criar um novo usuário platform admin?',
    a: 'Acesse o Supabase Dashboard → Authentication → Users → edite o usuário e adicione is_platform_admin: true em raw_user_meta_data.',
  },
  {
    q: 'O cliente perdeu acesso após mudança de plano. O que fazer?',
    a: 'Se o downgrade foi aplicado antes do fim do período, verifique pending_plan e current_period_end na tabela organizations. Use o cron /api/cron/apply-pending-downgrades se necessário.',
  },
  {
    q: 'Como resetar a senha de um usuário de um cliente?',
    a: 'Acesse o Supabase Dashboard → Authentication → Users → encontre o usuário pelo email → Send password reset.',
  },
]

function Section({ icon: Icon, title, desc, children }: { icon: React.ElementType; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-main">{title}</h2>
          <p className="text-xs text-muted mt-0.5">{desc}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

export default function SuportePageClient() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-main">Suporte</h1>
        <p className="text-sm text-muted mt-1">Recursos e canais para resolver problemas da plataforma</p>
      </div>

      {/* Canais de contato */}
      <Section icon={FiMessageCircle} title="Canais de Contato" desc="Entre em contato com a equipe OpereCheck">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <a
            href="mailto:suporte@operecheck.com.br"
            className="flex items-center gap-3 p-4 rounded-xl border border-subtle hover:border-primary/40 hover:bg-primary/5 transition-all group"
          >
            <div className="w-9 h-9 rounded-lg bg-surface-hover flex items-center justify-center shrink-0">
              <FiMail className="w-4 h-4 text-muted group-hover:text-primary transition-colors" />
            </div>
            <div>
              <p className="text-sm font-medium text-main">Email</p>
              <p className="text-xs text-muted">suporte@operecheck.com.br</p>
            </div>
          </a>

          <a
            href="https://wa.me/5511999999999"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-4 rounded-xl border border-subtle hover:border-primary/40 hover:bg-primary/5 transition-all group"
          >
            <div className="w-9 h-9 rounded-lg bg-surface-hover flex items-center justify-center shrink-0">
              <FiMessageCircle className="w-4 h-4 text-muted group-hover:text-primary transition-colors" />
            </div>
            <div>
              <p className="text-sm font-medium text-main">WhatsApp</p>
              <p className="text-xs text-muted">Atendimento em horário comercial</p>
            </div>
          </a>
        </div>
      </Section>

      {/* Links rápidos */}
      <Section icon={FiBook} title="Recursos Técnicos" desc="Acesso rápido às ferramentas de administração">
        <div className="space-y-2">
          {[
            { label: 'Supabase Dashboard', url: 'https://supabase.com/dashboard', desc: 'Banco de dados, auth e storage' },
            { label: 'Stripe Dashboard', url: 'https://dashboard.stripe.com', desc: 'Assinaturas, pagamentos e webhooks' },
            { label: 'Vercel / Cloudflare Pages', url: 'https://dash.cloudflare.com', desc: 'Deploys e logs da aplicação' },
          ].map(item => (
            <a
              key={item.label}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 rounded-xl border border-subtle hover:border-primary/40 hover:bg-primary/5 transition-all group"
            >
              <div>
                <p className="text-sm font-medium text-main">{item.label}</p>
                <p className="text-xs text-muted">{item.desc}</p>
              </div>
              <FiExternalLink className="w-3.5 h-3.5 text-muted group-hover:text-primary transition-colors shrink-0" />
            </a>
          ))}
        </div>
      </Section>

      {/* Status da plataforma */}
      <Section icon={FiZap} title="Status da Plataforma" desc="Indicadores de saúde do sistema">
        <div className="space-y-2">
          {[
            { label: 'API / Backend', status: 'ok' },
            { label: 'Banco de Dados (Supabase)', status: 'ok' },
            { label: 'Pagamentos (Stripe)', status: 'ok' },
            { label: 'Email (Resend)', status: 'ok' },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between py-2 border-b border-subtle last:border-0">
              <span className="text-sm text-secondary">{item.label}</span>
              <div className="flex items-center gap-1.5">
                <FiCheckCircle className="w-3.5 h-3.5 text-success" />
                <span className="text-xs text-success font-medium">Operacional</span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* FAQ */}
      <Section icon={FiBook} title="FAQ — Problemas Comuns" desc="Respostas para situações frequentes de suporte">
        <div className="space-y-4">
          {FAQ.map((item, i) => (
            <div key={i} className="border-b border-subtle last:border-0 pb-4 last:pb-0">
              <p className="text-sm font-medium text-main mb-1">{item.q}</p>
              <p className="text-xs text-muted leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}
