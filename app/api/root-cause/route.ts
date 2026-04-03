import { GoogleGenAI } from '@google/genai'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  try {
    const { recurringFindings, companyName, industry } = await req.json()

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      config: {
        maxOutputTokens: 800,
        systemInstruction: `You are a root cause analysis expert for workplace safety.
Analyse recurring findings and identify systemic root causes.
Return ONLY valid JSON:
{
  "rootCauses": [
    {
      "finding": "string - the recurring finding",
      "occurrences": number,
      "rootCause": "string - the underlying cause",
      "causeType": "TrainingGap" | "EquipmentFailure" | "ProcessFailure" | "CultureIssue" | "ResourceConstraint" | "Other",
      "evidence": "string - why this is the root cause",
      "systemicFix": "string - permanent solution",
      "urgency": "Immediate" | "ShortTerm" | "LongTerm"
    }
  ],
  "overallTheme": "string - the common thread across all findings",
  "priorityAction": "string - the single most important action to take"
}`
      },
      contents: `Perform root cause analysis for ${companyName} (${industry || 'General'}):
Recurring findings in last 90 days:
${recurringFindings.map((f: { text: string; count: number; locations: string[]; categories: string[] }) =>
  `- "${f.text}" occurred ${f.count} times at: ${f.locations.join(', ')} (categories: ${f.categories.join(', ')})`
).join('\n')}
Return ONLY the JSON.`
    })

    const text = (response.text || '')
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
    const analysis = JSON.parse(cleaned)
    return NextResponse.json({ analysis })
  } catch (err) {
    console.error('RCA error:', err)
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}
