'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { db } from '@/lib/firebase'
import { collection, getDocs, query, where, addDoc, serverTimestamp } from 'firebase/firestore'
import { Template, Location, AppUser } from '@/types'
import { logActivity } from '@/lib/auditLog'
import toast from 'react-hot-toast'
import { ArrowLeft, ClipboardList, MapPin, User, Calendar, Play, Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function NewAuditPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [templates, setTemplates] = useState<Template[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [members, setMembers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    templateId: '',
    locationId: '',
    auditorId: '',
    scheduledDate: new Date().toISOString().split('T')[0],
    notes: '',
  })

  useEffect(() => {
    if (!user?.companyId) return
    Promise.all([
      getDocs(query(collection(db, 'templates'), where('companyId', '==', user.companyId))),
      getDocs(collection(db, `companies/${user.companyId}/locations`)),
      getDocs(collection(db, `companies/${user.companyId}/members`)),
    ]).then(([tSnap, lSnap, mSnap]) => {
      setTemplates(tSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Template))
      setLocations(lSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Location).filter(l => l.active !== false))
      setMembers(mSnap.docs.map(d => ({ uid: d.id, ...d.data() }) as AppUser))
      setLoading(false)
    })
  }, [user?.companyId])

  async function handleStart() {
    if (!form.templateId || !form.locationId) { toast.error('Select a template and location'); return }
    if (!user?.companyId) return
    setSaving(true)
    try {
      const template = templates.find(t => t.id === form.templateId)!
      const location = locations.find(l => l.id === form.locationId)!
      const auditor = members.find(m => m.uid === form.auditorId) || user

      const ref = await addDoc(collection(db, 'audits'), {
        companyId: user.companyId,
        locationId: form.locationId,
        locationName: location.name,
        templateId: form.templateId,
        templateTitle: template.title,
        auditorId: auditor.uid,
        auditorName: auditor.name,
        status: 'in_progress',
        notes: form.notes,
        scheduledDate: form.scheduledDate ? new Date(form.scheduledDate) : null,
        createdAt: serverTimestamp(),
        startedAt: serverTimestamp(),
      })

      await logActivity(user.companyId, {
        userId: user.uid, name: user.name, role: user.role || '', email: user.email
      }, {
        action: 'audit_started',
        category: 'audit',
        target: { type: 'audit', id: ref.id, label: template.title },
        auditId: ref.id,
        locationId: form.locationId,
      })

      toast.success('Audit started!')
      router.push(`/audits/${ref.id}/conduct`)
    } catch (err) {
      console.error(err)
      toast.error('Failed to start audit')
    } finally {
      setSaving(false)
    }
  }

  const selectedTemplate = templates.find(t => t.id === form.templateId)

  return (
    <div className="max-w-2xl space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Link href="/audits" className="btn-ghost p-2">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white">New Audit</h1>
          <p className="text-neutral-500 text-sm">Set up and start an audit</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-6 h-6 text-orange-400 animate-spin" />
        </div>
      ) : (
        <>
          {/* Template */}
          <div className="card p-5 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <ClipboardList className="w-4 h-4 text-orange-400" />
              <h2 className="text-sm font-semibold text-white">Select Template</h2>
            </div>
            {templates.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-neutral-600 text-sm mb-2">No templates yet</p>
                <Link href="/templates/new" className="text-orange-400 text-sm hover:text-orange-300">Create a template first →</Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {templates.map(t => (
                  <button key={t.id} onClick={() => setForm(f => ({ ...f, templateId: t.id }))}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      form.templateId === t.id
                        ? 'bg-orange-500/10 border-orange-500/40 text-orange-400'
                        : 'bg-[#1A1A1A] border-[#2A2A2A] text-neutral-400 hover:border-neutral-600'
                    }`}>
                    <p className="text-sm font-medium truncate">{t.title}</p>
                    <p className="text-xs opacity-70 mt-0.5">{t.sections.length} sections · {t.sections.reduce((s, sec) => s + sec.questions.length, 0)} questions</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Location */}
          <div className="card p-5 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <MapPin className="w-4 h-4 text-orange-400" />
              <h2 className="text-sm font-semibold text-white">Location</h2>
            </div>
            {locations.length === 0 ? (
              <p className="text-neutral-600 text-sm">No locations set up yet. Add one in Settings.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {locations.map(l => (
                  <button key={l.id} onClick={() => setForm(f => ({ ...f, locationId: l.id }))}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      form.locationId === l.id
                        ? 'bg-orange-500/10 border-orange-500/40 text-orange-400'
                        : 'bg-[#1A1A1A] border-[#2A2A2A] text-neutral-400 hover:border-neutral-600'
                    }`}>
                    <p className="text-sm font-medium">{l.name}</p>
                    <p className="text-xs opacity-70 mt-0.5">{l.city}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Auditor & Date */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <User className="w-4 h-4 text-orange-400" />
              <h2 className="text-sm font-semibold text-white">Assign & Schedule</h2>
            </div>
            <div>
              <label className="label">Assigned Auditor</label>
              <select className="input" value={form.auditorId} onChange={e => setForm(f => ({ ...f, auditorId: e.target.value }))}>
                <option value="">Me ({user?.name})</option>
                {members.filter(m => m.uid !== user?.uid && (m.role === 'auditor' || m.role === 'admin')).map(m => (
                  <option key={m.uid} value={m.uid}>{m.name} ({m.role})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Scheduled Date</label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-neutral-600 absolute left-3 top-1/2 -translate-y-1/2" />
                <input type="date" className="input pl-9" value={form.scheduledDate} onChange={e => setForm(f => ({ ...f, scheduledDate: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="label">Notes (optional)</label>
              <textarea className="input resize-none" rows={2} placeholder="Any instructions for the auditor..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>

          {/* Summary & Start */}
          {selectedTemplate && form.locationId && (
            <div className="card border-orange-500/20 bg-orange-500/5 p-4 animate-fade-in">
              <p className="text-xs text-neutral-500 font-medium uppercase tracking-wide mb-2">Ready to start</p>
              <p className="text-sm text-white font-medium">{selectedTemplate.title}</p>
              <p className="text-xs text-neutral-500 mt-0.5">
                {selectedTemplate.sections.reduce((s, sec) => s + sec.questions.length, 0)} questions across {selectedTemplate.sections.length} sections
              </p>
            </div>
          )}

          <button
            onClick={handleStart}
            disabled={saving || !form.templateId || !form.locationId}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {saving ? 'Starting...' : 'Start Audit'}
          </button>
        </>
      )}
    </div>
  )
}
