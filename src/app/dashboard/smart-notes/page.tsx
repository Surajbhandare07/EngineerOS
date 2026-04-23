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

        // Compress images
        if (!item.isPdf) {
          try {
            compressedFile = await imageCompression(item.file, {
              maxSizeMB: 2, // Allow slightly better quality
              maxWidthOrHeight: 1600,
              useWebWorker: true,
            })
          } catch { /* keep original */ }

          if (compressedFile.size > 19 * 1024 * 1024) throw new Error('Image too large (max 20 MB)')
        }

        const formData = new FormData()
        formData.append('file', compressedFile)

        const res = item.isPdf
          ? await generateNotesFromPDF(formData)
          : await generateNotesFromImage(formData)

        if (!res.success || !res.markdownContent) throw new Error(res.error ?? 'Unknown error')

        lastResult = { 
          markdownContent: res.markdownContent, 
          title: res.title ?? 'Untitled Note', 
          publicUrl: 'publicUrl' in res ? (res.publicUrl as string) : undefined 
        }

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
    <div className="max-w-[1600px] w-full mx-auto h-[calc(100vh-8rem)] flex flex-col">

      {/* filename modal */}
      {showFilenameModal && (
        <FilenameModal
          defaultName={activeNote?.title ?? 'Digital Notes'}
          onConfirm={handleDownloadConfirm}
          onCancel={() => setShowFilenameModal(false)}
        />
      )}

      {/* ── Header ── */}
      <div className="mb-5 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold mb-1 text-purple-400">📓 Digital Notebook</h1>
          <p className="text-gray-400 text-sm">Upload up to 10 images or PDFs → AI generates beautiful notes → Download as PDF</p>
        </div>
        <div className="flex gap-3 items-center">
          {activeNote && (
            <button
              onClick={handleDownloadClick}
              disabled={isDownloading}
              className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow-lg flex items-center gap-2 transition-colors"
            >
              {isDownloading ? <><Spinner /> Preparing…</> : '📄 Download PDF'}
            </button>
          )}
          {(hasQueue || activeNote) && (
            <button
              onClick={resetAll}
              className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-sm font-medium transition-colors"
            >
              + New Session
            </button>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex gap-5 flex-1 min-h-0">

        {/* Main area */}
        <div className="flex-1 flex flex-col min-h-0 bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-lg">

          {!hasQueue && !activeNote ? (

            /* ── Upload zone ── */
            <div
              className="flex-1 flex flex-col items-center justify-center p-8 m-6 border-2 border-dashed border-gray-700 rounded-xl hover:border-purple-500 hover:bg-gray-800/40 transition-all cursor-pointer group"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="w-20 h-20 bg-gray-800 group-hover:bg-purple-900/40 rounded-full flex items-center justify-center mb-5 transition-colors">
                <span className="text-4xl">✍️</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Upload Notes or PDFs</h3>
              <p className="text-gray-400 text-sm mb-3 max-w-md text-center">
                Select up to <span className="text-purple-400 font-semibold">10 files</span> (images or PDFs). AI will transcribe and structure them into beautiful notebook pages.
              </p>
              <p className="text-gray-600 text-xs mb-7">Supports .jpg .png .jpeg .pdf</p>
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,application/pdf"
                multiple
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileSelect}
              />
              <button className="px-8 py-3 bg-purple-600 hover:bg-purple-500 rounded-xl text-white font-semibold transition-colors shadow-lg shadow-purple-500/20">
                Select Files
              </button>
            </div>

          ) : (

            /* ── Working view ── */
            <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">

              {/* Left: file queue (fixed width) */}
              <div className="lg:w-72 shrink-0 border-b lg:border-b-0 lg:border-r border-gray-800 bg-gray-950 p-4 flex flex-col gap-3 overflow-y-auto notebook-scrollbar">
                <div className="flex items-center justify-between shrink-0">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Files ({queue.length}/10)
                  </h3>
                  {queue.length < 10 && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                    >
                      + Add more
                    </button>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,application/pdf"
                  multiple
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                />

                {/* File thumbnails */}
                <div className="flex flex-col gap-2">
                  {queue.map(item => (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border transition-colors ${
                        item.status === 'processing' ? 'border-purple-500 bg-purple-900/20'
                        : item.status === 'done'       ? 'border-green-700 bg-green-900/20'
                        : item.status === 'error'      ? 'border-red-700 bg-red-900/20'
                        : 'border-gray-800 bg-gray-900'
                      }`}
                    >
                      {/* Thumbnail */}
                      <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-gray-800 border border-gray-700 flex items-center justify-center text-lg">
                        {item.previewUrl
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={item.previewUrl} alt="" className="w-full h-full object-cover" />
                          : <span>📄</span>
                        }
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-200 truncate font-medium">{item.file.name}</p>
                        <p className={`text-xs mt-0.5 ${
                          item.status === 'processing' ? 'text-purple-400 animate-pulse'
                          : item.status === 'done'     ? 'text-green-400'
                          : item.status === 'error'    ? item.error?.startsWith('SCANNED_PDF')
                              ? 'text-amber-400'
                              : 'text-red-400'
                          : 'text-gray-500'
                        }`}>
                          {item.status === 'processing' ? '⏳ Uploading & Processing…'
                           : item.status === 'done'     ? '✅ Done'
                           : item.status === 'error'    
                             ? item.error?.startsWith('SCANNED_PDF')
                               ? '📸 Scanned PDF — upload as image'
                               : `❌ ${item.error ?? 'Error'}`
                           : item.isPdf               ? '📄 PDF'
                           : '🖼️ Image'
                          }
                        </p>
                      </div>

                      {/* Remove (only pending) */}
                      {item.status === 'pending' && (
                        <button onClick={() => removeFile(item.id)} className="text-gray-600 hover:text-red-400 transition-colors text-lg shrink-0">×</button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Generate button */}
                {hasPending && !processing && (
                  <button
                    onClick={processQueue}
                    className="mt-2 w-full py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-semibold transition-colors shadow-lg"
                  >
                    ✨ Generate Notes ({queue.filter(q => q.status === 'pending').length} file{queue.filter(q => q.status === 'pending').length > 1 ? 's' : ''})
                  </button>
                )}

                {processing && (
                  <div className="mt-2 flex items-center justify-center gap-2 py-3 text-purple-400 text-sm font-medium">
                    <Spinner /> Uploading & Generating…
                  </div>
                )}

                {allDone && !processing && !hasPending && (
                  <p className="text-center text-green-400 text-xs mt-2 font-medium">
                    ✅ All files processed!
                  </p>
                )}
              </div>

              {/* Right: Notebook canvas */}
              <div className="flex-1 flex flex-col min-h-0 bg-gray-800">
                <div className="flex-1 overflow-y-auto notebook-scrollbar">
                  {!activeNote && !processing && (
                    <div className="flex flex-col items-center justify-center h-64 gap-2 text-center px-8">
                      <span className="text-4xl">👈</span>
                      <p className="text-gray-400 text-sm">Select files and click <span className="text-purple-400 font-semibold">Generate Notes</span></p>
                    </div>
                  )}

                  {processing && !activeNote && (
                    <div className="flex flex-col items-center justify-center h-64 gap-3">
                      <Spinner />
                      <p className="text-purple-400 font-semibold animate-pulse text-lg">Uploading & Transcribing your notes…</p>
                      <p className="text-gray-500 text-sm">Please wait, AI is generating your digital notebook.</p>
                    </div>
                  )}

                  {activeNote && (
                    /*
                      ┌─────────────────────────────────────┐
                      │   A4 DIGITAL NOTEBOOK PAPER          │
                      │   - Warm cream background            │
                      │   - Horizontal ruled lines           │
                      │   - Red left margin                  │
                      │   - Caveat handwriting font          │
                      └─────────────────────────────────────┘
                    */
                    <div
                      id="notebook-paper"
                      className="min-h-[80vh] w-full font-caveat"
                      style={{
                        backgroundColor: '#fffdf5',
                        color: '#1a1a1a',
                        padding: '1.5rem 2.5rem 2rem 4rem',
                        backgroundImage: `
                          linear-gradient(90deg, transparent 52px, #f87171 52px, #f87171 54px, transparent 54px),
                          linear-gradient(#e2e8f0 1px, transparent 1px)
                        `,
                        backgroundSize: '100% 1.75rem',
                        lineHeight: '1.75rem',
                      }}
                    >
                      <div
                        className="prose max-w-none"
                        style={{ fontFamily: 'Caveat, cursive', color: '#1a1a1a', fontSize: '1.05rem', lineHeight: '1.75rem' }}
                      >
                        <ReactMarkdown
                          components={{
                            h1: ({ children }) => (
                              <h1 className="flex items-center gap-1.5 font-bold" style={{ fontSize: '1.55rem', lineHeight: '1.75rem', color: '#1e1b4b', margin: '1.75rem 0 0.35rem' }}>
                                📌 {children}
                              </h1>
                            ),
                            h2: ({ children }) => (
                              <h2 className="flex items-center gap-1.5 font-bold" style={{ fontSize: '1.3rem', lineHeight: '1.75rem', color: '#312e81', margin: '1.4rem 0 0.2rem' }}>
                                📝 {children}
                              </h2>
                            ),
                            h3: ({ children }) => (
                              <h3 className="flex items-center gap-1 font-semibold" style={{ fontSize: '1.15rem', lineHeight: '1.75rem', color: '#3730a3', margin: '0.875rem 0 0.1rem' }}>
                                🔹 {children}
                              </h3>
                            ),
                            h4: ({ children }) => (
                              <h4 className="font-semibold" style={{ fontSize: '1.05rem', lineHeight: '1.75rem', color: '#4338ca', margin: '0.5rem 0 0' }}>
                                ▸ {children}
                              </h4>
                            ),
                            p: ({ children }) => (
                              <p style={{ margin: '0', lineHeight: '1.75rem', fontSize: '1.05rem', color: '#1a1a1a' }}>{children}</p>
                            ),
                            ul: ({ children }) => (
                              <ul style={{ paddingLeft: '1.25rem', margin: '0' }}>{children}</ul>
                            ),
                            ol: ({ children }) => (
                              <ol style={{ paddingLeft: '1.25rem', margin: '0' }}>{children}</ol>
                            ),
                            li: ({ children }) => (
                              <li style={{ lineHeight: '1.75rem', color: '#1a1a1a', listStyleType: 'disc', marginBottom: 0, fontSize: '1.05rem' }}>
                                {children}
                              </li>
                            ),
                            strong: ({ children }) => (
                              <strong style={{ color: '#1e1b4b', fontWeight: 700 }}>{children}</strong>
                            ),
                            blockquote: ({ children }) => (
                              <div style={{
                                background: '#fef9c3',
                                borderLeft: '5px solid #facc15',
                                borderRadius: '0 8px 8px 0',
                                padding: '0.25rem 1rem',
                                margin: '0.5rem 0',
                                lineHeight: '1.75rem',
                                fontSize: '1rem',
                                color: '#1a1a1a',
                              }}>
                                💡 {children}
                              </div>
                            ),
                            code: ({ children }) => (
                              <code style={{ background: '#dbeafe', color: '#1e40af', padding: '0.05em 0.3em', borderRadius: '4px', fontSize: '0.95rem', fontFamily: 'monospace' }}>
                                {children}
                              </code>
                            ),
                          }}
                        >
                          {activeNote.markdownContent}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── History sidebar ── */}
        <aside className="w-72 shrink-0 bg-gray-900 border border-gray-800 rounded-2xl flex flex-col shadow-lg overflow-hidden hidden xl:flex">
          <div className="p-5 border-b border-gray-800">
            <h3 className="font-bold text-white text-sm">Notebook Pages</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 notebook-scrollbar">
            {history.length === 0 ? (
              <p className="text-xs text-gray-500 text-center mt-10 px-4">No pages yet.</p>
            ) : history.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveNote({
                  markdownContent: item.clean_content ?? item.markdown_content ?? '',
                  title: item.title ?? 'Untitled Note',
                })}
                className="w-full text-left p-3 rounded-xl hover:bg-gray-800 transition-colors border border-transparent hover:border-gray-700 flex items-start gap-3"
              >
                <div className="w-12 h-12 rounded-lg bg-gray-800 shrink-0 overflow-hidden border border-gray-700 flex items-center justify-center text-xl">
                  {item.image_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={item.image_url} alt="" className="w-full h-full object-cover opacity-80" />
                    : '📄'
                  }
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-200 truncate">
                    {item.title || (item.clean_content ?? '').split('\n').find((l: string) => l.trim())?.replace(/^#+\s*/, '') || 'Untitled Note'}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(item.created_at).toLocaleDateString()}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </aside>

      </div>

      <style jsx global>{`
        .notebook-scrollbar::-webkit-scrollbar { width: 6px; }
        .notebook-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .notebook-scrollbar::-webkit-scrollbar-thumb { background: #374151; border-radius: 10px; }
        .notebook-scrollbar::-webkit-scrollbar-thumb:hover { background: #4b5563; }
      `}</style>
    </div>
  )
}
