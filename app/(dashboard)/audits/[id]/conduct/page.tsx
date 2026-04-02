'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { db, storage } from '@/lib/firebase'
import {
  doc, getDoc, collection, addDoc, updateDoc,
  serverTimestamp, getDocs
} from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { Audit, Template, Section, Question, AuditAnswer, Finding } from '@/types'
import { logActivity } from '@/lib/auditLog'
import { generateId, severityColor } from '@/lib/utils'
import toast from 'react-hot-toast'
import {
  ChevronLeft, ChevronRight, Camera, Mic, MicOff,
  CheckCircle, XCircle, AlertTriangle, Minus,
  Loader2, Sparkles, X, Check, Send
} from 'lucide-react'
import dynamic from 'next/dynamic'

const AuditCopilot = dynamic(() => import('@/components/AuditCopilot'), { ssr: false })

interface AiHazard {
  description: string
  severity: string
  category: string
  confidence: string
  suggestedAction: string
}

interface AiAnalysis {
  hazards: AiHazard[]
  overallRisk: string
  summary: string
}

export default function ConductAuditPage({ params }: { params: { id: string } }) {
  const { user } = useAuth()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [audit, setAudit] = useState<Audit | null>(null)
  const [template, setTemplate] = useState<Template | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [currentSectionIdx, setCurrentSectionIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, AuditAnswer>>({})

  // Photo AI state
  const [analyzingPhoto, setAnalyzingPhoto] = useState(false)
  const [photoAnalysis, setPhotoAnalysis] = useState<Record<string, AiAnalysis>>({})
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  // Voice state
  const [recording, setRecording] = useState(false)
  const [voiceQuestionId, setVoiceQuestionId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const auditSnap = await getDoc(doc(db, 'audits', params.id))
        if (!auditSnap.exists()) { router.push('/audits'); return }
        const auditData = { id: auditSnap.id, ...auditSnap.data() } as Audit
        setAudit(auditData)

        const templateSnap = await getDoc(doc(db, 'templates', auditData.templateId))
        if (templateSnap.exists()) {
          setTemplate({ id: templateSnap.id, ...templateSnap.data() } as Template)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [params.id])

  function setAnswer(questionId: string, value: string) {
    setAnswers(prev => ({
      ...prev,
      [questionId]: {
        questionId,
        answer: value,
        notes: prev[questionId]?.notes || '',
        photos: prev[questionId]?.photos || [],
        timestamp: new Date(),
      }
    }))
  }

  function setNote(questionId: string, note: string) {
    setAnswers(prev => ({
      ...prev,
      [questionId]: { ...prev[questionId], questionId, notes: note, timestamp: new Date(), answer: prev[questionId]?.answer || '' }
    }))
  }

  async function handlePhotoCapture(questionId: string, file: File) {
    if (!user?.companyId || !audit) return
    setUploadingPhoto(true)
    try {
      // Upload to storage
      const path = `photos/${user.companyId}/${audit.id}/${questionId}/${generateId()}.jpg`
      const sRef = storageRef(storage, path)
      await uploadBytes(sRef, file)
      const url = await getDownloadURL(sRef)

      // Update answer with photo
      setAnswers(prev => ({
        ...prev,
        [questionId]: {
          ...prev[questionId],
          questionId,
          answer: prev[questionId]?.answer || '',
          timestamp: new Date(),
          photos: [...(prev[questionId]?.photos || []), url]
        }
      }))

      // AI Analysis
      setAnalyzingPhoto(true)
      const reader = new FileReader()
      reader.onload = async (e) => {
        const base64 = (e.target?.result as string)?.split(',')[1]
        if (!base64) return
        try {
          const res = await fetch('/api/analyse-photo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageBase64: base64,
              mediaType: file.type,
              context: `${template?.title || 'Audit'} - ${audit.locationName}`
            })
          })
          const data = await res.json()
          if (data.analysis) {
            setPhotoAnalysis(prev => ({ ...prev, [questionId]: data.analysis }))
            if (data.analysis.hazards.length > 0) {
              toast.success(`AI found ${data.analysis.hazards.length} potential hazard${data.analysis.hazards.length > 1 ? 's' : ''}`)
            }
          }
        } catch (err) {
          console.error('Photo analysis failed:', err)
        } finally {
          setAnalyzingPhoto(false)
        }
      }
      reader.readAsDataURL(file)
    } catch (err) {
      console.error(err)
      toast.error('Photo upload failed')
    } finally {
      setUploadingPhoto(false)
    }
  }

  async function handleSubmit() {
    if (!template || !audit || !user?.companyId) return
    setSubmitting(true)
    try {
      // Calculate score
      let totalWeight = 0
      let passWeight = 0
      const findings: string[] = []

      for (const section of template.sections) {
        for (const question of section.questions) {
          const answer = answers[question.id]
          const weight = question.weight || 3
          totalWeight += weight
          if (answer?.answer === 'pass' || answer?.answer === 'yes') {
            passWeight += weight
          }

          // Create findings for fails
          if (answer?.answer === 'fail' || answer?.answer === 'no') {
            const analysis = photoAnalysis[question.id]
            const findingRef = await addDoc(collection(db, `audits/${audit.id}/findings`), {
              auditId: audit.id,
              questionId: question.id,
              questionText: question.text,
              answer: answer.answer,
              notes: answer.notes || '',
              photos: answer.photos || [],
              severity: analysis?.overallRisk || 'medium',
              aiAnalysis: analysis?.summary || null,
              category: analysis?.hazards?.[0]?.category || 'other',
              aiSuggestedAction: analysis?.hazards?.[0]?.suggestedAction || null,
              createdAt: serverTimestamp(),
            } as unknown as Partial<Finding>)
            findings.push(findingRef.id)
          }
        }
      }

      const score = totalWeight > 0 ? Math.round((passWeight / totalWeight) * 100) : 100

      await updateDoc(doc(db, 'audits', audit.id), {
        status: 'submitted',
        score,
        findings,
        submittedAt: serverTimestamp(),
      })

      // Run quality scoring asynchronously
      fetch('/api/score-quality', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audit: {
            templateTitle: template.title,
            score,
            totalQuestions,
            startedAt: audit.startedAt,
            submittedAt: new Date().toISOString(),
          },
          findings: await (async () => {
            const snap = await getDocs(collection(db, `audits/${audit.id}/findings`))
            return snap.docs.map(d => d.data())
          })(),
          answers,
        }),
      }).then(async res => {
        const data = await res.json()
        if (data.quality) {
          await updateDoc(doc(db, 'audits', audit.id), { qualityScore: data.quality.qualityScore })
        }
      }).catch(console.error)

      await logActivity(user.companyId, {
        userId: user.uid, name: user.name, role: user.role || '', email: user.email
      }, {
        action: 'audit_submitted',
        category: 'audit',
        target: { type: 'audit', id: audit.id, label: template.title },
        auditId: audit.id,
        metadata: { score, findingsCount: findings.length },
      })

      toast.success(`Audit submitted! Score: ${score}%`)
      router.push(`/audits/${audit.id}`)
    } catch (err) {
      console.error(err)
      toast.error('Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 text-orange-400 animate-spin" />
    </div>
  )

  if (!template || !audit) return null

  const sections = template.sections
  const currentSection = sections[currentSectionIdx]
  const totalQuestions = sections.reduce((s, sec) => s + sec.questions.length, 0)
  const answeredQuestions = Object.keys(answers).length
  const progress = Math.round((answeredQuestions / totalQuestions) * 100)
  const isLastSection = currentSectionIdx === sections.length - 1
  const canSubmit = answeredQuestions >= sections.reduce((s, sec) => s + sec.questions.filter(q => q.required).length, 0)

  return (
    <div className="max-w-2xl mx-auto space-y-4 animate-fade-in pb-20">
      {/* Header */}
      <div className="card p-4 sticky top-0 z-10 bg-[#0A0A0A]/95 backdrop-blur-sm border-b border-[#1F1F1F]">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-sm font-semibold text-white">{template.title}</h1>
            <p className="text-xs text-neutral-600">{audit.locationName}</p>
          </div>
          <span className="text-sm font-semibold text-orange-400">{progress}%</span>
        </div>
        <div className="w-full bg-[#1F1F1F] rounded-full h-1.5">
          <div
            className="bg-orange-500 h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-2 text-xs text-neutral-600">
          <span>Section {currentSectionIdx + 1} of {sections.length}: <span className="text-neutral-400">{currentSection.title}</span></span>
          <span>{answeredQuestions}/{totalQuestions} answered</span>
        </div>
      </div>

      {/* Questions */}
      <div className="space-y-4">
        {currentSection.questions.map((question, idx) => {
          const answer = answers[question.id]
          const analysis = photoAnalysis[question.id]

          return (
            <div key={question.id} className={`card p-5 transition-all ${answer?.answer ? 'border-orange-500/20' : ''}`}>
              <div className="flex items-start gap-3 mb-4">
                <span className="w-6 h-6 bg-[#1A1A1A] rounded-full flex items-center justify-center text-xs text-neutral-500 shrink-0 mt-0.5">{idx + 1}</span>
                <div>
                  <p className="text-sm text-white font-medium">{question.text}</p>
                  {question.hint && <p className="text-xs text-neutral-600 mt-1 flex items-center gap-1"><span className="text-orange-400/60">💡</span>{question.hint}</p>}
                </div>
              </div>

              {/* Answer Controls */}
              {(question.type === 'yes_no') && (
                <div className="flex gap-3 ml-9">
                  {['yes', 'no'].map(val => (
                    <button key={val} onClick={() => setAnswer(question.id, val)}
                      className={`flex-1 py-3 rounded-xl font-medium text-sm border transition-all flex items-center justify-center gap-2 ${
                        answer?.answer === val
                          ? val === 'yes' ? 'bg-green-500/20 border-green-500/40 text-green-400' : 'bg-red-500/20 border-red-500/40 text-red-400'
                          : 'bg-[#1A1A1A] border-[#2A2A2A] text-neutral-400 hover:border-neutral-600'
                      }`}>
                      {val === 'yes' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                      {val.charAt(0).toUpperCase() + val.slice(1)}
                    </button>
                  ))}
                </div>
              )}

              {(question.type === 'pass_fail') && (
                <div className="flex gap-2 ml-9">
                  {[
                    { val: 'pass', label: 'Pass', icon: CheckCircle, color: 'green' },
                    { val: 'fail', label: 'Fail', icon: XCircle, color: 'red' },
                    { val: 'na', label: 'N/A', icon: Minus, color: 'neutral' },
                  ].map(({ val, label, icon: Icon, color }) => (
                    <button key={val} onClick={() => setAnswer(question.id, val)}
                      className={`flex-1 py-3 rounded-xl text-sm border transition-all flex items-center justify-center gap-1.5 ${
                        answer?.answer === val
                          ? `bg-${color}-500/20 border-${color}-500/40 text-${color}-400`
                          : 'bg-[#1A1A1A] border-[#2A2A2A] text-neutral-400 hover:border-neutral-600'
                      }`}
                      style={answer?.answer === val ? {
                        backgroundColor: `rgba(${color === 'green' ? '34,197,94' : color === 'red' ? '239,68,68' : '163,163,163'}, 0.1)`,
                        borderColor: `rgba(${color === 'green' ? '34,197,94' : color === 'red' ? '239,68,68' : '163,163,163'}, 0.3)`,
                        color: color === 'green' ? '#4ade80' : color === 'red' ? '#f87171' : '#a3a3a3'
                      } : {}}>
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {question.type === 'text' && (
                <textarea
                  className="input ml-9 w-[calc(100%-2.25rem)] resize-none text-sm"
                  rows={3}
                  placeholder="Enter your observation..."
                  value={answer?.answer || ''}
                  onChange={e => setAnswer(question.id, e.target.value)}
                />
              )}

              {question.type === 'number' && (
                <input
                  type="number"
                  className="input ml-9 w-[calc(100%-2.25rem)] text-sm"
                  placeholder="Enter value..."
                  value={answer?.answer || ''}
                  onChange={e => setAnswer(question.id, e.target.value)}
                />
              )}

              {/* Notes */}
              <div className="mt-3 ml-9">
                <input
                  className="w-full bg-transparent border-b border-[#1F1F1F] text-xs text-neutral-500 placeholder-neutral-700 py-1 focus:outline-none focus:border-orange-500/30 transition-colors"
                  placeholder="Add a note..."
                  value={answer?.notes || ''}
                  onChange={e => setNote(question.id, e.target.value)}
                />
              </div>

              {/* Photo capture */}
              <div className="mt-3 ml-9">
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (file) handlePhotoCapture(question.id, file)
                      e.target.value = ''
                    }}
                    id={`photo-${question.id}`}
                  />
                  <label
                    htmlFor={`photo-${question.id}`}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs cursor-pointer transition-all ${
                      uploadingPhoto || analyzingPhoto
                        ? 'border-orange-500/30 text-orange-400'
                        : 'border-[#2A2A2A] text-neutral-600 hover:border-neutral-500 hover:text-neutral-400'
                    }`}
                  >
                    {uploadingPhoto || analyzingPhoto
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Camera className="w-3.5 h-3.5" />}
                    {uploadingPhoto ? 'Uploading...' : analyzingPhoto ? 'Analysing...' : 'Add Photo'}
                  </label>

                  {answer?.photos?.length ? (
                    <span className="text-xs text-neutral-600">{answer.photos.length} photo{answer.photos.length > 1 ? 's' : ''}</span>
                  ) : null}
                </div>

                {/* Photo thumbnails */}
                {answer?.photos?.length ? (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {answer.photos.map((url, i) => (
                      <img key={i} src={url} alt="Evidence" className="w-16 h-16 object-cover rounded-lg border border-[#2A2A2A]" />
                    ))}
                  </div>
                ) : null}

                {/* AI Analysis Results */}
                {analysis && analysis.hazards.length > 0 && (
                  <div className="mt-3 bg-[#1A1A1A] border border-orange-500/20 rounded-lg p-3 space-y-2 animate-fade-in">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                      <span className="text-xs font-medium text-orange-400">AI Hazard Analysis</span>
                    </div>
                    {analysis.hazards.map((hazard, i) => (
                      <div key={i} className={`p-2 rounded-lg ${severityColor(hazard.severity)}`}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-medium capitalize">{hazard.severity} Risk</span>
                          <span className="text-xs opacity-70">{hazard.confidence} confidence</span>
                        </div>
                        <p className="text-xs opacity-80">{hazard.description}</p>
                        {hazard.suggestedAction && (
                          <p className="text-xs opacity-60 mt-1">→ {hazard.suggestedAction}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {analysis && analysis.hazards.length === 0 && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-green-400">
                    <CheckCircle className="w-3 h-3" />
                    No hazards detected in photo
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Navigation */}
      <div className="fixed bottom-0 left-60 right-0 bg-[#0A0A0A]/95 backdrop-blur-sm border-t border-[#1F1F1F] p-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <button
            onClick={() => setCurrentSectionIdx(i => i - 1)}
            disabled={currentSectionIdx === 0}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>

          <div className="flex gap-1">
            {sections.map((_, i) => (
              <button key={i} onClick={() => setCurrentSectionIdx(i)}
                className={`w-2 h-2 rounded-full transition-all ${i === currentSectionIdx ? 'bg-orange-400 w-4' : 'bg-[#2A2A2A] hover:bg-neutral-600'}`}
              />
            ))}
          </div>

          {isLastSection ? (
            <button
              onClick={handleSubmit}
              disabled={submitting || !canSubmit}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {submitting ? 'Submitting...' : 'Submit Audit'}
            </button>
          ) : (
            <button
              onClick={() => setCurrentSectionIdx(i => i + 1)}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      {/* AI Copilot */}
      {template && audit && (
        <AuditCopilot
          auditContext={{
            templateTitle: template.title,
            locationName: audit.locationName,
            currentSection: currentSection?.title,
            findingsLogged: Object.values(answers).filter(a => a.answer === 'fail' || a.answer === 'no').length,
          }}
        />
      )}
    </div>
  )
}
