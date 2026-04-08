import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { doc, getDoc, collection, getDocs, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { GoogleGenerativeAI } from '@google/genai'

// Allow forcing dynamic if needed, though POST handlers are usually dynamic
export const dynamic = 'force-dynamic'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '')
const model = genAI.getGenerativeModel({ 
  model: 'gemini-2.0-flash-exp',
  systemInstruction: 'You are a professional H&S consultant. Write concise executive summaries. Plain text only, no markdown, 3 paragraphs ~150 words total.'
})

export async function POST(req: NextRequest) {
  try {
    const { auditId, companyId, userId } = await req.json()

    // Ensure we have an API key
    if (!process.env.GOOGLE_API_KEY) {
      console.warn('GOOGLE_API_KEY is missing, AI generation will fail')
    }

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

    const prompt = `Write executive summary: Company: ${company.name}, Audit: ${audit.templateTitle}, Score: ${audit.score}%, Location: ${audit.locationName}, Total findings: ${findings.length}, Failed: ${failCount}, Critical: ${criticalCount}`

    const result = await model.generateContent(prompt)
    const summary = result.response.text() || ''

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
