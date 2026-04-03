import { GoogleGenAI } from '@google/genai'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  try {
    const { imageBase64, mediaType, context } = await req.json()
    if (!imageBase64) return NextResponse.json({ error: 'Image required' }, { status: 400 })

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      config: {
        maxOutputTokens: 1000,
        systemInstruction: `You are an expert health and safety inspector. Analyse workplace photos for hazards.
Return ONLY valid JSON with no preamble or markdown:
{
  "hazards": [
    {
      "description": "string - clear description of the hazard",
      "severity": "critical" | "high" | "medium" | "low",
      "category": "fire" | "electrical" | "manual_handling" | "housekeeping" | "chemical" | "structural" | "ppe" | "other",
      "confidence": "high" | "medium" | "low",
      "suggestedAction": "string - specific corrective action"
    }
  ],
  "overallRisk": "critical" | "high" | "medium" | "low" | "none",
  "summary": "string - brief 1 sentence summary",
  "compliantAreas": ["string"] 
}
If no hazards are found return an empty hazards array and overallRisk of "none".`
      },
      contents: [{
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: mediaType || 'image/jpeg',
              data: imageBase64,
            }
          },
          {
            text: `Analyse this workplace photo for health and safety hazards. Context: ${context || 'General workplace inspection'}. Return ONLY the JSON object.`
          }
        ]
      }]
    })

    const text = (response.text || '')
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
    const analysis = JSON.parse(cleaned)

    return NextResponse.json({ analysis })
  } catch (err) {
    console.error('Photo analysis error:', err)
    return NextResponse.json({ error: 'Failed to analyse photo' }, { status: 500 })
  }
}
