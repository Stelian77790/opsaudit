import { GoogleGenAI } from '@google/genai'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  try {
    const { locationName, auditHistory, openActions, industry } = await req.json()

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      config: {
        maxOutputTokens: 600,
        systemInstruction: `You are a predictive health and safety risk analyst.
Based on historical audit data, predict future risk levels.
Return ONLY valid JSON:
{
  "riskTrajectory": "Improving" | "Stable" | "Deteriorating" | "Critical",
  "predictedScoreNextAudit": number 0-100,
  "topRisks": ["string", "string", "string"],
  "recommendations": ["string", "string", "string"],
  "confidence": "High" | "Medium" | "Low",
  "summary": "string - 2 sentence plain text summary"
}`
      },
      contents: `Analyse risk for location: ${locationName}
Industry: ${industry || 'General'}
Recent audit scores: ${auditHistory.map((a: { score: number; date: string }) => `${a.score}% (${a.date})`).join(', ')}
Open corrective actions: ${openActions.length} (${openActions.filter((a: { priority: string }) => a.priority === 'critical').length} critical, ${openActions.filter((a: { priority: string }) => a.priority === 'high').length} high)
Common finding categories: ${[...new Set(openActions.map((a: { category?: string }) => a.category || 'other'))].slice(0, 5).join(', ')}
Return ONLY the JSON.`
    })

    const text = (response.text || '')
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
    const prediction = JSON.parse(cleaned)
    return NextResponse.json({ prediction })
  } catch (err) {
    console.error('Prediction error:', err)
    return NextResponse.json({ error: 'Prediction failed' }, { status: 500 })
  }
}
