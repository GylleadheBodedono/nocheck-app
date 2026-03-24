/**
 * Motor de validação cruzada para checklists de recebimento de mercadorias.
 *
 * Compara o valor informado pelo estoquista com o do aprendiz para a mesma nota fiscal.
 * Suporta:
 * - Match exato (mesmo número de nota) → status `sucesso` ou `falhou`
 * - Match por "notas irmãs" (prefixo igual ou tempo próximo) → status `notas_diferentes`
 * - Expiração automática de validações pendentes (configurável via `app_settings`)
 * - Notificação via Teams quando há divergência
 */

/** Resposta de um campo do checklist. */
type ChecklistResponse = {
  field_id: number
  value_text: string | null
  value_number: number | null
  value_json: unknown
}

/** Campo de um template com tipo e opções de configuração. */
type TemplateField = {
  id: number
  name: string
  field_type: string
  options: unknown
}

/**
 * Envia notificação de divergência para o canal do Teams via API route `/api/integrations/notify`.
 * Falhas são silenciosas — a validação não deve ser bloqueada por erros de notificação.
 */
async function notificarIntegracoes(data: {
  id: number
  numeroNota: string
  numeroNotaVinculada?: string
  loja: string
  setor?: string
  valorEstoquista: number | null
  valorAprendiz: number | null
  diferenca: number | null
  status: 'pendente' | 'sucesso' | 'falhou' | 'notas_diferentes' | 'expirado'
  dataHora: string
  matchReason?: string
}): Promise<void> {
  try {
    const response = await fetch('/api/integrations/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'teams',
        data,
      }),
    })

    if (!response.ok) {
      console.error('[CrossValidation] Erro ao notificar integrações:', await response.text())
    }
  } catch (err) {
    console.error('[CrossValidation] Erro ao chamar API de integrações:', err)
  }
}

/**
 * Verifica se duas notas são potencialmente "irmãs" (possível erro de digitação ou divisão de NF).
 *
 * Critérios de match (OR):
 * - Prefixo (primeiros 3 dígitos) igual + diferença de tempo ≤ 30 min → match forte
 * - Diferença de tempo ≤ 10 min (mesmo sem prefixo igual) → match fraco
 *
 * @param nota1 - Número da nota do primeiro checklist
 * @param nota2 - Número da nota do segundo checklist
 * @param data1 - Data/hora do primeiro preenchimento
 * @param data2 - Data/hora do segundo preenchimento
 * @returns `{ match: boolean; reason: string }` — reason descreve o critério aplicado
 */
function verificarNotasIrmas(
  nota1: string,
  nota2: string,
  data1: Date,
  data2: Date
): { match: boolean; reason: string } {
  // Extrair apenas dígitos das notas
  const digitos1 = nota1.replace(/\D/g, '')
  const digitos2 = nota2.replace(/\D/g, '')

  // Verificar se primeiros 3 dígitos são iguais
  const prefixo1 = digitos1.substring(0, 3)
  const prefixo2 = digitos2.substring(0, 3)
  const prefixoIgual = prefixo1.length >= 3 && prefixo1 === prefixo2

  // Verificar diferença de tempo (30 minutos = 1800000 ms)
  const diffMs = Math.abs(data1.getTime() - data2.getTime())
  const diffMinutos = diffMs / (1000 * 60)
  const tempoProximo = diffMinutos <= 30

  if (prefixoIgual && tempoProximo) {
    return {
      match: true,
      reason: `Notas com prefixo "${prefixo1}" e preenchidas com ${Math.round(diffMinutos)} minutos de diferença`,
    }
  }

  if (tempoProximo && !prefixoIgual) {
    // Mesmo assim pode ser um match fraco se o tempo for muito próximo (< 10 min)
    if (diffMinutos <= 10) {
      return {
        match: true,
        reason: `Notas preenchidas com apenas ${Math.round(diffMinutos)} minutos de diferença (possível erro de digitação)`,
      }
    }
  }

  return { match: false, reason: '' }
}

