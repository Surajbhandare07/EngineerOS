'use client'

import { useState, useRef } from 'react'
import { useLanguage } from '@/context/LanguageContext'
import { extractTextFromPDF } from '@/lib/actions/documents'
import { askStudyDriveQuestion } from '@/lib/actions/ai'
import { ChatMessage } from '@/types'
import Spinner from '@/components/ui/Spinner'

export default function StudyDrivePage() {
  const { language } = useLanguage()
  const [file, setFile] = useState<File | null>(null)
  const [documentText, setDocumentText] = useState('')
  const [uploading, setUploading] = useState(false)
  
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loadingMsg, setLoadingMsg] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return
    
    setFile(selectedFile)
    setUploading(true)
    setDocumentText('')
    setMessages([])
    
    const formData = new FormData()
    formData.append('file', selectedFile)

    const res = await extractTextFromPDF(formData)
    
    if (res.success && res.data) {
      console.log("Extracted Text:", res.data)
      setDocumentText(res.data)
      setMessages([{ role: 'model', content: `I have successfully read **${selectedFile.name}**. What would you like to know about it?` }])
    } else {
      setMessages([{ role: 'model', content: `Failed to read PDF: ${res.error}` }])
    }
    
    setUploading(false)
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !documentText) return

    const userMsg: ChatMessage = { role: 'user', content: input }
    const newMessages = [...messages, userMsg]
    
    setMessages(newMessages)
    setInput('')
    setLoadingMsg(true)

    const res = await askStudyDriveQuestion(documentText, userMsg.content, language, messages)
    
    if (res.success && res.data) {
      setMessages([...newMessages, { role: 'model', content: res.data }])
    } else {
      setMessages([...newMessages, { role: 'model', content: `⚠️ Error: ${res.error}` }])
    }
    
    setLoadingMsg(false)
  }

  return (
    <div className="max-w-5xl mx-auto h-[calc(100vh-8rem)] flex flex-col">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 text-purple-400">StudyDrive</h1>
        <p className="text-gray-400">Upload your PDF syllabus or notes and ask questions based entirely on their content in {language}.</p>
      </div>
      
      {!documentText && !uploading ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 flex flex-col items-center justify-center flex-1 border-dashed shadow-lg cursor-pointer hover:border-purple-500 transition-colors" onClick={() => fileInputRef.current?.click()}>
          <div className="text-center">
            <div className="w-16 h-16 bg-purple-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
               <span className="text-2xl">📄</span>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Upload a PDF</h3>
            <p className="text-gray-400 text-sm mb-6">Click here to browse your device</p>
            <input 
              type="file" 
              accept="application/pdf" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            <button className="px-6 py-2 bg-purple-600 hover:bg-purple-700 transition-colors rounded text-white font-medium">
              Select File
            </button>
          </div>
        </div>
      ) : uploading ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 flex flex-col items-center justify-center flex-1 shadow-lg">
          <Spinner />
          <p className="mt-4 text-purple-400 font-medium animate-pulse">Extracting text from {file?.name}...</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col bg-gray-900 rounded-xl border border-gray-800 overflow-hidden shadow-lg">
          <div className="p-4 border-b border-gray-800 bg-gray-950 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <span className="text-xl">📄</span>
              <span className="font-semibold text-purple-400 truncate max-w-[200px] sm:max-w-[400px]">{file?.name}</span>
            </div>
            <button 
              onClick={() => {
                setDocumentText('')
                setFile(null)
                setMessages([])
              }} 
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Upload Another
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-4 rounded-xl ${msg.role === 'user' ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-200 border border-gray-700'}`}>
                  {msg.role === 'model' && <div className="text-xs text-purple-400 mb-1 font-bold">Study Assistant</div>}
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              </div>
            ))}
            {loadingMsg && (
              <div className="flex justify-start">
                <div className="bg-gray-800 border border-gray-700 p-4 rounded-xl">
                  <Spinner />
                </div>
              </div>
            )}
          </div>
          
          <div className="p-4 bg-gray-950 border-t border-gray-800">
            <form onSubmit={handleSend} className="flex gap-2">
              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question about your document..."
                className="flex-1 p-3 bg-gray-800 border border-gray-700 rounded text-white focus:ring-2 focus:ring-purple-600 focus:outline-none"
                disabled={loadingMsg}
              />
              <button 
                type="submit"
                disabled={!input.trim() || loadingMsg}
                className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded text-white font-bold transition-colors disabled:opacity-50"
              >
                Ask
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
