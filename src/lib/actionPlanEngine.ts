/**
 * Engine de processamento de não-conformidades e planos de ação.
 * Chamado após a submissão de um checklist (similar a `crossValidation.ts`).
 *
 * Pipeline de `processarNaoConformidades`:
 * 1. Busca `field_conditions` ativos para os campos do template
 * 2. Avalia cada resposta contra as condições via `evaluateCondition`
 * 3. Para cada não-conformidade detectada:
 *    a. Verifica reincidência (mesmo campo+loja+template nos últimos 90 dias)
 *    b. Cria `action_plan` no banco
 *    c. Cria notificação in-app para o responsável
 *    d. Envia email via template configurável (`emailTemplateEngine`)
 *    e. Se reincidência, notifica admins com alerta adicional
 *    f. Envia alerta Teams se webhook configurado
 *
 * Funções exportadas:
 * - `processarNaoConformidades` — pipeline principal (chamado após submit de checklist)
 * - `checkOverduePlans`         — verifica e atualiza planos vencidos (chamado no login admin)
 */

import { createNotification, sendActionPlanEmail, sendActionPlanTeamsAlert } from './notificationService'
import { serverLogger } from '@/lib/serverLogger'
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
 * Avalia se uma resposta viola uma condição de não-conformidade.
 *
 * Suporta os tipos de campo: `yes_no`, `number`, `rating`, `dropdown`,
 * `checkbox_multiple` e `text`. Tipos desconhecidos retornam `false`.
 *
 * @param field     - Dados do campo (tipo e nome)
 * @param response  - Resposta do usuário para o campo
 * @param condition - Condição configurada pelo admin (`field_conditions`)
 * @returns `true` se a resposta é não-conforme, `false` caso contrário
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
 * Verifica se há reincidência de não-conformidade para a combinação campo+loja+template.
 * Consulta `action_plans` nos últimos `lookbackDays` dias.
 *
 * @param supabase     - Cliente Supabase
 * @param fieldId      - ID do campo que gerou a NC
 * @param storeId      - ID da loja
 * @param templateId   - ID do template
 * @param lookbackDays - Janela de busca em dias (padrão: 90)
 * @returns `{ isReincidencia, count, parentPlanId }` — parentPlanId aponta para o plano mais antigo
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
    serverLogger.error('Erro ao verificar reincidencia', {}, err)
    return { isReincidencia: false, count: 0, parentPlanId: null }
  }
}

