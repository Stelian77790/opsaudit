'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { db } from '@/lib/firebase'
import { doc, setDoc, updateDoc, serverTimestamp, collection } from 'firebase/firestore'
import { logCritical } from '@/lib/auditLog'
import toast from 'react-hot-toast'
import { Building2, MapPin, Users, Globe, ArrowRight, CheckCircle } from 'lucide-react'

const INDUSTRIES = ['Logistics', 'Manufacturing', 'Construction', 'Hospitality', 'Retail', 'Healthcare', 'Other']
const SIZES = ['1-50', '50-100', '100-250', '250-500', '500+']
const COUNTRIES = ['United Kingdom', 'Romania', 'Germany', 'France', 'Italy', 'Spain', 'United States', 'Other']

const steps = [
  { id: 1, title: 'Company Info', icon: Building2 },
  { id: 2, title: 'Location', icon: MapPin },
  { id: 3, title: 'Team Size', icon: Users },
]

export default function OnboardingPage() {
  const { user, refreshUser } = useAuth()
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    companyName: '',
    industry: '',
    size: '',
    country: '',
    city: '',
  })

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleFinish() {
    if (!user) return
    setLoading(true)
    try {
      const companyId = collection(db, 'companies').id || `company_${Date.now()}`
      const companyRef = doc(collection(db, 'companies'))
      const finalCompanyId = companyRef.id

      await setDoc(companyRef, {
        name: form.companyName,
        industry: form.industry,
        size: form.size,
        country: form.country,
        city: form.city,
        subscriptionTier: 'free',
        healthScore: null,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      })

      // Add default location
      await setDoc(doc(collection(db, `companies/${finalCompanyId}/locations`)), {
        name: 'Main Site',
        address: '',
        city: form.city,
        country: form.country,
        active: true,
        createdAt: serverTimestamp(),
      })

      // Add user as member
      await setDoc(doc(db, `companies/${finalCompanyId}/members`, user.uid), {
        userId: user.uid,
        name: user.name,
        email: user.email,
        role: 'admin',
        status: 'active',
        joinedAt: serverTimestamp(),
      })

      // Update user doc
      await updateDoc(doc(db, 'users', user.uid), {
        companyId: finalCompanyId,
        role: 'admin',
      })

      // Initialise usage
      await setDoc(doc(db, 'usage', finalCompanyId), {
        auditsThisMonth: 0,
        locationsCount: 1,
        membersCount: 1,
        resetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
      })

      await logCritical(finalCompanyId, {
        userId: user.uid,
        name: user.name,
        role: 'admin',
        email: user.email,
      }, {
        action: 'company_created',
        category: 'company',
        target: { type: 'company', id: finalCompanyId, label: form.companyName },
      })

      await refreshUser()

      // Send welcome email
      await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'welcome',
          toEmail: user.email,
          toName: user.name,
          companyName: form.companyName,
        }),
      })

      toast.success(`Welcome to OpsAudit, ${form.companyName}!`)
      router.push('/dashboard')
    } catch (err) {
      console.error(err)
      toast.error('Setup failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4">
      <div className="w-full max-w-lg animate-slide-up">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                step === s.id ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                step > s.id ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                'bg-[#1F1F1F] text-neutral-600 border border-[#2A2A2A]'
              }`}>
                {step > s.id ? <CheckCircle className="w-3 h-3" /> : <s.icon className="w-3 h-3" />}
                {s.title}
              </div>
              {i < steps.length - 1 && <div className={`w-8 h-px ${step > s.id ? 'bg-orange-500/50' : 'bg-[#2A2A2A]'}`} />}
            </div>
          ))}
        </div>

        <div className="card p-6">
          {step === 1 && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <h2 className="text-xl font-semibold text-white">Tell us about your company</h2>
                <p className="text-neutral-500 text-sm mt-1">This helps us customise your experience</p>
              </div>
              <div>
                <label className="label">Company name</label>
                <input className="input" placeholder="Acme Logistics Ltd" value={form.companyName} onChange={e => update('companyName', e.target.value)} />
              </div>
              <div>
                <label className="label">Industry</label>
                <div className="grid grid-cols-3 gap-2">
                  {INDUSTRIES.map(ind => (
                    <button key={ind} type="button" onClick={() => update('industry', ind)}
                      className={`px-3 py-2 rounded-lg text-sm border transition-all ${
                        form.industry === ind
                          ? 'bg-orange-500/20 text-orange-400 border-orange-500/40'
                          : 'bg-[#1A1A1A] text-neutral-400 border-[#2A2A2A] hover:border-neutral-600'
                      }`}>
                      {ind}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={() => setStep(2)}
                disabled={!form.companyName || !form.industry}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <h2 className="text-xl font-semibold text-white">Where are you based?</h2>
                <p className="text-neutral-500 text-sm mt-1">Your primary operating country</p>
              </div>
              <div>
                <label className="label">Country</label>
                <div className="grid grid-cols-2 gap-2">
                  {COUNTRIES.map(c => (
                    <button key={c} type="button" onClick={() => update('country', c)}
                      className={`px-3 py-2 rounded-lg text-sm border transition-all text-left ${
                        form.country === c
                          ? 'bg-orange-500/20 text-orange-400 border-orange-500/40'
                          : 'bg-[#1A1A1A] text-neutral-400 border-[#2A2A2A] hover:border-neutral-600'
                      }`}>
                      <Globe className="w-3 h-3 inline mr-1.5" />{c}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">City</label>
                <input className="input" placeholder="e.g. London" value={form.city} onChange={e => update('city', e.target.value)} />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStep(1)} className="btn-secondary flex-1">Back</button>
                <button onClick={() => setStep(3)} disabled={!form.country} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  Continue <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <h2 className="text-xl font-semibold text-white">How big is your team?</h2>
                <p className="text-neutral-500 text-sm mt-1">Approximate number of employees</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {SIZES.map(s => (
                  <button key={s} type="button" onClick={() => update('size', s)}
                    className={`px-3 py-3 rounded-lg text-sm border transition-all font-medium ${
                      form.size === s
                        ? 'bg-orange-500/20 text-orange-400 border-orange-500/40'
                        : 'bg-[#1A1A1A] text-neutral-400 border-[#2A2A2A] hover:border-neutral-600'
                    }`}>
                    {s}
                  </button>
                ))}
              </div>

              {/* Summary */}
              {form.size && (
                <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg p-4 space-y-2 animate-fade-in">
                  <p className="text-xs text-neutral-500 font-medium uppercase tracking-wide">Summary</p>
                  <div className="grid grid-cols-2 gap-1 text-sm">
                    <span className="text-neutral-500">Company</span><span className="text-white">{form.companyName}</span>
                    <span className="text-neutral-500">Industry</span><span className="text-white">{form.industry}</span>
                    <span className="text-neutral-500">Country</span><span className="text-white">{form.country}</span>
                    <span className="text-neutral-500">Team size</span><span className="text-white">{form.size}</span>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => setStep(2)} className="btn-secondary flex-1">Back</button>
                <button onClick={handleFinish} disabled={!form.size || loading} className="btn-primary flex-1">
                  {loading ? 'Setting up...' : 'Launch workspace'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
