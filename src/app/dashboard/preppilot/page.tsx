'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
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
import { ChatMessage, PrepPilotSession } from '@/types'
import { useTheme } from 'next-themes'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Plus, MessageSquare, Trash2, Zap, History, Send, Calendar, 
  Clock, AlertTriangle, Cpu, Brain, Sparkles, ChevronLeft, Menu,
  Paperclip, FileText, Image as ImageIcon, X
} from 'lucide-react'
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface SelectedFile {
  id: string;
  file: File;
  preview: string;
  type: 'pdf' | 'image';
  extractedText?: string;
  isExtracting: boolean;
}

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

export default function EngineerOSPage() {
  const { language } = useLanguage()
  const { theme, resolvedTheme } = useTheme()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [complexMode, setComplexMode] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  
  const [sessions, setSessions] = useState<PrepPilotSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loadingMsg, setLoadingMsg] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([])
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const isDarkMode = resolvedTheme === 'dark'

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, loadingMsg])

  const loadSessions = useCallback(async () => {
    const res: any = await getPrepPilotSessions()
    if (res.success && res.data) {
      setSessions(res.data)
    }
  }, [])

  useEffect(() => {
    loadSessions()
    getUserProfile().then((res: any) => {
      if (res.success) setProfile(res.data)
    })
  }, [loadSessions])

  const handleNewChat = () => {
    setCurrentSessionId(null)
    setMessages([])
    setSelectedFiles([])
    setComplexMode(false)
  }

  const loadSession = async (session: any) => {
    setCurrentSessionId(session.id)
    setComplexMode(false)
    setLoadingMsg(true)
    const res: any = await getPrepPilotMessages(session.id)
    if (res.success && res.data) {
      setMessages(res.data.map((m: any) => ({ 
        role: m.role === 'assistant' ? 'model' : 'user', 
        content: m.content 
      })))
    }
    setLoadingMsg(false)
    if (window.innerWidth < 768) setSidebarOpen(false)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const newFiles: SelectedFile[] = files.map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
      type: file.type === 'application/pdf' ? 'pdf' : 'image',
      isExtracting: true
    }))

    setSelectedFiles(prev => [...prev, ...newFiles])
    
    newFiles.forEach(async (f) => {
      try {
        let extracted = ''
        const formData = new FormData()
        formData.append('file', f.file)

        if (f.type === 'pdf') {
          const pdfjs = await import('pdfjs-dist')
          pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
          const arrayBuffer = await f.file.arrayBuffer()
          const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise
          
          let fullText = ''
          const numPages = Math.min(3, pdf.numPages)
          for (let i = 1; i <= numPages; i++) {
            const page = await pdf.getPage(i)
            const textContent = await page.getTextContent()
            fullText += textContent.items.map((it: any) => it.str).join(' ') + ' '
          }

          if (fullText.trim().length > 100) {
            formData.append('extractedText', fullText.trim())
          } else {
            const page = await pdf.getPage(1)
            const viewport = page.getViewport({ scale: 1.5 })
            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d')
            canvas.height = viewport.height
            canvas.width = viewport.width
            if (ctx) {
              // @ts-ignore
              await page.render({ canvasContext: ctx, viewport, canvas } as any).promise
              const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
              if (blob) formData.append('renderedImage', blob, 'page1.png')
            }
          }
          const res: any = await extractTextFromPDF(formData)
          extracted = res.data || ''
        } else {
          const res: any = await extractTextFromImage(formData)
          extracted = res.data || ''
        }

        setSelectedFiles(prev => prev.map(item => 
          item.id === f.id ? { ...item, extractedText: extracted, isExtracting: false } : item
        ))
      } catch (err) {
        console.error("File extraction error:", err)
        setSelectedFiles(prev => prev.map(item => 
          item.id === f.id ? { ...item, isExtracting: false } : item
        ))
      }
    })
    
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeFile = (id: string) => {
    setSelectedFiles(prev => prev.filter(f => f.id !== id))
  }

  const handleSend = async (text?: string) => {
    const msgText = text || input
    if (!msgText.trim() && selectedFiles.length === 0) return

    const userDisplayMsg: ChatMessage = { role: 'user', content: msgText || "Attached files..." }
    const currentMessages = messages
    setMessages(prev => [...prev, userDisplayMsg])
    setInput('')
    setLoadingMsg(true)
    
    let contextStr = ''
    if (selectedFiles.length > 0) {
      contextStr = "\n\n[CONTEXT FROM UPLOADED FILES]:\n"
      selectedFiles.forEach(f => {
        if (f.extractedText) {
          contextStr += `--- File: ${f.file.name} ---\n${f.extractedText}\n\n`
        }
      })
    }
    const fullMsg = msgText + contextStr
    const filesToClear = [...selectedFiles]
    setSelectedFiles([])

    try {
      let sessionId = currentSessionId
      if (!sessionId) {
        const title = msgText ? msgText.slice(0, 30).trim() : (filesToClear[0]?.file.name || 'New Chat')
        const res: any = await createPrepPilotSession(title)
        if (res.success && res.data) {
          sessionId = res.data.id
          setCurrentSessionId(sessionId)
          loadSessions()
        } else {
          throw new Error(res.error || "Failed to create session")
        }
      }

      // @ts-ignore
      savePrepPilotMessage(sessionId!, 'user', fullMsg).catch(err => console.error("Save error:", err))

      const response = await fetch('/api/chat/preppilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          syllabusText: contextStr,
          question: msgText || "Analyze these documents.",
          language,
          history: [...currentMessages, userDisplayMsg],
          complexMode,
          firstName: profile?.first_name || 'Engineer'
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'AI Engine is currently busy. Please try again.')
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response stream available')
      
      const textDecoder = new TextDecoder()
      let aiContent = ''
      setMessages(prev => [...prev, { role: 'model', content: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = textDecoder.decode(value)
        aiContent += chunk
        setMessages(prev => {
          const last = prev[prev.length - 1]
          return [...prev.slice(0, -1), { ...last, content: aiContent }]
        })
      }

      // @ts-ignore
      savePrepPilotMessage(sessionId!, 'assistant', aiContent).catch(err => console.error("Save AI error:", err))

    } catch (err: any) {
      console.error("Chat Error:", err)
      setError(err.message)
      setMessages(prev => [...prev, { role: 'model', content: `⚠️ **System Error:** ${err.message}` }])
    } finally {
      setLoadingMsg(false)
    }
  }

  const handleDeleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (confirm('Delete this chat?')) {
      const res: any = await deletePrepPilotSession(id)
      if (res.success) {
        if (currentSessionId === id) handleNewChat()
        loadSessions()
      }
    }
  }

  const parseAIResponse = (content: string) => {
    const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/);
    if (thinkMatch) {
      const thinking = thinkMatch[1].trim();
      const rest = content.replace(/<think>[\s\S]*?<\/think>/, '').trim();
      return { thinking, rest };
    }
    return { thinking: null, rest: content };
  }

  return (
    <div className="flex h-[calc(100vh-120px)] overflow-hidden bg-background dark:bg-[#050505] rounded-[2rem] border border-border shadow-2xl relative">
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 dark:bg-black/80 z-40 md:hidden backdrop-blur-md"
          />
        )}
      </AnimatePresence>

      <motion.div 
        animate={{ width: sidebarOpen ? '280px' : '0px', x: sidebarOpen ? 0 : -280 }}
        transition={{ type: 'spring', damping: 25, stiffness: 120 }}
        className="bg-muted/30 dark:bg-[#080808] border-r border-border flex flex-col z-50 absolute md:relative h-full overflow-hidden shrink-0"
      >
        <div className="p-5 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-black bg-gradient-to-r from-purple-600 via-blue-600 to-purple-600 dark:from-purple-400 dark:via-blue-400 dark:to-purple-400 bg-clip-text text-transparent italic tracking-tighter">ENGINEEROS</h1>
            <button onClick={() => setSidebarOpen(false)} className="md:hidden p-1.5 text-muted-foreground hover:text-foreground transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>
          
          <button 
            onClick={handleNewChat}
            className="w-full py-3 px-4 bg-background dark:bg-white/5 hover:bg-muted dark:hover:bg-white/10 text-foreground dark:text-white rounded-2xl border border-border flex items-center justify-between transition-all group active:scale-95 shadow-md dark:shadow-xl"
          >
            <span className="font-bold text-[12px] tracking-wide">New Interaction</span>
            <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 no-scrollbar">
          <div className="px-3 text-[10px] font-black text-muted-foreground/40 dark:text-white/20 uppercase tracking-[0.25em] mb-4 mt-2">
            Workspace History
          </div>
          {sessions.length === 0 ? (
            <div className="p-8 text-center opacity-10">
              <Sparkles className="w-6 h-6 mx-auto mb-3" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">No sessions yet</p>
            </div>
          ) : (
            sessions.map(s => (
              <motion.div 
                layout
                key={s.id}
                onClick={() => loadSession(s)}
                className={`group relative flex items-center gap-3 px-4 py-3.5 rounded-2xl cursor-pointer transition-all border ${currentSessionId === s.id ? 'bg-purple-600/5 dark:bg-purple-600/10 border-purple-500/20 shadow-inner' : 'bg-transparent border-transparent hover:bg-muted/50 dark:hover:bg-white/5'}`}
              >
                <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${currentSessionId === s.id ? 'text-purple-600 dark:text-purple-400' : 'text-muted-foreground/50'}`} />
                <div className="min-w-0 flex-1">
                  <p className={`text-[12px] truncate font-semibold tracking-tight ${currentSessionId === s.id ? 'text-foreground' : 'text-muted-foreground'}`}>{s.title}</p>
                </div>
                <button 
                  onClick={(e) => handleDeleteSession(e, s.id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground/20 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>

      <div className="flex-1 flex flex-col min-w-0 bg-background dark:bg-[#050505] relative h-full">
        <header className="h-14 border-b border-border flex items-center justify-between px-6 bg-background/60 dark:bg-[#050505]/60 backdrop-blur-2xl z-30 sticky top-0">
          <div className="flex items-center gap-4">
            {!sidebarOpen && (
              <button onClick={() => setSidebarOpen(true)} className="p-2 text-muted-foreground hover:text-foreground bg-muted/50 dark:bg-white/5 rounded-xl transition-all">
                <Menu className="w-4 h-4" />
              </button>
            )}
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-muted-foreground tracking-[0.2em] uppercase flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${complexMode ? 'bg-amber-500' : 'bg-green-500'}`} />
                {complexMode ? 'Reasoning Engine' : 'EngineerOS v4.3'}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
             <div className="flex items-center gap-3">
                <span className={`text-[9px] font-black uppercase tracking-widest ${complexMode ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground/30'}`}>Deep Think</span>
                <button 
                  onClick={() => setComplexMode(!complexMode)}
                  className={`relative w-8 h-4 rounded-full transition-all duration-500 ${complexMode ? 'bg-amber-500/20 ring-1 ring-amber-500/50' : 'bg-muted dark:bg-white/5'}`}
                >
                  <span className={`absolute top-1 left-1 w-2 h-2 rounded-full transition-all duration-500 ${complexMode ? 'translate-x-4 bg-amber-600 dark:bg-amber-400' : 'bg-muted-foreground/40'}`} />
                </button>
             </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar scroll-smooth">
          <AnimatePresence mode="wait">
            {!currentSessionId && messages.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-2xl mx-auto h-full flex flex-col items-center justify-center p-8 text-center gap-8"
              >
                <div className="relative group">
                  <div className="absolute inset-0 bg-purple-600 blur-[60px] opacity-10 dark:opacity-20 group-hover:opacity-30 transition-opacity" />
                  <div className="w-20 h-20 bg-gradient-to-br from-purple-600 via-indigo-600 to-purple-800 rounded-[2.5rem] flex items-center justify-center shadow-2xl relative z-10">
                    <Zap className="w-10 h-10 text-white dark:text-white" />
                  </div>
                </div>

                <div className="space-y-3">
                  <h2 className="text-4xl font-black text-foreground tracking-tighter">EngineerOS</h2>
                  <p className="text-muted-foreground text-sm font-medium leading-relaxed italic max-w-sm mx-auto">
                    A high-performance multimodal workspace for academic excellence.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                  {[
                    "Visualize Maxwell's Equations",
                    "Analyze Circuit Stability",
                    "Explain Neural Architecture",
                    "Summarize Engineering Docs"
                  ].map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => setInput(prompt)}
                      className="p-4 text-[11px] text-left text-muted-foreground font-bold uppercase tracking-wider bg-muted/30 dark:bg-white/[0.02] border border-border rounded-2xl hover:bg-muted dark:hover:bg-white/[0.05] hover:text-foreground transition-all active:scale-[0.98]"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </motion.div>
            ) : (
              <div className="max-w-4xl mx-auto p-6 md:p-10 space-y-8 pb-40">
                {messages.map((msg, idx) => {
                  const { thinking, rest } = msg.role === 'model' ? parseAIResponse(msg.content) : { thinking: null, rest: msg.content };
                  return (
                    <motion.div 
                      key={idx}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                    >
                      <div className={`max-w-[90%] p-6 rounded-[2rem] text-[16px] leading-[1.6] shadow-lg ${msg.role === 'user' ? 'bg-muted dark:bg-[#151515] text-foreground dark:text-white border border-border' : 'bg-background dark:bg-[#080808] text-foreground dark:text-white/90 border border-border'} font-serif tracking-tight`}>
                        <style jsx>{`
                          .font-serif { font-family: 'Times New Roman', Times, serif; }
                        `}</style>
                        {thinking && (
                          <details className="mb-6 group bg-muted/50 dark:bg-black/60 rounded-[1.2rem] border border-border overflow-hidden transition-all font-sans">
                            <summary className="p-3 text-[9px] font-black text-amber-600 dark:text-amber-500/70 cursor-pointer uppercase tracking-[0.2em] list-none flex items-center gap-3 hover:bg-muted transition-colors">
                              <Brain className="w-3 h-3" />
                              Cognitive Trace
                              <div className="flex-1 h-[1px] bg-border" />
                              <ChevronLeft className="w-3 h-3 -rotate-90 group-open:rotate-90 transition-transform" />
                            </summary>
                            <div className="px-4 pb-4 text-[12px] leading-relaxed text-muted-foreground dark:text-white/20 font-mono italic whitespace-pre-wrap">
                              {thinking}
                            </div>
                          </details>
                        )}
                        <div className="prose dark:prose-invert prose-sm max-w-none prose-p:my-3 prose-headings:mb-4 prose-headings:mt-6 prose-headings:text-foreground prose-strong:text-purple-600 dark:prose-strong:text-purple-400 prose-code:text-blue-600 dark:prose-code:text-blue-300">
                          <ReactMarkdown
                            components={{
                              code({ node, inline, className, children, ...props }: any) {
                                const match = /language-(\w+)/.exec(className || '')
                                return !inline && match ? (
                                  <SyntaxHighlighter
                                    style={isDarkMode ? vscDarkPlus : oneLight}
                                    language={match[1]}
                                    PreTag="div"
                                    className="rounded-2xl border border-border !bg-muted/50 dark:!bg-black !p-4 my-4 no-scrollbar shadow-xl font-sans"
                                    {...props}
                                  >
                                    {String(children).replace(/\n$/, '')}
                                  </SyntaxHighlighter>
                                ) : (
                                  <code className={`${className} bg-muted px-1.5 py-0.5 rounded font-mono text-[12px] text-blue-600 dark:text-blue-300`} {...props}>
                                    {children}
                                  </code>
                                )
                              }
                            }}
                          >
                            {rest}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
                {loadingMsg && !messages[messages.length-1]?.content && (
                   <div className="flex justify-start">
                     <div className="bg-muted dark:bg-[#080808] border border-border p-4 rounded-2xl shadow-md">
                        <div className="flex gap-1.5">
                           {[0, 0.2, 0.4].map((delay) => (
                             <motion.div key={delay} animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.2, delay }} className="w-1.5 h-1.5 bg-purple-500 rounded-full" />
                           ))}
                        </div>
                     </div>
                   </div>
                )}
                <div ref={chatEndRef} />
              </div>
            )}
          </AnimatePresence>
        </div>

        <div className="p-6 md:p-8 bg-gradient-to-t from-background dark:from-[#050505] via-background dark:via-[#050505] to-transparent pt-12 sticky bottom-0 z-20">
          <div className="max-w-4xl mx-auto space-y-5">
            <AnimatePresence>
              {selectedFiles.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 15 }}
                  className="flex gap-3 overflow-x-auto pb-3 no-scrollbar"
                >
                  {selectedFiles.map(f => (
                    <div key={f.id} className="relative group shrink-0">
                      <div className="w-28 h-28 bg-muted dark:bg-[#0a0a0a] border border-border rounded-2xl overflow-hidden flex flex-col items-center justify-center p-3 text-center gap-2 shadow-lg transition-all group-hover:border-purple-500/30">
                        {f.type === 'image' ? (
                          <img src={f.preview} className="w-full h-14 object-cover rounded-xl mb-1" />
                        ) : (
                          <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center mb-1">
                            <FileText className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                          </div>
                        )}
                        <span className="text-[9px] text-muted-foreground font-bold truncate w-full px-1 uppercase tracking-tighter">{f.file.name}</span>
                        {f.isExtracting && (
                          <div className="absolute inset-0 bg-background/70 dark:bg-black/70 flex items-center justify-center backdrop-blur-sm">
                            <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                          </div>
                        )}
                      </div>
                      <button 
                        onClick={() => removeFile(f.id)}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-2xl active:scale-90 border-2 border-background"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            <form 
              onSubmit={(e) => { e.preventDefault(); handleSend() }} 
              className="relative flex items-center gap-3"
            >
              <div className="relative flex-1 group">
                <div className="absolute inset-0 bg-purple-600/10 blur-[80px] opacity-0 group-focus-within:opacity-100 transition-opacity" />
                
                <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-3 z-20">
                  <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-all"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>
                </div>

                <input 
                  type="text" 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={selectedFiles.length > 0 ? "Explain these specific documents..." : "Message EngineerOS..."}
                  className="w-full p-5 pl-14 pr-16 bg-muted/40 dark:bg-[#0a0a0a] border border-border rounded-[1.8rem] text-[15px] text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-purple-500/30 transition-all relative z-10 shadow-lg"
                  disabled={loadingMsg}
                />

                <input 
                  type="file" 
                  multiple 
                  className="hidden" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  accept="application/pdf,image/*" 
                />

                <button 
                  type="submit"
                  disabled={(!input.trim() && selectedFiles.length === 0) || loadingMsg}
                  className={`absolute right-2 top-2 bottom-2 px-6 flex items-center justify-center rounded-[1.2rem] transition-all z-20 active:scale-95 shadow-md ${complexMode ? 'bg-amber-600 text-white' : 'bg-foreground text-background'}`}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
            <div className="flex items-center justify-center gap-6 opacity-30 group">
                <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-border" />
                <p className="text-[8px] text-muted-foreground font-black uppercase tracking-[0.6em]">ENGINEEROS CORE v4.3</p>
                <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-border" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
