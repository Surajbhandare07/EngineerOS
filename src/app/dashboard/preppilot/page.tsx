'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useLanguage } from '@/context/LanguageContext'
import { generateStudyPlan } from '@/lib/actions/ai'
import { saveStudyPlanAndTasks } from '@/lib/actions/tasks'
import { extractTextFromPDF, extractTextFromImage } from '@/lib/actions/documents'
import { 
  createPrepPilotSession, 
  getPrepPilotSessions, 
  savePrepPilotMessage, 
  getPrepPilotMessages,
  deletePrepPilotSession
} from '@/lib/actions/preppilot'
import { getUserProfile } from '@/lib/actions/profile'
import Spinner from '@/components/ui/Spinner'
import { StudyPlanContent, ChatMessage, PrepPilotSession } from '@/types'
import { Plus, MessageSquare, Trash2, Zap, History, Send, Calendar, Clock, AlertTriangle } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

function getRelativeTime(date: string) {
  const now = new Date()
  const then = new Date(date)
  const diff = now.getTime() - then.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 7) return then.toLocaleDateString()
  if (days > 1) return `${days} days ago`
  if (days === 1) return 'Yesterday'
  if (hours > 1) return `${hours} hours ago`
  if (hours === 1) return '1 hour ago'
  if (minutes > 1) return `${minutes} mins ago`
  return 'Just now'
}

