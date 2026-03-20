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

import { createNotification, sendActionPlanEmail, sendActionPlanTeamsAlert } from './notificationService'
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

      const normalizeYesNo = (v: string) => {
        const l = v.toLowerCase().replace(/[\/\s]/g, '')
        if (l === 'na' || l === 'n/a' || l === 'naoaplicavel') return 'na'
        if (l === 'nao' || l === 'não') return 'nao'
        if (l === 'sim') return 'sim'
        return l
      }
      const answerNorm = normalizeYesNo(answer)
      const condNorm = normalizeYesNo((condValue.value as string) || '')

      if (condition.condition_type === 'equals') {
        return answerNorm === condNorm
      }
      if (condition.condition_type === 'not_equals') {
        return answerNorm !== condNorm
      }
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

      const valNorm = val.toLowerCase()
      const targetValuesNorm = targetValues.map(v => v.toLowerCase())

      if (condition.condition_type === 'in_list') return targetValuesNorm.includes(valNorm)
      if (condition.condition_type === 'not_in_list') return !targetValuesNorm.includes(valNorm)
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
      const textNorm = text.toLowerCase()
      const condTextNorm = ((condValue.value as string) || '').toLowerCase()

      if (condition.condition_type === 'empty') return text.trim() === ''
      if (condition.condition_type === 'equals') return textNorm === condTextNorm
      if (condition.condition_type === 'not_equals') return textNorm !== condTextNorm
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
      let ans = ''
      if (response.value_json && typeof response.value_json === 'object') {
        ans = (response.value_json as Record<string, unknown>).answer as string || response.value_text || ''
      } else {
        ans = response.value_text || ''
      }
      if (ans.toLowerCase() === 'na') return 'N/A'
      return ans
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

    // Buscar access token para autenticacao do email API
    let accessToken: string | undefined
    try {
      const { data: { session } } = await supabase.auth.getSession()
      accessToken = session?.access_token || undefined
      if (!accessToken) {
        console.warn('[ActionPlan] access_token NAO encontrado na sessao — emails podem falhar (session:', session ? 'existe' : 'null', ')')
      }
    } catch (tokenErr) {
      console.warn('[ActionPlan] Erro ao obter access token:', tokenErr)
    }

    // Buscar contexto com resiliencia - falhas aqui NAO devem impedir criacao do plano
    let storeName = `Loja #${storeId}`
    let templateName = `Template #${templateId}`
    let sectorName = ''
    let respondentName = 'Usuario'
    let respondentEmail = ''
    let respondentTime = new Date().toISOString()
    let emailTemplateHtml: string | null = null
    let emailSubjectTemplate: string | null = null

    try {
      const [storeResult, templateResult, sectorResult, respondentResult, checklistResult, emailTemplateResult, emailSubjectResult] =
        await Promise.all([
          sb.from('stores').select('name').eq('id', storeId).single(),
          sb.from('checklist_templates').select('name').eq('id', templateId).single(),
          sectorId
            ? sb.from('sectors').select('name').eq('id', sectorId).single()
            : Promise.resolve({ data: null }),
          sb.from('users').select('full_name, email').eq('id', userId).single(),
          sb.from('checklists').select('completed_at, created_at').eq('id', checklistId).single(),
          sb.from('app_settings').select('value').eq('key', 'action_plan_email_template').maybeSingle(),
          sb.from('app_settings').select('value').eq('key', 'action_plan_email_subject').maybeSingle(),
        ])

      if (storeResult.data?.name) storeName = storeResult.data.name
      if (templateResult.data?.name) templateName = templateResult.data.name
      if (sectorResult.data?.name) sectorName = sectorResult.data.name
      if (respondentResult.data?.full_name) respondentName = respondentResult.data.full_name
      if (respondentResult.data?.email) respondentEmail = respondentResult.data.email
      if (checklistResult.data?.completed_at || checklistResult.data?.created_at) {
        respondentTime = checklistResult.data.completed_at || checklistResult.data.created_at
      }
      emailTemplateHtml = emailTemplateResult.data?.value || null
      emailSubjectTemplate = emailSubjectResult.data?.value || null
    } catch (ctxErr) {
      console.warn('[ActionPlan] Erro ao buscar dados de contexto (prosseguindo com defaults):', ctxErr)
    }

    const appUrl = typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || 'https://nocheck-app.vercel.app'

    // 3. Avaliar cada condicao contra as respostas
    let plansCreated = 0

    for (const condition of conditions as FieldCondition[]) {
      const field = fields.find(f => f.id === condition.field_id)
      if (!field) {
        console.warn(`[ActionPlan][DEBUG] Campo ID ${condition.field_id} NAO encontrado nos fields recebidos. Fields IDs: [${fields.map(f => f.id).join(', ')}]`)
        continue
      }

      const response = responses.find(r => r.field_id === condition.field_id)
      if (!response) {
        console.warn(`[ActionPlan][DEBUG] Resposta para campo "${field.name}" (ID ${field.id}) NAO encontrada. Responses field_ids: [${responses.map(r => r.field_id).join(', ')}]`)
        continue
      }

      const isNonConforming = evaluateCondition(field, response, condition)
      if (!isNonConforming) {
        continue
      }

      // 4. Nao-conformidade detectada! Verificar reincidencia
      const reincidencia = await checkReincidencia(supabase, field.id, storeId, templateId)

      // Verificar se o usuario selecionou uma funcao, severidade e/ou modelo
      const valueJson = response.value_json as Record<string, unknown> | null
      const userSelectedFunctionId = valueJson?.selectedFunctionId as number | null
      // Fallback para dados antigos (selectedAssigneeId era UUID de usuario)
      const legacyAssigneeId = valueJson?.selectedAssigneeId as string | null
      const userSelectedSeverity = valueJson?.selectedSeverity as string | null
      const userSelectedPresetId = valueJson?.selectedPresetId as number | null

      // Buscar dados do modelo selecionado (se houver)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let presetData: any = null
      if (userSelectedPresetId) {
        try {
          const { data } = await sb.from('action_plan_presets').select('*').eq('id', userSelectedPresetId).single()
          if (data) presetData = data
        } catch (err) {
          console.warn('[ActionPlan] Erro ao buscar modelo selecionado:', err)
        }
      }

      // Determinar funcao responsavel: prioridade para a selecionada pelo preenchedor, depois preset, depois condition
      const assignedFunctionId = userSelectedFunctionId || presetData?.default_function_id || condition.default_function_id || null
      // Se funcao atribuida, assigned_to = quem preencheu (funcao inteira recebe notificacoes)
      // Senao, fallback legado: usuario direto
      const assigneeId = assignedFunctionId
        ? userId
        : (legacyAssigneeId || presetData?.default_assignee_id || condition.default_assignee_id || userId)
      console.log(`[ActionPlan] Campo "${field.name}": assignedFunctionId=${assignedFunctionId}, assigneeId=${assigneeId}, userSelected=${userSelectedFunctionId}, conditionDefault=${condition.default_function_id}`)

      // Calcular deadline (preset pode sobrescrever)
      const deadlineDays = presetData?.deadline_days ?? condition.deadline_days
      const deadline = new Date()
      deadline.setDate(deadline.getDate() + deadlineDays)
      const deadlineStr = deadline.toISOString().split('T')[0]

      // Gerar titulo e descricao
      const nonConformityValue = getNonConformityValueStr(field, response)
      const planTitle = presetData?.name
        ? presetData.name
        : condition.description_template
          ? condition.description_template
              .replace('{field_name}', field.name)
              .replace('{value}', nonConformityValue)
              .replace('{store_name}', storeName)
          : `Nao conformidade: ${field.name} - ${storeName}`

      // Severidade: prioridade para a selecionada pelo usuario, depois preset, depois condition
      let severity = (userSelectedSeverity || presetData?.severity || condition.severity) as string
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
          title: planTitle,
          description: condition.description_template || null,
          severity,
          status: 'aberto',
          assigned_to: assigneeId,
          assigned_function_id: assignedFunctionId,
          assigned_by: userId,
          deadline: deadlineStr,
          is_reincidencia: reincidencia.isReincidencia,
          reincidencia_count: reincidencia.count,
          parent_action_plan_id: reincidencia.parentPlanId,
          non_conformity_value: nonConformityValue,
          require_photo_on_completion: presetData?.require_photo_on_completion ?? true,
          require_text_on_completion: presetData?.require_text_on_completion ?? true,
          completion_max_chars: presetData?.completion_max_chars || condition.completion_max_chars || 800,
          created_by: userId,
        })
        .select('id')
        .single()

      if (planError) {
        console.error('[ActionPlan] Erro ao criar plano:', planError)
        continue
      }

      plansCreated++

      // 7. Buscar usuarios responsaveis (todos da funcao ou fallback para usuario unico)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let responsibleUsers: { id: string; email: string; full_name: string }[] = []
      let functionWebhookUrl: string | null = null
      let functionName = ''

      if (assignedFunctionId) {
        // Buscar membros da funcao via API (server-side com service role)
        const membersUrl = `${appUrl}/api/functions/${assignedFunctionId}/members`
        console.log(`[ActionPlan] Buscando membros: ${membersUrl} (token: ${accessToken ? 'SIM' : 'NAO'})`)
        try {
          const membersRes = await fetch(membersUrl, {
            headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
          })
          if (membersRes.ok) {
            const membersData = await membersRes.json()
            responsibleUsers = membersData.users || []
            functionName = membersData.functionName || ''
            functionWebhookUrl = membersData.teamsWebhookUrl || null
            console.log(`[ActionPlan] Funcao "${functionName}" (ID ${assignedFunctionId}): ${responsibleUsers.length} usuarios`, responsibleUsers.map((u: {full_name: string}) => u.full_name))
          } else {
            const errorText = await membersRes.text().catch(() => '(sem body)')
            console.error(`[ActionPlan] Erro ao buscar membros da funcao ${assignedFunctionId}: HTTP ${membersRes.status} - ${errorText}`)
          }
        } catch (fetchErr) {
          console.error('[ActionPlan] Erro fetch membros da funcao:', fetchErr)
        }

        // Fallback: se API falhou, buscar direto do banco
        if (responsibleUsers.length === 0) {
          console.warn(`[ActionPlan] API retornou 0 membros para funcao ${assignedFunctionId}, tentando query direta...`)
          try {
            const [usersResult, fnResult] = await Promise.all([
              sb.from('users').select('id, email, full_name').eq('function_id', assignedFunctionId).eq('is_active', true),
              sb.from('functions').select('name, teams_webhook_url').eq('id', assignedFunctionId).single(),
            ])
            if (usersResult.data && usersResult.data.length > 0) {
              responsibleUsers = usersResult.data
              functionName = fnResult.data?.name || ''
              functionWebhookUrl = fnResult.data?.teams_webhook_url || null
              console.log(`[ActionPlan] Fallback DB: funcao "${functionName}" — ${responsibleUsers.length} usuarios`)
            } else {
              console.error(`[ActionPlan] Nenhum usuario ativo na funcao ${assignedFunctionId}`)
            }
          } catch (dbErr) {
            console.error('[ActionPlan] Erro fallback DB membros:', dbErr)
          }
        }
      } else {
        // Fallback legado: usuario unico
        try {
          const { data: userData } = await sb
            .from('users')
            .select('id, email, full_name, function_ref:functions!users_function_id_fkey(teams_webhook_url)')
            .eq('id', assigneeId)
            .single()
          if (userData) {
            responsibleUsers = [{ id: userData.id, email: userData.email, full_name: userData.full_name }]
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const fnRef = (userData as any)?.function_ref
            if (fnRef?.teams_webhook_url) functionWebhookUrl = fnRef.teams_webhook_url
          }
        } catch { /* ignora erro na busca do usuario */ }
      }

      // 7a. Criar notificacao in-app para CADA usuario responsavel
      const notifTitle = reincidencia.isReincidencia
        ? `Reincidencia #${reincidencia.count + 1}: ${field.name}`
        : `Novo plano de acao: ${field.name}`

      console.log(`[ActionPlan] Notificando ${responsibleUsers.length} responsaveis:`, responsibleUsers.map(u => `${u.full_name} (${u.id})`))
      for (const responsible of responsibleUsers) {
        console.log(`[ActionPlan] Criando notificacao para: ${responsible.full_name} (${responsible.id})`)
        await createNotification(supabase, responsible.id, {
          type: reincidencia.isReincidencia ? 'reincidencia_detected' : 'action_plan_assigned',
          title: notifTitle,
          message: `${storeName} - Prazo: ${new Date(deadlineStr).toLocaleDateString('pt-BR')}`,
          link: `/admin/planos-de-acao/${plan.id}`,
          metadata: {
            action_plan_id: plan.id,
            store_id: storeId,
            severity,
            is_reincidencia: reincidencia.isReincidencia,
          },
        })
      }

      // 7b. Notificar quem respondeu o checklist
      const isFillerAlsoResponsible = responsibleUsers.some(u => u.id === userId)
      if (!isFillerAlsoResponsible) {
        const assigneeLabel = functionName || responsibleUsers.map(u => u.full_name).join(', ') || 'Nao atribuido'
        await createNotification(supabase, userId, {
          type: 'action_plan_created',
          title: `Plano de acao gerado: ${field.name}`,
          message: `Voce respondeu "${templateName}" e o campo "${field.name}" foi marcado como "${nonConformityValue}". Responsavel: ${assigneeLabel}.`,
          link: `/admin/planos-de-acao/${plan.id}`,
          metadata: {
            action_plan_id: plan.id,
            store_id: storeId,
            field_name: field.name,
            non_conformity_value: nonConformityValue,
          },
        })
      }

      // 8. Enviar email para CADA usuario responsavel + Teams
      try {
        const assigneeLabel = functionName || responsibleUsers.map(u => u.full_name).join(', ') || 'Nao atribuido'
        const emailVars: EmailTemplateVariables = {
          plan_title: planTitle,
          field_name: field.name,
          store_name: storeName,
          sector_name: sectorName,
          template_name: templateName,
          respondent_name: respondentName,
          respondent_time: new Date(respondentTime).toLocaleString('pt-BR'),
          assignee_name: assigneeLabel,
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
          app_name: 'OpereCheck',
        }

        const { html: htmlBody, subject: emailSubject } = buildEmailFromTemplate(
          emailTemplateHtml,
          emailSubjectTemplate,
          emailVars
        )

        // Enviar email para CADA usuario da funcao
        console.log(`[ActionPlan] Enviando email para ${responsibleUsers.length} responsaveis`)
        for (const responsible of responsibleUsers) {
          console.log(`[ActionPlan] Email → ${responsible.full_name} (${responsible.id})`)
          const emailResult = await sendActionPlanEmail(responsible.id, emailSubject, htmlBody, accessToken)
          console.log(`[ActionPlan] Email resultado: ${emailResult.success ? 'OK' : 'FALHA'} - ${emailResult.error || ''}`)
          if (!emailResult.success) {
            console.error(`[ActionPlan] FALHA ao enviar email para ${responsible.email}:`, emailResult.error)
          }
        }

        // Teams alert — uma vez por funcao
        await sendActionPlanTeamsAlert({
          title: planTitle,
          fieldName: field.name,
          storeName,
          severity,
          deadline: new Date(deadlineStr).toLocaleDateString('pt-BR'),
          assigneeName: assigneeLabel,
          nonConformityValue,
          isReincidencia: reincidencia.isReincidencia,
          reincidenciaCount: reincidencia.count,
          respondentName,
          respondentEmail,
          assigneeEmail: responsibleUsers[0]?.email || '',
          webhookUrl: functionWebhookUrl,
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
  supabase: any,
  accessToken?: string
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

      // Enviar email de vencimento ao responsavel
      if (accessToken) {
        try {
          const appUrl = typeof window !== 'undefined'
            ? window.location.origin
            : process.env.NEXT_PUBLIC_APP_URL || 'https://nocheck-app.vercel.app'
          const planUrl = `${appUrl}/admin/planos-de-acao/${plan.id}`
          const deadlineFormatted = new Date(plan.deadline).toLocaleDateString('pt-BR')

          const htmlBody = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #dc2626; color: white; padding: 20px; border-radius: 12px 12px 0 0;">
                <h2 style="margin: 0;">Plano de Acao Vencido</h2>
              </div>
              <div style="padding: 24px; background: #1a1a2e; color: #e0e0e0; border-radius: 0 0 12px 12px;">
                <p style="font-size: 16px; margin-bottom: 16px;">
                  O plano de acao <strong>"${plan.title}"</strong> venceu em <strong style="color: #ef4444;">${deadlineFormatted}</strong>.
                </p>
                <p style="font-size: 14px; color: #a0a0a0; margin-bottom: 24px;">
                  Por favor, acesse o sistema para tomar as providencias necessarias.
                </p>
                <a href="${planUrl}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                  Ver Plano de Acao
                </a>
              </div>
            </div>
          `
          await sendActionPlanEmail(
            plan.assigned_to,
            `Plano de Acao Vencido: "${plan.title}"`,
            htmlBody,
            accessToken
          )
        } catch (emailErr) {
          console.error(`[ActionPlan] Erro ao enviar email de vencimento para plano #${plan.id}:`, emailErr)
        }
      }
    }

    return overduePlans.length
  } catch (err) {
    console.error('[ActionPlan] Erro ao verificar planos vencidos:', err)
    return 0
  }
}

// Exports for testing (pure functions)
export { evaluateCondition as _evaluateCondition }
export { getNonConformityValueStr as _getNonConformityValueStr }
export type { FieldData, ResponseData }
