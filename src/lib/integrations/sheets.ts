/**
 * Google Sheets Integration
 * Exporta validações para planilha do Google
 */

const SHEETS_ID = process.env.GOOGLE_SHEETS_ID || ''
const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || ''
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY || ''

type ValidationRow = {
  id: number
  data: string
  loja: string
  numeroNota: string
  valorEstoquista: number | null
  valorAprendiz: number | null
  diferenca: number | null
  status: 'pendente' | 'sucesso' | 'falhou'
}

/**
 * Gera token de acesso usando Service Account
 */
async function getAccessToken(): Promise<string | null> {
  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY) {
    console.warn('[Sheets] Credenciais do Service Account não configuradas')
    return null
  }

  try {
    // Criar JWT para autenticação
    const now = Math.floor(Date.now() / 1000)
    const expiry = now + 3600 // 1 hora

    const header = {
      alg: 'RS256',
      typ: 'JWT',
    }

    const payload = {
      iss: GOOGLE_SERVICE_ACCOUNT_EMAIL,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: expiry,
    }

    // Encode header and payload
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url')
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')

    // Sign with private key
    const crypto = await import('crypto')
    const sign = crypto.createSign('RSA-SHA256')
    sign.update(`${encodedHeader}.${encodedPayload}`)
    const signature = sign.sign(GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'), 'base64url')

    const jwt = `${encodedHeader}.${encodedPayload}.${signature}`

    // Exchange JWT for access token
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    })

    if (!response.ok) {
      throw new Error(`Token request failed: ${response.status}`)
    }

    const data = await response.json()
    return data.access_token
  } catch (err) {
    console.error('[Sheets] Erro ao obter access token:', err)
    return null
  }
}

/**
 * Adiciona uma linha de validação na planilha
 */
export async function adicionarValidacaoSheet(row: ValidationRow): Promise<{ success: boolean; error?: string }> {
  if (!SHEETS_ID) {
    return { success: false, error: 'SHEETS_ID não configurado' }
  }

  const accessToken = await getAccessToken()
  if (!accessToken) {
    // Fallback: tentar sem autenticação (se planilha for pública para edição)
    console.warn('[Sheets] Sem token, tentando sem autenticação...')
  }

  const formatCurrency = (value: number | null) => {
    if (value === null) return ''
    return value.toFixed(2).replace('.', ',')
  }

  const statusEmoji: Record<string, string> = {
    pendente: '⏳',
    sucesso: '✅',
    falhou: '❌',
  }

  const values = [
    [
      row.id.toString(),
      row.data,
      row.loja,
      row.numeroNota,
      formatCurrency(row.valorEstoquista),
      formatCurrency(row.valorAprendiz),
      formatCurrency(row.diferenca),
      `${statusEmoji[row.status] || ''} ${row.status.toUpperCase()}`,
    ],
  ]

  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEETS_ID}/values/Validacoes!A:H:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ values }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Sheets API error: ${response.status} - ${error}`)
    }

    console.log('[Sheets] Linha adicionada com sucesso')
    return { success: true }
  } catch (err) {
    console.error('[Sheets] Erro ao adicionar linha:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erro desconhecido',
    }
  }
}

/**
 * Atualiza uma linha existente na planilha
 */
export async function atualizarValidacaoSheet(
  rowNumber: number,
  row: ValidationRow
): Promise<{ success: boolean; error?: string }> {
  if (!SHEETS_ID) {
    return { success: false, error: 'SHEETS_ID não configurado' }
  }

  const accessToken = await getAccessToken()
  if (!accessToken) {
    return { success: false, error: 'Não foi possível obter access token' }
  }

  const formatCurrency = (value: number | null) => {
    if (value === null) return ''
    return value.toFixed(2).replace('.', ',')
  }

  const statusEmoji: Record<string, string> = {
    pendente: '⏳',
    sucesso: '✅',
    falhou: '❌',
  }

  const values = [
    [
      row.id.toString(),
      row.data,
      row.loja,
      row.numeroNota,
      formatCurrency(row.valorEstoquista),
      formatCurrency(row.valorAprendiz),
      formatCurrency(row.diferenca),
      `${statusEmoji[row.status] || ''} ${row.status.toUpperCase()}`,
    ],
  ]

  try {
    const range = `Validacoes!A${rowNumber}:H${rowNumber}`
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEETS_ID}/values/${range}?valueInputOption=USER_ENTERED`

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ values }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Sheets API error: ${response.status} - ${error}`)
    }

    console.log('[Sheets] Linha atualizada com sucesso')
    return { success: true }
  } catch (err) {
    console.error('[Sheets] Erro ao atualizar linha:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erro desconhecido',
    }
  }
}

/**
 * Cria cabeçalho na planilha (executar uma vez)
 */
export async function criarCabecalhoSheet(): Promise<{ success: boolean; error?: string }> {
  if (!SHEETS_ID) {
    return { success: false, error: 'SHEETS_ID não configurado' }
  }

  const accessToken = await getAccessToken()
  if (!accessToken) {
    return { success: false, error: 'Não foi possível obter access token' }
  }

  const headers = [
    ['ID', 'Data/Hora', 'Loja', 'Nº Nota', 'Valor Estoquista', 'Valor Aprendiz', 'Diferença', 'Status'],
  ]

  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEETS_ID}/values/Validacoes!A1:H1?valueInputOption=USER_ENTERED`

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ values: headers }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Sheets API error: ${response.status} - ${error}`)
    }

    console.log('[Sheets] Cabeçalho criado com sucesso')
    return { success: true }
  } catch (err) {
    console.error('[Sheets] Erro ao criar cabeçalho:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erro desconhecido',
    }
  }
}

/**
 * Exporta todas as validações para a planilha (batch)
 */
export async function exportarValidacoesSheet(rows: ValidationRow[]): Promise<{ success: boolean; error?: string; count?: number }> {
  if (!SHEETS_ID) {
    return { success: false, error: 'SHEETS_ID não configurado' }
  }

  if (rows.length === 0) {
    return { success: true, count: 0 }
  }

  const accessToken = await getAccessToken()
  if (!accessToken) {
    return { success: false, error: 'Não foi possível obter access token' }
  }

  const formatCurrency = (value: number | null) => {
    if (value === null) return ''
    return value.toFixed(2).replace('.', ',')
  }

  const statusEmoji: Record<string, string> = {
    pendente: '⏳',
    sucesso: '✅',
    falhou: '❌',
  }

  // Cabeçalho + dados
  const values = [
    ['ID', 'Data/Hora', 'Loja', 'Nº Nota', 'Valor Estoquista', 'Valor Aprendiz', 'Diferença', 'Status'],
    ...rows.map(row => [
      row.id.toString(),
      row.data,
      row.loja,
      row.numeroNota,
      formatCurrency(row.valorEstoquista),
      formatCurrency(row.valorAprendiz),
      formatCurrency(row.diferenca),
      `${statusEmoji[row.status] || ''} ${row.status.toUpperCase()}`,
    ]),
  ]

  try {
    // Limpar planilha primeiro
    const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEETS_ID}/values/Validacoes!A:H:clear`
    await fetch(clearUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    // Inserir dados
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEETS_ID}/values/Validacoes!A1?valueInputOption=USER_ENTERED`

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ values }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Sheets API error: ${response.status} - ${error}`)
    }

    console.log(`[Sheets] ${rows.length} validações exportadas com sucesso`)
    return { success: true, count: rows.length }
  } catch (err) {
    console.error('[Sheets] Erro ao exportar validações:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erro desconhecido',
    }
  }
}
