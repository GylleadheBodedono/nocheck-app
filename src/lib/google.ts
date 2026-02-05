/**
 * Google API Integration (Sheets + Drive)
 * Server-side only - uses service account credentials
 */

const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || ''
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY || ''
const SHEETS_ID = process.env.GOOGLE_SHEETS_ID || ''
const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || ''

// Cache token to avoid generating new ones every request
let cachedToken: { token: string; expiry: number } | null = null

/**
 * Get Google Access Token using Service Account
 */
export async function getGoogleAccessToken(): Promise<string | null> {
  // Check cache
  if (cachedToken && cachedToken.expiry > Date.now()) {
    return cachedToken.token
  }

  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY) {
    console.error('[Google] Credenciais não configuradas')
    console.error('[Google] GOOGLE_SERVICE_ACCOUNT_EMAIL:', GOOGLE_SERVICE_ACCOUNT_EMAIL ? 'SET' : 'NOT SET')
    console.error('[Google] GOOGLE_PRIVATE_KEY:', GOOGLE_PRIVATE_KEY ? 'SET' : 'NOT SET')
    return null
  }

  try {
    const now = Math.floor(Date.now() / 1000)
    const expiry = now + 3600 // 1 hour

    const header = { alg: 'RS256', typ: 'JWT' }
    const payload = {
      iss: GOOGLE_SERVICE_ACCOUNT_EMAIL,
      // Scopes for both Sheets and Drive
      scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: expiry,
    }

    // Encode header and payload
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url')
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')

    // Sign with private key - handle different formats of the key
    const crypto = await import('crypto')
    const privateKey = GOOGLE_PRIVATE_KEY
      .replace(/\\n/g, '\n') // Handle escaped newlines from env
      .replace(/"/g, '') // Remove any quotes

    const sign = crypto.createSign('RSA-SHA256')
    sign.update(`${encodedHeader}.${encodedPayload}`)
    const signature = sign.sign(privateKey, 'base64url')

    const jwt = `${encodedHeader}.${encodedPayload}.${signature}`

    // Exchange JWT for access token
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Google] Token request failed:', response.status, errorText)
      throw new Error(`Token request failed: ${response.status} - ${errorText}`)
    }

    const tokenData = await response.json()

    // Cache the token
    cachedToken = {
      token: tokenData.access_token,
      expiry: Date.now() + 3500000, // 58 minutes (a bit less than 1 hour)
    }

    console.log('[Google] Token obtained successfully')
    return tokenData.access_token
  } catch (err) {
    console.error('[Google] Erro ao obter token:', err)
    return null
  }
}

/**
 * Ensure sheet exists, create if not
 */
export async function ensureSheetExists(sheetName: string): Promise<boolean> {
  const token = await getGoogleAccessToken()
  if (!token || !SHEETS_ID) return false

  try {
    // Get spreadsheet info
    const infoUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEETS_ID}?fields=sheets.properties.title`
    const infoRes = await fetch(infoUrl, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!infoRes.ok) {
      console.error('[Sheets] Erro ao obter info da planilha:', await infoRes.text())
      return false
    }

    const info = await infoRes.json()
    const sheets = info.sheets?.map((s: { properties: { title: string } }) => s.properties.title) || []

    // Check if sheet exists
    if (sheets.includes(sheetName)) {
      return true
    }

    // Create sheet
    const createUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEETS_ID}:batchUpdate`
    const createRes = await fetch(createUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        requests: [
          {
            addSheet: {
              properties: { title: sheetName },
            },
          },
        ],
      }),
    })

    if (!createRes.ok) {
      console.error('[Sheets] Erro ao criar aba:', await createRes.text())
      return false
    }

    console.log(`[Sheets] Aba "${sheetName}" criada com sucesso`)
    return true
  } catch (err) {
    console.error('[Sheets] Erro ao verificar/criar aba:', err)
    return false
  }
}

/**
 * Add row to Google Sheets
 */
