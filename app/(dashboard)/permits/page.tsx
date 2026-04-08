'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { db } from '@/lib/firebase'
import { collection, addDoc, getDocs, query, where, orderBy, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { logActivity } from '@/lib/auditLog'
import { formatDateTime } from '@/lib/utils'
import toast from 'react-hot-toast'
import {
  Shield, Plus, X, Loader2, CheckCircle, XCircle,
  AlertTriangle, Clock, Sparkles, User, Calendar, FileText
} from 'lucide-react'

type PermitType = 'hot_work' | 'confined_space' | 'working_at_height' | 'electrical_isolation' | 'excavation'
type PermitStatus = 'pending' | 'ai_checking' | 'approved' | 'conditional' | 'rejected' | 'active' | 'closed'

interface Permit {
  id: string
  companyId: string
  locationId: string
  locationName: string
  type: PermitType
  workDescription: string
  requestedBy: string
  requestedByName: string
  workers: string[]
  hazards: string[]
  controls: string[]
  startTime: string
  endTime: string
  status: PermitStatus
  aiCheck?: {
    passed: boolean
    issues: string[]
    recommendation: string
    confidence: string
  }
  approvedBy?: string
  approvedByName?: string
  notes?: string
  createdAt: Date
  updatedAt: Date
}

const PERMIT_TYPES: Record<PermitType, { label: string; icon: string; color: string; hazardHints: string[] }> = {
  hot_work: {
    label: 'Hot Work',
    icon: '🔥',
    color: 'text-red-400 bg-red-400/10 border-red-400/20',
    hazardHints: ['Fire risk', 'Fume inhalation', 'Burns', 'Explosion risk'],
  },
  confined_space: {
    label: 'Confined Space Entry',
    icon: '⬛',
    color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
    hazardHints: ['Oxygen deficiency', 'Toxic atmosphere', 'Engulfment', 'Entrapment'],
  },
  working_at_height: {
    label: 'Working at Height',
    icon: '🪜',
    color: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
    hazardHints: ['Falls from height', 'Falling objects', 'Unstable surface', 'Weather conditions'],
  },
  electrical_isolation: {
    label: 'Electrical Isolation',
    icon: '⚡',
    color: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    hazardHints: ['Electric shock', 'Arc flash', 'Burns', 'Explosion'],
  },
  excavation: {
    label: 'Excavation',
    icon: '🚧',
    color: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
    hazardHints: ['Ground collapse', 'Buried services', 'Flooding', 'Falling materials'],
  },
}

const STATUS_CONFIG: Record<PermitStatus, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'Pending Review', color: 'text-neutral-400 bg-neutral-400/10 border-neutral-400/20', icon: Clock },
  ai_checking: { label: 'AI Checking', color: 'text-blue-400 bg-blue-400/10 border-blue-400/20', icon: Sparkles },
  approved: { label: 'Approved', color: 'text-green-400 bg-green-400/10 border-green-400/20', icon: CheckCircle },
  conditional: { label: 'Conditional', color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20', icon: AlertTriangle },
  rejected: { label: 'Rejected', color: 'text-red-400 bg-red-400/10 border-red-400/20', icon: XCircle },
  active: { label: 'Active', color: 'text-orange-400 bg-orange-400/10 border-orange-400/20', icon: Shield },
  closed: { label: 'Closed', color: 'text-neutral-600 bg-neutral-600/10 border-neutral-600/20', icon: CheckCircle },
}

