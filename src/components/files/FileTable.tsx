'use client'

import { 
  FileText, 
  Folder, 
  MoreHorizontal, 
  Share2, 
  Trash2, 
  ExternalLink, 
  FileImage,
  FileCode
} from 'lucide-react'
import { motion } from 'framer-motion'

interface FileTableProps {
  folders: any[]
  documents: any[]
  onOpenFolder: (id: string) => void
  onDelete: (id: string, type: 'file' | 'folder') => void
  onShare: (doc: any) => void
}

export default function FileTable({ folders, documents, onOpenFolder, onDelete, onShare }: FileTableProps) {
  const getItemIcon = (type: string) => {
    if (type === 'folder') return <Folder className="text-yellow-500 fill-yellow-500/10" size={20} />
    if (type.includes('pdf')) return <FileText className="text-red-500" size={20} />
    if (type.includes('image')) return <FileImage className="text-blue-500" size={20} />
    return <FileCode className="text-purple-500" size={20} />
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  return (
    <div className="w-full">
      <div className="grid grid-cols-[1fr_150px_150px_100px] gap-4 px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground border-b border-border/50">
        <div>Name</div>
        <div>Date Modified</div>
        <div>Status</div>
        <div className="text-right">Actions</div>
      </div>

      <div className="divide-y divide-border/30">
        {folders.map(folder => (
          <motion.div 
            key={folder.id}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => onOpenFolder(folder.id)}
            className="grid grid-cols-[1fr_150px_150px_100px] gap-4 px-4 py-4 hover:bg-muted/30 transition-all cursor-pointer group items-center"
          >
            <div className="flex items-center gap-3">
              {getItemIcon('folder')}
              <span className="text-sm font-bold truncate group-hover:text-primary transition-colors">{folder.name}</span>
            </div>
            <div className="text-xs text-muted-foreground">{formatDate(folder.created_at)}</div>
            <div className="text-[10px] font-black uppercase tracking-widest opacity-40">—</div>
            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={(e) => { e.stopPropagation(); onDelete(folder.id, 'folder') }}
                className="p-1.5 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 rounded-lg transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </motion.div>
        ))}

        {documents.map(doc => (
          <motion.div 
            key={doc.id}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-[1fr_150px_150px_100px] gap-4 px-4 py-4 hover:bg-muted/30 transition-all group items-center"
          >
            <div className="flex items-center gap-3">
              {getItemIcon(doc.document_type)}
              <span className="text-sm font-bold truncate">{doc.filename}</span>
            </div>
            <div className="text-xs text-muted-foreground">{formatDate(doc.created_at)}</div>
            <div className="flex items-center gap-2">
              {doc.is_public ? (
                <span className="px-2 py-0.5 bg-green-500/10 text-green-500 text-[9px] font-black uppercase tracking-widest rounded-full border border-green-500/20">Public</span>
              ) : (
                <span className="px-2 py-0.5 bg-muted text-muted-foreground text-[9px] font-black uppercase tracking-widest rounded-full border border-border">Private</span>
              )}
            </div>
            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={() => onShare(doc)}
                className="p-1.5 hover:bg-primary/10 text-muted-foreground hover:text-primary rounded-lg transition-colors"
                title="Share"
              >
                <Share2 size={14} />
              </button>
              <button 
                onClick={() => onDelete(doc.id, 'file')}
                className="p-1.5 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 rounded-lg transition-colors"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </motion.div>
        ))}

        {folders.length === 0 && documents.length === 0 && (
          <div className="py-20 text-center">
            <Folder className="mx-auto text-muted-foreground/20 mb-4" size={48} />
            <p className="text-sm text-muted-foreground font-medium">This folder is empty.</p>
            <p className="text-xs text-muted-foreground/60 mt-1 uppercase tracking-widest font-black">Drop files here to upload</p>
          </div>
        )}
      </div>
    </div>
  )
}