export async function addRowToSheet(
  sheetName: string,
  values: (string | number)[],
  createHeaderIfEmpty?: string[]
): Promise<{ success: boolean; error?: string }> {
  const token = await getGoogleAccessToken()
  if (!token) {
    return { success: false, error: 'Não foi possível obter token do Google' }
  }

  if (!SHEETS_ID) {
    return { success: false, error: 'GOOGLE_SHEETS_ID não configurado' }
  }

  try {
    // Ensure sheet exists
    await ensureSheetExists(sheetName)

    // If header provided, check if sheet is empty and add header first
    if (createHeaderIfEmpty) {
      const checkUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEETS_ID}/values/${sheetName}!A1:A1`
      const checkRes = await fetch(checkUrl, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (checkRes.ok) {
        const checkData = await checkRes.json()
        if (!checkData.values || checkData.values.length === 0) {
          // Add header
          const headerUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEETS_ID}/values/${sheetName}!A1?valueInputOption=USER_ENTERED`
          await fetch(headerUrl, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ values: [createHeaderIfEmpty] }),
          })
          console.log('[Sheets] Cabeçalho adicionado')
        }
      }
    }

    // Append row
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEETS_ID}/values/${sheetName}!A:Z:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ values: [values] }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Sheets] Erro ao adicionar linha:', response.status, errorText)
      throw new Error(`Sheets API error: ${response.status} - ${errorText}`)
    }

    console.log('[Sheets] Linha adicionada com sucesso')
    return { success: true }
  } catch (err) {
    console.error('[Sheets] Erro:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erro desconhecido',
    }
  }
}

// Cache para o ID da pasta de imagens
let cachedFolderId: string | null = null

/**
 * Encontra ou cria a pasta "Imagens-Checklists" no Google Drive
 */
async function getOrCreateImageFolder(token: string): Promise<string | null> {
  // Se já configurou manualmente, usa esse
  if (DRIVE_FOLDER_ID) {
    return DRIVE_FOLDER_ID
  }

  // Se já temos em cache, retorna
  if (cachedFolderId) {
    return cachedFolderId
  }

  const folderName = 'Imagens-Checklists'

  try {
    // Procurar pasta existente
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)`
    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (searchRes.ok) {
      const searchData = await searchRes.json()
      if (searchData.files && searchData.files.length > 0) {
        cachedFolderId = searchData.files[0].id
        console.log(`[Drive] Pasta "${folderName}" encontrada: ${cachedFolderId}`)
        return cachedFolderId
      }
    }

    // Criar pasta se não existe
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    })

    if (!createRes.ok) {
      console.error('[Drive] Erro ao criar pasta:', await createRes.text())
      return null
    }

    const folderData = await createRes.json()
    cachedFolderId = folderData.id
    console.log(`[Drive] Pasta "${folderName}" criada: ${cachedFolderId}`)

    // Tornar pasta acessível publicamente
    await fetch(`https://www.googleapis.com/drive/v3/files/${cachedFolderId}/permissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone',
      }),
    })

    return cachedFolderId
  } catch (err) {
    console.error('[Drive] Erro ao buscar/criar pasta:', err)
    return null
  }
}

/**
 * Upload image to Google Drive
 */
export async function uploadImageToDrive(
  base64Image: string,
  fileName: string,
  mimeType: string = 'image/jpeg'
): Promise<{ success: boolean; fileId?: string; webViewLink?: string; error?: string }> {
  const token = await getGoogleAccessToken()
  if (!token) {
    return { success: false, error: 'Não foi possível obter token do Google' }
  }

  try {
    // Obter ou criar pasta de imagens
    const folderId = await getOrCreateImageFolder(token)

    // Remove data URL prefix if present
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '')

    // Create file metadata
    const metadata = {
      name: fileName,
      mimeType: mimeType,
      parents: folderId ? [folderId] : undefined,
    }

    // Create multipart form data
    const boundary = '-------314159265358979323846'
    const delimiter = `\r\n--${boundary}\r\n`
    const closeDelimiter = `\r\n--${boundary}--`

    const multipartBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      `Content-Type: ${mimeType}\r\n` +
      'Content-Transfer-Encoding: base64\r\n\r\n' +
      base64Data +
      closeDelimiter

    const response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink,webContentLink',
      {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/related; boundary=${boundary}`,
          Authorization: `Bearer ${token}`,
        },
        body: multipartBody,
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Drive] Erro ao fazer upload:', response.status, errorText)
      throw new Error(`Drive API error: ${response.status} - ${errorText}`)
    }

    const result = await response.json()

    // Make file publicly accessible
    await fetch(`https://www.googleapis.com/drive/v3/files/${result.id}/permissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone',
      }),
    })

    console.log('[Drive] Imagem enviada com sucesso:', result.id)
    return {
      success: true,
      fileId: result.id,
      webViewLink: result.webViewLink || `https://drive.google.com/file/d/${result.id}/view`,
    }
  } catch (err) {
    console.error('[Drive] Erro:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erro desconhecido',
    }
  }
}

