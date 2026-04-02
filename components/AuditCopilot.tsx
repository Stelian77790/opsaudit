'use client'

import { useState, useRef, useEffect } from 'react'
import { Sparkles, X, Send, Loader2, Mic, MicOff, ChevronDown } from 'lucide-react'

interface CopilotMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface AuditCopilotProps {
  auditContext: {
    templateTitle: string
    locationName: string
    industry?: string
    currentSection?: string
    findingsLogged: number
  }
}

const SUGGESTED_QUESTIONS = [
  'What should I check in chemical storage areas?',
  'Is this level of wear on equipment acceptable?',
  'What are the legal requirements for fire exit spacing?',
  'How should I assess manual handling risks?',
  'What documentation should I request from contractors?',
]

export default function AuditCopilot({ auditContext }: AuditCopilotProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<CopilotMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<unknown>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const SR = (window as unknown as Record<string, unknown>).SpeechRecognition ||
               (window as unknown as Record<string, unknown>).webkitSpeechRecognition
    if (!SR) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition = new (SR as any)()
    recognition.continuous = false
    recognition.interimResults = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript
      setInput(transcript)
      setIsListening(false)
    }
    recognition.onerror = () => setIsListening(false)
    recognition.onend = () => setIsListening(false)
    recognitionRef.current = recognition
  }, [])

  function toggleVoice() {
    if (!recognitionRef.current) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = recognitionRef.current as any
    if (isListening) {
      rec.stop()
      setIsListening(false)
    } else {
      rec.start()
      setIsListening(true)
    }
  }

  async function sendMessage(text?: string) {
    const question = text || input.trim()
    if (!question) return

    const userMsg: CopilotMessage = { role: 'user', content: question, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/audit-copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          context: auditContext,
          history: messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json()
      const assistantMsg: CopilotMessage = {
        role: 'assistant',
        content: data.answer || 'Unable to answer. Please try rephrasing.',
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, assistantMsg])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Connection error. Please try again.',
        timestamp: new Date(),
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-24 right-6 z-40 w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all ${
          isOpen
            ? 'bg-[#1A1A1A] border border-orange-500/30 text-orange-400'
            : 'bg-orange-500 text-white shadow-orange-500/30'
        }`}
      >
        {isOpen ? <ChevronDown className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-40 right-6 z-40 w-80 bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl shadow-2xl shadow-black/50 flex flex-col overflow-hidden animate-slide-up"
          style={{ maxHeight: '420px' }}>

          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-[#1F1F1F] bg-[#111111]">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-xs font-medium text-white">AI Audit Copilot</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-neutral-600">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
              {auditContext.currentSection || auditContext.templateTitle}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3" style={{ minHeight: '200px', maxHeight: '280px' }}>
            {messages.length === 0 && (
              <div className="space-y-2">
                <p className="text-xs text-neutral-600 text-center">Ask anything about this audit</p>
                {SUGGESTED_QUESTIONS.slice(0, 3).map(q => (
                  <button key={q} onClick={() => sendMessage(q)}
                    className="w-full text-left text-xs text-neutral-500 hover:text-orange-400 bg-[#1A1A1A] hover:border-orange-500/20 border border-[#2A2A2A] px-2.5 py-2 rounded-lg transition-all">
                    {q}
                  </button>
                ))}
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-orange-500 text-white rounded-br-sm'
                    : 'bg-[#1A1A1A] border border-[#2A2A2A] text-neutral-300 rounded-bl-sm'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-[#1A1A1A] border border-[#2A2A2A] px-3 py-2 rounded-xl rounded-bl-sm">
                  <Loader2 className="w-3.5 h-3.5 text-orange-400 animate-spin" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-2 border-t border-[#1F1F1F] flex items-center gap-1.5">
            <button onClick={toggleVoice}
              className={`p-1.5 rounded-lg transition-colors ${isListening ? 'text-red-400 bg-red-400/10' : 'text-neutral-600 hover:text-neutral-400'}`}>
              {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            </button>
            <input
              className="flex-1 bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-orange-500/30"
              placeholder={isListening ? 'Listening...' : 'Ask a question...'}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              disabled={loading}
            />
            <button onClick={() => sendMessage()} disabled={!input.trim() || loading}
              className="p-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 rounded-lg transition-colors">
              <Send className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
