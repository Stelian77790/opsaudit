'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { db } from '@/lib/firebase'
import { collection, addDoc, getDocs, query, where, orderBy, doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { logActivity } from '@/lib/auditLog'
import { formatDateTime } from '@/lib/utils'
import toast from 'react-hot-toast'
import {
  AlertOctagon, Plus, X, Loader2, Sparkles,
  ChevronRight, Camera, User, Calendar, FileText
} from 'lucide-react'

type IncidentType = 'injury' | 'near_miss' | 'dangerous_occurrence' | 'property_damage' | 'environmental'
type IncidentSeverity = 'critical' | 'high' | 'medium' | 'low'

interface Incident {
  id: string
  companyId: string
  locationName: string
  type: IncidentType
  title: string
  description: string
  dateTime: string
  reportedBy: string
  reportedByName: string
  peopleInvolved: string
  immediateActions: string
  photos: string[]
  severity: IncidentSeverity
  status: 'open' | 'investigating' | 'closed'
  aiAnalysis?: {
    rootCauseSuggestions: string[]
    relatedAuditFindings: string[]
    preventionRecommendations: string[]
    regulatoryNotification: boolean
    regulatoryBody?: string
  }
  linkedAuditIds: string[]
  createdAt: Date
}

const INCIDENT_TYPES: Record<IncidentType, { label: string; icon: string; color: string }> = {
  injury: { label: 'Injury / Illness', icon: '🤕', color: 'text-red-400 bg-red-400/10 border-red-400/20' },
  near_miss: { label: 'Near Miss', icon: '⚡', color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20' },
  dangerous_occurrence: { label: 'Dangerous Occurrence', icon: '💥', color: 'text-orange-400 bg-orange-400/10 border-orange-400/20' },
  property_damage: { label: 'Property Damage', icon: '🏚️', color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
  environmental: { label: 'Environmental', icon: '🌿', color: 'text-green-400 bg-green-400/10 border-green-400/20' },
}

const SEVERITY_COLORS: Record<IncidentSeverity, string> = {
  critical: 'text-red-400 bg-red-400/10 border-red-400/20',
  high: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
  medium: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  low: 'text-green-400 bg-green-400/10 border-green-400/20',
}

export default function IncidentsPage() {
  const { user } = useAuth()
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null)
  const [form, setForm] = useState({
    type: 'near_miss' as IncidentType,
    title: '',
    description: '',
    dateTime: new Date().toISOString().slice(0, 16),
    peopleInvolved: '',
    immediateActions: '',
    severity: 'medium' as IncidentSeverity,
    locationName: 'Main Site',
  })

  useEffect(() => {
    if (!user?.companyId) return
    getDocs(query(
      collection(db, 'incidents'),
      where('companyId', '==', user.companyId),
      orderBy('createdAt', 'desc')
    )).then(snap => {
      setIncidents(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Incident))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [user?.companyId])

  async function handleSubmit() {
    if (!form.title || !form.description || !user?.companyId) {
      toast.error('Fill in title and description')
      return
    }
    setSubmitting(true)
    try {
      const incidentData = {
        companyId: user.companyId,
        locationName: form.locationName,
        type: form.type,
        title: form.title,
        description: form.description,
        dateTime: form.dateTime,
        reportedBy: user.uid,
        reportedByName: user.name,
        peopleInvolved: form.peopleInvolved,
        immediateActions: form.immediateActions,
        severity: form.severity,
        status: 'open',
        photos: [],
        linkedAuditIds: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }

      const ref = await addDoc(collection(db, 'incidents'), incidentData)

      // Run AI analysis
      const aiRes = await fetch('/api/analyse-incident', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: form.type,
          title: form.title,
          description: form.description,
          immediateActions: form.immediateActions,
          severity: form.severity,
          companyId: user.companyId,
        }),
      })
      const aiData = await aiRes.json()

      if (aiData.analysis) {
        await updateDoc(doc(db, 'incidents', ref.id), { aiAnalysis: aiData.analysis })
      }

      const newIncident: Incident = {
        id: ref.id,
        ...incidentData,
        aiAnalysis: aiData.analysis,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as Incident

      setIncidents(prev => [newIncident, ...prev])
      setShowForm(false)
      toast.success('Incident reported and analysed')

      await logActivity(user.companyId, {
        userId: user.uid, name: user.name, role: user.role || '', email: user.email,
      }, {
        action: 'incident_reported',
        category: 'incident',
        target: { type: 'incident', id: ref.id, label: form.title },
        metadata: { type: form.type, severity: form.severity },
      })
    } catch (err) {
      console.error(err)
      toast.error('Failed to report incident')
    } finally {
      setSubmitting(false)
    }
  }

  const stats = {
    open: incidents.filter(i => i.status === 'open').length,
    investigating: incidents.filter(i => i.status === 'investigating').length,
    critical: incidents.filter(i => i.severity === 'critical').length,
    thisMonth: incidents.filter(i => {
      const d = new Date(i.createdAt as unknown as string)
      const now = new Date()
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }).length,
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <AlertOctagon className="w-6 h-6 text-red-400" /> Incidents
          </h1>
          <p className="text-neutral-500 text-sm mt-0.5">{incidents.length} total · {stats.open} open</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> Report Incident
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Open', value: stats.open, color: 'text-orange-400' },
          { label: 'Investigating', value: stats.investigating, color: 'text-blue-400' },
          { label: 'Critical', value: stats.critical, color: 'text-red-400' },
          { label: 'This Month', value: stats.thisMonth, color: 'text-white' },
        ].map(s => (
          <div key={s.label} className="card p-4 text-center">
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-neutral-600 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Incidents List */}
      {loading ? (
        <div className="flex items-center justify-center h-40"><Loader2 className="w-5 h-5 text-red-400 animate-spin" /></div>
      ) : incidents.length === 0 ? (
        <div className="card p-12 text-center">
          <AlertOctagon className="w-10 h-10 text-neutral-700 mx-auto mb-2" />
          <p className="text-white font-medium">No incidents reported</p>
          <p className="text-neutral-600 text-sm">Report near misses and incidents to track patterns</p>
        </div>
      ) : (
        <div className="space-y-2">
          {incidents.map(incident => {
            const typeConfig = INCIDENT_TYPES[incident.type]
            return (
              <div key={incident.id}
                onClick={() => setSelectedIncident(incident)}
                className="card-hover p-4 flex items-center gap-4 cursor-pointer">
                <div className="text-2xl shrink-0">{typeConfig?.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm text-white font-medium">{incident.title}</p>
                    <span className={`badge text-xs ${SEVERITY_COLORS[incident.severity]}`}>{incident.severity}</span>
                    {incident.aiAnalysis?.regulatoryNotification && (
                      <span className="badge text-xs text-red-400 bg-red-400/10 border-red-400/20">Reportable</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-neutral-600">
                    <span className={`badge text-xs ${typeConfig?.color}`}>{typeConfig?.label}</span>
                    <span className="flex items-center gap-1"><User className="w-3 h-3" />{incident.reportedByName}</span>
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDateTime(incident.createdAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`badge text-xs ${
                    incident.status === 'open' ? 'text-orange-400 bg-orange-400/10 border-orange-400/20' :
                    incident.status === 'investigating' ? 'text-blue-400 bg-blue-400/10 border-blue-400/20' :
                    'text-neutral-500 bg-neutral-500/10 border-neutral-500/20'
                  }`}>{incident.status}</span>
                  {incident.aiAnalysis && <Sparkles className="w-3.5 h-3.5 text-orange-400" />}
                  <ChevronRight className="w-4 h-4 text-neutral-700" />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Incident Detail Panel */}
      {selectedIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedIncident(null)} />
          <div className="relative w-full max-w-lg h-full bg-[#0D0D0D] border-l border-[#1F1F1F] overflow-y-auto p-5 space-y-5 animate-slide-up">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">{INCIDENT_TYPES[selectedIncident.type]?.icon}</span>
                  <h2 className="text-base font-semibold text-white">{selectedIncident.title}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`badge text-xs ${SEVERITY_COLORS[selectedIncident.severity]}`}>{selectedIncident.severity}</span>
                  <span className={`badge text-xs ${INCIDENT_TYPES[selectedIncident.type]?.color}`}>{INCIDENT_TYPES[selectedIncident.type]?.label}</span>
                </div>
              </div>
              <button onClick={() => setSelectedIncident(null)} className="btn-ghost p-1.5"><X className="w-4 h-4" /></button>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs text-neutral-500 font-medium mb-1">Description</p>
                <p className="text-sm text-neutral-300 leading-relaxed">{selectedIncident.description}</p>
              </div>
              {selectedIncident.immediateActions && (
                <div>
                  <p className="text-xs text-neutral-500 font-medium mb-1">Immediate Actions Taken</p>
                  <p className="text-sm text-neutral-300">{selectedIncident.immediateActions}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Location', value: selectedIncident.locationName },
                  { label: 'Reported By', value: selectedIncident.reportedByName },
                  { label: 'Date & Time', value: selectedIncident.dateTime },
                  { label: 'Status', value: selectedIncident.status },
                ].map(item => (
                  <div key={item.label} className="bg-[#1A1A1A] rounded-lg p-3">
                    <p className="text-xs text-neutral-600">{item.label}</p>
                    <p className="text-sm text-white mt-0.5">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Analysis */}
            {selectedIncident.aiAnalysis && (
              <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-orange-400" />
                  <span className="text-sm font-medium text-orange-400">AI Analysis</span>
                  {selectedIncident.aiAnalysis.regulatoryNotification && (
                    <span className="badge text-xs text-red-400 bg-red-400/10 border-red-400/20 ml-auto">
                      ⚠ Regulatory Report Required
                    </span>
                  )}
                </div>
                {selectedIncident.aiAnalysis.rootCauseSuggestions?.length > 0 && (
                  <div>
                    <p className="text-xs text-neutral-500 mb-1.5">Root Cause Suggestions</p>
                    {selectedIncident.aiAnalysis.rootCauseSuggestions.map((s, i) => (
                      <p key={i} className="text-xs text-neutral-400 flex items-start gap-1.5 mb-1">
                        <span className="text-orange-400 shrink-0">→</span>{s}
                      </p>
                    ))}
                  </div>
                )}
                {selectedIncident.aiAnalysis.preventionRecommendations?.length > 0 && (
                  <div>
                    <p className="text-xs text-neutral-500 mb-1.5">Prevention Recommendations</p>
                    {selectedIncident.aiAnalysis.preventionRecommendations.map((r, i) => (
                      <p key={i} className="text-xs text-neutral-400 flex items-start gap-1.5 mb-1">
                        <span className="text-green-400 shrink-0">✓</span>{r}
                      </p>
                    ))}
                  </div>
                )}
                {selectedIncident.aiAnalysis.regulatoryBody && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                    <p className="text-xs text-red-400 font-medium">Report to: {selectedIncident.aiAnalysis.regulatoryBody}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Report Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="card w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 space-y-4 animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <AlertOctagon className="w-5 h-5 text-red-400" /> Report Incident
              </h2>
              <button onClick={() => setShowForm(false)} className="btn-ghost p-1.5"><X className="w-4 h-4" /></button>
            </div>

            <div>
              <label className="label">Incident Type</label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.entries(INCIDENT_TYPES) as [IncidentType, typeof INCIDENT_TYPES[IncidentType]][]).map(([type, config]) => (
                  <button key={type} onClick={() => setForm(f => ({ ...f, type }))}
                    className={`p-2.5 rounded-lg border text-left transition-all ${
                      form.type === type ? 'bg-orange-500/10 border-orange-500/40' : 'bg-[#1A1A1A] border-[#2A2A2A] hover:border-neutral-600'
                    }`}>
                    <div className="text-lg mb-0.5">{config.icon}</div>
                    <p className={`text-xs ${form.type === type ? 'text-orange-400' : 'text-neutral-500'}`}>{config.label}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Title *</label>
              <input className="input" placeholder="Brief description of what happened"
                value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>

            <div>
              <label className="label">Full Description *</label>
              <textarea className="input resize-none" rows={4}
                placeholder="Describe exactly what happened, where, and when..."
                value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Date & Time</label>
                <input type="datetime-local" className="input"
                  value={form.dateTime} onChange={e => setForm(f => ({ ...f, dateTime: e.target.value }))} />
              </div>
              <div>
                <label className="label">Severity</label>
                <select className="input" value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value as IncidentSeverity }))}>
                  {['critical', 'high', 'medium', 'low'].map(s => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="label">People Involved</label>
              <input className="input" placeholder="Names or roles of anyone involved"
                value={form.peopleInvolved} onChange={e => setForm(f => ({ ...f, peopleInvolved: e.target.value }))} />
            </div>

            <div>
              <label className="label">Immediate Actions Taken</label>
              <textarea className="input resize-none" rows={2}
                placeholder="What was done immediately after the incident?"
                value={form.immediateActions} onChange={e => setForm(f => ({ ...f, immediateActions: e.target.value }))} />
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleSubmit} disabled={submitting} className="btn-primary flex-1 flex items-center justify-center gap-2">
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" />Reporting...</> : <><AlertOctagon className="w-4 h-4" />Report Incident</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
