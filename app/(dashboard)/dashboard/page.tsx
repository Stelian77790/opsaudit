'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc } from 'firebase/firestore'
import { Audit, CorrectiveAction, Company } from '@/types'
import { scoreColor, formatDateTime } from '@/lib/utils'
import Link from 'next/link'
import {
  ClipboardList, AlertTriangle, CheckCircle, TrendingUp,
  Plus, ArrowRight, Activity, Calendar, Zap, TrendingDown,
  Building2, Sparkles, Search, Loader2
} from 'lucide-react'
import { ScoreTrendChart, SeverityDonut, AuditFrequencyChart } from '@/components/Charts'
import { format, subMonths } from 'date-fns'

export default function DashboardPage() {
  const { user } = useAuth()
  const [audits, setAudits] = useState<Audit[]>([])
  const [recentAudits, setRecentAudits] = useState<Audit[]>([])
  const [actions, setActions] = useState<CorrectiveAction[]>([])
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [aiQuery, setAiQuery] = useState('')
  const [aiAnswer, setAiAnswer] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  useEffect(() => {
    if (!user?.companyId) return
    async function load() {
      try {
        const [auditSnap, recentSnap, companySnap] = await Promise.all([
          getDocs(query(collection(db, 'audits'), where('companyId', '==', user!.companyId))),
          getDocs(query(collection(db, 'audits'), where('companyId', '==', user!.companyId), orderBy('createdAt', 'desc'), limit(5))),
          getDoc(doc(db, 'companies', user!.companyId!)),
        ])
        const allAudits = auditSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Audit)
        setAudits(allAudits)
        setRecentAudits(recentSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Audit))
        if (companySnap.exists()) setCompany({ id: companySnap.id, ...companySnap.data() } as Company)

        const allActions: CorrectiveAction[] = []
        for (const auditDoc of auditSnap.docs) {
          const actSnap = await getDocs(collection(db, `audits/${auditDoc.id}/actions`))
          actSnap.docs.forEach(d => allActions.push({ id: d.id, auditId: auditDoc.id, ...d.data() } as CorrectiveAction))
        }
        setActions(allActions)
      } catch (err) { console.error(err) }
      finally { setLoading(false) }
    }
    load()
  }, [user?.companyId])

  // Derived analytics
  const submitted = audits.filter(a => a.status === 'submitted' || a.status === 'reviewed')
  const avgScore = submitted.length > 0 ? Math.round(submitted.reduce((s, a) => s + (a.score || 0), 0) / submitted.length) : null
  const healthScore = company?.healthScore || avgScore
  const openActions = actions.filter(a => a.status === 'open' || a.status === 'in_progress')
  const criticalActions = openActions.filter(a => a.priority === 'critical')

  // Score trend — last 6 months
  const scoreTrend = Array.from({ length: 6 }, (_, i) => {
    const month = subMonths(new Date(), 5 - i)
    const monthKey = format(month, 'MMM')
    const monthAudits = submitted.filter(a => {
      const d = a.submittedAt ? new Date(a.submittedAt as unknown as string) : null
      return d && format(d, 'MMM yyyy') === format(month, 'MMM yyyy')
    })
    const avg = monthAudits.length > 0
      ? Math.round(monthAudits.reduce((s, a) => s + (a.score || 0), 0) / monthAudits.length)
      : null
    return { date: monthKey, score: avg || 0 }
  })

  // Audit frequency
  const auditFreq = Array.from({ length: 6 }, (_, i) => {
    const month = subMonths(new Date(), 5 - i)
    const count = audits.filter(a => {
      const d = new Date(a.createdAt as unknown as string)
      return format(d, 'MMM yyyy') === format(month, 'MMM yyyy')
    }).length
    return { month: format(month, 'MMM'), count }
  })

  // Severity distribution
  const allFindings = { critical: 0, high: 0, medium: 0, low: 0 }
  actions.forEach(a => {
    const p = a.priority as keyof typeof allFindings
    if (p in allFindings) allFindings[p]++
  })

  // Category breakdown
  const categories: Record<string, number> = {}
  actions.forEach(a => {
    const cat = (a as unknown as { category?: string }).category || 'other'
    categories[cat] = (categories[cat] || 0) + 1
  })
  const categoryData = Object.entries(categories)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)

  // AI Natural Language Query
  async function handleAiQuery(e: React.FormEvent) {
    e.preventDefault()
    if (!aiQuery.trim() || !user?.companyId) return
    setAiLoading(true)
    setAiAnswer('')
    try {
      const context = {
        totalAudits: audits.length,
        submittedAudits: submitted.length,
        avgScore,
        openActions: openActions.length,
        criticalActions: criticalActions.length,
        resolvedActions: actions.filter(a => a.status === 'resolved').length,
        locations: [...new Set(audits.map(a => a.locationName))],
        recentScores: submitted.slice(0, 10).map(a => ({ location: a.locationName, score: a.score, date: formatDateTime(a.submittedAt) })),
      }
      const res = await fetch('/api/analytics-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: aiQuery, context }),
      })
      const data = await res.json()
      setAiAnswer(data.answer || 'Unable to answer that question with current data.')
    } catch { setAiAnswer('Query failed. Try again.') }
    finally { setAiLoading(false) }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 text-orange-400 animate-spin" />
    </div>
  )

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-neutral-500 text-sm mt-0.5">{company?.name} · {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <Link href="/audits/new" className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Audit
        </Link>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          {
            label: 'Health Score',
            value: healthScore !== null ? `${healthScore}` : '—',
            suffix: healthScore !== null ? '/100' : '',
            color: healthScore !== null ? scoreColor(healthScore) : 'text-neutral-500',
            icon: Activity,
            sub: 'Composite operational score',
            trend: null,
          },
          {
            label: 'Open Actions',
            value: `${openActions.length}`,
            color: openActions.length > 5 ? 'text-orange-400' : 'text-green-400',
            icon: AlertTriangle,
            sub: `${criticalActions.length} critical`,
            trend: null,
          },
          {
            label: 'Audits Completed',
            value: `${submitted.length}`,
            color: 'text-blue-400',
            icon: ClipboardList,
            sub: `${audits.length} total created`,
            trend: null,
          },
          {
            label: 'Avg Score',
            value: avgScore !== null ? `${avgScore}%` : '—',
            color: avgScore !== null ? scoreColor(avgScore) : 'text-neutral-500',
            icon: TrendingUp,
            sub: 'Across submitted audits',
            trend: null,
          },
        ].map(stat => (
          <div key={stat.label} className="card-hover p-5">
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs text-neutral-500 font-medium uppercase tracking-wide">{stat.label}</p>
              <div className="w-8 h-8 bg-[#1A1A1A] rounded-lg flex items-center justify-center">
                <stat.icon className="w-4 h-4 text-neutral-500" />
              </div>
            </div>
            <div className="flex items-baseline gap-1">
              <span className={`text-3xl font-bold ${stat.color}`}>{stat.value}</span>
              {stat.suffix && <span className="text-neutral-600 text-sm">{stat.suffix}</span>}
            </div>
            <p className="text-xs text-neutral-600 mt-1">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* AI Query */}
      <div className="card p-5 border-orange-500/10">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-orange-400" />
          <h2 className="text-sm font-semibold text-white">Ask Your Data</h2>
          <span className="text-xs text-neutral-600">Natural language analytics</span>
        </div>
        <form onSubmit={handleAiQuery} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-600 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              className="input pl-9 text-sm"
              placeholder="e.g. Which location has the most open actions? What is our average score this month?"
              value={aiQuery}
              onChange={e => setAiQuery(e.target.value)}
            />
          </div>
          <button type="submit" disabled={aiLoading || !aiQuery.trim()} className="btn-primary text-sm px-4 flex items-center gap-2">
            {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Ask
          </button>
        </form>
        {aiAnswer && (
          <div className="mt-3 bg-orange-500/5 border border-orange-500/20 rounded-lg p-3 animate-fade-in">
            <p className="text-sm text-neutral-300 leading-relaxed">{aiAnswer}</p>
          </div>
        )}
        {!aiAnswer && (
          <div className="flex gap-2 mt-2 flex-wrap">
            {[
              'Which location scores lowest?',
              'How many critical actions are open?',
              'What is our audit completion rate?',
            ].map(q => (
              <button key={q} onClick={() => setAiQuery(q)}
                className="text-xs text-neutral-600 hover:text-orange-400 bg-[#1A1A1A] border border-[#2A2A2A] px-2.5 py-1 rounded-full transition-colors">
                {q}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-3 gap-4">
        {/* Score Trend */}
        <div className="col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-orange-400" /> Score Trend
            </h2>
            <span className="text-xs text-neutral-600">Last 6 months</span>
          </div>
          {scoreTrend.some(d => d.score > 0) ? (
            <ScoreTrendChart data={scoreTrend} />
          ) : (
            <div className="h-[180px] flex items-center justify-center text-neutral-700 text-sm">
              Complete audits to see trend data
            </div>
          )}
        </div>

        {/* Severity Distribution */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-400" /> By Severity
          </h2>
          <SeverityDonut {...allFindings} />
          <div className="grid grid-cols-2 gap-2 mt-2">
            {[
              { label: 'Critical', count: allFindings.critical, color: 'bg-red-400' },
              { label: 'High', count: allFindings.high, color: 'bg-orange-400' },
              { label: 'Medium', count: allFindings.medium, color: 'bg-yellow-400' },
              { label: 'Low', count: allFindings.low, color: 'bg-green-400' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${item.color}`} />
                <span className="text-xs text-neutral-500">{item.label}</span>
                <span className="text-xs text-white ml-auto">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-3 gap-4">
        {/* Recent Audits */}
        <div className="col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-orange-400" /> Recent Audits
            </h2>
            <Link href="/audits" className="text-xs text-neutral-500 hover:text-orange-400 flex items-center gap-1 transition-colors">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {recentAudits.length === 0 ? (
            <div className="text-center py-6">
              <ClipboardList className="w-8 h-8 text-neutral-700 mx-auto mb-2" />
              <p className="text-neutral-600 text-sm">No audits yet</p>
              <Link href="/audits/new" className="text-orange-400 text-xs hover:text-orange-300 mt-1 inline-block">Create your first →</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {recentAudits.map(audit => (
                <Link key={audit.id} href={`/audits/${audit.id}`}
                  className="flex items-center justify-between p-3 bg-[#1A1A1A] rounded-lg hover:bg-[#1F1F1F] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${
                      audit.status === 'submitted' ? 'bg-green-400' :
                      audit.status === 'in_progress' ? 'bg-orange-400' : 'bg-blue-400'
                    }`} />
                    <div>
                      <p className="text-sm text-white font-medium">{audit.templateTitle}</p>
                      <p className="text-xs text-neutral-600">{audit.locationName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {audit.score !== undefined && (
                      <span className={`text-sm font-semibold ${scoreColor(audit.score)}`}>{audit.score}%</span>
                    )}
                    <span className={`badge text-xs ${
                      audit.status === 'submitted' ? 'text-green-400 bg-green-400/10 border-green-400/20' :
                      audit.status === 'in_progress' ? 'text-orange-400 bg-orange-400/10 border-orange-400/20' :
                      'text-blue-400 bg-blue-400/10 border-blue-400/20'
                    }`}>
                      {audit.status.replace('_', ' ')}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Audit Frequency + Quick Actions */}
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-orange-400" /> Audit Volume
            </h2>
            <AuditFrequencyChart data={auditFreq} />
          </div>

          <div className="card p-4 border-orange-500/20 bg-orange-500/5">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-orange-400" />
              <h2 className="text-sm font-semibold text-orange-400">Quick Actions</h2>
            </div>
            <div className="space-y-2">
              {[
                { label: 'Create template with AI', href: '/templates/new?mode=ai', icon: Sparkles },
                { label: 'Schedule an audit', href: '/audits/new', icon: Calendar },
                { label: 'Review open actions', href: '/actions', icon: AlertTriangle },
                { label: 'Invite team member', href: '/team', icon: TrendingUp },
              ].map(item => (
                <Link key={item.href} href={item.href}
                  className="flex items-center gap-2 text-xs text-neutral-400 hover:text-orange-400 transition-colors py-0.5">
                  <item.icon className="w-3 h-3 text-orange-500/50 shrink-0" />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
