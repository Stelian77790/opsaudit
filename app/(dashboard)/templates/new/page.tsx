'use client'

import { useEffect, useState, useCallback, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { db } from '@/lib/firebase'
import { doc, setDoc, getDoc, serverTimestamp, collection } from 'firebase/firestore'
import { Template, Section, Question, QuestionType } from '@/types'
import { logActivity } from '@/lib/auditLog'
import { generateId } from '@/lib/utils'
import toast from 'react-hot-toast'
import {
  Plus, Trash2, GripVertical, Sparkles, Save,
  ArrowLeft, ChevronDown, ChevronUp, Loader2, Info, Upload
} from 'lucide-react'

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: 'yes_no', label: 'Yes / No' },
  { value: 'pass_fail', label: 'Pass / Fail / N/A' },
  { value: 'text', label: 'Text Answer' },
  { value: 'number', label: 'Number' },
  { value: 'photo', label: 'Photo Required' },
  { value: 'multiple_choice', label: 'Multiple Choice' },
]

const INDUSTRIES = ['Logistics', 'Manufacturing', 'Construction', 'Hospitality', 'Retail', 'Healthcare', 'General', 'Other']

function emptySection(): Section {
  return { id: generateId(), title: 'New Section', questions: [] }
}

function emptyQuestion(): Question {
  return { id: generateId(), text: '', type: 'pass_fail', required: true, weight: 3 }
}

