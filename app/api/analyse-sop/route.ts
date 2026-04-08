import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const industry = formData.get('industry') as string || 'General'

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    const mediaType = file.type as 'application/pdf' | 'text/plain'

    let documentContent: Anthropic.MessageParam['content']

    if (file.type === 'application/pdf') {
      documentContent = [{
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: base64,
        },
      }, {
        type: 'text',
        text: `Analyse this SOP/Work Instruction document and generate a compliance audit checklist.
Each question must verify adherence to a specific procedure in the document.
Include the source section reference in the hint field.
Return ONLY valid JSON matching this exact schema:
{
  "title": "string",
  "description": "string",
  "estimatedMinutes": number,
  "sourceDocument": "${file.name}",
  "sections": [
    {
      "title": "string",
      "sourceSection": "string - the SOP section this covers",
      "questions": [
        {
          "text": "string - specific compliance check question",
          "type": "yes_no" | "pass_fail" | "text" | "number" | "photo",
          "hint": "string - reference to SOP section e.g. Section 3.2",
          "required": true,
          "weight": number 1-5
        }
      ]
    }
  ]
}
Generate 4-8 sections covering all major procedures. Make questions specific and measurable.`
      }]
    } else {
      // Plain text fallback
      const textContent = Buffer.from(arrayBuffer).toString('utf-8')
      documentContent = [{
        type: 'text',
        text: `Analyse this SOP document and generate a compliance audit checklist:

${textContent}

Return ONLY valid JSON with this schema:
{
  "title": "string",
  "description": "string", 
  "estimatedMinutes": number,
  "sourceDocument": "${file.name}",
  "sections": [{ "title": "string", "sourceSection": "string", "questions": [{ "text": "string", "type": "pass_fail", "hint": "string", "required": true, "weight": 3 }] }]
}`
      }]
    }

    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 3000,
      system: 'You are an expert H&S auditor. Generate precise compliance checklists from SOPs. Return ONLY valid JSON, no markdown, no preamble.',
      messages: [{ role: 'user', content: documentContent }]
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
    const template = JSON.parse(cleaned)

    return NextResponse.json({ template, filename: file.name })
  } catch (err) {
    console.error('SOP analysis error:', err)
    return NextResponse.json({ error: 'Failed to analyse document' }, { status: 500 })
  }
}
