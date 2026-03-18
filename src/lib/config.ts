// ============================================
// CONFIGURACAO CENTRALIZADA DO APP
// Altere aqui para mudar em todo o projeto
// ============================================

/** Cor primaria padrao (teal) usada como fallback quando o tenant nao define tema */
const DEFAULT_PRIMARY_COLOR = '#0D9488'

/**
 * Configuracao global da aplicacao.
 *
 * Contem informacoes do app, rotas, mensagens padrao,
 * categorias de templates e roles de usuarios.
 * Valores aqui sao fallbacks — tenants podem sobrescrever via settings.
 */
export const APP_CONFIG = {
  // Informacoes do App
  name: 'OpereCheck',
  fullName: 'OpereCheck - Gestão Operacional e Checklists',
  description: 'Gestão operacional e checklists inteligentes',
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
    checklistNew: '/checklist/novo',
    cadastro: '/cadastro',
    esqueciSenha: '/esqueci-senha',
    resetPassword: '/auth/reset-password',
  },

  // Mensagens padrao
  messages: {
    loading: 'Carregando...',
    error: 'Ocorreu um erro. Tente novamente.',
    noStores: 'Nenhuma loja atribuida',
    noStoresHint: 'Entre em contato com o administrador para ter acesso a uma loja.',
    noChecklists: 'Nenhum checklist disponivel para seu cargo nesta loja.',
    loginRequired: 'Voce precisa estar logado',
    checklistSent: 'Checklist Enviado!',
    redirecting: 'Redirecionando...',
    loginError: 'Email ou senha incorretos',
    loginErrorGeneric: 'Erro ao fazer login. Tente novamente.',
    signupSuccess: 'Conta criada! Verifique seu email para confirmar.',
    passwordResetSent: 'Se existe uma conta com esse email, voce recebera um link para redefinir sua senha.',
    passwordResetSuccess: 'Senha alterada com sucesso! Faca login com a nova senha.',
    passwordResetError: 'Erro ao redefinir senha. Tente novamente.',
  },

  // Configuracoes de storage
  storage: {
    themeKey: 'operecheck-theme',
  },

  // Categorias de templates
  templateCategories: [
    { value: 'recebimento', label: 'Recebimento' },
    { value: 'limpeza', label: 'Limpeza' },
    { value: 'abertura', label: 'Abertura' },
    { value: 'fechamento', label: 'Fechamento' },
    { value: 'outros', label: 'Outros' },
  ],

  // Roles de usuarios
  userRoles: [
    { value: 'estoquista', label: 'Estoquista' },
    { value: 'aprendiz', label: 'Aprendiz' },
    { value: 'supervisor', label: 'Supervisor' },
  ],
} as const

/** Tipo inferido da configuracao global (readonly) */
export type AppConfig = typeof APP_CONFIG

// ============================================
// HELPERS TENANT-AWARE
// Mesclam settings do tenant com fallbacks
// ============================================

import type { Organization } from '@/types/tenant'

/**
 * Retorna o nome do app configurado pelo tenant.
 * Usa "OpereCheck" como fallback se nao houver configuracao.
 *
 * @param org - Organizacao atual (pode ser null durante carregamento)
 * @returns Nome do app do tenant ou fallback
 */
export function getTenantAppName(org: Organization | null | undefined): string {
  return org?.settings?.theme?.appName || APP_CONFIG.name
}

/**
 * Retorna a URL do logo configurado pelo tenant.
 *
 * @param org - Organizacao atual (pode ser null durante carregamento)
 * @returns URL do logo ou null se nao configurado
 */
export function getTenantLogoUrl(org: Organization | null | undefined): string | null {
  return org?.settings?.theme?.logoUrl || null
}

/**
 * Retorna a URL do favicon configurado pelo tenant.
 *
 * @param org - Organizacao atual (pode ser null durante carregamento)
 * @returns URL do favicon ou null se nao configurado
 */
export function getTenantFaviconUrl(org: Organization | null | undefined): string | null {
  return org?.settings?.theme?.faviconUrl || null
}

/**
 * Retorna a cor primaria do tenant para uso em temas.
 * Usa teal padrao ({@link DEFAULT_PRIMARY_COLOR}) como fallback.
 *
 * @param org - Organizacao atual (pode ser null durante carregamento)
 * @returns Cor hexadecimal (ex: "#0D9488")
 */
export function getTenantPrimaryColor(org: Organization | null | undefined): string {
  return org?.settings?.theme?.primaryColor || DEFAULT_PRIMARY_COLOR
}
