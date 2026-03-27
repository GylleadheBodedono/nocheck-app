/**
 * Configuração centralizada do aplicativo OpereCheck.
 *
 * Todas as constantes de identidade, rotas, mensagens e categorias do app
 * estão definidas aqui. Altere neste arquivo para refletir em todo o projeto.
 *
 * Uso:
 * ```ts
 * import { APP_CONFIG } from '@/lib/config'
 * console.log(APP_CONFIG.name) // 'OpereCheck'
 * ```
 */

// ============================================
// CONFIGURAÇÃO CENTRALIZADA DO APP
// Altere aqui para mudar em todo o projeto
// ============================================

/** Objeto de configuração global do app. Imutável em runtime (`as const`). */
export const APP_CONFIG = {
  // Informacoes do App
  name: 'OpereCheck',
  fullName: 'OpereCheck - Gestao Operacional e Checklists',
  description: 'Plataforma SaaS de gestao operacional e checklists',
  version: '2.1.0',
  company: 'OpereCheck',
  year: new Date().getFullYear(),

  // Rotas
  routes: {
    home: '/',
    login: '/login',
    dashboard: '/dashboard',
    admin: '/admin',
    adminUsers: '/admin/usuarios',
    adminUsersNew: '/admin/usuarios/novo',
    adminTemplates: '/admin/templates',
    adminTemplatesNew: '/admin/templates/novo',
    adminStores: '/admin/lojas',
    adminSectors: '/admin/setores',
    adminFunctions: '/admin/funcoes',
    adminReports: '/admin/relatorios',
    adminNCPhotoReport: '/admin/relatorios/fotos-nc',
    adminActionPlanReport: '/admin/relatorios/planos-de-acao',
    adminValidations: '/admin/validacoes',
    adminChecklists: '/admin/checklists',
    adminGallery: '/admin/galeria',
    adminActionPlans: '/admin/planos-de-acao',
    adminActionPlanNew: '/admin/planos-de-acao/novo',
    adminActionPlanPresets: '/admin/planos-de-acao/modelos',
    adminSettings: '/admin/configuracoes',
    platform: '/platform',
    platformClientes: '/platform/clientes',
    platformConfiguracoes: '/platform/configuracoes',
    adminLogs: '/admin/logs',
    userReports: '/relatorios',
    checklistNew: '/checklist/novo',
    cadastro: '/cadastro',
    esqueciSenha: '/esqueci-senha',
    resetPassword: '/auth/reset-password',
  },

  // Mensagens padrão
  messages: {
    loading: 'Carregando...',
    error: 'Ocorreu um erro. Tente novamente.',
    noStores: 'Nenhuma loja atribuída',
    noStoresHint: 'Entre em contato com o administrador para ter acesso a uma loja.',
    noChecklists: 'Nenhum checklist disponível para seu cargo nesta loja.',
    loginRequired: 'Você precisa estar logado',
    checklistSent: 'Checklist Enviado!',
    redirecting: 'Redirecionando...',
    loginError: 'Email ou senha incorretos',
    loginErrorGeneric: 'Erro ao fazer login. Tente novamente.',
    signupSuccess: 'Conta criada! Verifique seu email para confirmar.',
    passwordResetSent: 'Se existe uma conta com esse email, você receberá um link para redefinir sua senha.',
    passwordResetSuccess: 'Senha alterada com sucesso! Faça login com a nova senha.',
    passwordResetError: 'Erro ao redefinir senha. Tente novamente.',
  },

  // Configurações de storage
  storage: {
    themeKey: 'nocheck-theme',
  },

  // Categorias de templates
  templateCategories: [
    { value: 'recebimento', label: 'Recebimento' },
    { value: 'limpeza', label: 'Limpeza' },
    { value: 'abertura', label: 'Abertura' },
    { value: 'fechamento', label: 'Fechamento' },
    { value: 'outros', label: 'Outros' },
  ],

  // Roles de usuários
  userRoles: [
    { value: 'estoquista', label: 'Estoquista' },
    { value: 'aprendiz', label: 'Aprendiz' },
    { value: 'supervisor', label: 'Supervisor' },
  ],
} as const

/** Tipo inferido de `APP_CONFIG` — útil para funções que recebem partes da config. */
export type AppConfig = typeof APP_CONFIG

// Tenant helpers (white-label)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getTenantAppName(org?: any): string {
  const themeAppName = org?.settings?.theme?.appName
  if (themeAppName && themeAppName !== 'Sistema') return themeAppName
  if (org?.name) return org.name
  if (typeof window !== 'undefined') return document.title || APP_CONFIG.name
  return APP_CONFIG.name
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getTenantLogoUrl(org?: any): string | null {
  if (org?.settings?.theme?.logoUrl) return org.settings.theme.logoUrl
  return null
}