/**
 * Busca o `sector_id` do usuário na loja especificada.
 * Prioriza `user_stores.sector_id` (setor por loja); faz fallback para `users.sector_id`.
 *
 * @param supabase - Cliente Supabase com acesso às tabelas `user_stores` e `users`
 * @param userId   - UUID do usuário
 * @param storeId  - ID da loja
 * @returns ID do setor ou `null` se não configurado
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getUserSectorId(supabase: any, userId: string, storeId: number): Promise<number | null> {
  // Tentar user_stores primeiro (setor por loja)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: userStore } = await (supabase as any)
    .from('user_stores')
    .select('sector_id')
    .eq('user_id', userId)
    .eq('store_id', storeId)
    .not('sector_id', 'is', null)
    .limit(1)
    .single()

  if (userStore?.sector_id) return userStore.sector_id

  // Fallback: users.sector_id
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: user } = await (supabase as any)
    .from('users')
    .select('sector_id')
    .eq('id', userId)
    .single()

  return user?.sector_id || null
}

/**
 * Busca o tempo de expiração configurado em `app_settings`.
 * Chave: `validation_expiration_minutes`. Fallback: 60 minutos.
 *
 * @param supabase - Cliente Supabase com acesso à tabela `app_settings`
 * @returns Tempo de expiração em milissegundos
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getExpirationMs(supabase: any): Promise<number> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('app_settings')
      .select('value')
      .eq('key', 'validation_expiration_minutes')
      .single()

    if (data?.value) {
      const minutes = parseInt(data.value, 10)
      if (!isNaN(minutes) && minutes > 0) {
        return minutes * 60 * 1000
      }
    }
  } catch {
    // Usa o padrão de 60 minutos silenciosamente
  }
  return 60 * 60 * 1000 // Fallback: 60 minutos
}

/**
 * Verifica validações pendentes expiradas e as marca como `expirado`.
 * O tempo de expiração é configurável via `app_settings.validation_expiration_minutes`.
 * Chamado em "piggyback" ao final de `processarValidacaoCruzada`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function verificarValidacoesExpiradas(supabase: any): Promise<void> {
  try {
    const expirationMs = await getExpirationMs(supabase)
    const cutoff = new Date(Date.now() - expirationMs).toISOString()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: expiradas } = await (supabase as any)
      .from('cross_validations')
      .select('*, stores:store_id(name), sectors:sector_id(name)')
      .eq('status', 'pendente')
      .lt('created_at', cutoff)

    if (!expiradas || expiradas.length === 0) return

    for (const val of expiradas) {
      // Marcar como expirado
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('cross_validations')
        .update({ status: 'expirado', validated_at: new Date().toISOString() })
        .eq('id', val.id)

      // Notificar
      await notificarIntegracoes({
        id: val.id,
        numeroNota: val.numero_nota,
        loja: val.stores?.name || `Loja ${val.store_id}`,
        setor: val.sectors?.name || undefined,
        valorEstoquista: val.valor_estoquista,
        valorAprendiz: val.valor_aprendiz,
        diferenca: null,
        status: 'expirado',
        dataHora: new Date(val.created_at).toLocaleString('pt-BR'),
      })

    }
  } catch (err) {
    console.error('[CrossValidation] Erro ao verificar validacoes expiradas:', err)
  }
}

/**
 * Processa a validação cruzada após um checklist ser concluído.
 *
 * Fluxo principal:
 * 1. Identifica campos de "número da nota" e "valor" (por `validationRole` ou nome)
 * 2. Determina se o usuário é Aprendiz ou Estoquista pelo `function_ref.name`
 * 3. Busca validação pendente com match exato do número da nota
 *    - Se encontrar: atualiza com o segundo valor e calcula divergência
 *    - Se não encontrar: busca notas "irmãs" nos últimos 30 minutos
 *    - Se não encontrar irmã: cria nova validação pendente
 * 4. Executa limpeza de validações expiradas (piggyback)
 *
 * @param supabase    - Cliente Supabase com acesso às tabelas necessárias
 * @param checklistId - ID do checklist recém-concluído
 * @param templateId  - ID do template do checklist
 * @param storeId     - ID da loja
 * @param userId      - UUID do usuário que preencheu o checklist
 * @param responses   - Respostas do checklist
 * @param fields      - Campos do template (para identificar nota e valor)
 * @returns `{ success: true }` ou `{ success: false, error: mensagem }`
 */
