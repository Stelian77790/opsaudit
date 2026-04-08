import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  try {
    const { question, context, history } = await req.json()

    const systemPrompt = `You are an expert health and safety audit assistant helping an auditor in the field.
Current audit context:
- Audit: ${context.templateTitle}
- Location: ${context.locationName}
${context.currentSection ? `- Current section: ${context.currentSection}` : ''}
- Findings logged so far: ${context.findingsLogged}
${context.industry ? `- Industry: ${context.industry}` : ''}

Answer questions concisely in 2-4 sentences. Be practical and specific.
Reference relevant regulations when applicable (UK HSE, ISO 45001, etc.).
If the question is about a physical hazard severity, always err on the side of caution.
Plain text only — no markdown, no bullet points.`

    const messages: Anthropic.MessageParam[] = [
      ...history.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: question },
    ]

    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 300,
      system: systemPrompt,
      messages,
    })

    const answer = response.content[0].type === 'text' ? response.content[0].text : ''
    return NextResponse.json({ answer })
  } catch (err) {
    console.error('Copilot error:', err)
    return NextResponse.json({ error: 'Copilot unavailable' }, { status: 500 })
  }
}
