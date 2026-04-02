import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const client = new Anthropic()
  try {
    const { audit, findings, answers } = await req.json()

    const totalQuestions = audit.totalQuestions || 0
    const answeredCount = Object.keys(answers || {}).length
    const photosAdded = findings.filter((f: { photos?: string[] }) => f.photos && f.photos.length > 0).length
    const failsWithNotes = findings.filter((f: { answer: string; notes?: string }) =>
      (f.answer === 'fail' || f.answer === 'no') && f.notes && f.notes.length > 10
    ).length
    const failsWithPhotos = findings.filter((f: { answer: string; photos?: string[] }) =>
      (f.answer === 'fail' || f.answer === 'no') && f.photos && f.photos.length > 0
    ).length
    const totalFails = findings.filter((f: { answer: string }) =>
      f.answer === 'fail' || f.answer === 'no'
    ).length

    // Calculate duration
    const durationMinutes = audit.startedAt && audit.submittedAt
      ? Math.floor((new Date(audit.submittedAt).getTime() - new Date(audit.startedAt).getTime()) / (1000 * 60))
      : null

    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 300,
      system: `You are a quality assessor for health and safety audits.
Score the audit quality 1-10 and provide specific feedback.
Return ONLY valid JSON:
{
  "qualityScore": number 1-10,
  "grade": "Excellent" | "Good" | "Adequate" | "Poor",
  "feedback": ["string", "string"],
  "strengths": ["string"],
  "improvements": ["string - specific actionable improvement"]
}`,
      messages: [{
        role: 'user',
        content: `Score this audit quality:
Audit: ${audit.templateTitle}
Completion: ${answeredCount}/${totalQuestions} questions answered
Duration: ${durationMinutes ? durationMinutes + ' minutes' : 'unknown'}
Total findings: ${findings.length}
Fail items with photos: ${failsWithPhotos}/${totalFails}
Fail items with notes: ${failsWithNotes}/${totalFails}
Photos taken total: ${photosAdded}
Score achieved: ${audit.score}%

Return ONLY the JSON.`
      }]
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
    const quality = JSON.parse(cleaned)

    return NextResponse.json({ quality })
  } catch (err) {
    console.error('Quality scoring error:', err)
    return NextResponse.json({ error: 'Quality scoring failed' }, { status: 500 })
  }
}
