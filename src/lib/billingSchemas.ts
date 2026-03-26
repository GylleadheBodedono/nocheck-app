/**
 * Zod schemas para validacao de request body das billing routes.
 * Garante type safety e rejeita payloads malformados com 400.
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

/** Helper para validar body e retornar erro formatado */
export function validateBody<T>(schema: z.ZodSchema<T>, body: unknown): { data: T; error?: never } | { data?: never; error: string } {
  const result = schema.safeParse(body)
  if (!result.success) {
    const message = result.error.issues.map(e => e.message).join(', ')
    return { error: message }
  }
  return { data: result.data }
}