/**
 * Add checklist data to Sheets
 */
export async function addChecklistToSheet(data: {
  checklistId: number
  templateName: string
  storeName: string
  userName: string
  completedAt: string
  responses: Array<{ fieldName: string; value: string }>
  imageUrls?: string[]
}): Promise<{ success: boolean; error?: string }> {
  const sheetName = 'Checklists'
  const header = [
    'ID',
    'Data/Hora',
    'Checklist',
    'Loja',
    'Usuário',
    'Respostas',
    'Imagens',
  ]

  // Format responses as string
  const responsesStr = data.responses
    .map(r => `${r.fieldName}: ${r.value}`)
    .join(' | ')

  const imagesStr = data.imageUrls?.join(', ') || ''

  const values = [
    data.checklistId,
    data.completedAt,
    data.templateName,
    data.storeName,
    data.userName,
    responsesStr,
    imagesStr,
  ]

  return addRowToSheet(sheetName, values, header)
}

/**
 * Add validation data to Sheets
 */
export async function addValidationToSheet(data: {
  id: number
  dataHora: string
  loja: string
  numeroNota: string
  valorEstoquista: number | null
  valorAprendiz: number | null
  diferenca: number | null
  status: string
}): Promise<{ success: boolean; error?: string }> {
  const sheetName = 'Validacoes'
  const header = [
    'ID',
    'Data/Hora',
    'Loja',
    'Nº Nota',
    'Valor Estoquista',
    'Valor Aprendiz',
    'Diferença',
    'Status',
  ]

  const formatCurrency = (value: number | null) => {
    if (value === null) return ''
    return `R$ ${value.toFixed(2).replace('.', ',')}`
  }

  const statusEmoji: Record<string, string> = {
    pendente: '⏳',
    sucesso: '✅',
    falhou: '❌',
  }

  const values = [
    data.id,
    data.dataHora,
    data.loja,
    data.numeroNota,
    formatCurrency(data.valorEstoquista),
    formatCurrency(data.valorAprendiz),
    formatCurrency(data.diferenca),
    `${statusEmoji[data.status] || ''} ${data.status.toUpperCase()}`,
  ]

  return addRowToSheet(sheetName, values, header)
}

/**
 * Test Google connection
 */
export async function testGoogleConnection(): Promise<{
  success: boolean
  token?: boolean
  sheets?: boolean
  drive?: boolean
  error?: string
}> {
  try {
    const token = await getGoogleAccessToken()
    if (!token) {
      return { success: false, token: false, error: 'Falha ao obter token' }
    }

    // Test Sheets access
    let sheetsOk = false
    if (SHEETS_ID) {
      const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEETS_ID}?fields=properties.title`
      const sheetsRes = await fetch(sheetsUrl, {
        headers: { Authorization: `Bearer ${token}` },
      })
      sheetsOk = sheetsRes.ok
      if (!sheetsOk) {
        console.error('[Test] Sheets error:', await sheetsRes.text())
      }
    }

    // Test Drive access
    let driveOk = false
    const driveUrl = 'https://www.googleapis.com/drive/v3/about?fields=user'
    const driveRes = await fetch(driveUrl, {
      headers: { Authorization: `Bearer ${token}` },
    })
    driveOk = driveRes.ok
    if (!driveOk) {
      console.error('[Test] Drive error:', await driveRes.text())
    }

    return {
      success: sheetsOk || driveOk,
      token: true,
      sheets: sheetsOk,
      drive: driveOk,
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Erro desconhecido',
    }
  }
}
