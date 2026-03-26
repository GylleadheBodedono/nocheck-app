// ============================================
// DTOs — Barrel Export
// ============================================
// Re-exporta todos os DTOs do sistema para
// facilitar importações em outros módulos.
//
// Uso:
//   import type { CreateUserRequestDTO } from '@/dtos'
//   import type { CheckoutRequestDTO, InvoiceDTO } from '@/dtos'
//
// Organização dos módulos:
//   user         — criação, listagem e relações de usuários
//   billing      — checkout, portal, status, faturas e planos
//   upload       — upload de imagens para o storage
//   notification — envio de e-mails transacionais via Resend
//   chat         — interação com o assistente IA Flux
//   integration  — alertas para Microsoft Teams
//   settings     — configurações do sistema (app_settings)
//   organization — organizações, convites e membros
//   checklist    — templates, checklists e respostas
//   action-plan  — planos de ação por não conformidade
// ============================================

export * from './user.dto'
export * from './billing.dto'
export * from './upload.dto'
export * from './notification.dto'
export * from './chat.dto'
export * from './integration.dto'
export * from './settings.dto'
export * from './organization.dto'
export * from './checklist.dto'
export * from './action-plan.dto'
