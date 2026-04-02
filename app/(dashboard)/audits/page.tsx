'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore'
import { Audit } from '@/types'
import Link from 'next/link'
import { formatDateTime, scoreColor } from '@/lib/utils'
import { Plus, ClipboardList, Search, Filter } from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  in_progress: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
  submitted: 'text-green-400 bg-green-400/10 border-green-400/20',
  reviewed: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
}

export default function AuditsPage() {
  const { user } = useAuth()
  const [audits, setAudits] = useState<Audit[]>([])
  const [filtered, setFiltered] = useState<Audit[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    if (!user?.companyId) return
    getDocs(query(
      collection(db, 'audits'),
      where('companyId', '==', user.companyId),
      orderBy('createdAt', 'desc')
    )).then(snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Audit)
      setAudits(data)
      setFiltered(data)
      setLoading(false)
    })
  }, [user?.companyId])

  useEffect(() => {
    let result = audits
    if (search) result = result.filter(a =>
      a.templateTitle?.toLowerCase().includes(search.toLowerCase()) ||
      a.locationName?.toLowerCase().includes(search.toLowerCase()) ||
      a.auditorName?.toLowerCase().includes(search.toLowerCase())
    )
    if (statusFilter !== 'all') result = result.filter(a => a.status === statusFilter)
    setFiltered(result)
  }, [search, statusFilter, audits])

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Audits</h1>
          <p className="text-neutral-500 text-sm mt-0.5">{audits.length} total audits</p>
        </div>
        <Link href="/audits/new" className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> New Audit
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="w-4 h-4 text-neutral-600 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            className="input pl-9 text-sm"
            placeholder="Search audits..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          {['all', 'scheduled', 'in_progress', 'submitted', 'reviewed'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                statusFilter === s
                  ? 'bg-orange-500/20 text-orange-400 border-orange-500/40'
                  : 'bg-[#1A1A1A] text-neutral-500 border-[#2A2A2A] hover:border-neutral-600'
              }`}
            >
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4].map(i => <div key={i} className="h-16 bg-[#111111] rounded-xl border border-[#1F1F1F] animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <ClipboardList className="w-12 h-12 text-neutral-700 mx-auto mb-3" />
          <h3 className="text-white font-medium mb-1">{audits.length === 0 ? 'No audits yet' : 'No results'}</h3>
          <p className="text-neutral-600 text-sm mb-4">
            {audits.length === 0 ? 'Schedule your first audit to get started' : 'Try adjusting your filters'}
          </p>
          {audits.length === 0 && (
            <Link href="/audits/new" className="btn-primary text-sm inline-flex items-center gap-2">
              <Plus className="w-4 h-4" /> Create Audit
            </Link>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1F1F1F]">
                {['Audit', 'Location', 'Auditor', 'Status', 'Score', 'Date'].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-neutral-600 uppercase tracking-wide px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((audit, i) => (
                <tr key={audit.id} className={`border-b border-[#1F1F1F] last:border-0 hover:bg-[#1A1A1A] transition-colors ${i % 2 === 0 ? '' : 'bg-[#0D0D0D]'}`}>
                  <td className="px-4 py-3">
                    <Link href={`/audits/${audit.id}`} className="text-sm text-white hover:text-orange-400 transition-colors font-medium">
                      {audit.templateTitle}
                    </Link>
                    {audit.anomalyFlags?.length ? (
                      <span className="ml-2 badge text-xs text-yellow-400 bg-yellow-400/10 border-yellow-400/20">⚠ Flagged</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-sm text-neutral-400">{audit.locationName}</td>
                  <td className="px-4 py-3 text-sm text-neutral-400">{audit.auditorName}</td>
                  <td className="px-4 py-3">
                    <span className={`badge text-xs ${STATUS_COLORS[audit.status] || 'text-neutral-400 bg-neutral-400/10 border-neutral-400/20'}`}>
                      {audit.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {audit.score !== undefined ? (
                      <span className={`text-sm font-semibold ${scoreColor(audit.score)}`}>{audit.score}%</span>
                    ) : <span className="text-neutral-700">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-neutral-600">{formatDateTime(audit.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
