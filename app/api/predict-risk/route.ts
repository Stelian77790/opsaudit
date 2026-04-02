import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const client = new Anthropic()
  try {
    const { locationName, auditHistory, openActions, industry } = await req.json()

    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 600,
      system: `You are a predictive health and safety risk analyst.
Based on historical audit data, predict future risk levels.
Return ONLY valid JSON:
{
  "riskTrajectory": "Improving" | "Stable" | "Deteriorating" | "Critical",
  "predictedScoreNextAudit": number 0-100,
  "topRisks": ["string", "string", "string"],
  "recommendations": ["string", "string", "string"],
  "confidence": "High" | "Medium" | "Low",
  "summary": "string - 2 sentence plain text summary"
}`,
      messages: [{
        role: 'user',
        content: `Analyse risk for location: ${locationName}
Industry: ${industry || 'General'}
Recent audit scores: ${auditHistory.map((a: { score: number; date: string }) => `${a.score}% (${a.date})`).join(', ')}
Open corrective actions: ${openActions.length} (${openActions.filter((a: { priority: string }) => a.priority === 'critical').length} critical, ${openActions.filter((a: { priority: string }) => a.priority === 'high').length} high)
Common finding categories: ${[...new Set(openActions.map((a: { category?: string }) => a.category || 'other'))].slice(0, 5).join(', ')}
Return ONLY the JSON.`
      }]
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
    const prediction = JSON.parse(cleaned)
    return NextResponse.json({ prediction })
  } catch (err) {
    console.error('Prediction error:', err)
    return NextResponse.json({ error: 'Prediction failed' }, { status: 500 })
  }
}
