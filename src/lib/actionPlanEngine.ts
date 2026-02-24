/**
 * Engine de processamento de nao-conformidades e planos de acao.
 * Chamado apos submissao de checklist (similar a crossValidation.ts).
 *
 * Pipeline:
 * 1. Busca field_conditions do template
 * 2. Avalia cada resposta contra as condicoes
 * 3. Para cada nao-conformidade:
 *    a. Verifica reincidencia (mesmo campo+loja nos ultimos 90 dias)
 *    b. Cria action_plan
 *    c. Cria notificacao in-app
 *    d. Envia email de notificacao (template configuravel)
 *    e. Se reincidencia, notifica admins
 */

import { createNotification, sendEmailNotification, sendActionPlanTeamsAlert } from './notificationService'
import { buildEmailFromTemplate, SEVERITY_COLORS, type EmailTemplateVariables } from './emailTemplateEngine'
import type { FieldCondition } from '@/types/database'

type ResponseData = {
  field_id: number
  value_text: string | null
  value_number: number | null
  value_json: unknown
}

type FieldData = {
  id: number
  name: string
  field_type: string
  options: unknown
}

type ProcessResult = {
  success: boolean
  plansCreated: number
  error?: string
}

/**
 * Avalia se uma resposta viola a condicao de nao-conformidade.
 * Retorna true se a resposta E nao-conforme.
 */
function evaluateCondition(
  field: FieldData,
  response: ResponseData,
  condition: FieldCondition
): boolean {
  const condValue = condition.condition_value as Record<string, unknown>

  switch (field.field_type) {
    case 'yes_no': {
      let answer: string | null = null
      if (response.value_json && typeof response.value_json === 'object') {
        answer = (response.value_json as Record<string, unknown>).answer as string | null
      }
      if (!answer) answer = response.value_text
      if (!answer) return condition.condition_type === 'empty'

      if (condition.condition_type === 'equals') return answer === condValue.value
      if (condition.condition_type === 'not_equals') return answer !== condValue.value
      return false
    }

    case 'number': {
      const num = response.value_number
      if (num === null || num === undefined) return condition.condition_type === 'empty'

      if (condition.condition_type === 'less_than') return num < (condValue.min as number)
      if (condition.condition_type === 'greater_than') return num > (condValue.max as number)
      if (condition.condition_type === 'between') {
        const min = condValue.min as number
        const max = condValue.max as number
        return num < min || num > max
      }
      return false
    }

    case 'rating': {
      const rating = response.value_number
      if (rating === null || rating === undefined) return condition.condition_type === 'empty'

      const threshold = condValue.threshold as number
      if (condition.condition_type === 'less_than') return rating < threshold
      return false
    }

    case 'dropdown': {
      const val = response.value_text || ''
      const targetValues = (condValue.values as string[]) || []

      if (condition.condition_type === 'in_list') return targetValues.includes(val)
      if (condition.condition_type === 'not_in_list') return !targetValues.includes(val)
      if (condition.condition_type === 'empty') return val.trim() === ''
      return false
    }

    case 'checkbox_multiple': {
      let selected: string[] = []
      if (Array.isArray(response.value_json)) {
        selected = response.value_json as string[]
      } else if (response.value_text) {
        try { selected = JSON.parse(response.value_text) } catch { selected = [] }
      }

      const required = condValue.required as string[] | undefined
      const forbidden = condValue.forbidden as string[] | undefined

      if (required && required.some(r => !selected.includes(r))) return true
      if (forbidden && forbidden.some(f => selected.includes(f))) return true
      return false
    }

    case 'text': {
      const text = response.value_text || ''
      if (condition.condition_type === 'empty') return text.trim() === ''
      if (condition.condition_type === 'equals') return text === condValue.value
      if (condition.condition_type === 'not_equals') return text !== condValue.value
      return false
    }

    default:
      return false
  }
}

/**
 * Verifica reincidencia: mesmo campo + loja + template nos ultimos N dias
 */
