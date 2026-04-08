'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useUsageLimits } from '@/hooks/useUsageLimits'
import { PLANS } from '@/lib/stripe'
import { Check, Zap, CreditCard, ExternalLink, Loader2 } from 'lucide-react'

export default function BillingPage() {
  const { user } = useAuth()
  const { usage, plan, limits, auditUsagePercent, isPro, isLoading } = useUsageLimits()
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)

  async function handleUpgrade(tier: string) {
    if (!user) return
    setCheckoutLoading(tier)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planTier: tier,
          companyId: user.companyId,
          userId: user.uid,
          userEmail: user.email,
        }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else if (data.error?.includes('not configured')) {
        alert('Add your STRIPE_SECRET_KEY to environment variables to enable billing.')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setCheckoutLoading(null)
    }
  }

  async function handlePortal() {
    setPortalLoading(true)
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: 'PLACEHOLDER', returnUrl: window.location.href }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch (err) {
      console.error(err)
    } finally {
      setPortalLoading(false)
    }
  }

  if (isLoading) return <div className="flex items-center justify-center h-40"><Loader2 className="w-5 h-5 text-orange-400 animate-spin" /></div>

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Current Plan */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">Current Plan</h2>
          {isPro && (
            <button onClick={handlePortal} disabled={portalLoading}
              className="btn-secondary text-xs flex items-center gap-1.5">
              {portalLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />}
              Manage Billing
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isPro ? 'bg-orange-500/20 border border-orange-500/30' : 'bg-[#1A1A1A] border border-[#2A2A2A]'}`}>
            <Zap className={`w-5 h-5 ${isPro ? 'text-orange-400' : 'text-neutral-600'}`} />
          </div>
          <div>
            <p className="text-white font-semibold capitalize">{plan} Plan</p>
            <p className="text-xs text-neutral-600">{isPro ? 'Full access to all features' : 'Limited to 3 audits/month'}</p>
          </div>
        </div>
      </div>

      {/* Usage */}
      {!isPro && usage && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Usage This Month</h2>
          <div className="space-y-4">
            {[
              { label: 'Audits', used: usage.auditsThisMonth, limit: limits.auditsPerMonth as number },
              { label: 'Locations', used: usage.locationsCount, limit: limits.locations as number },
              { label: 'Members', used: usage.membersCount, limit: limits.members as number },
            ].map(item => (
              <div key={item.label}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-neutral-500">{item.label}</span>
                  <span className={`font-medium ${item.used >= item.limit ? 'text-red-400' : 'text-white'}`}>
                    {item.used} / {item.limit}
                  </span>
                </div>
                <div className="w-full bg-[#1F1F1F] rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all ${item.used >= item.limit ? 'bg-red-400' : 'bg-orange-500'}`}
                    style={{ width: `${Math.min(100, (item.used / item.limit) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Plans */}
      {!isPro && (
        <div>
          <h2 className="text-sm font-semibold text-white mb-4">Upgrade Your Plan</h2>
          <div className="grid grid-cols-2 gap-4">
            {(['professional', 'enterprise'] as const).map(tier => {
              const p = PLANS[tier]
              const isPopular = tier === 'professional'
              return (
                <div key={tier} className={`rounded-xl p-5 border ${isPopular ? 'bg-orange-500/5 border-orange-500/30' : 'bg-[#1A1A1A] border-[#2A2A2A]'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-white">{p.name}</h3>
                    {isPopular && <span className="badge text-xs text-orange-400 bg-orange-400/10 border-orange-400/20">Popular</span>}
                  </div>
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className={`text-3xl font-bold ${isPopular ? 'text-orange-400' : 'text-white'}`}>€{p.price}</span>
                    <span className="text-neutral-600 text-sm">/mo</span>
                  </div>
                  <ul className="space-y-1.5 mb-5">
                    {p.features.slice(0, 5).map(f => (
                      <li key={f} className="flex items-center gap-2 text-xs text-neutral-400">
                        <Check className={`w-3 h-3 shrink-0 ${isPopular ? 'text-orange-400' : 'text-neutral-600'}`} />{f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => handleUpgrade(tier)}
                    disabled={!!checkoutLoading}
                    className={`w-full text-sm flex items-center justify-center gap-2 py-2 rounded-lg font-medium transition-all ${
                      isPopular ? 'btn-primary' : 'btn-secondary'
                    }`}
                  >
                    {checkoutLoading === tier ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Start free trial
                  </button>
                </div>
              )
            })}
          </div>
          <p className="text-center text-xs text-neutral-700 mt-3">14-day free trial · No credit card required · Cancel anytime</p>
        </div>
      )}
    </div>
  )
}
