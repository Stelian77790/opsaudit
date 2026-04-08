import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  try {
    const { type, workDescription, hazards, controls, workers } = await req.json()

    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 500,
      system: `You are a health and safety permit validation expert.
Check if a Permit to Work request meets all safety requirements.
Return ONLY valid JSON:
{
  "passed": boolean,
  "confidence": "High" | "Medium" | "Low",
  "issues": ["string"],
  "recommendations": ["string"],
  "recommendation": "string - overall recommendation",
  "immediateRiskLevel": "Critical" | "High" | "Medium" | "Low"
}
Be strict — approve only when all key controls are in place for the permit type.`,
      messages: [{
        role: 'user',
        content: `Validate this ${type.replace('_', ' ')} permit:
Work: ${workDescription}
Hazards identified: ${hazards.join(', ') || 'none listed'}
Controls in place: ${controls.join(', ') || 'none listed'}
Workers: ${workers.join(', ') || 'not specified'}

Check: Are all required controls present for this permit type? Are the hazards adequately addressed?
Return ONLY the JSON.`
      }]
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
    const check = JSON.parse(cleaned)

    return NextResponse.json({ check })
  } catch (err) {
    console.error('Permit check error:', err)
    return NextResponse.json({ error: 'AI check failed' }, { status: 500 })
  }
}