async function checkReincidencia(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  fieldId: number,
  storeId: number,
  templateId: number,
  lookbackDays: number = 90
): Promise<{ isReincidencia: boolean; count: number; parentPlanId: number | null }> {
  try {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - lookbackDays)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: previousPlans } = await (supabase as any)
      .from('action_plans')
      .select('id, created_at')
      .eq('field_id', fieldId)
      .eq('store_id', storeId)
      .eq('template_id', templateId)
      .gte('created_at', cutoff.toISOString())
      .order('created_at', { ascending: false })

    if (!previousPlans || previousPlans.length === 0) {
      return { isReincidencia: false, count: 0, parentPlanId: null }
    }

    return {
      isReincidencia: true,
      count: previousPlans.length,
      parentPlanId: previousPlans[previousPlans.length - 1].id,
    }
  } catch (err) {
    console.error('[ActionPlan] Erro ao verificar reincidencia:', err)
    return { isReincidencia: false, count: 0, parentPlanId: null }
  }
}

/**
 * Obtem o valor nao-conforme como string para exibicao
 */
function getNonConformityValueStr(field: FieldData, response: ResponseData): string {
  switch (field.field_type) {
    case 'yes_no': {
      if (response.value_json && typeof response.value_json === 'object') {
        return (response.value_json as Record<string, unknown>).answer as string || response.value_text || ''
      }
      return response.value_text || ''
    }
    case 'number':
    case 'rating':
      return response.value_number !== null ? String(response.value_number) : ''
    case 'dropdown':
    case 'text':
      return response.value_text || ''
    case 'checkbox_multiple': {
      if (Array.isArray(response.value_json)) return (response.value_json as string[]).join(', ')
      return response.value_text || ''
    }
    default:
      return response.value_text || ''
  }
}

/**
 * Funcao principal: processa nao-conformidades apos submissao de checklist.
 */
