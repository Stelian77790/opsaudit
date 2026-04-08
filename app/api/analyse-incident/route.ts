import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  try {
    const { type, title, description, immediateActions, severity } = await req.json()

    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 700,
      system: `You are a workplace incident investigation expert with knowledge of UK HSE regulations.
Analyse workplace incidents and provide investigation support.
Return ONLY valid JSON:
{
  "rootCauseSuggestions": ["string", "string", "string"],
  "relatedAuditFindings": ["string"],
  "preventionRecommendations": ["string", "string", "string"],
  "regulatoryNotification": boolean,
  "regulatoryBody": "string or null",
  "riddorReportable": boolean,
  "investigationPriority": "Immediate" | "Within24Hours" | "Within7Days",
  "similarIncidentPattern": "string or null"
}
For regulatoryNotification: true if the incident type/severity would require RIDDOR reporting or similar.
For UK: RIDDOR applies to deaths, specified injuries, over-7-day incapacitation, dangerous occurrences.`,
      messages: [{
        role: 'user',
        content: `Analyse this workplace incident:
Type: ${type.replace('_', ' ')}
Severity: ${severity}
Title: ${title}
Description: ${description}
Immediate actions: ${immediateActions || 'none recorded'}

Provide root cause analysis and prevention recommendations. Return ONLY the JSON.`
      }]
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
    const analysis = JSON.parse(cleaned)

    return NextResponse.json({ analysis })
  } catch (err) {
    console.error('Incident analysis error:', err)
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}
