'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { db } from '@/lib/firebase'
import { collection, getDocs, doc, updateDoc, deleteDoc, addDoc, serverTimestamp, query, where } from 'firebase/firestore'
import { AppUser, Invitation, UserRole } from '@/types'
import { logCritical } from '@/lib/auditLog'
import toast from 'react-hot-toast'
import { formatDateTime } from '@/lib/utils'
import { Users, Plus, Mail, Trash2, Shield, Clock, X, Send, Loader2, CheckCircle, AlertCircle } from 'lucide-react'

const ROLES: { value: UserRole; label: string; desc: string }[] = [
  { value: 'admin', label: 'Admin', desc: 'Full access including billing' },
  { value: 'manager', label: 'Manager', desc: 'View audits at assigned locations' },
  { value: 'auditor', label: 'Auditor', desc: 'Conduct and submit audits' },
  { value: 'assignee', label: 'Assignee', desc: 'Manage corrective actions' },
  { value: 'viewer', label: 'Viewer', desc: 'Read-only dashboard access' },
]

const ROLE_COLORS: Record<string, string> = {
  admin: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
  manager: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  auditor: 'text-green-400 bg-green-400/10 border-green-400/20',
  assignee: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  viewer: 'text-neutral-400 bg-neutral-400/10 border-neutral-400/20',
}

