export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/branding/suggest
 *
 * Recebe cores dominantes extraidas da logo (via canvas no frontend)
 * e usa Groq (llama-3.3-70b) para sugerir paleta completa para o app.
 */
export async function POST(req: NextRequest) {
  try {
    const { dominantColors } = await req.json()

    if (!dominantColors || !Array.isArray(dominantColors) || dominantColors.length === 0) {
      return NextResponse.json({ error: 'dominantColors e obrigatorio (array de hex)' }, { status: 400 })
    }

    const groqKey = process.env.GROQ_API_KEY
    if (!groqKey) {
      return NextResponse.json({ error: 'GROQ_API_KEY nao configurada' }, { status: 500 })
    }

    const prompt = `Voce e um designer de UI/UX especialista em SaaS. Recebeu as cores dominantes da logo de um cliente: ${dominantColors.join(', ')}.

Baseado nessas cores, sugira uma paleta completa para um aplicativo web SaaS de gestao operacional:

1. primaryColor — cor principal (botoes, links, destaque). Deve ser vibrante e acessivel.
2. primaryHover — versao mais escura da primaryColor para hover states.
3. accentColor — cor de destaque secundaria (badges, alertas positivos).
4. suggestedTheme — "dark" ou "light" baseado no estilo da marca.
5. reasoning — breve explicacao de por que essas cores foram escolhidas (1 frase).

IMPORTANTE: Retorne APENAS JSON valido, sem markdown, sem texto extra. Formato exato:
{"primaryColor":"#XXXXXX","primaryHover":"#XXXXXX","accentColor":"#XXXXXX","suggestedTheme":"dark","reasoning":"texto"}`

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 300,
      }),
    })

    if (!groqRes.ok) {
      const err = await groqRes.text()
      console.error('[Branding Suggest] Groq error:', err)
      return NextResponse.json({ error: 'Falha na IA ao sugerir cores' }, { status: 502 })
    }

    const groqData = await groqRes.json()
    const content = groqData.choices?.[0]?.message?.content || ''

    // Extrair JSON da resposta (pode vir com markdown wrapping)
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'IA retornou formato invalido', raw: content }, { status: 502 })
    }

    const suggestion = JSON.parse(jsonMatch[0])
    return NextResponse.json(suggestion)
  } catch (err) {
    console.error('[Branding Suggest] Erro:', err)
    return NextResponse.json({ error: 'Erro ao processar sugestao de cores' }, { status: 500 })
  }
}
