import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const client = new Anthropic()
  try {
    const { query, context } = await req.json()

    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 300,
      system: `You are a data analyst for an operational audit platform. 
Answer questions about audit data concisely in 1-3 sentences.
Be specific with numbers when available. If data is insufficient, say so clearly.
Never use markdown, bullet points or formatting. Plain conversational text only.`,
      messages: [{
        role: 'user',
        content: `Audit data context:
${JSON.stringify(context, null, 2)}

Question: ${query}

Answer directly and concisely.`
      }]
    })

    const answer = response.content[0].type === 'text' ? response.content[0].text : ''
    return NextResponse.json({ answer })
  } catch (err) {
    console.error('Analytics query error:', err)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }
}