export async function processarValidacaoCruzada(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  checklistId: number,
  templateId: number,
  storeId: number,
  userId: string,
  responses: ChecklistResponse[],
  fields: TemplateField[]
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Encontrar campos de "numero da nota" e "valor"
    // Prioridade: campo marcado explicitamente pelo admin (validationRole)
    // Fallback: deteccao por nome (palavras-chave)
    // Tipos de campo validos para nota (exclui yes_no, checkbox, dropdown, photo, etc)
    const tiposTextoNumero = ['text', 'number', 'textarea']

    const campoNota = fields.find(f =>
      (f.options as { validationRole?: string } | null)?.validationRole === 'nota'
    ) || fields.find(f => {
      if (!tiposTextoNumero.includes(f.field_type)) return false
      const name = f.name.toLowerCase()
      return name.includes('nota') || name.includes('nf') || name.includes('numero')
    })

    const campoValor = fields.find(f =>
      (f.options as { validationRole?: string } | null)?.validationRole === 'valor'
    ) || fields.find(f => {
      if (!tiposTextoNumero.includes(f.field_type)) return false
      const name = f.name.toLowerCase()
      return name.includes('valor') || name.includes('total') || name.includes('quantia')
    })

    if (!campoNota) {
      // Template nao tem campo de nota - verificar expiradas e sair
      await verificarValidacoesExpiradas(supabase)
      return { success: true }
    }

    // 2. Obter valores das respostas
    const respostaNota = responses.find(r => r.field_id === campoNota.id)
    const respostaValor = campoValor ? responses.find(r => r.field_id === campoValor.id) : null

    const numeroNota = (respostaNota?.value_text || respostaNota?.value_number?.toString() || '').trim()
    const valorRaw = respostaValor?.value_number ?? parseFloat(respostaValor?.value_text || '')
    const valor = (valorRaw === null || valorRaw === undefined || isNaN(valorRaw as number)) ? null : valorRaw

    if (!numeroNota) {
      await verificarValidacoesExpiradas(supabase)
      return { success: true }
    }

    // 3. Verificar o cargo do usuario via function_id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: userProfile } = await (supabase as any)
      .from('users')
      .select(`
        function_id,
        function_ref:functions!users_function_id_fkey(name)
      `)
      .eq('id', userId)
      .single()

    let isAprendiz = false

    if (userProfile?.function_ref?.name) {
      const functionName = userProfile.function_ref.name.toLowerCase()
      isAprendiz = functionName.includes('aprendiz')
    }

    // Qualquer usuario com funcao definida pode participar da validacao
    // Aprendiz = lado aprendiz, qualquer outro = lado referencia (estoquista)
    if (!userProfile?.function_id) {
      await verificarValidacoesExpiradas(supabase)
      return { success: true }
    }

    // 4. Buscar setor do usuario nesta loja
    const sectorId = await getUserSectorId(supabase, userId, storeId)

    // 5. Verificar se ja existe validacao para esta nota (match exato)
    // Primeiro tenta com setor, se nao encontrar tenta sem setor
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let existingValidation = null

    if (sectorId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('cross_validations')
        .select('*')
        .eq('store_id', storeId)
        .eq('numero_nota', numeroNota)
        .eq('sector_id', sectorId)
        .single()
      existingValidation = data
    }

    // Se nao encontrou com setor (ou setor e null), busca sem filtro de setor
    if (!existingValidation) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('cross_validations')
        .select('*')
        .eq('store_id', storeId)
        .eq('numero_nota', numeroNota)
        .eq('status', 'pendente')
        .single()
      existingValidation = data
    }

    // Buscar nome da loja e setor para notificações
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: store } = await (supabase as any)
      .from('stores')
      .select('name')
      .eq('id', storeId)
      .single()

    let setorNome: string | undefined
    if (sectorId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: sector } = await (supabase as any)
        .from('sectors')
        .select('name')
        .eq('id', sectorId)
        .single()
      setorNome = sector?.name
    }

    const lojaNome = store?.name || `Loja ${storeId}`
    const dataHora = new Date().toLocaleString('pt-BR')

    if (existingValidation) {
      // Atualizar validacao existente (match exato de número de nota)
      const updateData: Record<string, unknown> = {}

      if (!isAprendiz && !existingValidation.estoquista_checklist_id) {
        updateData.estoquista_checklist_id = checklistId
        updateData.valor_estoquista = valor
      } else if (isAprendiz && !existingValidation.aprendiz_checklist_id) {
        updateData.aprendiz_checklist_id = checklistId
        updateData.valor_aprendiz = valor
      } else {
        // Ja tem os dois preenchidos ou é duplicado
        await verificarValidacoesExpiradas(supabase)
        return { success: true }
      }

      // Verificar se agora temos os dois valores para calcular diferenca
      const valorEstoquista = updateData.valor_estoquista ?? existingValidation.valor_estoquista
      const valorAprendiz = updateData.valor_aprendiz ?? existingValidation.valor_aprendiz

      let validationComplete = false
      let hasDivergence = false

      if (valorEstoquista !== null && valorAprendiz !== null) {
        const diferenca = Math.abs((valorEstoquista as number) - (valorAprendiz as number))
        updateData.diferenca = diferenca
        updateData.status = diferenca <= 0.01 ? 'sucesso' : 'falhou'
        updateData.validated_at = new Date().toISOString()
        validationComplete = true
        hasDivergence = diferenca > 0.01
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('cross_validations')
        .update(updateData)
        .eq('id', existingValidation.id)

      if (error) throw error

      // Se validacao completa, enviar notificacoes
      if (validationComplete && hasDivergence) {
        await notificarIntegracoes({
          id: existingValidation.id,
          numeroNota,
          loja: lojaNome,
          setor: setorNome,
          valorEstoquista: valorEstoquista as number | null,
          valorAprendiz: valorAprendiz as number | null,
          diferenca: updateData.diferenca as number | null,
          status: updateData.status as 'pendente' | 'sucesso' | 'falhou',
          dataHora,
        })

      }

    } else {
      // Não encontrou match exato - procurar por notas "irmãs"
      // Buscar validações pendentes na mesma loja nos últimos 30 minutos
      const trintaMinutosAtras = new Date(Date.now() - 30 * 60 * 1000).toISOString()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sisterQuery = (supabase as any)
        .from('cross_validations')
        .select('*')
        .eq('store_id', storeId)
        .eq('status', 'pendente')
        .gte('created_at', trintaMinutosAtras)
        .is(!isAprendiz ? 'estoquista_checklist_id' : 'aprendiz_checklist_id', null)

      const { data: pendingValidations } = await sisterQuery

      let foundSisterValidation = null
      let matchReason = ''

      if (pendingValidations && pendingValidations.length > 0) {
        for (const pendingVal of pendingValidations) {
          // Verificar se são notas "irmãs"
          const { match, reason } = verificarNotasIrmas(
            numeroNota,
            pendingVal.numero_nota,
            new Date(),
            new Date(pendingVal.created_at)
          )

          if (match) {
            foundSisterValidation = pendingVal
            matchReason = reason
            break
          }
        }
      }

      if (foundSisterValidation) {
        // Encontrou uma nota "irmã" - vincular as duas
        const updateData: Record<string, unknown> = {
          match_reason: matchReason,
        }

        if (!isAprendiz) {
          updateData.estoquista_checklist_id = checklistId
          updateData.valor_estoquista = valor
        } else {
          updateData.aprendiz_checklist_id = checklistId
          updateData.valor_aprendiz = valor
        }

        // Calcular diferença se temos os dois valores
        const valorEstoquista = !isAprendiz ? valor : foundSisterValidation.valor_estoquista
        const valorAprendiz = isAprendiz ? valor : foundSisterValidation.valor_aprendiz

        if (valorEstoquista !== null && valorAprendiz !== null) {
          const diferenca = Math.abs((valorEstoquista as number) - (valorAprendiz as number))
          updateData.diferenca = diferenca
          // Status especial para notas diferentes vinculadas
          updateData.status = 'notas_diferentes'
          updateData.validated_at = new Date().toISOString()

          // Atualizar a validação existente com os novos dados
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error } = await (supabase as any)
            .from('cross_validations')
            .update(updateData)
            .eq('id', foundSisterValidation.id)

          if (error) throw error

          // Criar uma validação secundária para a nova nota
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: newValidation, error: insertError } = await (supabase as any)
            .from('cross_validations')
            .insert({
              store_id: storeId,
              sector_id: sectorId,
              numero_nota: numeroNota,
              estoquista_checklist_id: !isAprendiz ? checklistId : null,
              aprendiz_checklist_id: isAprendiz ? checklistId : null,
              valor_estoquista: !isAprendiz ? valor : null,
              valor_aprendiz: isAprendiz ? valor : null,
              status: 'notas_diferentes',
              linked_validation_id: foundSisterValidation.id,
              match_reason: matchReason,
              is_primary: false,
            })
            .select()
            .single()

          if (insertError) throw insertError

          // Atualizar a validação original para apontar para a nova
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from('cross_validations')
            .update({ linked_validation_id: newValidation.id })
            .eq('id', foundSisterValidation.id)

          // Notificar sobre notas diferentes vinculadas
          await notificarIntegracoes({
            id: foundSisterValidation.id,
            numeroNota: foundSisterValidation.numero_nota,
            numeroNotaVinculada: numeroNota,
            loja: lojaNome,
            setor: setorNome,
            valorEstoquista: valorEstoquista as number | null,
            valorAprendiz: valorAprendiz as number | null,
            diferenca: updateData.diferenca as number | null,
            status: 'notas_diferentes',
            dataHora,
            matchReason,
          })

        }
      } else {
        // Criar nova validacao (sem match)
        const insertData: Record<string, unknown> = {
          store_id: storeId,
          sector_id: sectorId,
          numero_nota: numeroNota,
          status: 'pendente',
          is_primary: true,
        }

        if (!isAprendiz) {
          insertData.estoquista_checklist_id = checklistId
          insertData.valor_estoquista = valor
        } else {
          insertData.aprendiz_checklist_id = checklistId
          insertData.valor_aprendiz = valor
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from('cross_validations')
          .insert(insertData)

        if (error) throw error
      }
    }

    // Verificar validacoes expiradas (piggyback)
    await verificarValidacoesExpiradas(supabase)

    return { success: true }
  } catch (err) {
    console.error('Erro ao processar validacao cruzada:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erro desconhecido'
    }
  }
}

// Exports for testing (pure functions)
export { verificarNotasIrmas as _verificarNotasIrmas }
