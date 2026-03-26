/**
 * Zod schemas para validacao de request body das billing routes.
 * Garante type safety e rejeita payloads malformados com 400.
 *
 * Os tipos inferidos (z.infer<>) são exportados como aliases de DTO
 * para uso em validações server-side sem duplicar a definição de tipo.
 * Para uso client-side e tipagem de DTOs, prefira importar de '@/dtos'.
 */

import { z } from 'zod'

export const changePlanSchema = z.object({
  orgId: z.string().uuid('orgId deve ser UUID valido'),
  newPlan: z.enum(['trial', 'starter', 'professional', 'enterprise'], { error: 'Plano invalido' }),
})

export const checkoutSchema = z.object({
  orgId: z.string().uuid('orgId deve ser UUID valido'),
  priceId: z.string().min(1, 'priceId obrigatorio'),
  successUrl: z.string().optional(),
  cancelUrl: z.string().optional(),
})

export const subscribeSchema = z.object({
  orgId: z.string().uuid('orgId deve ser UUID valido'),
  priceId: z.string().min(1, 'priceId obrigatorio'),
  paymentMethodId: z.string().min(1, 'paymentMethodId obrigatorio'),
})

export const portalSchema = z.object({
  orgId: z.string().uuid('orgId deve ser UUID valido'),
  returnUrl: z.string().optional(),
})

export const statusSchema = z.object({
  orgId: z.string().uuid('orgId deve ser UUID valido'),
})

export const checkEmailSchema = z.object({
  email: z.string().email('Email invalido'),
})

export const settingsSchema = z.object({
  key: z.string().min(1, 'key obrigatoria'),
  value: z.string(),
})

// ── Tipos inferidos dos schemas Zod ──
// Exportados para uso em rotas server-side como alternativa
// aos DTOs de '@/dtos' quando a validação Zod já está em uso.

/** Tipo inferido do schema de mudança de plano */
export type ChangePlanInput = z.infer<typeof changePlanSchema>

/** Tipo inferido do schema de checkout */
export type CheckoutInput = z.infer<typeof checkoutSchema>

/** Tipo inferido do schema de assinatura direta */
export type SubscribeInput = z.infer<typeof subscribeSchema>

/** Tipo inferido do schema do portal de billing */
export type PortalInput = z.infer<typeof portalSchema>

/** Tipo inferido do schema de status de assinatura */
export type StatusInput = z.infer<typeof statusSchema>

/** Tipo inferido do schema de verificação de e-mail */
export type CheckEmailInput = z.infer<typeof checkEmailSchema>

/** Tipo inferido do schema de configurações */
export type SettingsInput = z.infer<typeof settingsSchema>

/** Helper para validar body e retornar erro formatado */
export function validateBody<T>(schema: z.ZodSchema<T>, body: unknown): { data: T; error?: never } | { data?: never; error: string } {
  const result = schema.safeParse(body)
  if (!result.success) {
    const message = result.error.issues.map(e => e.message).join(', ')
    return { error: message }
  }
  return { data: result.data }
}
