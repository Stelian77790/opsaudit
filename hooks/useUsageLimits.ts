'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
import { PLANS, PlanTier } from '@/lib/stripe'

interface UsageData {
  auditsThisMonth: number
  locationsCount: number
  membersCount: number
}

interface LimitsResult {
  usage: UsageData | null
  plan: PlanTier
  limits: typeof PLANS['free']['limits']
  canCreateAudit: boolean
  canAddLocation: boolean
  canAddMember: boolean
  auditUsagePercent: number
  isLoading: boolean
  isPro: boolean
}

export function useUsageLimits(): LimitsResult {
  const { user } = useAuth()
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [plan, setPlan] = useState<PlanTier>('free')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!user?.companyId) return
    async function load() {
      try {
        const [usageSnap, companySnap] = await Promise.all([
          getDoc(doc(db, 'usage', user!.companyId!)),
          getDoc(doc(db, 'companies', user!.companyId!)),
        ])
        if (usageSnap.exists()) setUsage(usageSnap.data() as UsageData)
        if (companySnap.exists()) {
          const tier = companySnap.data().subscriptionTier as PlanTier
          setPlan(tier || 'free')
        }
      } catch (err) {
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [user?.companyId])

  const limits = PLANS[plan]?.limits || PLANS.free.limits
  const isPro = plan !== 'free'

  return {
    usage,
    plan,
    limits,
    canCreateAudit: isPro || (usage?.auditsThisMonth || 0) < (limits.auditsPerMonth as number),
    canAddLocation: isPro || (usage?.locationsCount || 0) < (limits.locations as number),
    canAddMember: isPro || (usage?.membersCount || 0) < (limits.members as number),
    auditUsagePercent: isPro ? 0 : Math.min(100, Math.round(((usage?.auditsThisMonth || 0) / (limits.auditsPerMonth as number)) * 100)),
    isLoading,
    isPro,
  }
}
