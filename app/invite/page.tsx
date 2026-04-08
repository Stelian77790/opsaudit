'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { db } from '@/lib/firebase'
import {
  collection, query, where, getDocs, updateDoc,
  doc, setDoc, serverTimestamp
} from 'firebase/firestore'
import { useAuth } from '@/contexts/AuthContext'
import { Invitation } from '@/types'
import toast from 'react-hot-toast'
import { Zap, CheckCircle, XCircle, Loader2, ArrowRight } from 'lucide-react'
import Link from 'next/link'

function InviteContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const router = useRouter()
  const { user, signUp, refreshUser } = useAuth()

  const [invitation, setInvitation] = useState<Invitation | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', password: '' })

  useEffect(() => {
    if (!token) { setError('Invalid invite link'); setLoading(false); return }
    getDocs(query(collection(db, 'invitations'), where('token', '==', token), where('status', '==', 'pending')))
      .then(snap => {
        if (snap.empty) { setError('This invitation has expired or already been used'); setLoading(false); return }
        const inv = { id: snap.docs[0].id, ...snap.docs[0].data() } as Invitation
        if (new Date(inv.expiresAt) < new Date()) { setError('This invitation has expired'); setLoading(false); return }
        setInvitation(inv)
        setLoading(false)
      })
  }, [token])

  async function handleAccept() {
    if (!invitation) return
    setAccepting(true)
    try {
      if (!user) {
        if (!form.name || !form.password) { toast.error('Fill in all fields'); setAccepting(false); return }
        await signUp(invitation.email, form.password, form.name)
      }

      const uid = user?.uid || (await new Promise<string>(resolve => {
        const unsub = (window as Window & { firebase?: { auth: () => { onAuthStateChanged: (cb: (u: { uid: string } | null) => void) => () => void } } }).firebase?.auth().onAuthStateChanged((u) => { if (u) { unsub?.(); resolve(u.uid) } })
      }))

      await Promise.all([
        updateDoc(doc(db, 'invitations', invitation.id), { status: 'accepted' }),
        setDoc(doc(db, 'users', uid), {
          companyId: invitation.companyId,
          role: invitation.role,
        }, { merge: true }),
        setDoc(doc(db, `companies/${invitation.companyId}/members`, uid), {
          userId: uid,
          role: invitation.role,
          status: 'active',
          joinedAt: serverTimestamp(),
        }, { merge: true }),
      ])

      await refreshUser()
      toast.success(`Welcome to ${invitation.companyName}!`)
      router.push('/dashboard')
    } catch (err) {
      console.error(err)
      toast.error('Failed to accept invitation')
    } finally {
      setAccepting(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
      <Loader2 className="w-6 h-6 text-orange-400 animate-spin" />
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4">
      <div className="card p-8 max-w-md w-full text-center space-y-3">
        <XCircle className="w-12 h-12 text-red-400 mx-auto" />
        <h2 className="text-lg font-semibold text-white">Invalid Invitation</h2>
        <p className="text-neutral-500 text-sm">{error}</p>
        <Link href="/auth/login" className="btn-secondary w-full flex items-center justify-center gap-2 mt-2">Back to login</Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-slide-up space-y-4">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" fill="white" />
            </div>
            <span className="text-2xl font-bold text-white">OpsAudit</span>
          </div>
        </div>

        <div className="card p-6 space-y-4">
          <div className="text-center space-y-1">
            <div className="w-12 h-12 bg-orange-500/10 border border-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="w-6 h-6 text-orange-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">You've been invited!</h2>
            <p className="text-neutral-500 text-sm">
              <span className="text-white">{invitation?.invitedByName}</span> has invited you to join{' '}
              <span className="text-orange-400">{invitation?.companyName}</span> as a{' '}
              <span className="text-white capitalize">{invitation?.role}</span>
            </p>
          </div>

          {invitation?.message && (
            <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg p-3">
              <p className="text-xs text-neutral-500 mb-1">Personal message</p>
              <p className="text-sm text-neutral-300 italic">"{invitation.message}"</p>
            </div>
          )}

          {!user ? (
            <div className="space-y-3">
              <div className="bg-[#1A1A1A] rounded-lg p-3 text-xs text-neutral-500">
                Signing up as: <span className="text-white">{invitation?.email}</span>
              </div>
              <div>
                <label className="label">Your name</label>
                <input className="input" placeholder="John Smith" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="label">Create password</label>
                <input type="password" className="input" placeholder="Min 8 characters" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
              </div>
            </div>
          ) : (
            <div className="bg-[#1A1A1A] rounded-lg p-3 text-sm text-neutral-400">
              Accepting as: <span className="text-white">{user.name}</span> ({user.email})
            </div>
          )}

          <button onClick={handleAccept} disabled={accepting} className="btn-primary w-full flex items-center justify-center gap-2">
            {accepting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            {accepting ? 'Joining...' : `Accept & Join ${invitation?.companyName}`}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function InvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-orange-400 animate-spin" />
      </div>
    }>
      <InviteContent />
    </Suspense>
  )
}
