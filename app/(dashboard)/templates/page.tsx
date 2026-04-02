'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, orderBy, deleteDoc, doc } from 'firebase/firestore'
import { Template } from '@/types'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Plus, FileText, Trash2, Copy, Clock, ChevronRight, Sparkles, Upload } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'

export default function TemplatesPage() {
  const { user } = useAuth()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    if (!user?.companyId) return
    try {
      const snap = await getDocs(query(
        collection(db, 'templates'),
        where('companyId', '==', user.companyId),
        orderBy('createdAt', 'desc')
      ))
      setTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Template))
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [user?.companyId])

  async function handleDelete(id: string) {
    if (!confirm('Delete this template? This cannot be undone.')) return
    await deleteDoc(doc(db, 'templates', id))
    setTemplates(prev => prev.filter(t => t.id !== id))
    toast.success('Template deleted')
  }

  const totalQuestions = (t: Template) => t.sections.reduce((s, sec) => s + sec.questions.length, 0)

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Templates</h1>
          <p className="text-neutral-500 text-sm mt-0.5">{templates.length} template{templates.length !== 1 ? 's' : ''} in your library</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/templates/new?mode=ai" className="btn-secondary flex items-center gap-2 text-sm">
            <Sparkles className="w-4 h-4 text-orange-400" /> AI Generate
          </Link>
          <Link href="/templates/new" className="btn-primary flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> New Template
          </Link>
        </div>
      </div>

      {/* AI Prompt Banner */}
      <div className="card border-orange-500/20 bg-orange-500/5 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">Generate a template with AI</p>
            <p className="text-xs text-neutral-500">Describe your audit in plain English and Claude will build it in seconds</p>
          </div>
        </div>
        <Link href="/templates/new?mode=ai" className="btn-primary text-sm flex items-center gap-1.5">
          Try it <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-40 bg-[#111111] rounded-xl border border-[#1F1F1F] animate-pulse" />)}
        </div>
      ) : templates.length === 0 ? (
        <div className="card p-12 text-center">
          <FileText className="w-12 h-12 text-neutral-700 mx-auto mb-3" />
          <h3 className="text-white font-medium mb-1">No templates yet</h3>
          <p className="text-neutral-600 text-sm mb-4">Create your first audit template manually or let AI build one</p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/templates/new" className="btn-secondary text-sm flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Manual
            </Link>
            <Link href="/templates/new?mode=ai" className="btn-primary text-sm flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" /> AI Generate
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {templates.map(template => (
            <div key={template.id} className="card-hover p-5 group relative">
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 bg-orange-500/10 border border-orange-500/20 rounded-lg flex items-center justify-center">
                  <FileText className="w-4 h-4 text-orange-400" />
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleDelete(template.id)} className="p-1.5 hover:bg-red-500/10 rounded-lg text-neutral-600 hover:text-red-400 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <h3 className="text-white font-medium text-sm mb-1 truncate">{template.title}</h3>
              <p className="text-neutral-600 text-xs mb-3 line-clamp-2">{template.description}</p>
              <div className="flex items-center gap-3 text-xs text-neutral-600 mb-4">
                <span className="flex items-center gap-1">
                  <FileText className="w-3 h-3" />{template.sections.length} sections
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />{totalQuestions(template)} questions
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="badge text-xs text-orange-400 bg-orange-400/10 border-orange-400/20">
                  {template.industry}
                </span>
                {template.sourceDoc && (
                  <span className="badge text-xs text-blue-400 bg-blue-400/10 border-blue-400/20">
                    <Upload className="w-2.5 h-2.5 mr-1" />SOP
                  </span>
                )}
              </div>
              <div className="mt-4 pt-3 border-t border-[#1F1F1F] flex items-center justify-between">
                <span className="text-xs text-neutral-700">{formatDateTime(template.createdAt)}</span>
                <Link href={`/templates/${template.id}/edit`} className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1 transition-colors">
                  Edit <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          ))}

          {/* Add New Card */}
          <Link href="/templates/new" className="card border-dashed border-[#2A2A2A] hover:border-orange-500/30 p-5 flex flex-col items-center justify-center gap-2 text-center transition-all group">
            <div className="w-10 h-10 bg-[#1A1A1A] group-hover:bg-orange-500/10 rounded-xl flex items-center justify-center transition-colors">
              <Plus className="w-5 h-5 text-neutral-600 group-hover:text-orange-400 transition-colors" />
            </div>
            <p className="text-sm text-neutral-600 group-hover:text-neutral-400 transition-colors">Add template</p>
          </Link>
        </div>
      )}
    </div>
  )
}
