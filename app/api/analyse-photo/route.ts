import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const client = new Anthropic()
  try {
    const { imageBase64, mediaType, context } = await req.json()
    if (!imageBase64) return NextResponse.json({ error: 'Image required' }, { status: 400 })

    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1000,
      system: `You are an expert health and safety inspector. Analyse workplace photos for hazards.
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
If no hazards are found return an empty hazards array and overallRisk of "none".`,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType || 'image/jpeg',
              data: imageBase64,
            }
          },
          {
            type: 'text',
            text: `Analyse this workplace photo for health and safety hazards. Context: ${context || 'General workplace inspection'}. Return ONLY the JSON object.`
          }
        ]
      }]
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
    const analysis = JSON.parse(cleaned)

    return NextResponse.json({ analysis })
  } catch (err) {
    console.error('Photo analysis error:', err)
    return NextResponse.json({ error: 'Failed to analyse photo' }, { status: 500 })
  }
}
