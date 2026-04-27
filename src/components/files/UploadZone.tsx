'use client'

import { Upload, FileUp, X } from 'lucide-react'
import { useState, useCallback } from 'react'

interface UploadZoneProps {
  onUpload: (files: FileList) => void
  isUploading: boolean
}

export default function UploadZone({ onUpload, isUploading }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUpload(e.dataTransfer.files)
    }
  }, [onUpload])

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        relative overflow-hidden group
        border-2 border-dashed rounded-[2.5rem] p-12 transition-all duration-500
        flex flex-col items-center justify-center gap-6
        ${isDragging 
          ? 'border-primary bg-primary/5 scale-[0.99] shadow-2xl shadow-primary/10' 
          : 'border-border/50 bg-muted/20 hover:border-border hover:bg-muted/30'
        }
        ${isUploading ? 'pointer-events-none opacity-50' : ''}
      `}
    >
      <div className={`
        w-20 h-20 rounded-[2rem] flex items-center justify-center transition-all duration-500
        ${isDragging ? 'bg-primary text-white rotate-12 scale-110 shadow-xl shadow-primary/20' : 'bg-card border border-border group-hover:scale-110 group-hover:rotate-6 shadow-md'}
      `}>
        {isUploading ? (
          <div className="w-8 h-8 border-4 border-muted-foreground/30 border-t-primary rounded-full animate-spin" />
        ) : (
          <FileUp size={32} className={isDragging ? 'text-white' : 'text-muted-foreground'} />
        )}
      </div>

      <div className="text-center space-y-2">
        <h3 className="text-lg font-black tracking-tight">
          {isUploading ? 'Transmitting Knowledge...' : isDragging ? 'Ready for Ingestion' : 'Drop Engineering Intel'}
        </h3>
        <p className="text-xs text-muted-foreground font-black uppercase tracking-[0.3em] opacity-60">
          PDF • Images • ZIP • DOCS
        </p>
      </div>

      <input 
        type="file" 
        multiple 
        onChange={(e) => e.target.files && onUpload(e.target.files)}
        className="absolute inset-0 opacity-0 cursor-pointer"
        disabled={isUploading}
      />
    </div>
  )
}
