'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { db } from '@/lib/firebase'
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore'
import { Audit, CorrectiveAction, Location } from '@/types'
import { scoreColor } from '@/lib/utils'
import toast from 'react-hot-toast'
import {
  Brain, TrendingUp, TrendingDown, Minus,
  AlertTriangle, Sparkles, Loader2, RefreshCw,
  Target, Lightbulb, ArrowRight, MapPin
} from 'lucide-react'

interface Prediction {
  riskTrajectory: string
  predictedScoreNextAudit: number
  topRisks: string[]
  recommendations: string[]
  confidence: string
  summary: string
}

interface RcaResult {
  rootCauses: Array<{
    finding: string
    occurrences: number
    rootCause: string
    causeType: string
    evidence: string
    systemicFix: string
    urgency: string
  }>
  overallTheme: string
  priorityAction: string
}

const TRAJECTORY_CONFIG: Record<string, { icon: typeof TrendingUp; color: string; bg: string }> = {
  Improving: { icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-400/10 border-green-400/20' },
  Stable: { icon: Minus, color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/20' },
  Deteriorating: { icon: TrendingDown, color: 'text-orange-400', bg: 'bg-orange-400/10 border-orange-400/20' },
  Critical: { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-400/10 border-red-400/20' },
}

const CAUSE_COLORS: Record<string, string> = {
  TrainingGap: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  EquipmentFailure: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
  ProcessFailure: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  CultureIssue: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
  ResourceConstraint: 'text-red-400 bg-red-400/10 border-red-400/20',
  Other: 'text-neutral-400 bg-neutral-400/10 border-neutral-400/20',
}

export default function IntelligencePage() {
  const { user } = useAuth()
  const [audits, setAudits] = useState<Audit[]>([])
  const [actions, setActions] = useState<CorrectiveAction[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [predictions, setPredictions] = useState<Record<string, Prediction>>({})
  const [rca, setRca] = useState<RcaResult | null>(null)
  const [loadingPrediction, setLoadingPrediction] = useState<string | null>(null)
  const [loadingRca, setLoadingRca] = useState(false)
  const [dataLoading, setDataLoading] = useState(true)

  useEffect(() => {
    if (!user?.companyId) return
    async function load() {
      try {
        const [auditSnap, locSnap] = await Promise.all([
          getDocs(query(collection(db, 'audits'), where('companyId', '==', user!.companyId), orderBy('createdAt', 'desc'))),
          getDocs(collection(db, `companies/${user!.companyId}/locations`)),
        ])
        const allAudits = auditSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Audit)
        setAudits(allAudits)
        setLocations(locSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Location))

        const allActions: CorrectiveAction[] = []
        for (const auditDoc of auditSnap.docs) {
          const actSnap = await getDocs(collection(db, `audits/${auditDoc.id}/actions`))
          actSnap.docs.forEach(d => allActions.push({ id: d.id, auditId: auditDoc.id, ...d.data() } as CorrectiveAction))
        }
        setActions(allActions)
      } catch (err) { console.error(err) }
      finally { setDataLoading(false) }
    }
    load()
  }, [user?.companyId])

  async function generatePrediction(location: Location) {
    setLoadingPrediction(location.id)
    try {
      const locationAudits = audits
        .filter(a => a.locationId === location.id && a.status === 'submitted')
        .slice(0, 10)
        .map(a => ({ score: a.score || 0, date: new Date(a.submittedAt as unknown as string).toLocaleDateString() }))

      const locationActions = actions.filter(a => a.locationId === location.id && a.status !== 'resolved')

      const res = await fetch('/api/predict-risk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationName: location.name,
          auditHistory: locationAudits,
          openActions: locationActions,
          industry: user?.companyId,
        })
      })
      const data = await res.json()
      if (data.prediction) {
        setPredictions(prev => ({ ...prev, [location.id]: data.prediction }))
      }
    } catch (err) {
      console.error(err)
      toast.error('Prediction failed')
    } finally {
      setLoadingPrediction(null)
    }
  }

  async function runRca() {
    if (!user?.companyId) return
    setLoadingRca(true)
    try {
      // Find recurring findings (same question text appearing 3+ times)
      const findingCounts: Record<string, { count: number; locations: string[]; categories: string[] }> = {}

      for (const audit of audits.filter(a => a.status === 'submitted')) {
        const findingsSnap = await getDocs(collection(db, `audits/${audit.id}/findings`))
        findingsSnap.docs.forEach(d => {
          const f = d.data()
          if (f.answer === 'fail' || f.answer === 'no') {
            const key = f.questionText
            if (!findingCounts[key]) findingCounts[key] = { count: 0, locations: [], categories: [] }
            findingCounts[key].count++
            if (!findingCounts[key].locations.includes(audit.locationName)) {
              findingCounts[key].locations.push(audit.locationName)
            }
            if (f.category && !findingCounts[key].categories.includes(f.category)) {
              findingCounts[key].categories.push(f.category)
            }
          }
        })
      }

      const recurring = Object.entries(findingCounts)
        .filter(([, v]) => v.count >= 2)
        .map(([text, data]) => ({ text, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8)

      if (recurring.length === 0) {
        toast('Not enough recurring findings for analysis yet — complete more audits')
        setLoadingRca(false)
        return
      }

      const res = await fetch('/api/root-cause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recurringFindings: recurring,
          companyName: 'Your Company',
          industry: 'Operations',
        })
      })
      const data = await res.json()
      if (data.analysis) setRca(data.analysis)
    } catch (err) {
      console.error(err)
      toast.error('RCA failed')
    } finally {
      setLoadingRca(false)
    }
  }

  if (dataLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 text-orange-400 animate-spin" />
    </div>
  )

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Brain className="w-6 h-6 text-orange-400" /> Intelligence
        </h1>
        <p className="text-neutral-500 text-sm mt-0.5">Predictive risk analysis and root cause identification</p>
      </div>

      {/* Predictive Risk by Location */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Target className="w-4 h-4 text-orange-400" /> Predictive Risk Index
          </h2>
          <p className="text-xs text-neutral-600">AI analyses audit history to forecast next audit performance</p>
        </div>

        {locations.length === 0 ? (
          <p className="text-neutral-600 text-sm text-center py-6">No locations configured yet</p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {locations.map(location => {
              const prediction = predictions[location.id]
              const isLoading = loadingPrediction === location.id
              const locationAudits = audits.filter(a => a.locationId === location.id && a.status === 'submitted')
              const latestScore = locationAudits[0]?.score
              const trajectoryConfig = prediction ? TRAJECTORY_CONFIG[prediction.riskTrajectory] : null

              return (
                <div key={location.id} className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-orange-400" />
                        <p className="text-sm font-medium text-white">{location.name}</p>
                      </div>
                      <p className="text-xs text-neutral-600 mt-0.5">{location.city}</p>
                    </div>
                    {latestScore !== undefined && (
                      <span className={`text-lg font-bold ${scoreColor(latestScore)}`}>{latestScore}%</span>
                    )}
                  </div>

                  {!prediction && !isLoading && (
                    <button onClick={() => generatePrediction(location)}
                      disabled={locationAudits.length === 0}
                      className="w-full py-2 border border-dashed border-[#2A2A2A] rounded-lg text-xs text-neutral-600 hover:border-orange-500/30 hover:text-orange-400 transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed">
                      <Sparkles className="w-3.5 h-3.5" />
                      {locationAudits.length === 0 ? 'No audits yet' : 'Generate Prediction'}
                    </button>
                  )}

                  {isLoading && (
                    <div className="flex items-center justify-center gap-2 py-3">
                      <Loader2 className="w-4 h-4 text-orange-400 animate-spin" />
                      <span className="text-xs text-neutral-500">Analysing...</span>
                    </div>
                  )}

                  {prediction && trajectoryConfig && (
                    <div className="space-y-2 animate-fade-in">
                      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${trajectoryConfig.bg}`}>
                        <trajectoryConfig.icon className={`w-3.5 h-3.5 ${trajectoryConfig.color}`} />
                        <span className={`text-xs font-medium ${trajectoryConfig.color}`}>{prediction.riskTrajectory}</span>
                        <span className="text-xs text-neutral-600 ml-auto">{prediction.confidence} confidence</span>
                      </div>
                      <p className="text-xs text-neutral-500">{prediction.summary}</p>
                      <div className="space-y-1">
                        {prediction.topRisks.slice(0, 2).map((risk, i) => (
                          <div key={i} className="flex items-start gap-1.5 text-xs text-neutral-600">
                            <AlertTriangle className="w-3 h-3 text-orange-400/50 shrink-0 mt-0.5" />
                            {risk}
                          </div>
                        ))}
                      </div>
                      <button onClick={() => generatePrediction(location)} className="text-xs text-neutral-700 hover:text-orange-400 flex items-center gap-1 transition-colors">
                        <RefreshCw className="w-3 h-3" /> Refresh
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Root Cause Analysis */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-orange-400" /> Root Cause Analysis
          </h2>
          <button onClick={runRca} disabled={loadingRca || audits.length < 2}
            className="btn-primary text-sm flex items-center gap-2">
            {loadingRca ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loadingRca ? 'Analysing...' : 'Run Analysis'}
          </button>
        </div>

        {!rca && !loadingRca && (
          <div className="text-center py-8 border border-dashed border-[#2A2A2A] rounded-xl">
            <Brain className="w-8 h-8 text-neutral-700 mx-auto mb-2" />
            <p className="text-neutral-600 text-sm">Click Run Analysis to identify recurring patterns</p>
            <p className="text-neutral-700 text-xs mt-1">Requires at least 5 completed audits with findings</p>
          </div>
        )}

        {loadingRca && (
          <div className="flex items-center justify-center gap-2 py-8">
            <Loader2 className="w-5 h-5 text-orange-400 animate-spin" />
            <span className="text-sm text-neutral-500">Analysing patterns across all audits...</span>
          </div>
        )}

        {rca && (
          <div className="space-y-4 animate-fade-in">
            {/* Overall theme */}
            <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-4">
              <p className="text-xs text-orange-400 font-medium uppercase tracking-wide mb-1">Overall Theme</p>
              <p className="text-sm text-white">{rca.overallTheme}</p>
              <div className="mt-3 pt-3 border-t border-orange-500/10">
                <p className="text-xs text-neutral-500 font-medium mb-1">Priority Action</p>
                <p className="text-sm text-orange-400 flex items-start gap-2">
                  <ArrowRight className="w-4 h-4 shrink-0 mt-0.5" />{rca.priorityAction}
                </p>
              </div>
            </div>

            {/* Root causes */}
            <div className="space-y-3">
              {rca.rootCauses.map((rc, i) => (
                <div key={i} className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <p className="text-sm text-white font-medium">{rc.finding}</p>
                      <p className="text-xs text-neutral-600 mt-0.5">{rc.occurrences} occurrences</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`badge text-xs ${CAUSE_COLORS[rc.causeType] || ''}`}>{rc.causeType.replace(/([A-Z])/g, ' $1').trim()}</span>
                      <span className={`badge text-xs ${
                        rc.urgency === 'Immediate' ? 'text-red-400 bg-red-400/10 border-red-400/20' :
                        rc.urgency === 'ShortTerm' ? 'text-orange-400 bg-orange-400/10 border-orange-400/20' :
                        'text-neutral-400 bg-neutral-400/10 border-neutral-400/20'
                      }`}>{rc.urgency}</span>
                    </div>
                  </div>
                  <p className="text-xs text-neutral-500 mb-2"><span className="text-neutral-400 font-medium">Root cause:</span> {rc.rootCause}</p>
                  <p className="text-xs text-neutral-600"><span className="text-neutral-500 font-medium">Fix:</span> {rc.systemicFix}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
