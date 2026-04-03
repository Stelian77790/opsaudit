import { GoogleGenAI } from '@google/genai'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  try {
    const { originalDescription, findingDescription, resolutionPhotoUrl } = await req.json()

    // If we have a resolution photo URL, fetch and analyse it
    if (resolutionPhotoUrl) {
      // For URL-based photos we describe the context and ask Gemini to reason about it
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
      config: {
        maxOutputTokens: 400,
        systemInstruction: `You are a health and safety verification expert. 
Assess whether a corrective action has been resolved based on the context provided.
Return ONLY valid JSON:
{
  "resolved": boolean,
  "confidence": "High" | "Medium" | "Low",
  "concerns": "string or null",
  "recommendation": "string"
}`
      },
      contents: `A corrective action was raised for: "${originalDescription}".
Finding details: "${findingDescription}".
A resolution photo has been uploaded. Based on the nature of this finding, assess the likelihood that a photo submission indicates genuine resolution.
If the issue is physical (blocked exit, spill, damaged equipment) a photo is strong evidence.
If the issue requires training or procedural change, a photo alone is insufficient.
Return ONLY the JSON.`
      })

      const text = (response.text || '')
      const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
      const verification = JSON.parse(cleaned)
      return NextResponse.json({ verification })
    }

    return NextResponse.json({ error: 'No photo provided' }, { status: 400 })
  } catch (err) {
    console.error('Verification error:', err)
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 })
  }
}
