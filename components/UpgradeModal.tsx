'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { PLANS } from '@/lib/stripe'
import { X, Zap, Check, Loader2 } from 'lucide-react'

interface UpgradeModalProps {
  reason: string
  onClose: () => void
}

export default function UpgradeModal({ reason, onClose }: UpgradeModalProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState<string | null>(null)

  async function handleUpgrade(tier: 'professional' | 'enterprise') {
    if (!user) return
    setLoading(tier)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planTier: tier,
          companyId: user.companyId,
          userId: user.uid,
          userEmail: user.email,
          returnUrl: window.location.href,
        }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else if (data.error?.includes('not configured')) {
        alert('Stripe is not configured yet. Add your STRIPE_SECRET_KEY to the environment variables.')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(null)
    }
  }

  const pro = PLANS.professional
  const enterprise = PLANS.enterprise

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="card w-full max-w-2xl p-6 animate-slide-up">
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-5 h-5 text-orange-400" />
              <h2 className="text-lg font-bold text-white">Upgrade to unlock this feature</h2>
            </div>
            <p className="text-sm text-neutral-500">{reason}</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-6">
          {/* Professional */}
          <div className="bg-orange-500/5 border border-orange-500/30 rounded-xl p-5">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-white">{pro.name}</h3>
              <span className="badge text-xs text-orange-400 bg-orange-400/10 border-orange-400/20">Most Popular</span>
            </div>
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-3xl font-bold text-orange-400">€{pro.price}</span>
              <span className="text-neutral-600 text-sm">/month</span>
            </div>
            <ul className="space-y-2 mb-5">
              {pro.features.map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-neutral-400">
                  <Check className="w-3.5 h-3.5 text-orange-400 shrink-0" />{f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleUpgrade('professional')}
              disabled={!!loading}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {loading === 'professional' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              Start 14-day free trial
            </button>
          </div>

          {/* Enterprise */}
          <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-5">
            <h3 className="font-semibold text-white mb-1">{enterprise.name}</h3>
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-3xl font-bold text-white">€{enterprise.price}</span>
              <span className="text-neutral-600 text-sm">/month</span>
            </div>
            <ul className="space-y-2 mb-5">
              {enterprise.features.map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-neutral-400">
                  <Check className="w-3.5 h-3.5 text-neutral-500 shrink-0" />{f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleUpgrade('enterprise')}
              disabled={!!loading}
              className="btn-secondary w-full flex items-center justify-center gap-2"
            >
              {loading === 'enterprise' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Start 14-day free trial
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-neutral-700 mt-4">
          No credit card required for trial · Cancel anytime · All prices exclude VAT
        </p>
      </div>
    </div>
  )
}
