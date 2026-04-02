'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'
import { ArrowLeft, Zap, Mail } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const { resetPassword } = useAuth()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await resetPassword(email)
      setSent(true)
    } catch {
      toast.error('Failed to send reset email')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" fill="white" />
            </div>
            <span className="text-2xl font-bold text-white">OpsAudit</span>
          </div>
        </div>

        <div className="card p-6">
          {sent ? (
            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
                <Mail className="w-6 h-6 text-green-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">Check your email</h2>
              <p className="text-neutral-500 text-sm">We sent a reset link to <span className="text-white">{email}</span></p>
              <Link href="/auth/login" className="btn-primary w-full flex items-center justify-center gap-2 mt-4">
                Back to login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-white mb-1">Reset password</h2>
                <p className="text-neutral-500 text-sm">Enter your email and we'll send a reset link</p>
              </div>
              <div>
                <label className="label">Email address</label>
                <input type="email" className="input" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? 'Sending...' : 'Send reset link'}
              </button>
            </form>
          )}
        </div>

        <div className="text-center mt-4">
          <Link href="/auth/login" className="text-sm text-neutral-600 hover:text-orange-400 flex items-center justify-center gap-1 transition-colors">
            <ArrowLeft className="w-3 h-3" /> Back to login
          </Link>
        </div>
      </div>
    </div>
  )
}