export async function processarNaoConformidades(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  checklistId: number,
  templateId: number,
  storeId: number,
  sectorId: number | null,
  userId: string,
  responses: ResponseData[],
  fields: FieldData[]
): Promise<ProcessResult> {
  try {
    // 1. Buscar field_conditions ativos para os campos deste template
    const fieldIds = fields.map(f => f.id)
    if (fieldIds.length === 0) return { success: true, plansCreated: 0 }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: conditions, error: condError } = await (supabase as any)
      .from('field_conditions')
      .select('*')
      .in('field_id', fieldIds)
      .eq('is_active', true)

    if (condError) {
      console.error('[ActionPlan] Erro ao buscar condicoes:', condError)
      return { success: false, plansCreated: 0, error: condError.message }
    }

    if (!conditions || conditions.length === 0) {
      return { success: true, plansCreated: 0 }
    }

    // 2. Buscar dados de contexto (uma unica vez, antes do loop)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any

    const [storeResult, templateResult, sectorResult, respondentResult, checklistResult, emailTemplateResult, emailSubjectResult] =
      await Promise.all([
        sb.from('stores').select('name').eq('id', storeId).single(),
        sb.from('checklist_templates').select('name').eq('id', templateId).single(),
        sectorId
          ? sb.from('sectors').select('name').eq('id', sectorId).single()
          : Promise.resolve({ data: null }),
        sb.from('users').select('full_name').eq('id', userId).single(),
        sb.from('checklists').select('completed_at, created_at').eq('id', checklistId).single(),
        sb.from('app_settings').select('value').eq('key', 'action_plan_email_template').maybeSingle(),
        sb.from('app_settings').select('value').eq('key', 'action_plan_email_subject').maybeSingle(),
      ])

    const storeName = storeResult.data?.name || `Loja #${storeId}`
    const templateName = templateResult.data?.name || `Template #${templateId}`
    const sectorName = sectorResult.data?.name || ''
    const respondentName = respondentResult.data?.full_name || 'Usuario'
    const respondentTime = checklistResult.data?.completed_at || checklistResult.data?.created_at || new Date().toISOString()
    const emailTemplateHtml: string | null = emailTemplateResult.data?.value || null
    const emailSubjectTemplate: string | null = emailSubjectResult.data?.value || null

    const appUrl = typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || 'https://nocheck-app.vercel.app'

    // 3. Avaliar cada condicao contra as respostas
    let plansCreated = 0

    for (const condition of conditions as FieldCondition[]) {
      const field = fields.find(f => f.id === condition.field_id)
      if (!field) continue

      const response = responses.find(r => r.field_id === condition.field_id)
      if (!response) continue

      const isNonConforming = evaluateCondition(field, response, condition)
      if (!isNonConforming) continue

      // 4. Nao-conformidade detectada! Verificar reincidencia
      const reincidencia = await checkReincidencia(supabase, field.id, storeId, templateId)

      // Determinar responsavel
      const assigneeId = condition.default_assignee_id || userId

      // Calcular deadline
      const deadline = new Date()
      deadline.setDate(deadline.getDate() + condition.deadline_days)
      const deadlineStr = deadline.toISOString().split('T')[0]

      // Gerar titulo e descricao
      const nonConformityValue = getNonConformityValueStr(field, response)
      const title = condition.description_template
        ? condition.description_template
            .replace('{field_name}', field.name)
            .replace('{value}', nonConformityValue)
            .replace('{store_name}', storeName)
        : `Nao conformidade: ${field.name} - ${storeName}`

      // Severidade pode ser escalada se reincidencia
      let severity = condition.severity
      if (reincidencia.isReincidencia && reincidencia.count >= 3) {
        const escalation: Record<string, string> = { baixa: 'media', media: 'alta', alta: 'critica' }
        severity = (escalation[severity] || severity) as typeof severity
      }

      // 5. Inserir resposta para obter ID (se nao tiver)
      const { data: responseRow } = await sb
        .from('checklist_responses')
        .select('id')
        .eq('checklist_id', checklistId)
        .eq('field_id', field.id)
        .single()

      // 6. Criar plano de acao
      const { data: plan, error: planError } = await sb
        .from('action_plans')
        .insert({
          checklist_id: checklistId,
          field_id: field.id,
          field_condition_id: condition.id,
          response_id: responseRow?.id || null,
          template_id: templateId,
          store_id: storeId,
          sector_id: sectorId,
          title,
          description: condition.description_template || null,
          severity,
          status: 'aberto',
          assigned_to: assigneeId,
          assigned_by: userId,
          deadline: deadlineStr,
          is_reincidencia: reincidencia.isReincidencia,
          reincidencia_count: reincidencia.count,
          parent_action_plan_id: reincidencia.parentPlanId,
          non_conformity_value: nonConformityValue,
          created_by: userId,
        })
        .select('id')
        .single()

      if (planError) {
        console.error('[ActionPlan] Erro ao criar plano:', planError)
        continue
      }

      plansCreated++

      // 7. Criar notificacao in-app para o responsavel
      await createNotification(supabase, assigneeId, {
        type: reincidencia.isReincidencia ? 'reincidencia_detected' : 'action_plan_assigned',
        title: reincidencia.isReincidencia
          ? `Reincidencia #${reincidencia.count + 1}: ${field.name}`
          : `Novo plano de acao: ${field.name}`,
        message: `${storeName} - Prazo: ${new Date(deadlineStr).toLocaleDateString('pt-BR')}`,
        link: `/admin/planos-de-acao/${plan.id}`,
        metadata: {
          action_plan_id: plan.id,
          store_id: storeId,
          severity,
          is_reincidencia: reincidencia.isReincidencia,
        },
      })

      // 8. Buscar dados do responsavel e enviar email + Teams
      try {
        const { data: assignee } = await sb
          .from('users')
          .select('email, full_name')
          .eq('id', assigneeId)
          .single()

        const assigneeName = assignee?.full_name || 'Nao atribuido'

        // Email com template configuravel
        if (assignee?.email) {
          const emailVars: EmailTemplateVariables = {
            plan_title: title,
            field_name: field.name,
            store_name: storeName,
            sector_name: sectorName,
            template_name: templateName,
            respondent_name: respondentName,
            respondent_time: new Date(respondentTime).toLocaleString('pt-BR'),
            assignee_name: assigneeName,
            severity,
            severity_label: severity.charAt(0).toUpperCase() + severity.slice(1),
            severity_color: SEVERITY_COLORS[severity] || '#f59e0b',
            deadline: new Date(deadlineStr).toLocaleDateString('pt-BR'),
            non_conformity_value: nonConformityValue,
            description: condition.description_template || '',
            plan_url: `${appUrl}/admin/planos-de-acao/${plan.id}`,
            plan_id: String(plan.id),
            is_reincidencia: reincidencia.isReincidencia ? 'Sim' : 'Nao',
            reincidencia_count: String(reincidencia.count),
            reincidencia_prefix: reincidencia.isReincidencia ? `REINCIDENCIA #${reincidencia.count + 1} - ` : '',
            app_name: 'NoCheck',
          }

          const { html: htmlBody, subject: emailSubject } = buildEmailFromTemplate(
            emailTemplateHtml,
            emailSubjectTemplate,
            emailVars
          )

          await sendEmailNotification(assignee.email, emailSubject, htmlBody)
        }

        // Teams alert
        await sendActionPlanTeamsAlert({
          title,
          fieldName: field.name,
          storeName,
          severity,
          deadline: new Date(deadlineStr).toLocaleDateString('pt-BR'),
          assigneeName,
          nonConformityValue,
          isReincidencia: reincidencia.isReincidencia,
          reincidenciaCount: reincidencia.count,
        })
      } catch (notifErr) {
        console.error('[ActionPlan] Erro ao enviar notificacoes:', notifErr)
      }

      // 9. Se reincidencia, notificar tambem os admins
      if (reincidencia.isReincidencia) {
        try {
          const { data: admins } = await sb
            .from('users')
            .select('id')
            .eq('is_admin', true)
            .eq('is_active', true)

          for (const admin of admins || []) {
            if (admin.id === assigneeId) continue
            await createNotification(supabase, admin.id, {
              type: 'reincidencia_detected',
              title: `Reincidencia #${reincidencia.count + 1}: ${field.name}`,
              message: `${storeName} - ${nonConformityValue} - Ocorrencia ${reincidencia.count + 1}x nos ultimos 90 dias`,
              link: `/admin/planos-de-acao/${plan.id}`,
              metadata: {
                action_plan_id: plan.id,
                store_id: storeId,
                severity,
                reincidencia_count: reincidencia.count + 1,
              },
            })
          }
        } catch (adminErr) {
          console.error('[ActionPlan] Erro ao notificar admins:', adminErr)
        }
      }
    }

    console.log(`[ActionPlan] ${plansCreated} plano(s) de acao criado(s) para checklist #${checklistId}`)
    return { success: true, plansCreated }
  } catch (err) {
    console.error('[ActionPlan] Erro no processamento:', err)
    return { success: false, plansCreated: 0, error: err instanceof Error ? err.message : 'Erro desconhecido' }
  }
}

