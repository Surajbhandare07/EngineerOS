'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useLanguage } from '@/context/LanguageContext'
import {
  askVivaQuestion,
  askVivaQuestionWithContext,
  extractTextForViva,
  generateSpeech
} from '@/lib/actions/ai'
import { saveVivaSession, getVivaSessions } from '@/lib/actions/viva'
import { ChatMessage } from '@/types'
import Spinner from '@/components/ui/Spinner'
import imageCompression from 'browser-image-compression'
import { 
  History as HistoryIcon, 
  Play, 
  FileText, 
  Clock, 
  ChevronRight, 
  Plus, 
  Search,
  Volume2,
  VolumeX,
  MessageSquare,
  GraduationCap,
  X,
  Mic,
  Send,
  Zap,
  Paperclip
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

/* ── Modes ── */
type SetupMode = 'topic' | 'document'

export default function VivaAIPage() {
  const { language } = useLanguage()

  // Layout & Navigation State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [mode, setMode] = useState<SetupMode>('topic')
  
  // Setup state
  const [topic, setTopic] = useState('')
  const [docFile, setDocFile] = useState<File | null>(null)
  const [docPreview, setDocPreview] = useState<string | null>(null)
  const [extractedContext, setExtractedContext] = useState<string | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState<string | null>(null)

  // Session history state
  const [sessions, setSessions] = useState<any[]>([])
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [historySearch, setHistorySearch] = useState('')

  // Session state
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [started, setStarted] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [audioLoading, setAudioLoading] = useState(false)

  const recognitionRef = useRef<any>(null)
  const chatBottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  /* ── Fetch History ── */
  useEffect(() => {
    fetchHistory()
  }, [])

  const fetchHistory = async () => {
    setLoadingSessions(true)
    const res: any = await getVivaSessions()
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

  /* ── High-Fidelity Groq TTS ── */
  /* ── TTS with Browser Fallback ── */
  const speakText = async (text: string) => {
    if (isMuted) return
    
    // Stop any current audio or speech
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }

    setAudioLoading(true)
    try {
      // 1. Try High-Fidelity Groq TTS
      const res: any = await generateSpeech(text)
      if (res.success && res.audio) {
        const audio = new Audio(res.audio)
        audioRef.current = audio
        await audio.play()
      } else {
        throw new Error(res.error || "Groq TTS failed")
      }
    } catch (err: any) {
      console.warn("Groq TTS failed, falling back to browser speech:", err)
      // 2. Fallback to Browser Native TTS
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        const clean = text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#/g, '')
        const utt = new SpeechSynthesisUtterance(clean)
        const voices = window.speechSynthesis.getVoices()
        const indian = voices.find(v => v.lang.includes('en-IN') || v.lang.includes('hi-IN'))
        if (indian) utt.voice = indian
        utt.pitch = 1.0
        utt.rate = 0.95
        window.speechSynthesis.speak(utt)
      }
    } finally {
      setAudioLoading(false)
    }
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

    let clientExtractedText = ''
    let renderedImageBlob: Blob | null = null

    if (file.type === 'application/pdf') {
      try {
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
        
        const arrayBuffer = await file.arrayBuffer()
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise
        
        let fullText = ''
        const numPagesToExtract = Math.min(5, pdf.numPages)
        for (let i = 1; i <= numPagesToExtract; i++) {
          const page = await pdf.getPage(i)
          const textContent = await page.getTextContent()
          const pageText = textContent.items.map((it: any) => it.str).join(' ')
          fullText += pageText + ' '
        }

        if (fullText.trim().length > 200) {
          clientExtractedText = fullText.trim()
        } else {
          const page = await pdf.getPage(1)
          const viewport = page.getViewport({ scale: 2.0 })
          const canvas = document.createElement('canvas')
          const context = canvas.getContext('2d')
          canvas.height = viewport.height
          canvas.width = viewport.width

          if (context) {
            await page.render({ canvasContext: context, viewport }).promise
            const dataUrl = canvas.toDataURL('image/png')
            const res = await fetch(dataUrl)
            renderedImageBlob = await res.blob()
          }
        }
      } catch (pdfErr) {
        console.error("PDF processing failed:", pdfErr)
      }
    } else if (file.type.startsWith('image/')) {
      try {
        file = await imageCompression(file, { maxSizeMB: 2, maxWidthOrHeight: 1600, useWebWorker: true })
      } catch { /* keep original */ }
      setDocPreview(URL.createObjectURL(file))
    }

    setDocFile(file)
    setExtracting(true)

    const formData = new FormData()
    formData.append('file', file)
    if (clientExtractedText) formData.append('extractedText', clientExtractedText)
    if (renderedImageBlob) formData.append('renderedImage', renderedImageBlob, 'page1.png')

    const res: any = await extractTextForViva(formData)

    if (res.success && res.extractedText) {
      if (started) {
        setExtractedContext(prev => (prev || '') + "\n\n--- ADDITIONAL CONTEXT ---\n\n" + res.extractedText)
        setMessages(prev => [...prev, { role: 'user', content: `[SYSTEM: Uploaded additional material: ${file?.name}]` }])
      } else {
        setExtractedContext(res.extractedText)
      }
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

    let res: any
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
    
    if (audioRef.current) audioRef.current.pause()

    const userMessage: ChatMessage = { role: 'user', content: input }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    const sessionTopic = mode === 'document'
      ? (topic || docFile?.name?.replace(/\.[^/.]+$/, '') || 'Uploaded Document')
      : topic

    let res: any
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
    if (audioRef.current) audioRef.current.pause()
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
    fetchHistory()
  }

  const loadPastSession = (s: any) => {
    setStarted(true)
    setTopic(s.topic)
    setMessages(s.messages || [])
    // Note: Past sessions are read-only for now or could be resumed
  }

  const filteredSessions = sessions.filter(s => 
    s.topic.toLowerCase().includes(historySearch.toLowerCase())
  )

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-background">
      {/* ── Sidebar History ── */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 320 : 0, opacity: isSidebarOpen ? 1 : 0 }}
        className="relative bg-card/50 backdrop-blur-xl border-r border-border overflow-hidden flex flex-col z-40 shadow-2xl shadow-black/10"
      >
        <div className="p-8 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-600/10 rounded-lg">
              <HistoryIcon className="text-purple-600 w-5 h-5" />
            </div>
            <h2 className="font-black text-[10px] uppercase tracking-[0.2em] text-foreground/70">Session History</h2>
          </div>
          <button 
            onClick={() => { setStarted(false); setMessages([]); setTopic(''); }} 
            className="p-2.5 hover:bg-muted rounded-xl transition-all border border-transparent hover:border-border"
          >
            <Plus className="w-4 h-4 text-purple-600" />
          </button>
        </div>

        <div className="p-6 border-b border-border shrink-0">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-purple-600 transition-colors" />
            <input 
              type="text" 
              placeholder="Search past vivas..."
              value={historySearch}
              onChange={e => setHistorySearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-muted/40 border border-border rounded-2xl text-xs font-medium focus:ring-4 focus:ring-purple-600/10 focus:border-purple-600 focus:outline-none transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loadingSessions ? (
            Array(6).fill(0).map((_, i) => (
              <div key={i} className="h-24 bg-muted/30 rounded-3xl animate-pulse" />
            ))
          ) : filteredSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-30 gap-4">
              <MessageSquare className="w-10 h-10" />
              <p className="italic text-xs font-medium">No records found.</p>
            </div>
          ) : (
            filteredSessions.map((s) => (
              <button 
                key={s.id}
                onClick={() => loadPastSession(s)}
                className="w-full text-left p-5 bg-card hover:bg-muted/50 border border-border rounded-[2rem] transition-all group relative overflow-hidden"
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="font-bold text-sm text-foreground truncate block flex-1 pr-2 tracking-tight group-hover:text-purple-600 transition-colors">{s.topic}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-purple-600 group-hover:translate-x-1 transition-all shrink-0 mt-0.5" />
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                    <Clock className="w-3.5 h-3.5" />
                    {new Date(s.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </div>
                  <span className="text-[9px] px-2 py-0.5 bg-purple-600/10 text-purple-600 rounded-lg uppercase font-black border border-purple-600/20">{s.language}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </motion.aside>

      {/* ── Main Content Area ── */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-background/30">
        
        {/* Toggle Sidebar Button */}
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute left-6 top-6 z-50 p-3 bg-card border border-border rounded-2xl shadow-xl hover:bg-muted transition-all active:scale-95 group"
        >
          {isSidebarOpen ? <X className="w-5 h-5" /> : <HistoryIcon className="w-5 h-5 text-purple-600 group-hover:scale-110 transition-transform" />}
        </button>

        <AnimatePresence mode="wait">
          {!started ? (
            <motion.div 
              key="setup"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              className="flex-1 overflow-y-auto p-12 flex items-center justify-center"
            >
              <div className="max-w-2xl w-full space-y-10 bg-card/80 backdrop-blur-2xl border border-border rounded-[4rem] p-12 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] relative overflow-hidden">
                {/* Decorative Background Element */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/5 blur-[100px] -mr-32 -mt-32 rounded-full" />
                
                <div className="text-center space-y-6 relative z-10">
                  <motion.div 
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="inline-flex items-center justify-center w-24 h-24 bg-purple-600 rounded-[2.5rem] text-white shadow-2xl shadow-purple-600/30 mb-2"
                  >
                    <GraduationCap size={48} />
                  </motion.div>
                  <h1 className="text-5xl font-black text-foreground tracking-[-0.05em] uppercase italic leading-none">
                    Engineer <span className="text-purple-600">Viva-AI</span>
                  </h1>
                  <p className="text-muted-foreground text-base font-medium max-w-md mx-auto leading-relaxed">
                    Battle-test your knowledge with the world's most rigorous AI Engineering Professor.
                  </p>
                </div>

                <div className="flex gap-3 p-2 bg-muted/50 rounded-[2.5rem] border border-border relative z-10">
                  <button
                    onClick={() => setMode('topic')}
                    className={`flex-1 py-5 rounded-[2rem] text-xs font-black uppercase tracking-[0.2em] transition-all ${mode === 'topic' ? 'bg-purple-600 text-white shadow-xl shadow-purple-600/20' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                  >
                    ✏️ Topic Trial
                  </button>
                  <button
                    onClick={() => setMode('document')}
                    className={`flex-1 py-5 rounded-[2rem] text-xs font-black uppercase tracking-[0.2em] transition-all ${mode === 'document' ? 'bg-purple-600 text-white shadow-xl shadow-purple-600/20' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                  >
                    📄 Context Exam
                  </button>
                </div>

                <motion.div 
                  layout
                  className="space-y-6 relative z-10"
                >
                  {mode === 'topic' ? (
                    <div className="space-y-4">
                      <div className="relative group">
                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] mb-3 block ml-4">Examination Objective</label>
                        <input
                          type="text"
                          placeholder="What shall we examine today?"
                          className="w-full p-6 bg-muted/30 border-2 border-border rounded-[2rem] text-foreground font-bold text-lg focus:ring-8 focus:ring-purple-600/5 focus:border-purple-600 focus:outline-none transition-all placeholder:text-muted-foreground/40"
                          value={topic}
                          onChange={e => setTopic(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && topic && handleStart()}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="relative group">
                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] mb-3 block ml-4">Session Reference</label>
                        <input
                          type="text"
                          placeholder="Name your examination context"
                          className="w-full p-5 bg-muted/30 border-2 border-border rounded-[1.5rem] text-foreground font-bold focus:ring-8 focus:ring-purple-600/5 focus:border-purple-600 focus:outline-none transition-all"
                          value={topic}
                          onChange={e => setTopic(e.target.value)}
                        />
                      </div>
                      <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/jpg,application/pdf" className="hidden" onChange={handleFileSelect} />
                      <div
                        onClick={() => !extracting && fileInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-[3rem] p-12 flex flex-col items-center justify-center gap-5 transition-all cursor-pointer group
                          ${extracting ? 'border-purple-500 bg-purple-500/5 cursor-wait' :
                            extractedContext ? 'border-emerald-500 bg-emerald-500/5' :
                            'border-border hover:border-purple-500 hover:bg-muted/50'}`}
                      >
                        {extracting ? (
                          <div className="flex flex-col items-center gap-4">
                            <Spinner />
                            <p className="text-purple-600 text-[10px] font-black uppercase tracking-[0.3em] animate-pulse">Scanning Neural Paths...</p>
                          </div>
                        ) : extractedContext ? (
                          <div className="text-center space-y-4">
                            {docPreview ? <img src={docPreview} alt="doc preview" className="max-h-28 rounded-2xl shadow-xl border-2 border-emerald-500/20" /> : <Zap size={40} className="text-emerald-500 mx-auto" />}
                            <div className="px-4 py-2 bg-emerald-500/10 rounded-xl inline-block border border-emerald-500/20">
                              <p className="text-emerald-600 font-black text-[10px] uppercase tracking-widest">{docFile?.name}</p>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center space-y-4">
                            <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto group-hover:bg-purple-600 group-hover:text-white transition-all duration-500">
                              <FileText size={32} className="opacity-50 group-hover:opacity-100" />
                            </div>
                            <div className="space-y-1">
                              <p className="font-black text-foreground uppercase tracking-tight">Ingest Material</p>
                              <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.2em] opacity-60">PDF / IMAGE • MAX 20MB</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleStart}
                    disabled={(mode === 'topic' ? !topic : !extractedContext) || loading}
                    className="w-full py-6 bg-purple-600 hover:bg-purple-700 rounded-[2.5rem] text-white font-black uppercase tracking-[0.3em] text-sm transition-all disabled:opacity-30 shadow-2xl shadow-purple-600/40 active:scale-95 flex items-center justify-center gap-4 group"
                  >
                    {loading ? <Spinner /> : <><Play size={20} className="group-hover:translate-x-1 transition-transform" /> Initiate Professor Session</>}
                  </button>
                </motion.div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="chat"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col min-h-0"
            >
              {/* Exam Header */}
              <header className="p-8 border-b border-border bg-card/80 backdrop-blur-2xl flex items-center justify-between shrink-0 pl-24 pr-10 z-30">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 bg-purple-600 rounded-[1.25rem] flex items-center justify-center text-white shadow-2xl shadow-purple-600/30">
                    {extractedContext ? <Zap size={28} /> : <GraduationCap size={28} />}
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-foreground tracking-tight uppercase italic leading-none truncate max-w-lg">{topic || 'Neural Examination'}</h2>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-red-500/10 rounded-full border border-red-500/20">
                        <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-red-500">Live Feedback</span>
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 bg-muted text-muted-foreground rounded-full border border-border">{language}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <button
                    onClick={() => { setIsMuted(!isMuted); if (!isMuted) audioRef.current?.pause() }}
                    className={`p-4 rounded-2xl transition-all shadow-xl flex items-center gap-3 border-2 ${isMuted ? 'bg-muted border-border text-muted-foreground' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'}`}
                  >
                    {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
                    <AnimatePresence>
                      {audioLoading && (
                        <motion.div 
                          initial={{ scale: 0 }} 
                          animate={{ scale: 1 }} 
                          exit={{ scale: 0 }}
                          className="w-2 h-2 bg-emerald-600 rounded-full animate-ping" 
                        />
                      )}
                    </AnimatePresence>
                  </button>
                  <button 
                    onClick={handleEndSession} 
                    className="px-8 py-4 bg-muted/50 hover:bg-red-500 hover:text-white text-foreground font-black text-xs uppercase tracking-[0.2em] rounded-2xl transition-all border border-border hover:border-red-600 shadow-lg active:scale-95"
                  >
                    End Exam
                  </button>
                </div>
              </header>

              {/* Chat Feed */}
              <div className="flex-1 overflow-y-auto p-12 space-y-12 bg-muted/10 min-h-0">
                {messages.map((msg, idx) => (
                  <motion.div 
                    key={idx}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`flex gap-6 max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-2xl relative ${msg.role === 'user' ? 'bg-foreground text-background' : 'bg-card border-2 border-border text-purple-600'}`}>
                        {msg.role === 'user' ? <MessageSquare size={24} /> : <Zap size={24} />}
                        {msg.role === 'model' && <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-purple-600 rounded-full border-2 border-card" />}
                      </div>
                      <div className={`p-8 rounded-[2.5rem] text-base leading-relaxed shadow-[0_8px_30px_rgb(0,0,0,0.04)] font-medium ${
                        msg.role === 'user'
                          ? 'bg-purple-600 text-white rounded-tr-none'
                          : 'bg-card border-2 border-border text-foreground rounded-tl-none'
                      }`}>
                        <div className={`text-[10px] font-black tracking-[0.3em] uppercase mb-4 opacity-60 ${msg.role === 'user' ? 'text-white' : 'text-purple-600'}`}>
                          {msg.role === 'user' ? 'Candidate Input' : 'Examiner Evaluation'}
                        </div>
                        <p className="whitespace-pre-wrap leading-relaxed tracking-tight">{msg.content}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                     <div className="flex gap-6 items-center">
                        <div className="w-14 h-14 rounded-2xl bg-card border-2 border-border flex items-center justify-center text-purple-600 shadow-xl animate-pulse">
                           <Zap size={24} />
                        </div>
                        <div className="flex gap-2">
                           <div className="w-2.5 h-2.5 bg-purple-600 rounded-full animate-bounce [animation-delay:-0.3s]" />
                           <div className="w-2.5 h-2.5 bg-purple-600 rounded-full animate-bounce [animation-delay:-0.15s]" />
                           <div className="w-2.5 h-2.5 bg-purple-600 rounded-full animate-bounce" />
                        </div>
                     </div>
                  </div>
                )}
                <div ref={chatBottomRef} className="h-10" />
              </div>

              {/* Interaction Bar */}
              <footer className="p-10 bg-card/80 backdrop-blur-2xl border-t border-border shrink-0 pl-24 pr-10 z-30">
                <form onSubmit={handleSend} className="max-w-5xl mx-auto flex gap-5">
                  <div className="flex-1 relative group">
                    <input 
                      type="text" 
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      placeholder={extracting ? "Processing knowledge transmission..." : "Articulate your technical response..."}
                      className="w-full pl-8 pr-32 py-6 bg-muted/40 border-2 border-border rounded-[2rem] text-foreground font-bold text-base focus:ring-8 focus:ring-purple-600/5 focus:border-purple-600 focus:outline-none transition-all shadow-inner"
                      disabled={loading || extracting}
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      <button 
                        type="button" 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={extracting}
                        className={`p-3 rounded-2xl transition-all ${extracting ? 'animate-pulse text-purple-600 bg-purple-600/10' : 'text-muted-foreground hover:bg-muted hover:text-purple-600'}`}
                        title="Upload additional material"
                      >
                        {extracting ? <Spinner /> : <Paperclip size={24} />}
                      </button>
                      <button 
                        type="button" 
                        onClick={toggleListen}
                        className={`p-3.5 rounded-2xl transition-all ${isListening ? 'bg-red-500 text-white shadow-2xl animate-pulse' : 'text-muted-foreground hover:bg-muted hover:text-purple-600'}`}
                      >
                        <Mic size={24} />
                      </button>
                    </div>
                  </div>
                  <button 
                    type="submit" 
                    disabled={!input.trim() || loading || extracting}
                    className="px-12 bg-purple-600 hover:bg-purple-700 text-white rounded-[2rem] font-black uppercase tracking-[0.3em] text-xs transition-all shadow-[0_16px_32px_-12px_rgba(147,51,234,0.5)] active:scale-95 flex items-center gap-3 group"
                  >
                    <Send size={18} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                    Transmit
                  </button>
                </form>
                {isListening && <p className="text-[10px] font-black uppercase tracking-[0.4em] text-red-500 text-center mt-6 animate-pulse">Capturing Candidate Frequency...</p>}
                {extracting && <p className="text-[10px] font-black uppercase tracking-[0.4em] text-purple-600 text-center mt-6 animate-pulse">Expanding Knowledge Base...</p>}
              </footer>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}
