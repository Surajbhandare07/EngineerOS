'use client'

import { useState, useEffect, useOptimistic, useTransition } from 'react'
import { 
  Plus, 
  Search, 
  FolderPlus, 
  Upload as UploadIcon,
  X,
  Copy,
  Check,
  Link as LinkIcon
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Breadcrumbs from '@/components/files/Breadcrumbs'
import FileTable from '@/components/files/FileTable'
import UploadZone from '@/components/files/UploadZone'
import { 
  getFilesAndFolders, 
  createFolder, 
  deleteItem, 
  toggleShare, 
  getBreadcrumbs,
  uploadFile
} from '@/lib/actions/files'
import Spinner from '@/components/ui/Spinner'

export default function FileManagerPage() {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [folders, setFolders] = useState<any[]>([])
  const [documents, setDocuments] = useState<any[]>([])
  const [breadcrumbs, setBreadcrumbs] = useState<any[]>([{ id: null, name: 'Home' }])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [showNewFolderModal, setShowNewFolderModal] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [shareModalDoc, setShareModalDoc] = useState<any>(null)
  const [copied, setCopied] = useState(false)

  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    fetchData()
  }, [currentFolderId])

  const fetchData = async () => {
    setLoading(true)
    const [filesRes, breadRes] = await Promise.all([
      getFilesAndFolders(currentFolderId),
      getBreadcrumbs(currentFolderId)
    ])

    if (filesRes.success) {
      setFolders(filesRes.folders || [])
      setDocuments(filesRes.documents || [])
    }
    setBreadcrumbs(breadRes)
    setLoading(false)
  }

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFolderName.trim()) return

    setShowNewFolderModal(false)
    const res = await createFolder(newFolderName, currentFolderId)
    if (res.success) {
      setFolders(prev => [...prev, res.folder])
      setNewFolderName('')
    }
  }

  const handleDelete = async (id: string, type: 'file' | 'folder') => {
    const res = await deleteItem(id, type)
    if (res.success) {
      if (type === 'file') setDocuments(prev => prev.filter(d => d.id !== id))
      else setFolders(prev => prev.filter(f => f.id !== id))
    }
  }

  const handleUpload = async (fileList: FileList) => {
    setIsUploading(true)
    for (let i = 0; i < fileList.length; i++) {
      const formData = new FormData()
      formData.append('file', fileList[i])
      const res = await uploadFile(formData, currentFolderId)
      if (res.success) {
        setDocuments(prev => [...prev, res.document])
      }
    }
    setIsUploading(false)
  }

  const handleToggleShare = async (doc: any) => {
    const newStatus = !doc.is_public
    const res = await toggleShare(doc.id, newStatus)
    if (res.success) {
      setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, is_public: newStatus } : d))
      if (shareModalDoc?.id === doc.id) {
        setShareModalDoc({ ...shareModalDoc, is_public: newStatus })
      }
    }
  }

  const copyToClipboard = (token: string) => {
    const url = `${window.location.origin}/share/${token}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const filteredFolders = folders.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
  const filteredDocs = documents.filter(d => d.filename.toLowerCase().includes(searchQuery.toLowerCase()))

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div className="space-y-1">
          <h1 className="text-4xl font-black tracking-tighter italic">Engineer<span className="text-primary">Drive</span></h1>
          <p className="text-sm text-muted-foreground font-medium opacity-60">Manage your technical assets with precision.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="Locate intelligence..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-12 pr-6 py-3 bg-muted/40 border border-border/50 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-primary/5 focus:border-primary focus:outline-none transition-all w-64 shadow-inner"
            />
          </div>
          <button 
            onClick={() => setShowNewFolderModal(true)}
            className="p-3 bg-card border border-border/50 hover:border-primary hover:text-primary rounded-2xl transition-all shadow-md active:scale-95"
            title="New Folder"
          >
            <FolderPlus size={20} />
          </button>
        </div>
      </div>

      <Breadcrumbs items={breadcrumbs} onNavigate={setCurrentFolderId} />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-10 items-start">
        <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-[2.5rem] overflow-hidden shadow-2xl">
          {loading ? (
            <div className="py-40 flex flex-col items-center justify-center gap-4">
              <Spinner />
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary animate-pulse">Syncing Drive Core...</p>
            </div>
          ) : (
            <FileTable 
              folders={filteredFolders} 
              documents={filteredDocs} 
              onOpenFolder={setCurrentFolderId}
              onDelete={handleDelete}
              onShare={setShareModalDoc}
            />
          )}
        </div>

        <div className="space-y-8 sticky top-8">
          <UploadZone onUpload={handleUpload} isUploading={isUploading} />
          
          <div className="p-8 bg-primary/5 border border-primary/10 rounded-[2.5rem] space-y-4">
            <h4 className="text-xs font-black uppercase tracking-widest text-primary">System Stats</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-card rounded-2xl border border-border/50">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Total Items</p>
                <p className="text-2xl font-black italic">{(folders.length + documents.length).toString().padStart(2, '0')}</p>
              </div>
              <div className="p-4 bg-card rounded-2xl border border-border/50">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Public Files</p>
                <p className="text-2xl font-black italic text-primary">{documents.filter(d => d.is_public).length.toString().padStart(2, '0')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* New Folder Modal */}
      <AnimatePresence>
        {showNewFolderModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNewFolderModal(false)}
              className="absolute inset-0 bg-background/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-card border-2 border-border p-10 rounded-[3rem] shadow-2xl"
            >
              <h3 className="text-2xl font-black tracking-tighter mb-8 italic">Create <span className="text-primary">Intelligence Hub</span></h3>
              <form onSubmit={handleCreateFolder} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Folder Name</label>
                  <input 
                    autoFocus
                    type="text" 
                    value={newFolderName}
                    onChange={e => setNewFolderName(e.target.value)}
                    placeholder="e.g. Semester 4 - Maths"
                    className="w-full px-6 py-4 bg-muted/40 border border-border rounded-2xl font-bold focus:ring-4 focus:ring-primary/5 focus:border-primary focus:outline-none transition-all"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button 
                    type="button" 
                    onClick={() => setShowNewFolderModal(false)}
                    className="flex-1 py-4 text-xs font-black uppercase tracking-widest hover:bg-muted rounded-2xl transition-all"
                  >
                    Abort
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-4 bg-primary text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/20 active:scale-95 transition-all"
                  >
                    Initialize
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Share Modal */}
      <AnimatePresence>
        {shareModalDoc && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShareModalDoc(null)}
              className="absolute inset-0 bg-background/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-card border-2 border-border p-10 rounded-[3rem] shadow-2xl"
            >
              <div className="flex justify-between items-start mb-8">
                <div className="space-y-1">
                  <h3 className="text-2xl font-black tracking-tighter italic">Share <span className="text-primary">Asset</span></h3>
                  <p className="text-xs text-muted-foreground font-bold">{shareModalDoc.filename}</p>
                </div>
                <button onClick={() => setShareModalDoc(null)} className="p-2 hover:bg-muted rounded-xl transition-all">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-8">
                <div className="flex items-center justify-between p-6 bg-muted/30 border border-border/50 rounded-[2rem]">
                  <div className="space-y-1">
                    <p className="text-sm font-bold">Public Accessibility</p>
                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest opacity-60">Anyone with the link can view</p>
                  </div>
                  <button 
                    onClick={() => handleToggleShare(shareModalDoc)}
                    className={`w-14 h-8 rounded-full p-1 transition-all duration-300 flex items-center ${shareModalDoc.is_public ? 'bg-primary' : 'bg-muted-foreground/20'}`}
                  >
                    <motion.div 
                      layout
                      className="w-6 h-6 bg-white rounded-full shadow-lg"
                      animate={{ x: shareModalDoc.is_public ? 24 : 0 }}
                    />
                  </button>
                </div>

                {shareModalDoc.is_public && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    <div className="relative group">
                      <input 
                        readOnly
                        value={`${window.location.origin}/share/${shareModalDoc.share_token}`}
                        className="w-full pl-6 pr-16 py-4 bg-muted/40 border border-border rounded-2xl font-mono text-[10px] text-muted-foreground"
                      />
                      <button 
                        onClick={() => copyToClipboard(shareModalDoc.share_token)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-card border border-border rounded-xl hover:text-primary transition-all shadow-sm active:scale-90"
                      >
                        {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                      </button>
                    </div>
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-center text-muted-foreground opacity-40 italic">Link is encrypted and secure</p>
                  </motion.div>
                )}
              </div>

              <div className="pt-8">
                <button 
                  onClick={() => setShareModalDoc(null)}
                  className="w-full py-4 text-xs font-black uppercase tracking-widest hover:bg-muted rounded-2xl transition-all border border-border/50"
                >
                  Close Access Protocol
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