export default function PermitsPage() {
  const { user } = useAuth()
  const [permits, setPermits] = useState<Permit[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    type: 'hot_work' as PermitType,
    workDescription: '',
    workers: '',
    hazards: [] as string[],
    controls: '',
    startTime: '',
    endTime: '',
    locationName: 'Main Site',
  })

  useEffect(() => {
    if (!user?.companyId) return
    getDocs(query(
      collection(db, 'permits'),
      where('companyId', '==', user.companyId),
      orderBy('createdAt', 'desc')
    )).then(snap => {
      setPermits(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Permit))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [user?.companyId])

  function toggleHazard(hazard: string) {
    setForm(f => ({
      ...f,
      hazards: f.hazards.includes(hazard)
        ? f.hazards.filter(h => h !== hazard)
        : [...f.hazards, hazard],
    }))
  }

  async function handleSubmit() {
    if (!form.workDescription || !form.startTime || !form.endTime || !user?.companyId) {
      toast.error('Fill in all required fields')
      return
    }
    setSubmitting(true)
    try {
      const permitData = {
        companyId: user.companyId,
        locationId: '',
        locationName: form.locationName,
        type: form.type,
        workDescription: form.workDescription,
        requestedBy: user.uid,
        requestedByName: user.name,
        workers: form.workers.split(',').map(w => w.trim()).filter(Boolean),
        hazards: form.hazards,
        controls: form.controls.split(',').map(c => c.trim()).filter(Boolean),
        startTime: form.startTime,
        endTime: form.endTime,
        status: 'ai_checking' as PermitStatus,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }

      const ref = await addDoc(collection(db, 'permits'), permitData)

      // Run AI check
      const aiRes = await fetch('/api/check-permit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: form.type,
          workDescription: form.workDescription,
          hazards: form.hazards,
          controls: form.controls.split(',').map(c => c.trim()).filter(Boolean),
          workers: form.workers.split(',').map(w => w.trim()).filter(Boolean),
        }),
      })
      const aiData = await aiRes.json()
      const aiCheck = aiData.check

      const newStatus: PermitStatus = aiCheck?.passed
        ? 'approved'
        : aiCheck?.issues?.length > 0
        ? 'conditional'
        : 'rejected'

      await updateDoc(doc(db, 'permits', ref.id), {
        status: newStatus,
        aiCheck,
        updatedAt: serverTimestamp(),
      })

      const newPermit: Permit = {
        id: ref.id,
        ...permitData,
        status: newStatus,
        aiCheck,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      setPermits(prev => [newPermit, ...prev])
      setShowForm(false)
      setForm({
        type: 'hot_work',
        workDescription: '',
        workers: '',
        hazards: [],
        controls: '',
        startTime: '',
        endTime: '',
        locationName: 'Main Site',
      })

      if (newStatus === 'approved') toast.success('Permit approved by AI ✓')
      else if (newStatus === 'conditional') toast('Permit conditionally approved — review AI notes', { icon: '⚠️' })
      else toast.error('Permit rejected — see AI feedback')

      await logActivity(user.companyId, {
        userId: user.uid, name: user.name, role: user.role || '', email: user.email,
      }, {
        action: 'permit_created',
        category: 'permit',
        target: { type: 'permit', id: ref.id, label: `${PERMIT_TYPES[form.type].label} — ${form.locationName}` },
        metadata: { status: newStatus, type: form.type },
      })
    } catch (err) {
      console.error(err)
      toast.error('Failed to submit permit')
    } finally {
      setSubmitting(false)
    }
  }

  async function closePermit(permitId: string) {
    await updateDoc(doc(db, 'permits', permitId), {
      status: 'closed',
      updatedAt: serverTimestamp(),
    })
    setPermits(prev => prev.map(p => p.id === permitId ? { ...p, status: 'closed' } : p))
    toast.success('Permit closed')
  }

  const activePermits = permits.filter(p => p.status === 'active' || p.status === 'approved')
  const permitTypeConfig = PERMIT_TYPES[form.type]

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-orange-400" /> Permit to Work
          </h1>
          <p className="text-neutral-500 text-sm mt-0.5">
            {activePermits.length} active permit{activePermits.length !== 1 ? 's' : ''} · {permits.length} total
          </p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> Request Permit
        </button>
      </div>

      {/* Active Permits Alert */}
      {activePermits.length > 0 && (
        <div className="card border-orange-500/20 bg-orange-500/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-orange-400" />
            <span className="text-sm font-medium text-orange-400">{activePermits.length} Active Permit{activePermits.length > 1 ? 's' : ''}</span>
          </div>
          <div className="space-y-2">
            {activePermits.map(p => (
              <div key={p.id} className="flex items-center justify-between bg-[#1A1A1A] rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <span>{PERMIT_TYPES[p.type]?.icon}</span>
                  <div>
                    <p className="text-sm text-white">{PERMIT_TYPES[p.type]?.label}</p>
                    <p className="text-xs text-neutral-600">{p.locationName} · {p.requestedByName}</p>
                  </div>
                </div>
                <button onClick={() => closePermit(p.id)}
                  className="text-xs text-neutral-500 hover:text-red-400 transition-colors px-2 py-1 rounded border border-[#2A2A2A] hover:border-red-400/30">
                  Close Permit
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Permits List */}
      {loading ? (
        <div className="flex items-center justify-center h-40"><Loader2 className="w-5 h-5 text-orange-400 animate-spin" /></div>
      ) : permits.length === 0 ? (
        <div className="card p-12 text-center">
          <Shield className="w-10 h-10 text-neutral-700 mx-auto mb-2" />
          <p className="text-white font-medium">No permits yet</p>
          <p className="text-neutral-600 text-sm">Request a permit for high-risk work activities</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1F1F1F]">
                {['Type', 'Description', 'Requested By', 'Time', 'Status', 'AI Check', ''].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-neutral-600 uppercase tracking-wide px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {permits.map((permit, i) => {
                const typeConfig = PERMIT_TYPES[permit.type]
                const statusConfig = STATUS_CONFIG[permit.status]
                const StatusIcon = statusConfig.icon
                return (
                  <tr key={permit.id} className={`border-b border-[#1F1F1F] last:border-0 hover:bg-[#1A1A1A] transition-colors ${i % 2 === 0 ? '' : 'bg-[#0D0D0D]'}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{typeConfig?.icon}</span>
                        <span className={`badge text-xs ${typeConfig?.color}`}>{typeConfig?.label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-white max-w-48 truncate">{permit.workDescription}</p>
                      <p className="text-xs text-neutral-600">{permit.locationName}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-400">{permit.requestedByName}</td>
                    <td className="px-4 py-3 text-xs text-neutral-500">
                      {permit.startTime && <div>{permit.startTime}</div>}
                      {permit.endTime && <div className="text-neutral-700">→ {permit.endTime}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge text-xs flex items-center gap-1 w-fit ${statusConfig.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusConfig.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {permit.aiCheck && (
                        <div className="text-xs">
                          {permit.aiCheck.passed ? (
                            <span className="text-green-400 flex items-center gap-1"><CheckCircle className="w-3 h-3" />Passed</span>
                          ) : (
                            <span className="text-red-400 flex items-center gap-1"><XCircle className="w-3 h-3" />{permit.aiCheck.issues?.length || 0} issues</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {(permit.status === 'approved' || permit.status === 'active') && (
                        <button onClick={() => closePermit(permit.id)}
                          className="text-xs text-neutral-600 hover:text-red-400 transition-colors">
                          Close
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Request Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5 animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-orange-400" /> Request Permit to Work
              </h2>
              <button onClick={() => setShowForm(false)} className="btn-ghost p-1.5"><X className="w-4 h-4" /></button>
            </div>

            {/* Permit Type */}
            <div>
              <label className="label">Permit Type</label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.entries(PERMIT_TYPES) as [PermitType, typeof PERMIT_TYPES[PermitType]][]).map(([type, config]) => (
                  <button key={type} onClick={() => setForm(f => ({ ...f, type, hazards: [] }))}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      form.type === type ? 'bg-orange-500/10 border-orange-500/40' : 'bg-[#1A1A1A] border-[#2A2A2A] hover:border-neutral-600'
                    }`}>
                    <div className="text-xl mb-1">{config.icon}</div>
                    <p className={`text-xs font-medium ${form.type === type ? 'text-orange-400' : 'text-neutral-400'}`}>{config.label}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Work Description */}
            <div>
              <label className="label">Work Description *</label>
              <textarea className="input resize-none" rows={3}
                placeholder="Describe the work to be carried out in detail..."
                value={form.workDescription}
                onChange={e => setForm(f => ({ ...f, workDescription: e.target.value }))} />
            </div>

            {/* Workers */}
            <div>
              <label className="label">Workers Involved</label>
              <input className="input" placeholder="Names or roles, comma separated e.g. John Smith, Mike Jones"
                value={form.workers}
                onChange={e => setForm(f => ({ ...f, workers: e.target.value }))} />
            </div>

            {/* Hazards */}
            <div>
              <label className="label">Identified Hazards</label>
              <div className="flex flex-wrap gap-2">
                {permitTypeConfig.hazardHints.map(h => (
                  <button key={h} onClick={() => toggleHazard(h)}
                    className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                      form.hazards.includes(h) ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-[#1A1A1A] border-[#2A2A2A] text-neutral-500 hover:border-neutral-600'
                    }`}>
                    {h}
                  </button>
                ))}
              </div>
            </div>

            {/* Controls */}
            <div>
              <label className="label">Controls in Place</label>
              <input className="input"
                placeholder="e.g. Fire extinguisher on standby, gas detection equipment, spotter present"
                value={form.controls}
                onChange={e => setForm(f => ({ ...f, controls: e.target.value }))} />
            </div>

            {/* Times */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Start Time *</label>
                <input type="datetime-local" className="input"
                  value={form.startTime}
                  onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
              </div>
              <div>
                <label className="label">End Time *</label>
                <input type="datetime-local" className="input"
                  value={form.endTime}
                  onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
              </div>
            </div>

            {/* AI check notice */}
            <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <p className="text-xs text-neutral-400">Claude AI will automatically validate your permit request — checking all conditions are met before issuing approval.</p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleSubmit} disabled={submitting} className="btn-primary flex-1 flex items-center justify-center gap-2">
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" />Checking...</> : <><Shield className="w-4 h-4" />Submit for AI Review</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
