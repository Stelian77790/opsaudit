'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { db } from '@/lib/firebase'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { CorrectiveAction } from '@/types'
import { severityColor, formatDateTime } from '@/lib/utils'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { AlertTriangle, CheckCircle, Search, Loader2, ChevronRight, Clock, User, ExternalLink } from 'lucide-react'

const ActionDetailPanel = dynamic(() => import('@/components/ActionDetailPanel'), { ssr: false })

const STATUS_COLORS: Record<string, string> = {
  open: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
  in_progress: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  resolved: 'text-green-400 bg-green-400/10 border-green-400/20',
  escalated: 'text-red-400 bg-red-400/10 border-red-400/20',
}

export default function ActionsPage() {
  const { user } = useAuth()
  const [actions, setActions] = useState<CorrectiveAction[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('open')
  const [selectedAction, setSelectedAction] = useState<CorrectiveAction | null>(null)

  useEffect(() => {
    if (!user?.companyId) return
    async function load() {
      try {
        const auditSnap = await getDocs(query(collection(db, 'audits'), where('companyId', '==', user!.companyId)))
        const allActions: CorrectiveAction[] = []
        await Promise.all(auditSnap.docs.map(async auditDoc => {
          const actSnap = await getDocs(collection(db, `audits/${auditDoc.id}/actions`))
          actSnap.docs.forEach(d => allActions.push({ id: d.id, auditId: auditDoc.id, ...d.data() } as CorrectiveAction))
        }))
        const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
        allActions.sort((a, b) => (priorityOrder[a.priority] || 99) - (priorityOrder[b.priority] || 99))
        setActions(allActions)
      } catch (err) { console.error(err) }
      finally { setLoading(false) }
    }
    load()
  }, [user?.companyId])

  function handleActionUpdate(updated: CorrectiveAction) {
    setActions(prev => prev.map(a => a.id === updated.id ? updated : a))
    setSelectedAction(updated)
  }

  const isOverdue = (a: CorrectiveAction) => {
    if (!a.dueDate || a.status === 'resolved') return false
    return new Date(a.dueDate as unknown as string) < new Date()
  }

  const filtered = actions.filter(a => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false
    if (priorityFilter !== 'all' && a.priority !== priorityFilter) return false
    if (search && !a.title?.toLowerCase().includes(search.toLowerCase()) && !a.assigneeName?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const stats = {
    open: actions.filter(a => a.status === 'open').length,
    inProgress: actions.filter(a => a.status === 'in_progress').length,
    resolved: actions.filter(a => a.status === 'resolved').length,
    critical: actions.filter(a => a.priority === 'critical' && a.status !== 'resolved').length,
    escalated: actions.filter(a => a.status === 'escalated').length,
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Corrective Actions</h1>
        <p className="text-neutral-500 text-sm mt-0.5">{stats.open + stats.inProgress} open · {stats.resolved} resolved</p>
      </div>

      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Open', value: stats.open, color: 'text-orange-400', filter: 'open' },
          { label: 'In Progress', value: stats.inProgress, color: 'text-blue-400', filter: 'in_progress' },
          { label: 'Escalated', value: stats.escalated, color: 'text-red-400', filter: 'escalated' },
          { label: 'Resolved', value: stats.resolved, color: 'text-green-400', filter: 'resolved' },
          { label: 'Critical', value: stats.critical, color: 'text-red-400', filter: 'all' },
        ].map(s => (
          <button key={s.label} onClick={() => setStatusFilter(s.filter)}
            className={`card-hover p-4 text-center ${statusFilter === s.filter ? 'border-orange-500/30' : ''}`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-neutral-600 mt-1">{s.label}</p>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="w-4 h-4 text-neutral-600 absolute left-3 top-1/2 -translate-y-1/2" />
          <input className="input pl-9 text-sm w-56" placeholder="Search actions..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1">
          {['all', 'open', 'in_progress', 'escalated', 'resolved'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${statusFilter === s ? 'bg-orange-500/20 text-orange-400 border-orange-500/40' : 'bg-[#1A1A1A] text-neutral-500 border-[#2A2A2A] hover:border-neutral-600'}`}>
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {['all', 'critical', 'high', 'medium', 'low'].map(p => (
            <button key={p} onClick={() => setPriorityFilter(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${priorityFilter === p ? 'bg-orange-500/20 text-orange-400 border-orange-500/40' : 'bg-[#1A1A1A] text-neutral-500 border-[#2A2A2A] hover:border-neutral-600'}`}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 text-orange-400 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-2" />
          <p className="text-white font-medium">{actions.length === 0 ? 'No actions yet' : 'No results'}</p>
          <p className="text-neutral-600 text-sm mt-1">Actions are created from audit findings</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(action => (
            <div key={action.id} onClick={() => setSelectedAction(action)}
              className={`card-hover p-4 flex items-center gap-4 cursor-pointer ${isOverdue(action) ? 'border-red-500/20 bg-red-500/5' : ''}`}>
              <div className={`w-1 h-10 rounded-full shrink-0 ${
                action.priority === 'critical' ? 'bg-red-400' : action.priority === 'high' ? 'bg-orange-400' :
                action.priority === 'medium' ? 'bg-yellow-400' : 'bg-green-400'
              }`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm text-white font-medium truncate">{action.title || 'Untitled Action'}</p>
                  {isOverdue(action) && <span className="badge text-xs text-red-400 bg-red-400/10 border-red-400/20 shrink-0">Overdue</span>}
                </div>
                <div className="flex items-center gap-3 text-xs text-neutral-600">
                  {action.assigneeName && <span className="flex items-center gap-1"><User className="w-3 h-3" />{action.assigneeName}</span>}
                  {action.dueDate && (
                    <span className={`flex items-center gap-1 ${isOverdue(action) ? 'text-red-400' : ''}`}>
                      <Clock className="w-3 h-3" />Due {formatDateTime(action.dueDate)}
                    </span>
                  )}
                  <Link href={`/audits/${action.auditId}`} onClick={e => e.stopPropagation()} className="flex items-center gap-1 hover:text-orange-400 transition-colors">
                    <ExternalLink className="w-3 h-3" />View audit
                  </Link>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`badge text-xs ${severityColor(action.priority)}`}>{action.priority}</span>
                <span className={`badge text-xs ${STATUS_COLORS[action.status] || ''}`}>{action.status.replace('_', ' ')}</span>
                <ChevronRight className="w-4 h-4 text-neutral-700" />
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedAction && (
        <ActionDetailPanel action={selectedAction} onClose={() => setSelectedAction(null)} onUpdate={handleActionUpdate} />
      )}
    </div>
  )
}
