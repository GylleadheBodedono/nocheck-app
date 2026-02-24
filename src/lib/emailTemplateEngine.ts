/**
 * Engine de templates de email configuravel pelo admin.
 * Substitui placeholders {{variavel}} por valores reais.
 */

// ============================================
// TIPOS
// ============================================

export type EmailTemplateVariables = {
  plan_title: string
  field_name: string
  store_name: string
  sector_name: string
  template_name: string
  respondent_name: string
  respondent_time: string
  assignee_name: string
  severity: string
  severity_label: string
  severity_color: string
  deadline: string
  non_conformity_value: string
  description: string
  plan_url: string
  plan_id: string
  is_reincidencia: string
  reincidencia_count: string
  reincidencia_prefix: string
  app_name: string
}

type TemplateVariableMeta = {
  key: keyof EmailTemplateVariables
  label: string
  description: string
  example: string
}

// ============================================
// VARIAVEIS DISPONIVEIS (para UI do admin)
// ============================================

export const TEMPLATE_VARIABLES: TemplateVariableMeta[] = [
  { key: 'plan_title', label: 'Titulo do Plano', description: 'Titulo gerado para o plano de acao', example: 'Nao conformidade: Higienizar maos - Loja Centro' },
  { key: 'field_name', label: 'Nome do Campo', description: 'Campo do checklist que disparou a nao conformidade', example: 'Higienizar maos e vestir uniforme completo' },
  { key: 'store_name', label: 'Loja', description: 'Nome da loja onde ocorreu', example: 'Loja Centro' },
  { key: 'sector_name', label: 'Setor', description: 'Setor da loja (pode estar vazio)', example: 'Cozinha' },
  { key: 'template_name', label: 'Template', description: 'Nome do template/checklist preenchido', example: 'Checklist Diario — Cozinha' },
  { key: 'respondent_name', label: 'Respondente', description: 'Nome de quem preencheu o checklist', example: 'Joao Silva' },
  { key: 'respondent_time', label: 'Data/Hora', description: 'Data e hora do preenchimento do checklist', example: '24/02/2026 14:30' },
  { key: 'assignee_name', label: 'Responsavel', description: 'Nome do responsavel pelo plano de acao', example: 'Maria Souza' },
  { key: 'severity', label: 'Severidade', description: 'Nivel de severidade (baixa, media, alta, critica)', example: 'alta' },
  { key: 'severity_label', label: 'Severidade (Label)', description: 'Severidade capitalizada', example: 'Alta' },
  { key: 'severity_color', label: 'Cor da Severidade', description: 'Codigo hex da cor (para uso no HTML)', example: '#f97316' },
  { key: 'deadline', label: 'Prazo', description: 'Data limite formatada', example: '01/03/2026' },
  { key: 'non_conformity_value', label: 'Valor Nao Conforme', description: 'Resposta que gerou a nao conformidade', example: 'Nao' },
  { key: 'description', label: 'Descricao', description: 'Descricao da condicao/plano', example: 'Funcionario nao higienizou as maos ao iniciar turno' },
  { key: 'plan_url', label: 'URL do Plano', description: 'Link completo para acessar o plano', example: 'https://app.nocheck.com/admin/planos-de-acao/42' },
  { key: 'plan_id', label: 'ID do Plano', description: 'Numero identificador do plano', example: '42' },
  { key: 'is_reincidencia', label: 'Reincidencia?', description: '"Sim" ou "Nao"', example: 'Sim' },
  { key: 'reincidencia_count', label: 'Qtd Reincidencias', description: 'Numero de ocorrencias anteriores', example: '3' },
  { key: 'reincidencia_prefix', label: 'Prefixo Reincidencia', description: '"REINCIDENCIA - " ou vazio', example: 'REINCIDENCIA - ' },
  { key: 'app_name', label: 'Nome do App', description: 'Nome do sistema', example: 'NoCheck' },
]

// ============================================
// CORES DE SEVERIDADE
// ============================================

export const SEVERITY_COLORS: Record<string, string> = {
  baixa: '#22c55e',
  media: '#f59e0b',
  alta: '#f97316',
  critica: '#ef4444',
}

// ============================================
// TEMPLATES PADRAO
// ============================================

export const DEFAULT_ACTION_PLAN_EMAIL_SUBJECT = '[NoCheck] {{reincidencia_prefix}}Plano de Acao: {{field_name}}'

