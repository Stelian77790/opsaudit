'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { db } from '@/lib/firebase'
import {
  doc, getDoc, updateDoc, collection,
  getDocs, addDoc, serverTimestamp
} from 'firebase/firestore'
import { Company, Location } from '@/types'
import { logActivity } from '@/lib/auditLog'
import toast from 'react-hot-toast'
import { Building2, MapPin, Plus, Save, Loader2, X } from 'lucide-react'

export default function SettingsPage() {
  const { user } = useAuth()
  const [company, setCompany] = useState<Company | null>(null)
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('company')
  const [showAddLocation, setShowAddLocation] = useState(false)
  const [newLocation, setNewLocation] = useState({ name: '', address: '', city: '', country: '' })

  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    if (!user?.companyId) return
    Promise.all([
      getDoc(doc(db, 'companies', user.companyId)),
      getDocs(collection(db, `companies/${user.companyId}/locations`))
    ]).then(([companySnap, locSnap]) => {
      if (companySnap.exists()) setCompany({ id: companySnap.id, ...companySnap.data() } as Company)
      setLocations(locSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Location))
      setLoading(false)
    })
  }, [user?.companyId])

  async function saveCompany() {
    if (!company || !user?.companyId) return
    setSaving(true)
    try {
      await updateDoc(doc(db, 'companies', user.companyId), {
        name: company.name,
        industry: company.industry,
        country: company.country,
      })
      await logActivity(user.companyId, {
        userId: user.uid, name: user.name, role: user.role || '', email: user.email
      }, { action: 'company_settings_updated', category: 'settings', target: { type: 'company', id: user.companyId, label: company.name } })
      toast.success('Settings saved')
    } catch { toast.error('Save failed') }
    finally { setSaving(false) }
  }

  async function addLocation() {
    if (!newLocation.name || !user?.companyId) return
    try {
      const ref = await addDoc(collection(db, `companies/${user.companyId}/locations`), {
        ...newLocation, active: true, createdAt: serverTimestamp()
      })
      setLocations(prev => [...prev, { id: ref.id, ...newLocation, active: true, companyId: user.companyId!, createdAt: new Date() }])
      setNewLocation({ name: '', address: '', city: '', country: '' })
      setShowAddLocation(false)
      toast.success('Location added')
    } catch { toast.error('Failed to add location') }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 text-orange-400 animate-spin" />
    </div>
  )

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-neutral-500 text-sm mt-0.5">Manage your company workspace</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#1F1F1F] pb-0">
        {[
          { id: 'company', label: 'Company', icon: Building2 },
          { id: 'locations', label: 'Locations', icon: MapPin },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-all ${
              activeTab === tab.id
                ? 'border-orange-500 text-orange-400'
                : 'border-transparent text-neutral-500 hover:text-neutral-300'
            }`}>
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Company Tab */}
      {activeTab === 'company' && company && (
        <div className="card p-6 space-y-4 animate-fade-in">
          <h2 className="text-sm font-semibold text-white">Company Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Company name</label>
              <input className="input" value={company.name} onChange={e => setCompany(c => c ? { ...c, name: e.target.value } : c)} disabled={!isAdmin} />
            </div>
            <div>
              <label className="label">Industry</label>
              <input className="input" value={company.industry} onChange={e => setCompany(c => c ? { ...c, industry: e.target.value } : c)} disabled={!isAdmin} />
            </div>
            <div>
              <label className="label">Country</label>
              <input className="input" value={company.country} onChange={e => setCompany(c => c ? { ...c, country: e.target.value } : c)} disabled={!isAdmin} />
            </div>
            <div>
              <label className="label">Subscription</label>
              <div className="input flex items-center gap-2 cursor-default">
                <span className={`w-2 h-2 rounded-full ${company.subscriptionTier === 'free' ? 'bg-neutral-500' : 'bg-orange-400'}`} />
                <span className="capitalize">{company.subscriptionTier}</span>
              </div>
            </div>
          </div>
          {isAdmin && (
            <button onClick={saveCompany} disabled={saving} className="btn-primary flex items-center gap-2 text-sm">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>
      )}

      {/* Locations Tab */}
      {activeTab === 'locations' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <p className="text-sm text-neutral-500">{locations.length} location{locations.length !== 1 ? 's' : ''}</p>
            {isAdmin && (
              <button onClick={() => setShowAddLocation(true)} className="btn-primary text-sm flex items-center gap-2">
                <Plus className="w-4 h-4" /> Add Location
              </button>
            )}
          </div>

          {locations.map(loc => (
            <div key={loc.id} className="card p-4 flex items-center gap-4">
              <div className="w-9 h-9 bg-orange-500/10 border border-orange-500/20 rounded-lg flex items-center justify-center">
                <MapPin className="w-4 h-4 text-orange-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-white font-medium">{loc.name}</p>
                <p className="text-xs text-neutral-600">{[loc.address, loc.city, loc.country].filter(Boolean).join(', ')}</p>
              </div>
              <span className={`badge text-xs ${loc.active !== false ? 'text-green-400 bg-green-400/10 border-green-400/20' : 'text-neutral-500 bg-neutral-500/10 border-neutral-500/20'}`}>
                {loc.active !== false ? 'Active' : 'Inactive'}
              </span>
            </div>
          ))}

          {locations.length === 0 && (
            <div className="card p-8 text-center">
              <MapPin className="w-8 h-8 text-neutral-700 mx-auto mb-2" />
              <p className="text-neutral-600 text-sm">No locations added yet</p>
            </div>
          )}

          {/* Add Location Modal */}
          {showAddLocation && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowAddLocation(false)}>
              <div className="card w-full max-w-md p-6 space-y-4 animate-slide-up" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-white">Add Location</h2>
                  <button onClick={() => setShowAddLocation(false)} className="btn-ghost p-1.5"><X className="w-4 h-4" /></button>
                </div>
                {[
                  { field: 'name', label: 'Location name', placeholder: 'e.g. Warehouse A' },
                  { field: 'address', label: 'Address', placeholder: '123 Industrial Road' },
                  { field: 'city', label: 'City', placeholder: 'Birmingham' },
                  { field: 'country', label: 'Country', placeholder: 'United Kingdom' },
                ].map(({ field, label, placeholder }) => (
                  <div key={field}>
                    <label className="label">{label}</label>
                    <input
                      className="input"
                      placeholder={placeholder}
                      value={newLocation[field as keyof typeof newLocation]}
                      onChange={e => setNewLocation(prev => ({ ...prev, [field]: e.target.value }))}
                    />
                  </div>
                ))}
                <div className="flex gap-3">
                  <button onClick={() => setShowAddLocation(false)} className="btn-secondary flex-1">Cancel</button>
                  <button onClick={addLocation} disabled={!newLocation.name} className="btn-primary flex-1">Add Location</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