export default function TeamPage() {
  const { user } = useAuth()
  const [members, setMembers] = useState<AppUser[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'auditor' as UserRole, message: '' })
  const [sendingInvite, setSendingInvite] = useState(false)

  async function load() {
    if (!user?.companyId) return
    const [membersSnap, invitesSnap] = await Promise.all([
      getDocs(collection(db, `companies/${user.companyId}/members`)),
      getDocs(query(collection(db, 'invitations'), where('companyId', '==', user.companyId), where('status', '==', 'pending')))
    ])
    setMembers(membersSnap.docs.map(d => ({ uid: d.id, ...d.data() }) as AppUser))
    setInvitations(invitesSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Invitation))
    setLoading(false)
  }

  useEffect(() => { load() }, [user?.companyId])

  async function sendInvite() {
    if (!inviteForm.email || !user?.companyId) return
    setSendingInvite(true)
    try {
      const token = crypto.randomUUID()
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

      await addDoc(collection(db, 'invitations'), {
        email: inviteForm.email.toLowerCase(),
        companyId: user.companyId,
        companyName: 'Your Company',
        role: inviteForm.role,
        locations: [],
        invitedBy: user.uid,
        invitedByName: user.name,
        status: 'pending',
        token,
        expiresAt,
        message: inviteForm.message,
        createdAt: serverTimestamp(),
      })

      await logCritical(user.companyId, {
        userId: user.uid, name: user.name, role: user.role || '', email: user.email
      }, {
        action: 'member_invited',
        category: 'member',
        target: { type: 'invitation', id: token, label: inviteForm.email },
        change: { field: 'role', from: null, to: inviteForm.role }
      })

      toast.success(`Invitation sent to ${inviteForm.email}`)
      setShowInviteModal(false)
      setInviteForm({ email: '', role: 'auditor', message: '' })
      load()
    } catch (err) {
      console.error(err)
      toast.error('Failed to send invitation')
    } finally {
      setSendingInvite(false)
    }
  }

  async function revokeInvite(id: string) {
    await updateDoc(doc(db, 'invitations', id), { status: 'revoked' })
    setInvitations(prev => prev.filter(i => i.id !== id))
    toast.success('Invitation revoked')
  }

  async function changeRole(uid: string, newRole: UserRole) {
    if (!user?.companyId) return
    const adminCount = members.filter(m => m.role === 'admin').length
    const member = members.find(m => m.uid === uid)
    if (member?.role === 'admin' && adminCount <= 1) {
      toast.error('Cannot demote the only Admin. Promote another member first.')
      return
    }
    await updateDoc(doc(db, `companies/${user.companyId}/members`, uid), { role: newRole })
    setMembers(prev => prev.map(m => m.uid === uid ? { ...m, role: newRole } : m))
    await logCritical(user.companyId, {
      userId: user.uid, name: user.name, role: user.role || '', email: user.email
    }, {
      action: 'member_role_changed',
      category: 'member',
      target: { type: 'user', id: uid, label: member?.name || uid },
      change: { field: 'role', from: member?.role, to: newRole }
    })
    toast.success('Role updated')
  }

  const isAdmin = user?.role === 'admin'

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Team</h1>
          <p className="text-neutral-500 text-sm mt-0.5">{members.length} members · {invitations.length} pending invites</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowInviteModal(true)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Invite Member
          </button>
        )}
      </div>

      {/* Active Members */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-[#1F1F1F] flex items-center gap-2">
          <Users className="w-4 h-4 text-orange-400" />
          <h2 className="text-sm font-semibold text-white">Active Members</h2>
        </div>
        {loading ? (
          <div className="p-4 space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-14 bg-[#1A1A1A] rounded-lg animate-pulse" />)}
          </div>
        ) : (
          <div className="divide-y divide-[#1F1F1F]">
            {members.map(member => (
              <div key={member.uid} className="flex items-center gap-4 p-4 hover:bg-[#1A1A1A] transition-colors">
                <div className="w-9 h-9 bg-orange-500/10 border border-orange-500/20 rounded-full flex items-center justify-center text-orange-400 text-sm font-medium shrink-0">
                  {member.name?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-white font-medium truncate">{member.name}</p>
                    {member.uid === user?.uid && <span className="text-xs text-neutral-600">(you)</span>}
                  </div>
                  <p className="text-xs text-neutral-600 truncate">{member.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  {isAdmin && member.uid !== user?.uid ? (
                    <select
                      className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg text-xs px-2 py-1 focus:outline-none focus:border-orange-500/30"
                      value={member.role || ''}
                      onChange={e => changeRole(member.uid, e.target.value as UserRole)}
                    >
                      {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  ) : (
                    <span className={`badge text-xs ${ROLE_COLORS[member.role || ''] || ''}`}>
                      <Shield className="w-3 h-3 mr-1" />
                      {member.role}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-[#1F1F1F] flex items-center gap-2">
            <Clock className="w-4 h-4 text-yellow-400" />
            <h2 className="text-sm font-semibold text-white">Pending Invitations</h2>
          </div>
          <div className="divide-y divide-[#1F1F1F]">
            {invitations.map(inv => (
              <div key={inv.id} className="flex items-center gap-4 p-4">
                <div className="w-9 h-9 bg-yellow-500/10 border border-yellow-500/20 rounded-full flex items-center justify-center shrink-0">
                  <Mail className="w-4 h-4 text-yellow-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{inv.email}</p>
                  <p className="text-xs text-neutral-600">
                    Invited by {inv.invitedByName} · Expires {formatDateTime(inv.expiresAt)}
                  </p>
                </div>
                <span className={`badge text-xs ${ROLE_COLORS[inv.role] || ''}`}>{inv.role}</span>
                {isAdmin && (
                  <button onClick={() => revokeInvite(inv.id)} className="p-1.5 hover:bg-red-500/10 rounded text-neutral-600 hover:text-red-400 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowInviteModal(false)}>
          <div className="card w-full max-w-md p-6 space-y-4 animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Invite Team Member</h2>
              <button onClick={() => setShowInviteModal(false)} className="btn-ghost p-1.5">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="label">Email address</label>
              <input
                type="email"
                className="input"
                placeholder="colleague@company.com"
                value={inviteForm.email}
                onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
                autoFocus
              />
            </div>

            <div>
              <label className="label">Role</label>
              <div className="space-y-2">
                {ROLES.filter(r => r.value !== 'admin' || user?.role === 'admin').map(role => (
                  <button
                    key={role.value}
                    onClick={() => setInviteForm(f => ({ ...f, role: role.value }))}
                    className={`w-full p-3 rounded-lg border text-left transition-all ${
                      inviteForm.role === role.value
                        ? 'bg-orange-500/10 border-orange-500/40'
                        : 'bg-[#1A1A1A] border-[#2A2A2A] hover:border-neutral-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-medium ${inviteForm.role === role.value ? 'text-orange-400' : 'text-white'}`}>{role.label}</span>
                      {inviteForm.role === role.value && <CheckCircle className="w-4 h-4 text-orange-400" />}
                    </div>
                    <p className="text-xs text-neutral-600 mt-0.5">{role.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Personal message (optional)</label>
              <textarea
                className="input resize-none"
                rows={2}
                placeholder="Add a note to the invite email..."
                value={inviteForm.message}
                onChange={e => setInviteForm(f => ({ ...f, message: e.target.value }))}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowInviteModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={sendInvite}
                disabled={sendingInvite || !inviteForm.email}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {sendingInvite ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sendingInvite ? 'Sending...' : 'Send Invite'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