function TemplateEditor({ params }: { params: { id?: string } }) {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const isAiMode = searchParams.get('mode') === 'ai'
  const isNew = !params?.id || params.id === 'new'

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [industry, setIndustry] = useState('General')
  const [sections, setSections] = useState<Section[]>([emptySection()])
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(!isNew)

  // AI state
  const [aiPrompt, setAiPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [showAiPanel, setShowAiPanel] = useState(isAiMode)
  const [showSopPanel, setShowSopPanel] = useState(false)
  const [uploadingSop, setUploadingSop] = useState(false)
  const sopFileRef = useRef<HTMLInputElement>(null)

  async function handleSopUpload(file: File) {
    setUploadingSop(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('industry', industry)
      const res = await fetch('/api/analyse-sop', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const t = data.template
      setTitle(t.title)
      setDescription(t.description)
      setSections(t.sections.map((s: Section) => ({ ...s, id: generateId(), questions: s.questions.map((q: Question) => ({ ...q, id: generateId() })) })))
      setExpandedSections(new Set(t.sections.map((_: Section, i: number) => i.toString())))
      setShowSopPanel(false)
      toast.success(`Template generated from ${data.filename}`)
    } catch (err) {
      console.error(err)
      toast.error('SOP analysis failed. Check file format.')
    } finally {
      setUploadingSop(false)
    }
  }

  useEffect(() => {
    if (!isNew && params?.id) {
      getDoc(doc(db, 'templates', params.id)).then(snap => {
        if (snap.exists()) {
          const t = snap.data() as Template
          setTitle(t.title)
          setDescription(t.description)
          setIndustry(t.industry)
          setSections(t.sections)
          setExpandedSections(new Set(t.sections.map(s => s.id)))
        }
        setLoading(false)
      })
    } else {
      setExpandedSections(new Set([sections[0].id]))
    }
  }, [])

  async function generateWithAI() {
    if (!aiPrompt.trim()) { toast.error('Describe the audit first'); return }
    setGenerating(true)
    try {
      const res = await fetch('/api/generate-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: aiPrompt, industry })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const t = data.template
      setTitle(t.title)
      setDescription(t.description)
      setSections(t.sections.map((s: Section) => ({
        ...s,
        id: generateId(),
        questions: s.questions.map((q: Question) => ({ ...q, id: generateId() }))
      })))
      setExpandedSections(new Set(t.sections.map((_: Section, i: number) => i.toString())))
      setShowAiPanel(false)
      toast.success('Template generated! Review and save.')
    } catch (err) {
      console.error(err)
      toast.error('Generation failed. Try again.')
    } finally {
      setGenerating(false)
    }
  }

  async function handleSave() {
    if (!title.trim()) { toast.error('Add a title'); return }
    if (sections.length === 0) { toast.error('Add at least one section'); return }
    if (!user?.companyId) return
    setSaving(true)
    try {
      const ref = isNew ? doc(collection(db, 'templates')) : doc(db, 'templates', params!.id!)
      const data = {
        companyId: user.companyId,
        title: title.trim(),
        description: description.trim(),
        industry,
        sections,
        isPublic: false,
        version: 1,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
      await setDoc(ref, data, { merge: true })
      await logActivity(user.companyId, {
        userId: user.uid, name: user.name, role: user.role || '', email: user.email
      }, {
        action: isNew ? 'template_created' : 'template_updated',
        category: 'template',
        target: { type: 'template', id: ref.id, label: title }
      })
      toast.success(isNew ? 'Template saved!' : 'Template updated!')
      router.push('/templates')
    } catch (err) {
      console.error(err)
      toast.error('Save failed')
    } finally {
      setSaving(false)
    }
  }

  function addSection() {
    const s = emptySection()
    setSections(prev => [...prev, s])
    setExpandedSections(prev => new Set([...prev, s.id]))
  }

  function removeSection(id: string) {
    setSections(prev => prev.filter(s => s.id !== id))
  }

  function updateSection(id: string, field: string, value: string) {
    setSections(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  function toggleSection(id: string) {
    setExpandedSections(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function addQuestion(sectionId: string) {
    setSections(prev => prev.map(s =>
      s.id === sectionId ? { ...s, questions: [...s.questions, emptyQuestion()] } : s
    ))
  }

  function removeQuestion(sectionId: string, questionId: string) {
    setSections(prev => prev.map(s =>
      s.id === sectionId ? { ...s, questions: s.questions.filter(q => q.id !== questionId) } : s
    ))
  }

  function updateQuestion(sectionId: string, questionId: string, field: string, value: unknown) {
    setSections(prev => prev.map(s =>
      s.id === sectionId ? {
        ...s,
        questions: s.questions.map(q => q.id === questionId ? { ...q, [field]: value } : q)
      } : s
    ))
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 text-orange-400 animate-spin" />
    </div>
  )

  const totalQuestions = sections.reduce((s, sec) => s + sec.questions.length, 0)

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="btn-ghost p-2">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">{isNew ? 'New Template' : 'Edit Template'}</h1>
            <p className="text-neutral-500 text-xs mt-0.5">
              {sections.length} sections · {totalQuestions} questions
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSopPanel(!showSopPanel)} className="btn-secondary flex items-center gap-2 text-sm">
            <Upload className="w-4 h-4 text-blue-400" /> Upload SOP
          </button>
          <button onClick={() => setShowAiPanel(!showAiPanel)} className="btn-secondary flex items-center gap-2 text-sm">
            <Sparkles className="w-4 h-4 text-orange-400" /> AI Generate
          </button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2 text-sm">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save Template'}
          </button>
        </div>
      </div>

      {/* SOP Upload Panel */}
      {showSopPanel && (
        <div className="card border-blue-500/30 bg-blue-500/5 p-5 space-y-4 animate-slide-up">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-blue-400">SOP / Work Instruction Upload</h3>
          </div>
          <p className="text-xs text-neutral-500">Upload a PDF or text SOP document. Claude will read every procedure and generate a compliance audit template with each question traceable to its source section.</p>
          <input ref={sopFileRef} type="file" accept=".pdf,.txt" className="hidden" id="sop-upload"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleSopUpload(f); e.target.value = '' }} />
          <label htmlFor="sop-upload"
            className={`flex items-center justify-center gap-3 p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
              uploadingSop ? 'border-blue-500/40 bg-blue-500/10' : 'border-[#2A2A2A] hover:border-blue-500/30 hover:bg-blue-500/5'
            }`}>
            {uploadingSop ? (
              <><Loader2 className="w-5 h-5 text-blue-400 animate-spin" /><span className="text-sm text-blue-400">Analysing document with Claude...</span></>
            ) : (
              <><Upload className="w-5 h-5 text-neutral-600" /><div><p className="text-sm text-neutral-400">Click to upload PDF or TXT</p><p className="text-xs text-neutral-600 mt-0.5">Max 20MB · SOP, WI, Risk Assessment, Method Statement</p></div></>
            )}
          </label>
        </div>
      )}

      {/* AI Panel */}
      {showAiPanel && (
        <div className="card border-orange-500/30 bg-orange-500/5 p-5 space-y-4 animate-slide-up">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-orange-400" />
            <h3 className="text-sm font-semibold text-orange-400">AI Template Generator</h3>
          </div>
          <div>
            <label className="label">Describe the audit you need</label>
            <textarea
              className="input min-h-[80px] resize-none"
              placeholder="e.g. Monthly fire safety walkthrough for a 3-floor warehouse with forklift operations and chemical storage areas"
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="label">Industry context</label>
              <select className="input" value={industry} onChange={e => setIndustry(e.target.value)}>
                {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div className="flex items-end pb-0.5">
              <button onClick={generateWithAI} disabled={generating || !aiPrompt.trim()} className="btn-primary flex items-center gap-2 whitespace-nowrap">
                {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><Sparkles className="w-4 h-4" /> Generate</>}
              </button>
            </div>
          </div>
          {generating && (
            <div className="flex items-center gap-2 text-xs text-neutral-500">
              <div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-pulse" />
              Claude is building your template...
            </div>
          )}
        </div>
      )}

      {/* Template Meta */}
      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white">Template Details</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label">Template title</label>
            <input className="input" placeholder="e.g. Monthly Fire Safety Walkthrough" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="label">Description</label>
            <input className="input" placeholder="Brief description of what this audit covers" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div>
            <label className="label">Industry</label>
            <select className="input" value={industry} onChange={e => setIndustry(e.target.value)}>
              {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-3">
        {sections.map((section, sIdx) => (
          <div key={section.id} className="card overflow-hidden">
            {/* Section Header */}
            <div
              className="flex items-center gap-3 p-4 cursor-pointer hover:bg-[#1A1A1A] transition-colors"
              onClick={() => toggleSection(section.id)}
            >
              <GripVertical className="w-4 h-4 text-neutral-700 shrink-0" />
              <div className="flex-1">
                <input
                  className="bg-transparent text-white font-medium text-sm w-full focus:outline-none"
                  value={section.title}
                  onChange={e => { e.stopPropagation(); updateSection(section.id, 'title', e.target.value) }}
                  onClick={e => e.stopPropagation()}
                  placeholder="Section title"
                />
                <p className="text-xs text-neutral-600 mt-0.5">{section.questions.length} questions</p>
              </div>
              <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                <button onClick={() => removeSection(section.id)} className="p-1.5 hover:bg-red-500/10 rounded text-neutral-600 hover:text-red-400 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                {expandedSections.has(section.id) ? <ChevronUp className="w-4 h-4 text-neutral-600" /> : <ChevronDown className="w-4 h-4 text-neutral-600" />}
              </div>
            </div>

            {/* Questions */}
            {expandedSections.has(section.id) && (
              <div className="border-t border-[#1F1F1F] p-4 space-y-3">
                {section.questions.map((question, qIdx) => (
                  <div key={question.id} className="bg-[#1A1A1A] rounded-lg p-3 space-y-2.5 group">
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-neutral-600 w-5 shrink-0 mt-2 text-right">{qIdx + 1}.</span>
                      <input
                        className="flex-1 bg-transparent border-b border-[#2A2A2A] text-white text-sm py-1 focus:outline-none focus:border-orange-500/50 transition-colors placeholder-neutral-600"
                        value={question.text}
                        onChange={e => updateQuestion(section.id, question.id, 'text', e.target.value)}
                        placeholder="Enter question text..."
                      />
                      <button onClick={() => removeQuestion(section.id, question.id)} className="p-1 hover:bg-red-500/10 rounded text-neutral-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="flex items-center gap-3 ml-7">
                      <select
                        className="bg-[#111111] border border-[#2A2A2A] rounded text-xs text-neutral-400 px-2 py-1 focus:outline-none focus:border-orange-500/30"
                        value={question.type}
                        onChange={e => updateQuestion(section.id, question.id, 'type', e.target.value)}
                      >
                        {QUESTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                      <select
                        className="bg-[#111111] border border-[#2A2A2A] rounded text-xs text-neutral-400 px-2 py-1 focus:outline-none focus:border-orange-500/30"
                        value={question.weight || 3}
                        onChange={e => updateQuestion(section.id, question.id, 'weight', parseInt(e.target.value))}
                      >
                        {[1,2,3,4,5].map(w => <option key={w} value={w}>Weight: {w}</option>)}
                      </select>
                      <label className="flex items-center gap-1.5 text-xs text-neutral-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={question.required}
                          onChange={e => updateQuestion(section.id, question.id, 'required', e.target.checked)}
                          className="rounded border-[#2A2A2A] bg-[#111111] accent-orange-500"
                        />
                        Required
                      </label>
                    </div>
                    {question.hint !== undefined && (
                      <div className="ml-7">
                        <input
                          className="w-full bg-transparent text-xs text-neutral-600 placeholder-neutral-700 focus:outline-none"
                          value={question.hint || ''}
                          onChange={e => updateQuestion(section.id, question.id, 'hint', e.target.value)}
                          placeholder="Add a hint for the auditor (optional)"
                        />
                      </div>
                    )}
                  </div>
                ))}

                <button onClick={() => addQuestion(section.id)} className="w-full py-2 border border-dashed border-[#2A2A2A] rounded-lg text-xs text-neutral-600 hover:text-neutral-400 hover:border-neutral-600 transition-colors flex items-center justify-center gap-1.5">
                  <Plus className="w-3 h-3" /> Add question
                </button>
              </div>
            )}
          </div>
        ))}

        <button onClick={addSection} className="w-full py-3 border border-dashed border-[#2A2A2A] rounded-xl text-sm text-neutral-600 hover:text-neutral-400 hover:border-neutral-600 transition-colors flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" /> Add section
        </button>
      </div>
    </div>
  )
}

export default function TemplateEditorPage({ params }: { params: { id?: string } }) {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 text-orange-400 animate-spin" /></div>}>
      <TemplateEditor params={params} />
    </Suspense>
  )
}
