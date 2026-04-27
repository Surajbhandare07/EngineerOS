'use client'

import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import {
  generateNotesFromImage,
  generateNotesFromPDF,
  getSmartNotes
} from '@/lib/actions/smart-notes'
import Spinner from '@/components/ui/Spinner'
import imageCompression from 'browser-image-compression'
import { toPng } from 'html-to-image'
import jsPDF from 'jspdf'
import { Plus, Download, NotebookPen, FileText, X, Notebook, History } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

/* ── Types ── */
type QueuedFile = {
  id: string
  file: File
  status: 'pending' | 'processing' | 'done' | 'error'
  previewUrl?: string   // image preview
  isPdf: boolean
  error?: string
}

type NoteResult = {
  markdownContent: string
  title: string
  publicUrl?: string
}

/* ── Modal: PDF filename prompt ── */
function FilenameModal({
  defaultName,
  onConfirm,
  onCancel,
}: {
  defaultName: string
  onConfirm: (name: string) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(defaultName)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 w-full max-w-sm shadow-2xl">
        <h3 className="text-lg font-bold text-white mb-1">Name your PDF</h3>
        <p className="text-gray-400 text-sm mb-5">This will be used as the download filename.</p>
        <input
          autoFocus
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && name.trim() && onConfirm(name.trim())}
          className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500 mb-5"
          placeholder="e.g. Photosynthesis Basics"
        />
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => name.trim() && onConfirm(name.trim())}
            disabled={!name.trim()}
            className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            📄 Download
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SmartNotesPage() {
  const [queue, setQueue] = useState<QueuedFile[]>([])
  const [processing, setProcessing] = useState(false)
  const [activeNote, setActiveNote] = useState<NoteResult | null>(null)
  const [history, setHistory] = useState<any[]>([])
  const [isDownloading, setIsDownloading] = useState(false)
  const [showFilenameModal, setShowFilenameModal] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { fetchHistory() }, [])

  const fetchHistory = async () => {
    const res = await getSmartNotes()
    if (res.success && res.data) setHistory(res.data)
  }

  /* ── File selection ── */
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, 10)
    if (!files.length) return

    const newItems: QueuedFile[] = files.map(f => ({
      id: `${Date.now()}_${Math.random()}`,
      file: f,
      status: 'pending',
      isPdf: f.type === 'application/pdf',
      previewUrl: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined,
    }))

    setQueue(prev => [...prev, ...newItems].slice(0, 10))
    // reset so re-selecting same files triggers onChange
    e.target.value = ''
  }

  /* ── Remove a pending file ── */
  const removeFile = (id: string) =>
    setQueue(prev => prev.filter(q => q.id !== id))

  /* ── Process all queued files sequentially ── */
  const processQueue = async () => {
    if (!queue.length || processing) return
    setProcessing(true)

    let lastResult: NoteResult | null = null

    for (const item of queue) {
      if (item.status !== 'pending') continue

      setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'processing' } : q))

      try {
        let compressedFile = item.file
        let clientExtractedText = ''
        let renderedImageBlob: Blob | null = null

        // --- CLIENT-SIDE PROCESSING ---
        if (item.isPdf) {
          try {
            const pdfjs = await import('pdfjs-dist')
            pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
            
            const arrayBuffer = await item.file.arrayBuffer()
            const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise
            
            // 1. Try Digital Text Extraction
            let fullText = ''
            const numPagesToExtract = Math.min(5, pdf.numPages) // Extract first 5 pages for check
            for (let i = 1; i <= numPagesToExtract; i++) {
              const page = await pdf.getPage(i)
              const textContent = await page.getTextContent()
              const pageText = textContent.items.map((it: any) => it.str).join(' ')
              fullText += pageText + ' '
            }

            if (fullText.trim().length > 200) {
              clientExtractedText = fullText.trim()
              console.log("[Client] Digital PDF detected, extracted text length:", clientExtractedText.length)
            } else {
              // 2. Scanned PDF Fallback: Render first page to Image
              console.log("[Client] Scanned PDF detected, rendering first page...")
              const page = await pdf.getPage(1)
              const scale = 2.0 // High quality for OCR
              const viewport = page.getViewport({ scale })
              
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
            console.error("[Client] PDF Processing failed:", pdfErr)
            // Fallback to sending original file if client-side fails
          }
        } else {
          // Compress images
          try {
            compressedFile = await imageCompression(item.file, {
              maxSizeMB: 2,
              maxWidthOrHeight: 1600,
              useWebWorker: true,
            })
          } catch { /* keep original */ }
        }

        const formData = new FormData()
        
        if (item.isPdf) {
          formData.append('file', item.file) // Always keep original for storage
          if (clientExtractedText) {
            formData.append('extractedText', clientExtractedText)
          } else if (renderedImageBlob) {
            formData.append('renderedImage', renderedImageBlob, 'page1.png')
          }
        } else {
          formData.append('file', compressedFile)
        }

        const res = item.isPdf
          ? await generateNotesFromPDF(formData)
          : await generateNotesFromImage(formData)

        if (!res.success || !res.markdownContent) throw new Error(res.error ?? 'Unknown error')

        lastResult = { markdownContent: res.markdownContent, title: res.title ?? 'Untitled Note', publicUrl: 'publicUrl' in res ? (res.publicUrl ?? undefined) : undefined }

        setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'done' } : q))
      } catch (err: any) {
        setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error', error: err.message } : q))
      }
    }

    if (lastResult) setActiveNote(lastResult)
    await fetchHistory()
    setProcessing(false)
  }

  /* ── PDF Download with filename modal ── */
  const handleDownloadClick = () => setShowFilenameModal(true)

  const handleDownloadConfirm = async (filename: string) => {
    setShowFilenameModal(false)
    const element = document.getElementById('notebook-paper')
    if (!element) return
    setIsDownloading(true)

    try {
      const dataUrl = await toPng(element, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#fffdf5',
        style: { color: '#1a1a1a', fontFamily: 'Caveat, cursive' },
      })

      const pdf = new jsPDF('p', 'mm', 'a4')
      const pdfWidth  = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()
      const imgRatio  = element.offsetHeight / element.offsetWidth
      const totalMM   = pdfWidth * imgRatio

      let yOffset = 0
      let page = 0
      while (yOffset < totalMM) {
        if (page > 0) pdf.addPage()
        pdf.addImage(dataUrl, 'PNG', 0, -yOffset, pdfWidth, totalMM)
        yOffset += pdfHeight
        page++
      }

      pdf.save(`${filename}.pdf`)
    } catch (err) {
      console.error('PDF generation failed:', err)
      alert('Failed to generate PDF. Please try again.')
    } finally {
      setIsDownloading(false)
    }
  }

  const resetAll = () => {
    setQueue([])
    setActiveNote(null)
  }

  const hasQueue = queue.length > 0
  const hasPending = queue.some(q => q.status === 'pending')
  const allDone = queue.length > 0 && queue.every(q => q.status === 'done' || q.status === 'error')

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 h-full flex flex-col">

      {/* Filename Modal */}
      <AnimatePresence>
        {showFilenameModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFilenameModal(false)}
              className="absolute inset-0 bg-background/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-card border-2 border-border p-10 rounded-[3rem] shadow-2xl"
            >
              <h3 className="text-2xl font-black tracking-tighter mb-2 italic">Name your <span className="text-primary">Asset</span></h3>
              <p className="text-xs text-muted-foreground font-medium mb-8 opacity-60 uppercase tracking-widest">Specify the archive identifier</p>
              
              <div className="space-y-6">
                <input
                  autoFocus
                  type="text"
                  value={activeNote?.title ?? 'Digital Notes'}
                  onChange={e => setActiveNote(prev => prev ? { ...prev, title: e.target.value } : null)}
                  className="w-full px-6 py-4 bg-muted/40 border border-border rounded-2xl font-bold focus:ring-4 focus:ring-primary/5 focus:border-primary focus:outline-none transition-all"
                  placeholder="e.g. Quantum Physics Notes"
                />
                
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowFilenameModal(false)}
                    className="flex-1 py-4 text-xs font-black uppercase tracking-widest hover:bg-muted rounded-2xl transition-all"
                  >
                    Abort
                  </button>
                  <button
                    onClick={() => handleDownloadConfirm(activeNote?.title ?? 'Notes')}
                    className="flex-1 py-4 bg-primary text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <Download size={14} />
                    Download
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div className="space-y-1">
          <h1 className="text-4xl font-black tracking-tighter italic text-foreground">Digital <span className="text-primary">Notebook</span></h1>
          <p className="text-sm text-muted-foreground font-medium opacity-60">Synthesize handwritten intelligence into digital assets.</p>
        </div>
        <div className="flex gap-3 items-center">
          {activeNote && (
            <button
              onClick={handleDownloadClick}
              disabled={isDownloading}
              className="px-6 py-3 bg-primary text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-105 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50"
            >
              {isDownloading ? <Spinner /> : <Download size={16} />}
              Export PDF
            </button>
          )}
          {(hasQueue || activeNote) && (
            <button
              onClick={resetAll}
              className="p-3 bg-card border border-border/50 hover:border-primary hover:text-primary rounded-2xl transition-all shadow-md active:scale-95"
              title="New Session"
            >
              <Plus size={20} />
            </button>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-10 flex-1 min-h-0">

        <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col relative min-h-0">

          {!hasQueue && !activeNote ? (
            <div
              className="flex-1 flex flex-col items-center justify-center p-12 m-8 border-2 border-dashed border-border/50 rounded-[2rem] hover:border-primary hover:bg-primary/5 transition-all cursor-pointer group"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="w-24 h-24 bg-card border border-border group-hover:scale-110 group-hover:rotate-6 rounded-[2rem] flex items-center justify-center mb-8 shadow-xl transition-all">
                <NotebookPen size={40} className="text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <h3 className="text-2xl font-black tracking-tighter mb-3">Intelligence Ingestion</h3>
              <p className="text-sm text-muted-foreground font-medium mb-10 max-w-sm text-center leading-relaxed">
                Upload up to <span className="text-primary font-black">10 academic assets</span>. Our vision engine will synthesize them into a professional digital archive.
              </p>
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,application/pdf"
                multiple
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileSelect}
              />
              <button className="px-10 py-4 bg-primary text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-2xl shadow-primary/20 active:scale-95 transition-all">
                Select Intelligence
              </button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
              {/* Left: file queue */}
              <div className="lg:w-80 shrink-0 border-b lg:border-b-0 lg:border-r border-border/50 bg-muted/20 p-6 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] opacity-60">
                    Queue Content ({queue.length}/10)
                  </h3>
                </div>

                <div className="space-y-3">
                  {queue.map(item => (
                    <motion.div
                      layout
                      key={item.id}
                      className={`flex items-center gap-4 p-3 rounded-2xl border transition-all ${
                        item.status === 'processing' ? 'border-primary bg-primary/5 shadow-inner'
                        : item.status === 'done'       ? 'border-green-500/20 bg-green-500/5'
                        : item.status === 'error'      ? 'border-red-500/20 bg-red-500/5'
                        : 'border-border/50 bg-card shadow-sm'
                      }`}
                    >
                      <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-muted border border-border/50 flex items-center justify-center shadow-sm">
                        {item.previewUrl
                          ? <img src={item.previewUrl} alt="" className="w-full h-full object-cover" />
                          : <FileText size={20} className="text-muted-foreground" />
                        }
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate text-foreground">{item.file.name}</p>
                        <p className={`text-[9px] font-black uppercase tracking-widest mt-1 ${
                          item.status === 'processing' ? 'text-primary animate-pulse'
                          : item.status === 'done'     ? 'text-green-500'
                          : item.status === 'error'    ? 'text-red-500'
                          : 'text-muted-foreground/60'
                        }`}>
                          {item.status === 'processing' ? 'Processing…'
                           : item.status === 'done'     ? 'Complete'
                           : item.status === 'error'    ? 'Error'
                           : item.isPdf               ? 'PDF Asset'
                           : 'Image Asset'
                          }
                        </p>
                      </div>

                      {item.status === 'pending' && (
                        <button onClick={() => removeFile(item.id)} className="p-1.5 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 rounded-lg transition-colors">
                          <X size={14} />
                        </button>
                      )}
                    </motion.div>
                  ))}
                </div>

                {hasPending && !processing && (
                  <button
                    onClick={processQueue}
                    className="mt-4 w-full py-4 bg-primary text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/20 active:scale-95 transition-all"
                  >
                    Synthesize Notes ({queue.filter(q => q.status === 'pending').length})
                  </button>
                )}

                {processing && (
                  <div className="mt-4 flex flex-col items-center justify-center gap-3 py-4 text-primary">
                    <Spinner />
                    <span className="text-[10px] font-black uppercase tracking-widest animate-pulse">Running Vision Logic...</span>
                  </div>
                )}
              </div>

              {/* Right: Notebook canvas */}
              <div className="flex-1 flex flex-col min-h-0 bg-background/30 backdrop-blur-sm">
                <div className="flex-1 overflow-y-auto custom-scrollbar p-10">
                  <AnimatePresence mode="wait">
                    {!activeNote && !processing ? (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center justify-center h-full gap-4 text-center opacity-40"
                      >
                        <Notebook size={48} className="text-muted-foreground mb-2" />
                        <p className="text-sm font-bold uppercase tracking-widest">Awaiting Synthesis</p>
                      </motion.div>
                    ) : processing && !activeNote ? (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center justify-center h-full gap-6"
                      >
                        <div className="relative">
                          <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
                          <Spinner className="w-12 h-12 text-primary relative z-10" />
                        </div>
                        <div className="space-y-2 text-center">
                          <p className="text-xl font-black tracking-tighter italic">Digitizing Intelligence</p>
                          <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.3em] opacity-60">Please maintain connection...</p>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        id="notebook-paper"
                        className="min-h-full w-full rounded-[2rem] shadow-2xl overflow-hidden"
                        style={{
                          backgroundColor: '#fffdf5',
                          color: '#1a1a1a',
                          padding: '2rem 2.5rem 2.5rem 4rem',
                          backgroundImage: `
                            linear-gradient(90deg, transparent 50px, #f87171 50px, #f87171 51px, transparent 51px),
                            linear-gradient(#e2e8f0 1px, transparent 1px)
                          `,
                          backgroundSize: '100% 1.6rem',
                          lineHeight: '1.6rem',
                        }}
                      >
                        <div className="prose max-w-none font-handwritten">
                          <ReactMarkdown
                            components={{
                              h1: ({ children }) => (
                                <h1 className="font-bold border-b-2 border-primary/20 pb-0.5 mb-4" style={{ fontSize: '1.6rem', color: '#1e1b4b', borderBottom: 'none' }}>
                                  📌 {children}
                                </h1>
                              ),
                              h2: ({ children }) => (
                                <h2 className="font-bold mb-3 mt-6" style={{ fontSize: '1.3rem', color: '#312e81' }}>
                                  📝 {children}
                                </h2>
                              ),
                              h3: ({ children }) => (
                                <h3 className="font-bold mb-1.5 mt-4" style={{ fontSize: '1.1rem', color: '#3730a3' }}>
                                  🔹 {children}
                                </h3>
                              ),
                              p: ({ children }) => (
                                <p style={{ margin: '0 0 1.6rem', fontSize: '1rem', color: '#1a1a1a', lineHeight: '1.6rem' }}>{children}</p>
                              ),
                              li: ({ children }) => (
                                <li style={{ fontSize: '1rem', color: '#1a1a1a', lineHeight: '1.6rem', listStyleType: 'disc' }}>
                                  {children}
                                </li>
                              ),
                              blockquote: ({ children }) => (
                                <div style={{
                                  background: '#fef9c3',
                                  borderLeft: '4px solid #facc15',
                                  borderRadius: '0 0.75rem 0.75rem 0',
                                  padding: '0.25rem 1rem',
                                  margin: '0.75rem 0',
                                  color: '#1a1a1a',
                                  fontSize: '0.95rem',
                                }}>
                                  💡 {children}
                                </div>
                              ),
                              code: ({ children }) => (
                                <code style={{ background: '#dbeafe', color: '#1e40af', padding: '0.1em 0.3em', borderRadius: '0.4rem', fontSize: '0.9rem', fontFamily: 'monospace' }}>
                                  {children}
                                </code>
                              ),
                            }}
                          >
                            {activeNote?.markdownContent}
                          </ReactMarkdown>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* History sidebar */}
        <aside className="bg-card/30 backdrop-blur-xl border border-border/50 rounded-[2.5rem] overflow-hidden flex flex-col shadow-2xl hidden xl:flex">
          <div className="p-6 border-b border-border/50 bg-muted/20">
            <h3 className="text-xs font-black uppercase tracking-widest text-primary">Asset Archive</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {history.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 opacity-20 text-center px-6">
                <History size={32} className="mb-2" />
                <p className="text-[10px] font-black uppercase tracking-widest">Archive Empty</p>
              </div>
            ) : history.map(item => (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                key={item.id}
                onClick={() => setActiveNote({
                  markdownContent: item.clean_content ?? item.markdown_content ?? '',
                  title: item.title ?? 'Untitled Note',
                })}
                className="w-full text-left p-4 rounded-[1.5rem] bg-card border border-border/50 hover:border-primary/30 hover:shadow-lg transition-all flex items-start gap-4 group"
              >
                <div className="w-14 h-14 rounded-xl bg-muted shrink-0 overflow-hidden border border-border/50 flex items-center justify-center text-xl shadow-inner group-hover:bg-primary/5 transition-colors">
                  {item.image_url
                    ? <img src={item.image_url} alt="" className="w-full h-full object-cover opacity-80" />
                    : <FileText size={24} className="text-muted-foreground" />
                  }
                </div>
                <div className="min-w-0 flex-1 py-1">
                  <p className="text-xs font-bold text-foreground truncate mb-1">
                    {item.title || 'Untitled Archive'}
                  </p>
                  <p className="text-[9px] text-muted-foreground font-black uppercase tracking-widest opacity-60">
                    {new Date(item.created_at).toLocaleDateString()}
                  </p>
                </div>
              </motion.button>
            ))}
          </div>
        </aside>
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;700&display=swap');
        .font-handwritten { font-family: 'Caveat', cursive; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #4b5563; }
      `}</style>
    </div>
  )
}