/**
 * Obtém o valor não-conforme como string legível para exibição.
 * Normaliza os diferentes formatos de valor (JSON, text, number) de cada tipo de campo.
 *
 * @param field    - Dados do campo (tipo usado para selecionar a lógica de extração)
 * @param response - Resposta do usuário
 * @returns String do valor não-conforme (ex: "Não", "3", "Produto A")
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
 * Processa não-conformidades após a submissão de um checklist.
 *
 * Para cada campo com condição violada:
 * - Verifica reincidência nos últimos 90 dias
 * - Cria `action_plan` atribuído ao responsável configurado
 * - Envia notificação in-app e email ao responsável
 * - Se reincidência: notifica admins e inclui prefixo "REINCIDÊNCIA" no email
 * - Se webhook Teams configurado: envia alerta de plano de ação
 *
 * Falhas em notificações não interrompem a criação do plano.
 *
 * @param supabase    - Cliente Supabase com permissão de escrita
 * @param checklistId - ID do checklist recém-submetido
 * @param templateId  - ID do template usado
 * @param storeId     - ID da loja
 * @param sectorId    - ID do setor (ou `null`)
 * @param userId      - UUID do usuário que submeteu o checklist
 * @param responses   - Respostas do checklist
 * @param fields      - Campos do template (para lookup de tipo e nome)
 * @returns `{ success, plansCreated }` ou `{ success: false, error }`
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
      serverLogger.error('Erro ao buscar condicoes do template', { checklistId }, condError)
      return { success: false, plansCreated: 0, error: condError.message }
    }

    // Se nao ha conditions E nao ha responses com selectedFunctionId, nao ha nada a fazer
    const hasUserSelectedFunctions = responses.some(r => {
      const vj = r.value_json as Record<string, unknown> | null
      return vj?.selectedFunctionId
    })
    if ((!conditions || conditions.length === 0) && !hasUserSelectedFunctions) {
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
    } catch (tokenErr) {
      // Falha ao obter token — emails podem nao funcionar, mas o plano sera criado
      void tokenErr
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
    } catch {
      // Falha ao buscar contexto — prossegue com valores padrao
    }

    const appUrl = typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || 'https://nocheck-app.vercel.app'

    // 3. Avaliar cada condicao contra as respostas
    let plansCreated = 0
    const createdFieldIds = new Set<number>()

    // Primeiro passo: avaliar conditions configuradas no banco
    for (const condition of (conditions || []) as FieldCondition[]) {
      const field = fields.find(f => f.id === condition.field_id)
      if (!field) continue

      const response = responses.find(r => r.field_id === condition.field_id)
      if (!response) continue

      const isNonConforming = evaluateCondition(field, response, condition)
      if (!isNonConforming) continue

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
        } catch { /* modelo nao encontrado, continua com defaults */ }
      }

      // Determinar funcao responsavel: prioridade para a selecionada pelo preenchedor, depois preset, depois condition
      const assignedFunctionId = userSelectedFunctionId || presetData?.default_function_id || condition.default_function_id || null
      // Se funcao atribuida, assigned_to = quem preencheu (funcao inteira recebe notificacoes)
      // Senao, fallback legado: usuario direto
      const assigneeId = assignedFunctionId
        ? userId
        : (legacyAssigneeId || presetData?.default_assignee_id || condition.default_assignee_id || userId)
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
        serverLogger.error('Erro ao criar plano de acao', { checklistId, storeId }, planError)
        continue
      }

      plansCreated++
      createdFieldIds.add(field.id)

      // 7. Buscar usuarios responsaveis (todos da funcao ou fallback para usuario unico)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let responsibleUsers: { id: string; email: string; full_name: string }[] = []
      let functionWebhookUrl: string | null = null
      let functionName = ''

      if (assignedFunctionId) {
        // Buscar membros da funcao via API (server-side com service role)
        const membersUrl = `${appUrl}/api/functions/${assignedFunctionId}/members`
        try {
          const membersRes = await fetch(membersUrl, {
            headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
          })
          if (membersRes.ok) {
            const membersData = await membersRes.json()
            responsibleUsers = membersData.users || []
            functionName = membersData.functionName || ''
            functionWebhookUrl = membersData.teamsWebhookUrl || null
          } else {
            const errorText = await membersRes.text().catch(() => '(sem body)')
            serverLogger.error('Erro ao buscar membros da funcao', { functionId: assignedFunctionId, statusCode: membersRes.status, body: errorText })
          }
        } catch (fetchErr) {
          serverLogger.error('Erro no fetch de membros da funcao', { functionId: assignedFunctionId }, fetchErr)
        }

        // Fallback: se API falhou, buscar direto do banco
        if (responsibleUsers.length === 0) {
          try {
            const [usersResult, fnResult] = await Promise.all([
              sb.from('users').select('id, email, full_name').eq('function_id', assignedFunctionId).eq('is_active', true),
              sb.from('functions').select('name, teams_webhook_url').eq('id', assignedFunctionId).single(),
            ])
            if (usersResult.data && usersResult.data.length > 0) {
              responsibleUsers = usersResult.data
              functionName = fnResult.data?.name || ''
              functionWebhookUrl = fnResult.data?.teams_webhook_url || null
            }
          } catch { /* ignora erro no fallback de membros */ }
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
      try {
        const notifTitle = reincidencia.isReincidencia
          ? `Reincidencia #${reincidencia.count + 1}: ${field.name}`
          : `Novo plano de acao: ${field.name}`

        for (const responsible of responsibleUsers) {
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
      } catch (notifErr) {
        serverLogger.error('Erro ao criar notificacoes in-app', { fieldName: field.name, checklistId }, notifErr)
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
        for (const responsible of responsibleUsers) {
          await sendActionPlanEmail(responsible.id, emailSubject, htmlBody, accessToken)
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
        serverLogger.error('Erro ao enviar notificacoes de plano de acao', { checklistId }, notifErr)
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
          serverLogger.error('Erro ao notificar admins sobre reincidencia', { checklistId }, adminErr)
        }
      }
    }

    // Segundo passo: campos onde usuario selecionou funcao/severidade
    // mas NAO tinham field_condition configurado no banco
    for (const response of responses) {
      const vJson = response.value_json as Record<string, unknown> | null
      const userFunctionId = vJson?.selectedFunctionId as number | null

      if (createdFieldIds.has(response.field_id)) continue
      if (!userFunctionId) continue

      const field = fields.find(f => f.id === response.field_id)
      if (!field) continue

      try {
        const userSeverity = (vJson?.selectedSeverity as string) || 'media'
        const userPresetId = vJson?.selectedPresetId as number | null

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let presetData2: any = null
        if (userPresetId) {
          try {
            const { data } = await sb.from('action_plan_presets').select('*').eq('id', userPresetId).single()
            if (data) presetData2 = data
          } catch { /* ignora */ }
        }

        const reincidencia2 = await checkReincidencia(supabase, field.id, storeId, templateId)

        const assignedFunctionId2 = userFunctionId
        const assigneeId2 = userId
        const deadlineDays2 = presetData2?.deadline_days ?? 7
        const deadline2 = new Date()
        deadline2.setDate(deadline2.getDate() + deadlineDays2)
        const deadlineStr2 = deadline2.toISOString().split('T')[0]

        const nonConformityValue2 = getNonConformityValueStr(field, response)
        const planTitle2 = presetData2?.name || `Nao conformidade: ${field.name} - ${storeName}`

        let severity2 = presetData2?.severity || userSeverity
        if (reincidencia2.isReincidencia && reincidencia2.count >= 3) {
          const escalation: Record<string, string> = { baixa: 'media', media: 'alta', alta: 'critica' }
          severity2 = escalation[severity2] || severity2
        }

        const { data: responseRow2 } = await sb
          .from('checklist_responses')
          .select('id')
          .eq('checklist_id', checklistId)
          .eq('field_id', field.id)
          .single()

        const { data: plan2, error: planError2 } = await sb
          .from('action_plans')
          .insert({
            checklist_id: checklistId,
            field_id: field.id,
            field_condition_id: null,
            response_id: responseRow2?.id || null,
            template_id: templateId,
            store_id: storeId,
            sector_id: sectorId,
            title: planTitle2,
            description: null,
            severity: severity2,
            status: 'aberto',
            assigned_to: assigneeId2,
            assigned_function_id: assignedFunctionId2,
            assigned_by: userId,
            deadline: deadlineStr2,
            is_reincidencia: reincidencia2.isReincidencia,
            reincidencia_count: reincidencia2.count,
            parent_action_plan_id: reincidencia2.parentPlanId,
            non_conformity_value: nonConformityValue2,
            require_photo_on_completion: presetData2?.require_photo_on_completion ?? true,
            require_text_on_completion: presetData2?.require_text_on_completion ?? true,
            completion_max_chars: presetData2?.completion_max_chars || 800,
            created_by: userId,
          })
          .select('id')
          .single()

        if (planError2) {
          serverLogger.error('Segundo passo: erro ao criar plano de acao', { fieldName: field.name, checklistId, storeId }, planError2)
          continue
        }

        plansCreated++
        createdFieldIds.add(field.id)

        // Buscar membros da funcao
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let responsibleUsers2: { id: string; email: string; full_name: string }[] = []
        let functionName2 = ''
        let functionWebhookUrl2: string | null = null

        try {
          const [usersResult, fnResult] = await Promise.all([
            sb.from('users').select('id, email, full_name').eq('function_id', assignedFunctionId2).eq('is_active', true),
            sb.from('functions').select('name, teams_webhook_url').eq('id', assignedFunctionId2).single(),
          ])
          if (usersResult.data && usersResult.data.length > 0) {
            responsibleUsers2 = usersResult.data
            functionName2 = fnResult.data?.name || ''
            functionWebhookUrl2 = fnResult.data?.teams_webhook_url || null
          }
        } catch (fetchErr2) {
          serverLogger.error('Segundo passo: erro ao buscar membros da funcao', { checklistId }, fetchErr2)
        }

        // Notificacoes
        try {
          for (const responsible of responsibleUsers2) {
            await createNotification(supabase, responsible.id, {
              type: 'action_plan_assigned',
              title: `Novo plano de acao: ${field.name}`,
              message: `${storeName} - Prazo: ${new Date(deadlineStr2).toLocaleDateString('pt-BR')}`,
              link: `/admin/planos-de-acao/${plan2.id}`,
              metadata: { action_plan_id: plan2.id, store_id: storeId, severity: severity2 },
            })
          }
          const isFillerAlso = responsibleUsers2.some(u => u.id === userId)
          if (!isFillerAlso) {
            const label2 = functionName2 || responsibleUsers2.map(u => u.full_name).join(', ') || 'Nao atribuido'
            await createNotification(supabase, userId, {
              type: 'action_plan_created',
              title: `Plano de acao gerado: ${field.name}`,
              message: `Campo "${field.name}" marcado como "${nonConformityValue2}". Responsavel: ${label2}.`,
              link: `/admin/planos-de-acao/${plan2.id}`,
              metadata: { action_plan_id: plan2.id, store_id: storeId },
            })
          }
        } catch (notifErr2) {
          serverLogger.error('Segundo passo: erro ao enviar notificacoes', { fieldName: field.name, checklistId }, notifErr2)
        }

        // Emails
        try {
          const label2 = functionName2 || responsibleUsers2.map(u => u.full_name).join(', ') || 'Nao atribuido'
          const emailVars2: EmailTemplateVariables = {
            plan_title: planTitle2,
            field_name: field.name,
            store_name: storeName,
            sector_name: sectorName,
            template_name: templateName,
            respondent_name: respondentName,
            respondent_time: new Date(respondentTime).toLocaleString('pt-BR'),
            assignee_name: label2,
            severity: severity2,
            severity_label: severity2.charAt(0).toUpperCase() + severity2.slice(1),
            severity_color: SEVERITY_COLORS[severity2] || '#f59e0b',
            deadline: new Date(deadlineStr2).toLocaleDateString('pt-BR'),
            non_conformity_value: nonConformityValue2,
            description: '',
            plan_url: `${appUrl}/admin/planos-de-acao/${plan2.id}`,
            plan_id: String(plan2.id),
            is_reincidencia: reincidencia2.isReincidencia ? 'Sim' : 'Nao',
            reincidencia_count: String(reincidencia2.count),
            reincidencia_prefix: reincidencia2.isReincidencia ? `REINCIDENCIA #${reincidencia2.count + 1} - ` : '',
            app_name: 'OpereCheck',
          }
          const { html: htmlBody2, subject: emailSubject2 } = buildEmailFromTemplate(emailTemplateHtml, emailSubjectTemplate, emailVars2)
          for (const responsible of responsibleUsers2) {
            await sendActionPlanEmail(responsible.id, emailSubject2, htmlBody2, accessToken)
          }
          await sendActionPlanTeamsAlert({
            title: planTitle2, fieldName: field.name, storeName, severity: severity2,
            deadline: new Date(deadlineStr2).toLocaleDateString('pt-BR'),
            assigneeName: label2, nonConformityValue: nonConformityValue2,
            isReincidencia: reincidencia2.isReincidencia, reincidenciaCount: reincidencia2.count,
            respondentName, respondentEmail,
            assigneeEmail: responsibleUsers2[0]?.email || '',
            webhookUrl: functionWebhookUrl2,
          })
        } catch (emailErr2) {
          serverLogger.error('Segundo passo: erro ao enviar email/Teams', { fieldName: field.name, checklistId }, emailErr2)
        }
      } catch (err2) {
        serverLogger.error('Segundo passo: erro geral ao processar campo', { fieldName: field.name, checklistId }, err2)
      }
    }

    return { success: true, plansCreated }
  } catch (err) {
    serverLogger.error('ERRO FATAL no processamento de nao-conformidades', { checklistId, storeId }, err)
    return { success: false, plansCreated: 0, error: err instanceof Error ? err.message : 'Erro desconhecido' }
  }
}

/**
 * Verifica planos de ação vencidos e atualiza seu status para `vencido`.
 * Chamado no login do admin (piggyback) para manter o banco atualizado.
 *
 * Para cada plano vencido:
 * - Atualiza `status` → `vencido` em `action_plans`
 * - Cria notificação in-app para o responsável e para todos os admins
 * - Se `accessToken` fornecido: envia email de aviso ao responsável
 *
 * @param supabase     - Cliente Supabase com permissão de leitura/escrita
 * @param accessToken  - Token JWT para autenticação nas APIs de email (opcional)
 * @returns Número de planos marcados como vencidos
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
          serverLogger.error('Erro ao enviar email de vencimento', { planId: plan.id }, emailErr)
        }
      }
    }

    return overduePlans.length
  } catch (err) {
    serverLogger.error('Erro ao verificar planos vencidos', {}, err)
    return 0
  }
}

// Exports for testing (pure functions)
export { evaluateCondition as _evaluateCondition }
export { getNonConformityValueStr as _getNonConformityValueStr }
export type { FieldData, ResponseData }
