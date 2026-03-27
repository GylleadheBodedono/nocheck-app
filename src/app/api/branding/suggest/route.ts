export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import { verifyApiAuth } from '@/lib/api-auth'
import { aiLimiter, getRequestIdentifier } from '@/lib/rateLimit'
import { serverLogger } from '@/lib/serverLogger'

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/

/**
 * POST /api/branding/suggest
 *
 * Recebe cores dominantes extraidas da logo (via canvas no frontend)
 * e usa Groq (llama-3.3-70b) para sugerir paleta completa para o app.
 * Requer autenticacao.
 */
export async function POST(req: NextRequest) {
  try {
    // Rate limiting (IA e cara — max 3 por minuto)
    const rl = aiLimiter.check(getRequestIdentifier(req))
    if (!rl.success) return NextResponse.json({ error: 'Muitas requisicoes de IA. Aguarde 1 minuto.' }, { status: 429 })

    // Autenticacao obrigatoria
    const auth = await verifyApiAuth(req)
    if (auth.error) return auth.error

    const { dominantColors } = await req.json()

    if (!dominantColors || !Array.isArray(dominantColors) || dominantColors.length === 0) {
      return NextResponse.json({ error: 'dominantColors e obrigatorio (array de hex)' }, { status: 400 })
    }

    // Validar que cada cor e hex valido (prevenir prompt injection)
    const validColors = dominantColors.filter((c: unknown) => typeof c === 'string' && HEX_COLOR_RE.test(c))
    if (validColors.length === 0) {
      return NextResponse.json({ error: 'Nenhuma cor hex valida fornecida' }, { status: 400 })
    }

    const groqKey = process.env.GROQ_API_KEY
    if (!groqKey) {
      return NextResponse.json({ error: 'GROQ_API_KEY nao configurada' }, { status: 500 })
    }

    const prompt = `Voce e um designer de UI/UX especialista em SaaS. Recebeu as cores dominantes da logo de um cliente: ${validColors.join(', ')}.

Crie uma paleta COMPLETA para um app web SaaS, com versoes para tema LIGHT e DARK. As cores devem harmonizar com a logo.

Para cada tema, defina:
- primary: cor principal (botoes, links). Vibrante e acessivel.
- primaryHover: versao mais escura da primary.
- secondary: cor secundaria (menus, headers).
- secondaryHover: versao hover da secondary.
- accent: cor de destaque (badges, destaques especiais). Quente e chamativa.
- accentHover: versao hover do accent.
- bgPage: fundo da pagina.
- bgSurface: fundo de cards e paineis.

Regras:
- No tema light: fundos claros, textos escuros, primary vibrante
- No tema dark: fundos escuros (#09090b a #27272a), textos claros, primary pode ser mais clara
- Accent deve contrastar bem em ambos os temas
- reasoning: 1 frase explicando a escolha

RETORNE APENAS JSON valido, sem markdown:
{"light":{"primary":"#...","primaryHover":"#...","secondary":"#...","secondaryHover":"#...","accent":"#...","accentHover":"#...","bgPage":"#...","bgSurface":"#..."},"dark":{"primary":"#...","primaryHover":"#...","secondary":"#...","secondaryHover":"#...","accent":"#...","accentHover":"#...","bgPage":"#...","bgSurface":"#..."},"reasoning":"texto"}`

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
        max_tokens: 600,
      }),
    })

    if (!groqRes.ok) {
      const err = await groqRes.text()
      serverLogger.error('[Branding Suggest] Groq error', { error: err instanceof Error ? err.message : String(err) })
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
    serverLogger.error('[Branding Suggest] Erro', { error: err instanceof Error ? err.message : String(err) })
    return NextResponse.json({ error: 'Erro ao processar sugestao de cores' }, { status: 500 })
  }
}
