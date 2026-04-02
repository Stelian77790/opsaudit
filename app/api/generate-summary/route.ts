import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const client = new Anthropic()
  try {
    const { audit, findings, companyName } = await req.json()

    const failCount = findings.filter((f: { answer: string }) =>
      f.answer === 'fail' || f.answer === 'no'
    ).length

    const criticalCount = findings.filter((f: { severity: string }) =>
      f.severity === 'critical'
    ).length

    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 600,
      system: `You are a professional health and safety consultant writing executive summaries for audit reports.
Write in a professional, clear, and constructive tone. Be specific but concise.
Write 3 short paragraphs totalling around 150 words.
Do not use bullet points. Do not use markdown. Plain text only.
First paragraph: Overall performance and score context.
Second paragraph: Key issues found and their significance.
Third paragraph: Priority recommendations and positive observations.`,
      messages: [{
        role: 'user',
        content: `Write an executive summary for this audit:
Company: ${companyName}
Audit: ${audit.templateTitle}
Location: ${audit.locationName}
Auditor: ${audit.auditorName}
Overall Score: ${audit.score}%
Total Findings: ${findings.length}
Failed Items: ${failCount}
Critical Issues: ${criticalCount}
Key findings: ${findings
  .filter((f: { severity: string; answer: string }) =>
    (f.answer === 'fail' || f.answer === 'no') && f.severity
  )
  .slice(0, 5)
  .map((f: { questionText: string; severity: string; aiSuggestedAction?: string }) =>
    `- ${f.questionText} (${f.severity})${f.aiSuggestedAction ? ': ' + f.aiSuggestedAction : ''}`
  )
  .join('\n')}`
      }]
    })

    const summary = response.content[0].type === 'text' ? response.content[0].text : ''
    return NextResponse.json({ summary })
  } catch (err) {
    console.error('Summary generation error:', err)
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 })
  }
}