/**
 * Verifica planos de acao vencidos e atualiza status.
 * Chamado no login do admin (piggyback).
 */
export async function checkOverduePlans(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<number> {
  try {
    const today = new Date().toISOString().split('T')[0]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: overduePlans } = await (supabase as any)
      .from('action_plans')
      .select('id, assigned_to, title, deadline')
      .lt('deadline', today)
      .in('status', ['aberto', 'em_andamento'])

    if (!overduePlans || overduePlans.length === 0) return 0

    const overdueIds = overduePlans.map((p: { id: number }) => p.id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('action_plans')
      .update({ status: 'vencido', updated_at: new Date().toISOString() })
      .in('id', overdueIds)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: admins } = await (supabase as any)
      .from('users')
      .select('id')
      .eq('is_admin', true)
      .eq('is_active', true)

    const adminIds = (admins || []).map((a: { id: string }) => a.id)

    for (const plan of overduePlans) {
      await createNotification(supabase, plan.assigned_to, {
        type: 'action_plan_overdue',
        title: 'Plano de acao vencido',
        message: `O plano "${plan.title}" venceu em ${new Date(plan.deadline).toLocaleDateString('pt-BR')}`,
        link: `/admin/planos-de-acao/${plan.id}`,
        metadata: { action_plan_id: plan.id },
      })

      for (const adminId of adminIds) {
        if (adminId === plan.assigned_to) continue
        await createNotification(supabase, adminId, {
          type: 'action_plan_overdue',
          title: 'Plano de acao vencido',
          message: `O plano "${plan.title}" venceu em ${new Date(plan.deadline).toLocaleDateString('pt-BR')}`,
          link: `/admin/planos-de-acao/${plan.id}`,
          metadata: { action_plan_id: plan.id },
        })
      }
    }

    console.log(`[ActionPlan] ${overduePlans.length} plano(s) marcado(s) como vencido(s)`)
    return overduePlans.length
  } catch (err) {
    console.error('[ActionPlan] Erro ao verificar planos vencidos:', err)
    return 0
  }
}
