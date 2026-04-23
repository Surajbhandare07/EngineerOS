'use client'

import { useState, useEffect, useRef } from 'react'
import { useLanguage } from '@/context/LanguageContext'
import {
  askVivaQuestion,
  askVivaQuestionWithContext,
  extractTextForViva
} from '@/lib/actions/ai'
import { saveVivaSession, getVivaSessions } from '@/lib/actions/viva'
import { ChatMessage } from '@/types'
import Spinner from '@/components/ui/Spinner'
import imageCompression from 'browser-image-compression'
import { History, Play, FileText, Clock, ChevronRight } from 'lucide-react'

/* ── Modes ── */
type SetupMode = 'topic' | 'document' | 'history'

export default function VivaAIPage() {
  const { language } = useLanguage()

  // Setup state
  const [mode, setMode] = useState<SetupMode>('topic')
  const [topic, setTopic] = useState('')
  const [docFile, setDocFile] = useState<File | null>(null)
  const [docPreview, setDocPreview] = useState<string | null>(null)
  const [extractedContext, setExtractedContext] = useState<string | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState<string | null>(null)

  // Session history state
  const [sessions, setSessions] = useState<any[]>([])
  const [loadingSessions, setLoadingSessions] = useState(false)

  // Session state
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [started, setStarted] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isMuted, setIsMuted] = useState(false)

  const recognitionRef = useRef<any>(null)
  const chatBottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  /* ── Fetch History ── */
  useEffect(() => {
    if (mode === 'history') {
      fetchHistory()
    }
  }, [mode])

  const fetchHistory = async () => {
    setLoadingSessions(true)
    const res = await getVivaSessions()
    if (res.success) {
      setSessions(res.data || [])
    }
    setLoadingSessions(false)
  }

  /* ── Speech Recognition init ── */
  useEffect(() => {
    if (typeof window === 'undefined') return
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return

    recognitionRef.current = new SR()
    recognitionRef.current.continuous = false
    recognitionRef.current.interimResults = false

    recognitionRef.current.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript
      setInput(prev => prev ? prev + ' ' + transcript : transcript)
      setIsListening(false)
    }
    recognitionRef.current.onerror = () => setIsListening(false)
    recognitionRef.current.onend  = () => setIsListening(false)
  }, [])

  /* ── Auto-scroll on new messages ── */
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  /* ── TTS ── */
  const speakText = (text: string) => {
    if (isMuted || typeof window === 'undefined' || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const clean = text.replace(/\*\*/g, '').replace(/\*/g, '')
    const utt   = new SpeechSynthesisUtterance(clean)
    const voices = window.speechSynthesis.getVoices()
    const indian = voices.find(v => v.lang.includes('en-IN') || v.lang.includes('hi-IN'))
    if (indian) utt.voice = indian
    utt.pitch = 0.8
    window.speechSynthesis.speak(utt)
  }

  /* ── Microphone toggle ── */
  const toggleListen = () => {
    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
    } else {
      recognitionRef.current?.start()
      setIsListening(true)
    }
  }

  /* ── File selection & extraction ── */
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    setExtractError(null)
    setExtractedContext(null)

    // Compress images client-side before upload
    if (file.type.startsWith('image/')) {
      try {
        file = await imageCompression(file, { maxSizeMB: 2, maxWidthOrHeight: 1600, useWebWorker: true })
      } catch { /* keep original */ }
      setDocPreview(URL.createObjectURL(file))
    } else {
      setDocPreview(null) // PDF — no image preview
    }

    setDocFile(file)
    setExtracting(true)

    const formData = new FormData()
    formData.append('file', file)
    const res = await extractTextForViva(formData)

    if (res.success && res.extractedText) {
      setExtractedContext(res.extractedText)
    } else {
      setExtractError(res.error ?? 'Failed to read file.')
      setDocFile(null)
      setDocPreview(null)
    }

    setExtracting(false)
  }

  /* ── Start session ── */
  const handleStart = async () => {
    const sessionTopic = mode === 'document'
      ? (topic || docFile?.name?.replace(/\.[^/.]+$/, '') || 'Uploaded Document')
      : topic

    if (!sessionTopic) return
    setStarted(true)
    setLoading(true)

    const greetingText = `Welcome to your Viva on "${sessionTopic}". Please wait while I prepare your first question…`
    setMessages([{ role: 'model', content: greetingText }])
    speakText(greetingText)

    let res
    if (extractedContext) {
      res = await askVivaQuestionWithContext(sessionTopic, language, [], extractedContext)
    } else {
      res = await askVivaQuestion(sessionTopic, language, [])
    }

    if (res.success && res.data) {
      setMessages([{ role: 'model', content: res.data }])
      speakText(res.data)
    } else {
      setMessages([{ role: 'model', content: `⚠️ Error: ${res.error || 'Failed to connect to AI.'}` }])
    }
    setLoading(false)
  }

  /* ── Send answer ── */
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    window.speechSynthesis?.cancel()

    const userMessage: ChatMessage = { role: 'user', content: input }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    const sessionTopic = mode === 'document'
      ? (topic || docFile?.name?.replace(/\.[^/.]+$/, '') || 'Uploaded Document')
      : topic

    let res
    if (extractedContext) {
      res = await askVivaQuestionWithContext(sessionTopic, language, newMessages, extractedContext)
    } else {
      res = await askVivaQuestion(sessionTopic, language, newMessages)
    }

    if (res.success && res.data) {
      setMessages([...newMessages, { role: 'model', content: res.data }])
      speakText(res.data)
    } else {
      setMessages([...newMessages, { role: 'model', content: `⚠️ Error: ${res.error || 'Failed.'}` }])
    }
    setLoading(false)
  }

  /* ── End session ── */
  const handleEndSession = async () => {
    window.speechSynthesis?.cancel()
    const sessionTopic = mode === 'document'
      ? (topic || docFile?.name?.replace(/\.[^/.]+$/, '') || 'Uploaded Document')
      : topic
    if (messages.length > 0) await saveVivaSession(sessionTopic, language, messages)
    setStarted(false)
    setTopic('')
    setMessages([])
    setDocFile(null)
    setDocPreview(null)
    setExtractedContext(null)
    setMode('topic')
  }

  /* ═══════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════ */
  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-purple-400">🎓 VivaAI Simulator</h1>
        {!started && (
          <button 
            onClick={() => setMode(mode === 'history' ? 'topic' : 'history')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all
              ${mode === 'history' 
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' 
                : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'}`}
          >
            {mode === 'history' ? <Play size={16} /> : <History size={16} />}
            {mode === 'history' ? 'Start Viva' : 'Viva History'}
          </button>
        )}
      </div>

      {!started ? (

        /* ── SETUP SCREEN ── */
        <div className="flex-1 overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl border border-gray-200 dark:border-gray-800 max-w-2xl mx-auto w-full mt-6 shadow-xl">
            {mode !== 'history' ? (
              <>
                <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">Start a New Viva Session</h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
                  Choose how to set up your exam context. The AI Professor will respond in <span className="text-purple-600 dark:text-purple-400 font-medium">{language}</span>.
                </p>

                {/* Mode Tabs */}
                <div className="flex gap-2 mb-8 bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl">
                  <button
                    onClick={() => setMode('topic')}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${mode === 'topic' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                  >
                    ✏️ Enter Topic
                  </button>
                  <button
                    onClick={() => setMode('document')}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${mode === 'document' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                  >
                    📄 Upload Material
                  </button>
                </div>

                {mode === 'topic' ? (
                  /* ── Topic mode ── */
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Examination Topic</label>
                      <input
                        type="text"
                        placeholder="e.g., Data Structures, Operating Systems, Thermodynamics"
                        className="w-full p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600 focus:outline-none transition-all"
                        value={topic}
                        onChange={e => setTopic(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && topic && handleStart()}
                      />
                    </div>
                    <button
                      onClick={handleStart}
                      disabled={!topic || loading}
                      className="w-full py-4 bg-purple-600 hover:bg-purple-700 rounded-2xl text-white font-bold transition-all disabled:opacity-50 shadow-lg shadow-purple-600/20 active:scale-[0.98]"
                    >
                      {loading ? <Spinner /> : '🚀 Start Viva'}
                    </button>
                  </div>
                ) : (
                  /* ── Document mode ── */
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Custom Title (Optional)</label>
                      <input
                        type="text"
                        placeholder="defaults to filename"
                        className="w-full p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600 focus:outline-none transition-all"
                        value={topic}
                        onChange={e => setTopic(e.target.value)}
                      />
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,application/pdf"
                      className="hidden"
                      onChange={handleFileSelect}
                    />

                    <div
                      onClick={() => !extracting && fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center gap-4 transition-all cursor-pointer group
                        ${extracting ? 'border-purple-500 bg-purple-600/5 cursor-wait' :
                          extractedContext ? 'border-green-500 bg-green-500/5' :
                          extractError ? 'border-red-500 bg-red-500/5' :
                          'border-gray-200 dark:border-gray-700 hover:border-purple-500 hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}
                    >
                      {extracting ? (
                        <>
                          <Spinner />
                          <p className="text-purple-600 dark:text-purple-400 font-bold animate-pulse">Analyzing Document…</p>
                        </>
                      ) : extractedContext ? (
                        <>
                          {docPreview
                            ? <img src={docPreview} alt="doc preview" className="max-h-32 rounded-xl object-contain border border-gray-200 dark:border-gray-700 shadow-sm" />
                            : <FileText size={48} className="text-purple-500" />
                          }
                          <div className="text-center">
                            <p className="text-green-600 dark:text-green-400 font-bold">{docFile?.name}</p>
                            <p className="text-gray-500 text-xs mt-1">Ready for examination</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-2xl text-purple-600 group-hover:scale-110 transition-transform">
                            <FileText size={32} />
                          </div>
                          <div className="text-center">
                            <p className="font-bold text-gray-900 dark:text-white">Upload Syllabus or Notes</p>
                            <p className="text-gray-500 text-xs mt-1">PDF, PNG, JPG • max 20MB</p>
                          </div>
                        </>
                      )}
                    </div>

                    <button
                      onClick={handleStart}
                      disabled={!extractedContext || loading}
                      className="w-full py-4 bg-purple-600 hover:bg-purple-700 rounded-2xl text-white font-bold transition-all disabled:opacity-50 shadow-lg shadow-purple-600/20 active:scale-[0.98]"
                    >
                      {loading ? <Spinner /> : '🚀 Start Document Viva'}
                    </button>
                  </div>
                )}
              </>
            ) : (
              /* ── HISTORY VIEW ── */
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-purple-600">
                    <History size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Viva Records</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Review your past performance and questions.</p>
                  </div>
                </div>

                {loadingSessions ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <Spinner />
                    <p className="text-sm text-gray-500">Loading your history...</p>
                  </div>
                ) : sessions.length === 0 ? (
                  <div className="text-center py-20 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-2xl">
                    <p className="text-gray-500 italic">No Viva sessions recorded yet.</p>
                    <button 
                      onClick={() => setMode('topic')}
                      className="mt-4 text-purple-600 font-bold hover:underline"
                    >
                      Take your first Viva now
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sessions.map((s) => (
                      <div 
                        key={s.id}
                        className="group flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-2xl hover:border-purple-400 dark:hover:border-purple-500 transition-all cursor-default"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-white dark:bg-gray-800 rounded-xl flex items-center justify-center text-xl shadow-sm">
                            🎓
                          </div>
                          <div>
                            <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-purple-600 transition-colors">{s.topic}</h3>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider text-gray-400">
                                <Clock size={12} />
                                {new Date(s.created_at).toLocaleDateString()}
                              </span>
                              <span className="text-[10px] bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full font-bold">
                                {s.language}
                              </span>
                            </div>
                          </div>
                        </div>
                        <button className="p-2 text-gray-400 hover:text-purple-600 transition-colors">
                          <ChevronRight size={20} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      ) : (

        /* ── CHAT SESSION ── */
        <div className="flex-1 flex flex-col bg-white dark:bg-gray-950 rounded-3xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-2xl min-h-0">

          {/* Header */}
          <div className="p-5 border-b border-gray-100 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50 backdrop-blur-md flex justify-between items-center shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center text-xl">
                {extractedContext ? '📄' : '📚'}
              </div>
              <div>
                <span className="text-gray-900 dark:text-white font-bold block leading-none">
                  {mode === 'document'
                    ? (topic || docFile?.name?.replace(/\.[^/.]+$/, '') || 'Document Viva')
                    : topic
                  }
                </span>
                {extractedContext && (
                  <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold uppercase tracking-widest mt-1 block">
                    Document-Based Context
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setIsMuted(!isMuted); if (!isMuted) window.speechSynthesis?.cancel() }}
                className={`p-2.5 rounded-xl transition-all ${isMuted ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' : 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'}`}
              >
                {isMuted ? '🔇' : '🔊'}
              </button>
              <button 
                onClick={handleEndSession} 
                className="px-4 py-2 text-sm font-bold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 transition-all rounded-xl border border-transparent hover:border-red-200 dark:hover:border-red-900"
              >
                End Exam
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 min-h-0 bg-gray-50/30 dark:bg-gray-900/10">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                {msg.role === 'model' && (
                  <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center text-lg shrink-0 mr-4 shadow-lg shadow-purple-600/20">👨‍🏫</div>
                )}
                <div className={`max-w-[80%] p-5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-purple-600 text-white rounded-tr-none'
                    : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-100 dark:border-gray-700 rounded-tl-none'
                }`}>
                  {msg.role === 'model' && (
                    <div className="text-[10px] text-purple-600 dark:text-purple-400 mb-2 font-black tracking-widest uppercase">EXAMINER</div>
                  )}
                  <div className="whitespace-pre-wrap font-medium">{msg.content}</div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center text-lg shrink-0 mr-4 shadow-lg shadow-purple-600/20">👨‍🏫</div>
                <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-5 rounded-2xl rounded-tl-none flex items-center gap-3 shadow-sm">
                  <Spinner />
                  <span className="text-gray-400 text-sm font-medium animate-pulse italic">Thinking...</span>
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Input area */}
          <div className="p-6 bg-white dark:bg-gray-950 border-t border-gray-100 dark:border-gray-800 shrink-0">
            <form onSubmit={handleSend} className="flex gap-3 max-w-4xl mx-auto">
              <div className="relative flex-1 group">
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Type your answer here..."
                  className="w-full p-4 pr-14 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-gray-900 dark:text-white placeholder-gray-500 text-sm focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600 focus:outline-none transition-all group-hover:border-purple-400"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={toggleListen}
                  className={`absolute right-2 top-2 p-2 rounded-xl flex items-center justify-center transition-all ${
                    isListening
                      ? 'bg-red-500 text-white animate-pulse shadow-lg'
                      : 'text-gray-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="22"/>
                  </svg>
                </button>
              </div>
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="px-8 bg-purple-600 hover:bg-purple-700 rounded-2xl text-white font-bold transition-all disabled:opacity-50 shadow-lg shadow-purple-600/20 active:scale-[0.95]"
              >
                Send
              </button>
            </form>
            {isListening && (
              <p className="text-[10px] text-red-500 mt-3 font-bold text-center uppercase tracking-widest animate-pulse">🎙️ Speak now</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