export default function PrepPilotPage() {
  const { language } = useLanguage()
  const [syllabusText, setSyllabusText] = useState('')
  const [plan, setPlan] = useState<StudyPlanContent | null>(null)
  const [loading, setLoading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPanicMode, setIsPanicMode] = useState(false)
  const [examDate, setExamDate] = useState<string>('')
  
  const [sessions, setSessions] = useState<PrepPilotSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loadingMsg, setLoadingMsg] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, loadingMsg])

  const loadSessions = useCallback(async () => {
    const res = await getPrepPilotSessions()
    if (res.success && res.data) {
      setSessions(res.data)
    }
  }, [])

  useEffect(() => {
    loadSessions()
    getUserProfile().then(res => {
      if (res.success) setProfile(res.data)
    })
  }, [loadSessions])

  const handleNewChat = () => {
    setPlan(null)
    setCurrentSessionId(null)
    setMessages([])
    setSyllabusText('')
    setIsPanicMode(false)
    setExamDate('')
  }

  const loadSession = async (session: any) => {
    setCurrentSessionId(session.id)
    setIsPanicMode(session.is_panic_mode)
    setExamDate(session.exam_date || '')
    setLoadingMsg(true)
    const res = await getPrepPilotMessages(session.id)
    if (res.success && res.data) {
      setMessages(res.data.map((m: any) => ({ 
        role: m.role === 'assistant' ? 'model' : 'user', 
        content: m.content 
      })))
    }
    setLoadingMsg(false)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setExtracting(true)
    setError(null)
    const formData = new FormData()
    formData.append('file', file)

    let res;
    if (file.type === 'application/pdf') {
      res = await extractTextFromPDF(formData)
    } else if (file.type.startsWith('image/')) {
      res = await extractTextFromImage(formData)
    } else {
      setError("Unsupported file type. Please upload a PDF or an Image.")
      setExtracting(false)
      return
    }

    if (res.success && res.data) {
      setSyllabusText(res.data)
    } else if (res.error?.includes('SCANNED_PDF')) {
      // Automatic Vision Mode for Scanned PDFs
      setExtracting(true)
      setError("🚨 Scanned PDF detected! Enabling AI Vision Mode to read your document...")
      
      try {
        const text = await processScannedPdf(file)
        if (text) {
          setSyllabusText(text)
          setError(null)
        } else {
          setError("Vision Mode failed to read the document.")
        }
      } catch (err: any) {
        setError("Vision Mode Error: " + err.message)
      } finally {
        setExtracting(false)
      }
    } else {
      setError(res.error || "Failed to extract text from file.")
    }
    setExtracting(false)
  }

  const processScannedPdf = async (file: File): Promise<string> => {
    return new Promise(async (resolve, reject) => {
      try {
        // Load pdf.js from CDN
        const script = document.createElement('script')
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
        document.head.appendChild(script)

        script.onload = async () => {
          try {
            const pdfjsLib = (window as any)['pdfjs-dist/build/pdf']
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'

            const arrayBuffer = await file.arrayBuffer()
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
            
            let combinedText = ''
            const maxPages = Math.min(pdf.numPages, 5) // Process first 5 pages for speed/tokens
            
            for (let i = 1; i <= maxPages; i++) {
              const page = await pdf.getPage(i)
              const viewport = page.getViewport({ scale: 2.0 })
              const canvas = document.createElement('canvas')
              const context = canvas.getContext('2d')
              canvas.height = viewport.height
              canvas.width = viewport.width

              await page.render({ canvasContext: context!, viewport }).promise
              
              const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.8))
              if (blob) {
                const formData = new FormData()
                formData.append('file', blob, `page_${i}.jpg`)
                
                const res = await extractTextFromImage(formData)
                if (res.success && res.data) {
                  combinedText += `\n--- Page ${i} ---\n${res.data}\n`
                }
              }
            }
            resolve(combinedText)
          } catch (err) {
            reject(err)
          }
        }
      } catch (err) {
        reject(err)
      }
    })
  }

  const handleGenerate = async () => {
    if (!syllabusText.trim()) return
    setLoading(true)
    setError(null)
    
    const res = await generateStudyPlan(syllabusText, language)
    if (res.success && res.data) {
      setPlan(res.data)
      await saveStudyPlanAndTasks(res.data)
      
      const sessionTitle = syllabusText.slice(0, 30).trim() + (syllabusText.length > 30 ? '...' : '')
      const sessionRes = await createPrepPilotSession(sessionTitle, isPanicMode, examDate)
      
      if (sessionRes.success && sessionRes.data) {
        setCurrentSessionId(sessionRes.data.id)
        loadSessions()
        
        const initialMsg = `Study plan generated! ${isPanicMode ? "🚨 PANIC MODE is active. I'm ready to help you learn fast. What topic should we start with?" : "How can I help you with your study plan today?"}`
        setMessages([{ role: 'model', content: initialMsg }])
        await savePrepPilotMessage(sessionRes.data.id, 'assistant', initialMsg)
      }
    } else {
      setError(res.error || 'Failed to generate study plan')
    }
    setLoading(false)
  }

  const handleSend = async (text?: string) => {
    const msgText = text || input
    if (!msgText.trim() || !syllabusText || !currentSessionId) return

    const userMsg: ChatMessage = { role: 'user', content: msgText }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoadingMsg(true)

    // Save User Message to DB
    await savePrepPilotMessage(currentSessionId, 'user', msgText)

    try {
      const response = await fetch('/api/chat/preppilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          syllabusText,
          question: msgText,
          language,
          history: messages,
          isPanicMode,
          firstName: profile?.first_name,
          examDate
        })
      });

      if (!response.ok) throw new Error('Stream failed');

      const reader = response.body?.getReader();
      const decoder = new TextEncoder().encode();
      const textDecoder = new TextDecoder();
      
      let aiContent = '';
      setMessages(prev => [...prev, { role: 'model', content: '' }]);

      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;
        
        const chunk = textDecoder.decode(value);
        aiContent += chunk;
        
        setMessages(prev => {
          const last = prev[prev.length - 1];
          return [...prev.slice(0, -1), { ...last, content: aiContent }];
        });
      }

      // Save final AI Message to DB
      await savePrepPilotMessage(currentSessionId, 'assistant', aiContent)
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'model', content: `⚠️ Error: ${err.message}` }])
    } finally {
      setLoadingMsg(false)
    }
  }

  const handleDeleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (confirm('Delete this chat?')) {
      const res = await deletePrepPilotSession(id)
      if (res.success) {
        if (currentSessionId === id) handleNewChat()
        loadSessions()
      }
    }
  }

  const getTimeRemaining = () => {
    if (!examDate) return null;
    const now = new Date();
    const exam = new Date(examDate);
    const diff = exam.getTime() - now.getTime();
    if (diff <= 0) return "EXAM STARTED";
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${days}d : ${hours}h : ${mins}m`;
  }

  return (
    <div className="flex h-[calc(100vh-100px)] overflow-hidden bg-gray-950 rounded-2xl border border-gray-800 shadow-2xl">
      {/* History Sidebar */}
      <div className="w-64 sm:w-72 border-r border-gray-800 bg-gray-900/50 flex flex-col hidden md:flex">
        <div className="p-4 border-b border-gray-800">
          <button 
            onClick={handleNewChat}
            className="w-full py-2.5 px-4 bg-gray-800 hover:bg-gray-700 text-white rounded-xl border border-gray-700 flex items-center justify-center gap-2 transition-all font-medium text-sm group"
          >
            <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
            New Chat
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-4 no-scrollbar">
          <div className="space-y-1">
            <h3 className="px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
              <History className="w-3 h-3" /> Recent Chats
            </h3>
            {sessions.length === 0 ? (
              <p className="px-3 py-4 text-xs text-gray-600 italic">No history yet</p>
            ) : (
              sessions.map(s => (
                <div 
                  key={s.id}
                  onClick={() => loadSession(s)}
                  className={`group relative flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-all ${currentSessionId === s.id ? 'bg-purple-600/10 border border-purple-500/30' : 'hover:bg-gray-800/50 border border-transparent'}`}
                >
                  <MessageSquare className={`w-4 h-4 shrink-0 ${currentSessionId === s.id ? 'text-purple-400' : 'text-gray-500'}`} />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm truncate ${currentSessionId === s.id ? 'text-white font-semibold' : 'text-gray-400'}`}>{s.title}</p>
                    <p className="text-[10px] text-gray-600 mt-0.5">{getRelativeTime(s.created_at)}</p>
                  </div>
                  <button 
                    onClick={(e) => handleDeleteSession(e, s.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  {s.is_panic_mode && <div className="absolute top-2 right-2 w-1 h-1 rounded-full bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.8)]" />}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-950 relative">
        {/* Exam Countdown Widget (Panic Mode Only) */}
        {isPanicMode && (
          <div className="absolute top-20 right-8 z-10 animate-in slide-in-from-right-4 duration-500">
            <div className="bg-red-950/80 backdrop-blur-md border border-red-500/50 p-4 rounded-2xl shadow-[0_0_20px_rgba(239,68,68,0.2)] flex flex-col items-center gap-2 border-dashed animate-pulse">
              <div className="flex items-center gap-2 text-red-400 text-[10px] font-black uppercase tracking-widest">
                <Clock className="w-3 h-3" /> Exam Countdown
              </div>
              <div className="text-xl font-black text-white tabular-nums tracking-tighter">
                {getTimeRemaining() || (
                   <input 
                    type="date" 
                    onChange={(e) => setExamDate(e.target.value)}
                    className="bg-transparent text-sm border-b border-red-500/30 outline-none text-red-200 cursor-pointer"
                   />
                )}
              </div>
              {!examDate && <p className="text-[9px] text-red-500/70">Set your exam date</p>}
            </div>
          </div>
        )}

        <div className={`p-4 border-b flex justify-between items-center transition-all duration-500 ${isPanicMode ? 'bg-red-950/20 border-red-900/50' : 'bg-gray-950 border-gray-800'}`}>
          <div className="flex items-center gap-3">
            <h1 className={`text-xl font-bold ${isPanicMode ? 'text-red-400' : 'text-purple-400'}`}>PrepPilot</h1>
            <div className={`w-1.5 h-1.5 rounded-full ${isPanicMode ? 'bg-red-500 animate-ping' : 'bg-green-500'}`} />
          </div>
          
          <div className="flex items-center gap-4">
            {isPanicMode && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-red-900/20 border border-red-500/30 rounded-lg text-red-400 text-xs font-bold animate-pulse">
                <AlertTriangle className="w-3 h-3" /> {getTimeRemaining() || 'No Date Set'}
              </div>
            )}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all duration-300 ${isPanicMode ? 'bg-red-600/10 border-red-500' : 'bg-gray-900 border-gray-800'}`}>
              <span className={`text-[10px] font-bold uppercase tracking-widest ${isPanicMode ? 'text-red-400' : 'text-gray-500'}`}>Panic Mode</span>
              <button 
                onClick={() => setIsPanicMode(!isPanicMode)}
                className={`relative w-10 h-5 rounded-full transition-colors duration-300 ${isPanicMode ? 'bg-red-600' : 'bg-gray-700'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-300 ${isPanicMode ? 'translate-x-5' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-8 custom-scrollbar">
          {!plan && !currentSessionId ? (
            <div className={`max-w-2xl mx-auto mt-10 p-8 rounded-3xl border transition-all duration-500 ${isPanicMode ? 'bg-red-950/10 border-red-500/30 shadow-[0_0_30px_rgba(239,68,68,0.1)]' : 'bg-gray-900/50 border-gray-800'}`}>
              <div className="text-center mb-8">
                <div className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center transition-all duration-500 ${isPanicMode ? 'bg-red-600 shadow-[0_0_20px_rgba(239,68,68,0.4)] rotate-12' : 'bg-purple-600'}`}>
                  <Zap className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white">How can I help you study?</h2>
                <p className="text-gray-400 mt-2 text-sm">Upload a syllabus to generate a 7-day plan and start learning.</p>
              </div>

              <div className="space-y-4">
                {isPanicMode && (
                  <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-2xl mb-6">
                    <label className="text-[10px] font-black uppercase text-red-400 tracking-widest mb-2 block">Set Exam Date</label>
                    <div className="flex items-center gap-3">
                      <Calendar className="text-red-500 w-5 h-5" />
                      <input 
                        type="date" 
                        value={examDate}
                        onChange={(e) => setExamDate(e.target.value)}
                        className="bg-transparent text-white outline-none w-full cursor-pointer"
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center mb-2 px-1">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Input Syllabus</span>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1.5"
                  >
                    📎 {extracting ? 'Reading...' : 'Attach PDF/Image'}
                  </button>
                  <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileUpload} accept="application/pdf,image/*" />
                </div>

                <textarea
                  value={syllabusText}
                  onChange={(e) => setSyllabusText(e.target.value)}
                  placeholder="Paste topics or attach a file..."
                  className={`w-full h-40 p-5 bg-gray-900 border rounded-2xl text-white focus:ring-1 focus:outline-none transition-all resize-none ${isPanicMode ? 'border-red-900 focus:ring-red-600' : 'border-gray-800 focus:ring-purple-600'}`}
                />
                
                {error && <p className="text-xs text-red-500 animate-bounce">{error}</p>}

                <button
                  onClick={handleGenerate}
                  disabled={!syllabusText.trim() || loading || extracting}
                  className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest transition-all disabled:opacity-40 flex items-center justify-center gap-3 ${isPanicMode ? 'bg-red-600 hover:bg-red-700 shadow-xl shadow-red-600/30' : 'bg-purple-600 hover:bg-purple-700 shadow-xl shadow-purple-600/30'}`}
                >
                  {loading ? <Spinner /> : isPanicMode ? '🚨 Panic Learning ON' : 'Generate Study Plan'}
                </button>
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-700 pb-10">
              {/* Chat View */}
              <div className={`rounded-3xl border overflow-hidden flex flex-col h-[550px] shadow-2xl transition-all duration-500 ${isPanicMode ? 'border-red-500/50 bg-red-950/5' : 'border-gray-800 bg-gray-900/40'}`}>
                <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar scroll-smooth">
                  {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                      <div className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed ${msg.role === 'user' ? (isPanicMode ? 'bg-red-600 text-white' : 'bg-purple-600 text-white') : 'bg-gray-800/80 text-gray-100 border border-gray-700/50 shadow-sm'}`}>
                        <div className="whitespace-pre-wrap prose prose-invert prose-sm max-w-none">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  ))}
                  {loadingMsg && !messages[messages.length-1]?.content && (
                    <div className="flex justify-start">
                      <div className="bg-gray-800/80 border border-gray-700/50 p-4 rounded-2xl shadow-sm">
                        <Spinner />
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <div className="p-4 border-t border-gray-800 bg-gray-950/50">
                  {isPanicMode && messages.length > 0 && !loadingMsg && (
                    <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar pb-1">
                      {['Give me an Example', 'Simplified Diagram', 'ELI5 again'].map(s => (
                        <button key={s} onClick={() => handleSend(s)} className="shrink-0 px-4 py-2 bg-red-600/10 border border-red-500/30 rounded-full text-xs text-red-400 hover:bg-red-600/20 transition-all">
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                  
                  <form onSubmit={(e) => { e.preventDefault(); handleSend() }} className="flex gap-3">
                    <input 
                      type="text" 
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder={isPanicMode ? "🚨 Speed teaching mode..." : "Ask a follow-up question..."}
                      className={`flex-1 p-4 bg-gray-900 border rounded-2xl text-sm text-white focus:outline-none transition-all ${isPanicMode ? 'border-red-900 focus:ring-red-600' : 'border-gray-800 focus:ring-purple-600'}`}
                    />
                    <button 
                      type="submit"
                      disabled={!input.trim() || loadingMsg}
                      className={`w-12 h-12 flex items-center justify-center rounded-2xl transition-all disabled:opacity-40 ${isPanicMode ? 'bg-red-600 hover:bg-red-700' : 'bg-purple-600 hover:bg-purple-700'}`}
                    >
                      <Send className="w-5 h-5 text-white" />
                    </button>
                  </form>
                </div>
              </div>

              {/* Plan View */}
              {plan && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-purple-600/20 flex items-center justify-center text-purple-400">📅</span>
                    Your 7-Day Plan
                  </h2>
                  <div className="grid grid-cols-1 gap-4">
                    {plan.schedule.map((day) => (
                      <div key={day.day} className="bg-gray-900/40 p-6 rounded-3xl border border-gray-800 hover:border-purple-500/50 transition-all group">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-gray-800 flex flex-col items-center justify-center shrink-0 group-hover:bg-purple-600 transition-colors">
                            <span className="text-[10px] text-gray-500 font-bold uppercase group-hover:text-purple-100">Day</span>
                            <span className="text-lg font-black text-white">{day.day}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-xl font-bold text-white mb-1">{day.topic}</h3>
                            <p className="text-gray-400 text-sm mb-4 leading-relaxed">{day.description}</p>
                            <div className="flex flex-wrap gap-2">
                              {day.tasks.map((task, i) => (
                                <span key={i} className="px-3 py-1 bg-gray-800 rounded-lg text-xs text-gray-400 border border-gray-700/50">
                                  {task}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