export const DEFAULT_ACTION_PLAN_EMAIL_HTML = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; padding: 20px; margin: 0;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <!-- Header com cor da severidade -->
    <div style="background: {{severity_color}}; padding: 24px; color: white;">
      <h1 style="margin: 0; font-size: 20px; font-weight: 700;">Plano de Acao {{reincidencia_prefix}}</h1>
      <p style="margin: 6px 0 0; opacity: 0.9; font-size: 14px;">Severidade: {{severity_label}}</p>
    </div>

    <!-- Corpo -->
    <div style="padding: 28px 24px;">
      <h2 style="margin: 0 0 20px; color: #1e293b; font-size: 18px; font-weight: 700;">{{plan_title}}</h2>

      <!-- Tabela de detalhes -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <tr>
          <td style="padding: 10px 12px; color: #64748b; font-size: 13px; border-bottom: 1px solid #f1f5f9; width: 140px;">Respondente:</td>
          <td style="padding: 10px 12px; color: #1e293b; font-size: 14px; font-weight: 600; border-bottom: 1px solid #f1f5f9;">{{respondent_name}}</td>
        </tr>
        <tr>
          <td style="padding: 10px 12px; color: #64748b; font-size: 13px; border-bottom: 1px solid #f1f5f9;">Data/Hora:</td>
          <td style="padding: 10px 12px; color: #1e293b; font-size: 14px; border-bottom: 1px solid #f1f5f9;">{{respondent_time}}</td>
        </tr>
        <tr>
          <td style="padding: 10px 12px; color: #64748b; font-size: 13px; border-bottom: 1px solid #f1f5f9;">Template:</td>
          <td style="padding: 10px 12px; color: #1e293b; font-size: 14px; border-bottom: 1px solid #f1f5f9;">{{template_name}}</td>
        </tr>
        <tr>
          <td style="padding: 10px 12px; color: #64748b; font-size: 13px; border-bottom: 1px solid #f1f5f9;">Campo:</td>
          <td style="padding: 10px 12px; color: #1e293b; font-size: 14px; font-weight: 600; border-bottom: 1px solid #f1f5f9;">{{field_name}}</td>
        </tr>
        <tr>
          <td style="padding: 10px 12px; color: #64748b; font-size: 13px; border-bottom: 1px solid #f1f5f9;">Valor:</td>
          <td style="padding: 10px 12px; color: #ef4444; font-size: 14px; font-weight: 600; border-bottom: 1px solid #f1f5f9;">{{non_conformity_value}}</td>
        </tr>
        <tr>
          <td style="padding: 10px 12px; color: #64748b; font-size: 13px; border-bottom: 1px solid #f1f5f9;">Loja:</td>
          <td style="padding: 10px 12px; color: #1e293b; font-size: 14px; border-bottom: 1px solid #f1f5f9;">{{store_name}}</td>
        </tr>
        <tr>
          <td style="padding: 10px 12px; color: #64748b; font-size: 13px; border-bottom: 1px solid #f1f5f9;">Setor:</td>
          <td style="padding: 10px 12px; color: #1e293b; font-size: 14px; border-bottom: 1px solid #f1f5f9;">{{sector_name}}</td>
        </tr>
        <tr>
          <td style="padding: 10px 12px; color: #64748b; font-size: 13px; border-bottom: 1px solid #f1f5f9;">Responsavel:</td>
          <td style="padding: 10px 12px; color: #1e293b; font-size: 14px; font-weight: 600; border-bottom: 1px solid #f1f5f9;">{{assignee_name}}</td>
        </tr>
        <tr>
          <td style="padding: 10px 12px; color: #64748b; font-size: 13px;">Prazo:</td>
          <td style="padding: 10px 12px; color: #1e293b; font-size: 14px; font-weight: 600;">{{deadline}}</td>
        </tr>
      </table>

      <!-- Descricao -->
      <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">{{description}}</p>

      <!-- CTA -->
      <a href="{{plan_url}}" style="display: inline-block; background: {{severity_color}}; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
        Ver Plano de Acao
      </a>
    </div>

    <!-- Footer -->
    <div style="padding: 16px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
      <p style="margin: 0; color: #94a3b8; font-size: 12px;">{{app_name}} - Sistema de Checklists</p>
    </div>
  </div>
</body>
</html>`

// ============================================
// FUNCOES
// ============================================

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Variaveis que contem HTML/URLs e NAO devem ser escapadas
const RAW_VARIABLES = new Set<string>(['severity_color', 'plan_url', 'reincidencia_prefix'])

export function replaceTemplatePlaceholders(
  template: string,
  variables: EmailTemplateVariables
): string {
  let result = template
  for (const [key, value] of Object.entries(variables)) {
    const safeValue = RAW_VARIABLES.has(key) ? (value ?? '') : escapeHtml(value ?? '')
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), safeValue)
  }
  return result
}

export function buildEmailFromTemplate(
  templateHtml: string | null,
  subjectTemplate: string | null,
  variables: EmailTemplateVariables
): { html: string; subject: string } {
  const html = replaceTemplatePlaceholders(
    templateHtml || DEFAULT_ACTION_PLAN_EMAIL_HTML,
    variables
  )
  const subject = replaceTemplatePlaceholders(
    subjectTemplate || DEFAULT_ACTION_PLAN_EMAIL_SUBJECT,
    variables
  )
  return { html, subject }
}

/**
 * Gera dados de exemplo para preview no admin
 */
export function getSampleVariables(): EmailTemplateVariables {
  return {
    plan_title: 'Nao conformidade: Higienizar maos - Loja Centro',
    field_name: 'Higienizar maos e vestir uniforme completo',
    store_name: 'Loja Centro',
    sector_name: 'Cozinha',
    template_name: 'Checklist Diario — Cozinha',
    respondent_name: 'Joao Silva',
    respondent_time: '24/02/2026 14:30',
    assignee_name: 'Maria Souza',
    severity: 'alta',
    severity_label: 'Alta',
    severity_color: '#f97316',
    deadline: '01/03/2026',
    non_conformity_value: 'Nao',
    description: 'Funcionario nao higienizou as maos ao iniciar o turno conforme protocolo de seguranca alimentar.',
    plan_url: '#',
    plan_id: '42',
    is_reincidencia: 'Sim',
    reincidencia_count: '3',
    reincidencia_prefix: 'REINCIDENCIA - ',
    app_name: 'NoCheck',
  }
}
