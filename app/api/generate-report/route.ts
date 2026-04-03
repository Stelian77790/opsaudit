import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { doc, getDoc, collection, getDocs, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { GoogleGenAI } from '@google/genai'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  try {
    const { auditId, companyId, userId } = await req.json()

    const [auditSnap, companySnap] = await Promise.all([
      getDoc(doc(db, 'audits', auditId)),
      getDoc(doc(db, 'companies', companyId)),
    ])

    if (!auditSnap.exists() || !companySnap.exists()) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const audit = auditSnap.data() as Record<string, unknown>
    const company = companySnap.data() as Record<string, unknown>
    const findingsSnap = await getDocs(collection(db, `audits/${auditId}/findings`))
    const findings = findingsSnap.docs.map(d => d.data() as Record<string, unknown>)

    const failCount = findings.filter(f => f.answer === 'fail' || f.answer === 'no').length
    const criticalCount = findings.filter(f => f.severity === 'critical').length

    const summaryRes = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      config: {
        maxOutputTokens: 600,
        systemInstruction: 'You are a professional H&S consultant. Write concise executive summaries. Plain text only, no markdown, 3 paragraphs ~150 words total.'
      },
      contents: `Write executive summary: Company: ${company.name}, Audit: ${audit.templateTitle}, Score: ${audit.score}%, Location: ${audit.locationName}, Total findings: ${findings.length}, Failed: ${failCount}, Critical: ${criticalCount}`
    })
    const summary = (summaryRes.text || '')

    const reportRef = await addDoc(collection(db, `audits/${auditId}/reports`), {
      auditId, companyId, summary, generatedBy: userId,
      generatedAt: serverTimestamp(), status: 'generated',
    })

    await updateDoc(doc(db, 'audits', auditId), {
      reportId: reportRef.id,
      executiveSummary: summary,
    })

    return NextResponse.json({ reportId: reportRef.id, summary, audit, findings, company })
  } catch (err) {
    console.error('Report error:', err)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}
