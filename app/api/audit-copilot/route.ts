import { GoogleGenAI } from '@google/genai'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
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

    const contents: any[] = [
      ...history.map((m: { role: string; content: string }) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
      { role: 'user', parts: [{ text: question }] },
    ]

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      config: {
        maxOutputTokens: 300,
        systemInstruction: systemPrompt,
      },
      contents,
    })

    const answer = (response.text || '')
    return NextResponse.json({ answer })
  } catch (err) {
    console.error('Copilot error:', err)
    return NextResponse.json({ error: 'Copilot unavailable' }, { status: 500 })
  }
}
