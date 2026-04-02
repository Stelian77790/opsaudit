'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { db } from '@/lib/firebase'
import { doc, getDoc, collection, getDocs, updateDoc } from 'firebase/firestore'
import { Audit, AuditWithReport, Template, Finding, Company } from '@/types'
import { scoreColor, severityColor, formatDateTime } from '@/lib/utils'
import Link from 'next/link'
import toast from 'react-hot-toast'
import dynamic from 'next/dynamic'
import {
  ArrowLeft, ClipboardList, MapPin, User, Calendar,
  AlertTriangle, CheckCircle, XCircle, Minus,
  Sparkles, Play, Loader2, Download, FileText, RefreshCw
} from 'lucide-react'

// Lazy load PDF to avoid SSR issues
const PDFDownloadLink = dynamic(
  () => import('@react-pdf/renderer').then(m => m.PDFDownloadLink),
  { ssr: false, loading: () => <button className="btn-secondary text-sm opacity-50">Loading PDF...</button> }
)

export default function AuditDetailPage({ params }: { params: { id: string } }) {
  const { user } = useAuth()
  const router = useRouter()
  const [audit, setAudit] = useState<AuditWithReport | null>(null)
  const [template, setTemplate] = useState<Template | null>(null)
  const [findings, setFindings] = useState<Finding[]>([])
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [generatingReport, setGeneratingReport] = useState(false)
  const [reportData, setReportData] = useState<{ summary: string } | null>(null)
  const [AuditReport, setAuditReport] = useState<React.ComponentType<unknown> | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const auditSnap = await getDoc(doc(db, 'audits', params.id))
        if (!auditSnap.exists()) { router.push('/audits'); return }
        const auditData = { id: auditSnap.id, ...auditSnap.data() } as AuditWithReport
        setAudit(auditData)

        const [templateSnap, findingsSnap, companySnap] = await Promise.all([
          getDoc(doc(db, 'templates', auditData.templateId)),
          getDocs(collection(db, `audits/${params.id}/findings`)),
          user?.companyId ? getDoc(doc(db, 'companies', user.companyId)) : Promise.resolve(null),
        ])
        if (templateSnap.exists()) setTemplate({ id: templateSnap.id, ...templateSnap.data() } as Template)
        setFindings(findingsSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Finding))
        if (companySnap?.exists()) setCompany({ id: companySnap.id, ...companySnap.data() } as Company)

        // Load existing summary if available
        if (auditData.executiveSummary) {
          setReportData({ summary: auditData.executiveSummary as string })
        }
      } catch (err) { console.error(err) }
      finally { setLoading(false) }
    }
    load()
  }, [params.id, user?.companyId])

  async function generateReport() {
    if (!audit || !user?.companyId) return
    setGeneratingReport(true)
    try {
      const res = await fetch('/api/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auditId: audit.id,
          companyId: user.companyId,
          userId: user.uid,
          userName: user.name,
          userEmail: user.email,
          userRole: user.role,
        })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setReportData({ summary: data.summary })

      // Dynamically import PDF component
      const { default: AuditReportComponent } = await import('@/components/AuditReport')
      setAuditReport(AuditReportComponent as React.ComponentType<unknown>)

      toast.success('Report generated!')
    } catch (err) {
      console.error(err)
      toast.error('Report generation failed')
    } finally {
      setGeneratingReport(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 text-orange-400 animate-spin" />
    </div>
  )

  if (!audit) return null

  const criticalFindings = findings.filter(f => f.severity === 'critical')
  const highFindings = findings.filter(f => f.severity === 'high')
  const failFindings = findings.filter(f => f.answer === 'fail' || f.answer === 'no')

  const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    scheduled: { label: 'Scheduled', color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
    in_progress: { label: 'In Progress', color: 'text-orange-400 bg-orange-400/10 border-orange-400/20' },
    submitted: { label: 'Submitted', color: 'text-green-400 bg-green-400/10 border-green-400/20' },
    reviewed: { label: 'Reviewed', color: 'text-purple-400 bg-purple-400/10 border-purple-400/20' },
  }
  const statusConfig = STATUS_CONFIG[audit.status] || STATUS_CONFIG.scheduled

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/audits" className="btn-ghost p-2"><ArrowLeft className="w-4 h-4" /></Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white">{audit.templateTitle}</h1>
              <span className={`badge text-xs ${statusConfig.color}`}>{statusConfig.label}</span>
              {audit.anomalyFlags?.length ? (
                <span className="badge text-xs text-yellow-400 bg-yellow-400/10 border-yellow-400/20">⚠ Anomaly</span>
              ) : null}
            </div>
            <p className="text-neutral-500 text-xs mt-0.5">Ref: {audit.id.slice(0, 8).toUpperCase()} · {formatDateTime(audit.createdAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {audit.status === 'in_progress' && (
            <Link href={`/audits/${audit.id}/conduct`} className="btn-primary flex items-center gap-2 text-sm">
              <Play className="w-4 h-4" /> Continue
            </Link>
          )}
          {audit.status === 'submitted' && !reportData && (
            <button onClick={generateReport} disabled={generatingReport} className="btn-secondary flex items-center gap-2 text-sm">
              {generatingReport ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              {generatingReport ? 'Generating...' : 'Generate Report'}
            </button>
          )}
          {reportData && (
            <button onClick={generateReport} disabled={generatingReport} className="btn-secondary flex items-center gap-2 text-sm text-xs">
              <RefreshCw className="w-3.5 h-3.5" /> Regenerate
            </button>
          )}
        </div>
      </div>

      {/* Score */}
      {audit.score !== undefined && (
        <div className="card p-6">
          <div className="flex items-center gap-8">
            <div className="text-center">
              <p className="text-xs text-neutral-500 mb-1">Overall Score</p>
              <span className={`text-5xl font-bold ${scoreColor(audit.score)}`}>{audit.score}</span>
              <span className="text-neutral-600 text-lg">%</span>
            </div>
            <div className="flex-1 grid grid-cols-4 gap-3">
              {[
                { label: 'Critical', value: criticalFindings.length, color: 'text-red-400' },
                { label: 'High', value: highFindings.length, color: 'text-orange-400' },
                { label: 'Total Issues', value: failFindings.length, color: 'text-white' },
                { label: 'Total Checks', value: findings.length, color: 'text-neutral-400' },
              ].map(s => (
                <div key={s.label} className="bg-[#1A1A1A] rounded-lg p-3 text-center">
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-neutral-600 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Meta row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: MapPin, label: 'Location', value: audit.locationName },
          { icon: User, label: 'Auditor', value: audit.auditorName },
          { icon: Calendar, label: 'Submitted', value: formatDateTime(audit.submittedAt || audit.createdAt) },
        ].map(item => (
          <div key={item.label} className="card p-4 flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-500/10 rounded-lg flex items-center justify-center shrink-0">
              <item.icon className="w-4 h-4 text-orange-400" />
            </div>
            <div>
              <p className="text-xs text-neutral-600">{item.label}</p>
              <p className="text-sm text-white font-medium">{item.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Executive Summary */}
      {reportData?.summary && (
        <div className="card p-5 border-orange-500/20 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-orange-400" /> Executive Summary
            </h2>
          </div>
          <p className="text-sm text-neutral-400 leading-relaxed">{reportData.summary}</p>
        </div>
      )}

      {/* Anomaly Flags */}
      {audit.anomalyFlags && audit.anomalyFlags.length > 0 && (
        <div className="card p-4 border-yellow-500/20 bg-yellow-500/5">
          <h2 className="text-sm font-semibold text-yellow-400 mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Anomaly Flags
          </h2>
          <ul className="space-y-1">
            {audit.anomalyFlags.map((flag, i) => (
              <li key={i} className="text-xs text-neutral-400 flex items-start gap-2">
                <span className="text-yellow-400 shrink-0 mt-0.5">⚠</span>{flag}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Findings */}
      {findings.length > 0 && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-[#1F1F1F] flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-400" />
            <h2 className="text-sm font-semibold text-white">All Findings ({findings.length})</h2>
          </div>
          <div className="divide-y divide-[#1F1F1F]">
            {findings.map(finding => (
              <div key={finding.id} className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 shrink-0 ${
                    finding.answer === 'pass' || finding.answer === 'yes' ? 'text-green-400' :
                    finding.answer === 'na' ? 'text-neutral-500' : 'text-red-400'
                  }`}>
                    {finding.answer === 'pass' || finding.answer === 'yes' ? <CheckCircle className="w-4 h-4" /> :
                     finding.answer === 'na' ? <Minus className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-white">{finding.questionText}</p>
                    {finding.notes && <p className="text-xs text-neutral-500 mt-1">{finding.notes}</p>}
                  </div>
                  {finding.severity && (
                    <span className={`badge text-xs shrink-0 ${severityColor(finding.severity)}`}>{finding.severity}</span>
                  )}
                </div>
                {finding.aiAnalysis && (
                  <div className="ml-7 bg-orange-500/5 border border-orange-500/20 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Sparkles className="w-3 h-3 text-orange-400" />
                      <span className="text-xs font-medium text-orange-400">AI Analysis</span>
                    </div>
                    <p className="text-xs text-neutral-400">{finding.aiAnalysis}</p>
                    {finding.aiSuggestedAction && (
                      <p className="text-xs text-neutral-600 mt-1.5">→ {finding.aiSuggestedAction}</p>
                    )}
                  </div>
                )}
                {finding.photos?.length > 0 && (
                  <div className="ml-7 flex gap-2 flex-wrap">
                    {finding.photos.map((url, i) => (
                      <img key={i} src={url} alt="Evidence" className="w-20 h-20 object-cover rounded-lg border border-[#2A2A2A]" />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {audit.status === 'submitted' && findings.length === 0 && (
        <div className="card p-8 text-center">
          <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-2" />
          <p className="text-white font-medium">No issues found</p>
          <p className="text-neutral-600 text-sm">All checks passed</p>
        </div>
      )}
    </div>
  )
}
