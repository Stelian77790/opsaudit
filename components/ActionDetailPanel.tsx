'use client'

import { useState, useRef } from 'react'
import { CorrectiveAction } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { db, storage } from '@/lib/firebase'
import { doc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { logActivity } from '@/lib/auditLog'
import { generateId, severityColor, formatDateTime } from '@/lib/utils'
import toast from 'react-hot-toast'
import {
  X, Camera, CheckCircle, Clock, AlertTriangle,
  MessageSquare, RefreshCw, Loader2, Sparkles, User,
  ArrowRight, Upload
} from 'lucide-react'

interface ActionDetailPanelProps {
  action: CorrectiveAction
  onClose: () => void
  onUpdate: (updated: CorrectiveAction) => void
}

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open', color: 'text-orange-400' },
  { value: 'in_progress', label: 'In Progress', color: 'text-blue-400' },
  { value: 'resolved', label: 'Resolved', color: 'text-green-400' },
]

const PRIORITY_OPTIONS = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

export default function ActionDetailPanel({ action, onClose, onUpdate }: ActionDetailPanelProps) {
  const { user } = useAuth()
  const [comment, setComment] = useState('')
  const [comments, setComments] = useState<{ text: string; author: string; timestamp: Date }[]>([])
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [resolutionPhoto, setResolutionPhoto] = useState<string | null>(action.resolutionPhoto || null)
  const [aiVerification, setAiVerification] = useState(action.aiVerification || null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleStatusChange(newStatus: string) {
    if (!user?.companyId) return
    setSaving(true)
    try {
      await updateDoc(doc(db, `audits/${action.auditId}/actions`, action.id), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      })
      const updated = { ...action, status: newStatus as CorrectiveAction['status'] }
      onUpdate(updated)
      await logActivity(user.companyId, {
        userId: user.uid, name: user.name, role: user.role || '', email: user.email
      }, {
        action: 'action_status_changed',
        category: 'corrective_action',
        target: { type: 'corrective_action', id: action.id, label: action.title },
        change: { field: 'status', from: action.status, to: newStatus },
        auditId: action.auditId,
      })
      toast.success(`Status updated to ${newStatus}`)
    } catch (err) {
      console.error(err)
      toast.error('Update failed')
    } finally {
      setSaving(false)
    }
  }

  async function handlePriorityChange(newPriority: string) {
    if (!user?.companyId) return
    await updateDoc(doc(db, `audits/${action.auditId}/actions`, action.id), {
      priority: newPriority,
      updatedAt: serverTimestamp(),
    })
    onUpdate({ ...action, priority: newPriority as CorrectiveAction['priority'] })
    toast.success('Priority updated')
  }

  async function addComment() {
    if (!comment.trim() || !user) return
    const newComment = { text: comment, author: user.name, timestamp: new Date() }
    setComments(prev => [...prev, newComment])
    setComment('')

    // Store comment in Firestore
    await addDoc(collection(db, `audits/${action.auditId}/actions/${action.id}/comments`), {
      ...newComment,
      authorId: user.uid,
      timestamp: serverTimestamp(),
    })
  }

  async function handleResolutionPhoto(file: File) {
    if (!user?.companyId) return
    setUploadingPhoto(true)
    try {
      const path = `photos/${user.companyId}/${action.auditId}/resolutions/${action.id}_${generateId()}.jpg`
      const sRef = storageRef(storage, path)
      await uploadBytes(sRef, file)
      const url = await getDownloadURL(sRef)
      setResolutionPhoto(url)

      await updateDoc(doc(db, `audits/${action.auditId}/actions`, action.id), {
        resolutionPhoto: url,
        updatedAt: serverTimestamp(),
      })

      toast.success('Resolution photo uploaded — running AI verification...')
      await runAiVerification(url)
    } catch (err) {
      console.error(err)
      toast.error('Upload failed')
    } finally {
      setUploadingPhoto(false)
    }
  }

  async function runAiVerification(resolutionUrl: string) {
    setVerifying(true)
    try {
      const origRes = await fetch('/api/verify-resolution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalDescription: action.title,
          resolutionPhotoUrl: resolutionUrl,
          findingDescription: action.description,
        })
      })
      const data = await origRes.json()

      if (data.verification) {
        setAiVerification(data.verification)
        await updateDoc(doc(db, `audits/${action.auditId}/actions`, action.id), {
          aiVerification: data.verification,
          updatedAt: serverTimestamp(),
        })
        if (data.verification.confidence === 'High' && data.verification.resolved) {
          toast.success('AI verified — issue appears resolved!')
          await handleStatusChange('resolved')
        } else {
          toast('AI is not fully confident — please verify in person', { icon: '⚠️' })
        }
      }
    } catch (err) {
      console.error(err)
    } finally {
      setVerifying(false)
    }
  }

  const daysOpen = Math.floor((new Date().getTime() - new Date(action.createdAt as unknown as string).getTime()) / (1000 * 60 * 60 * 24))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg h-full bg-[#0D0D0D] border-l border-[#1F1F1F] overflow-y-auto animate-slide-up flex flex-col">

        {/* Header */}
        <div className="sticky top-0 bg-[#0D0D0D] border-b border-[#1F1F1F] p-5 z-10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-neutral-600 mb-1">Corrective Action</p>
              <h2 className="text-base font-semibold text-white leading-tight">{action.title}</h2>
            </div>
            <button onClick={onClose} className="btn-ghost p-1.5 shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Status & Priority */}
          <div className="flex items-center gap-2 mt-3">
            <select
              className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg text-xs px-2 py-1.5 text-white focus:outline-none focus:border-orange-500/30"
              value={action.status}
              onChange={e => handleStatusChange(e.target.value)}
              disabled={saving}
            >
              {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <select
              className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg text-xs px-2 py-1.5 text-white focus:outline-none focus:border-orange-500/30"
              value={action.priority}
              onChange={e => handlePriorityChange(e.target.value)}
            >
              {PRIORITY_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <span className={`badge text-xs ${severityColor(action.priority)}`}>{action.priority}</span>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 p-5 space-y-5">

          {/* Meta */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Assigned To', value: action.assigneeName || 'Unassigned', icon: User },
              { label: 'Days Open', value: `${daysOpen} days`, icon: Clock },
              { label: 'Due Date', value: action.dueDate ? formatDateTime(action.dueDate) : 'Not set', icon: AlertTriangle },
              { label: 'Created', value: formatDateTime(action.createdAt), icon: RefreshCw },
            ].map(item => (
              <div key={item.label} className="bg-[#1A1A1A] rounded-lg p-3">
                <p className="text-xs text-neutral-600 mb-1">{item.label}</p>
                <p className="text-sm text-white">{item.value}</p>
              </div>
            ))}
          </div>

          {/* Description */}
          {action.description && (
            <div>
              <p className="text-xs text-neutral-500 uppercase tracking-wide font-medium mb-2">Description</p>
              <p className="text-sm text-neutral-400 leading-relaxed">{action.description}</p>
            </div>
          )}

          {/* AI Suggested Action */}
          {(action as unknown as { aiSuggestedAction?: string }).aiSuggestedAction && (
            <div className="bg-orange-500/5 border border-orange-500/20 rounded-lg p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                <span className="text-xs font-medium text-orange-400">AI Recommended Action</span>
              </div>
              <p className="text-sm text-neutral-300">{(action as unknown as { aiSuggestedAction: string }).aiSuggestedAction}</p>
            </div>
          )}

          {/* Resolution Photo Upload */}
          {action.status !== 'resolved' && (
            <div>
              <p className="text-xs text-neutral-500 uppercase tracking-wide font-medium mb-2">Resolution Evidence</p>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                id="resolution-photo"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) handleResolutionPhoto(file)
                  e.target.value = ''
                }}
              />
              <label htmlFor="resolution-photo"
                className={`flex items-center gap-2 px-4 py-3 rounded-lg border cursor-pointer transition-all ${
                  uploadingPhoto || verifying
                    ? 'border-orange-500/30 text-orange-400 bg-orange-500/5'
                    : 'border-dashed border-[#2A2A2A] text-neutral-600 hover:border-neutral-500 hover:text-neutral-400'
                }`}>
                {uploadingPhoto ? <Loader2 className="w-4 h-4 animate-spin" /> :
                 verifying ? <Sparkles className="w-4 h-4 animate-pulse" /> :
                 <Upload className="w-4 h-4" />}
                <span className="text-sm">
                  {uploadingPhoto ? 'Uploading...' : verifying ? 'AI verifying...' : 'Upload resolution photo'}
                </span>
              </label>
            </div>
          )}

          {/* Resolution Photo Preview */}
          {resolutionPhoto && (
            <div>
              <p className="text-xs text-neutral-500 uppercase tracking-wide font-medium mb-2">Resolution Photo</p>
              <img src={resolutionPhoto} alt="Resolution" className="w-full rounded-lg border border-[#2A2A2A] max-h-48 object-cover" />
            </div>
          )}

          {/* AI Verification Result */}
          {aiVerification && (
            <div className={`rounded-lg p-3 border ${
              aiVerification.resolved && aiVerification.confidence === 'High'
                ? 'bg-green-500/5 border-green-500/20'
                : 'bg-yellow-500/5 border-yellow-500/20'
            }`}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Sparkles className={`w-3.5 h-3.5 ${aiVerification.resolved ? 'text-green-400' : 'text-yellow-400'}`} />
                <span className={`text-xs font-medium ${aiVerification.resolved ? 'text-green-400' : 'text-yellow-400'}`}>
                  AI Verification — {aiVerification.confidence} Confidence
                </span>
              </div>
              <p className="text-sm text-neutral-300">
                {aiVerification.resolved ? '✓ Issue appears resolved' : '⚠ Resolution not fully confirmed'}
              </p>
              {aiVerification.concerns && (
                <p className="text-xs text-neutral-500 mt-1">{aiVerification.concerns}</p>
              )}
            </div>
          )}

          {/* Quick Resolve Button */}
          {action.status !== 'resolved' && (
            <button
              onClick={() => handleStatusChange('resolved')}
              disabled={saving}
              className="w-full py-2.5 bg-green-500/10 border border-green-500/30 rounded-lg text-sm text-green-400 hover:bg-green-500/20 transition-all flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Mark as Resolved
            </button>
          )}

          {/* Comments */}
          <div>
            <p className="text-xs text-neutral-500 uppercase tracking-wide font-medium mb-3">Comments</p>
            {comments.length === 0 && (
              <p className="text-xs text-neutral-700 mb-3">No comments yet</p>
            )}
            <div className="space-y-2 mb-3">
              {comments.map((c, i) => (
                <div key={i} className="bg-[#1A1A1A] rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-orange-400">{c.author}</span>
                    <span className="text-xs text-neutral-700">{formatDateTime(c.timestamp)}</span>
                  </div>
                  <p className="text-sm text-neutral-300">{c.text}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="input flex-1 text-sm"
                placeholder="Add a comment..."
                value={comment}
                onChange={e => setComment(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && addComment()}
              />
              <button
                onClick={addComment}
                disabled={!comment.trim()}
                className="btn-primary px-3"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
