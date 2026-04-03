import { GoogleGenAI } from '@google/genai'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  try {
    const { query, context } = await req.json()

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      config: {
        maxOutputTokens: 300,
        systemInstruction: `You are a data analyst for an operational audit platform. 
Answer questions about audit data concisely in 1-3 sentences.
Be specific with numbers when available. If data is insufficient, say so clearly.
Never use markdown, bullet points or formatting. Plain conversational text only.`
      },
      contents: `Audit data context:
${JSON.stringify(context, null, 2)}

Question: ${query}

Answer directly and concisely.`
    })

    const answer = (response.text || '')
    return NextResponse.json({ answer })
  } catch (err) {
    console.error('Analytics query error:', err)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }
}
