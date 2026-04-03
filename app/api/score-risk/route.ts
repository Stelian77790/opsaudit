import { GoogleGenAI } from '@google/genai'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  try {
    const { finding } = await req.json()

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      config: {
        maxOutputTokens: 500,
        systemInstruction: `You are a health and safety risk assessor. Score findings using likelihood x impact.
Return ONLY valid JSON:
{
  "likelihood": number 1-5,
  "impact": number 1-5,
  "riskScore": number 1-25,
  "riskLevel": "critical" | "high" | "medium" | "low",
  "justification": "string - one sentence",
  "immediateIsolationRequired": boolean,
  "suggestedAction": "string - specific corrective action",
  "effort": "quick_fix" | "short_term" | "long_term"
}
Scoring: Critical = 20-25, High = 15-19, Medium = 8-14, Low = 1-7`
      },
      contents: `Score this finding:\nTitle: ${finding.title}\nDescription: ${finding.description}\nCategory: ${finding.category || 'unknown'}\nLocation type: ${finding.locationType || 'unknown'}\nReturn ONLY the JSON.`
    })

    const text = (response.text || '')
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
    const scoring = JSON.parse(cleaned)

    return NextResponse.json({ scoring })
  } catch (err) {
    console.error('Risk scoring error:', err)
    return NextResponse.json({ error: 'Failed to score risk' }, { status: 500 })
  }
}
