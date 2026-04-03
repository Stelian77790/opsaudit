import { GoogleGenAI } from '@google/genai'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  try {
    const { description, industry } = await req.json()
    if (!description) return NextResponse.json({ error: 'Description required' }, { status: 400 })

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      config: {
        maxOutputTokens: 2000,
        systemInstruction: `You are an expert health and safety auditor. Generate professional audit templates.
Return ONLY valid JSON with no preamble, no markdown, no explanation.
The JSON must match this exact schema:
{
  "title": "string",
  "description": "string",
  "estimatedMinutes": number,
  "sections": [
    {
      "title": "string",
      "questions": [
        {
          "text": "string",
          "type": "yes_no" | "pass_fail" | "text" | "number" | "photo" | "multiple_choice",
          "hint": "string or null",
          "required": true,
          "weight": number between 1-5
        }
      ]
    }
  ]
}
Generate 4-6 sections with 5-8 questions each. Make questions specific, practical, and measurable.`
      },
      contents: `Generate a detailed audit template for: ${description}\nIndustry context: ${industry || 'General'}\n\nReturn ONLY the JSON object.`
    })

    const text = (response.text || '')
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
    const template = JSON.parse(cleaned)

    return NextResponse.json({ template })
  } catch (err) {
    console.error('Template generation error:', err)
    return NextResponse.json({ error: 'Failed to generate template' }, { status: 500 })
  }
}
