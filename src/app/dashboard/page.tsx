'use client'

import { useState, useEffect } from 'react'
import { useLanguage } from '@/context/LanguageContext'
import Link from 'next/link'
import { getUserTasks } from '@/lib/actions/tasks'
import { getUserDocuments } from '@/lib/actions/documents'
import Spinner from '@/components/ui/Spinner'

export default function DashboardPage() {
  const { language } = useLanguage()
  const [taskCount, setTaskCount] = useState(0)
  const [documents, setDocuments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      const [tasksRes, docsRes] = await Promise.all([
        getUserTasks(),
        getUserDocuments()
      ])
      
      if (tasksRes.success && tasksRes.data) {
        setTaskCount(tasksRes.data.filter((t: any) => t.status === 'pending').length)
      }
      
      if (docsRes.success && docsRes.data) {
        setDocuments(docsRes.data.slice(0, 3))
      }
      setLoading(false)
    }
    loadData()
  }, [])

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold mb-2">Welcome to EngineerOS</h1>
          <p className="text-lg text-gray-400">
            Your AI-powered study companion. Currently translating to: <strong className="text-purple-400">{language}</strong>
          </p>
        </div>
        
        {loading ? (
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <Spinner /> Loading stats...
          </div>
        ) : (
          <div className="flex gap-4">
            <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl min-w-[120px]">
              <div className="text-xs text-gray-500 uppercase font-bold mb-1">Pending Tasks</div>
              <div className="text-2xl font-bold text-purple-400">{taskCount}</div>
            </div>
            <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl min-w-[120px]">
              <div className="text-xs text-gray-500 uppercase font-bold mb-1">Documents</div>
              <div className="text-2xl font-bold text-white">{documents.length}</div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/dashboard/studydrive" className="block p-6 bg-gray-900 border border-gray-800 rounded-xl hover:border-purple-500 hover:shadow-[0_0_15px_rgba(108,99,255,0.2)] transition-all group">
          <div className="h-12 w-12 bg-purple-900/50 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <span className="text-2xl">📚</span>
          </div>
          <h2 className="text-xl font-semibold mb-2 text-white group-hover:text-purple-400 transition-colors">StudyDrive</h2>
          <p className="text-sm text-gray-400">Upload your PDFs and ask questions. Get answers powered by LLaMA 3 AI.</p>
        </Link>

        <Link href="/dashboard/viva-ai" className="block p-6 bg-gray-900 border border-gray-800 rounded-xl hover:border-purple-500 hover:shadow-[0_0_15px_rgba(108,99,255,0.2)] transition-all group">
          <div className="h-12 w-12 bg-purple-900/50 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <span className="text-2xl">🧑‍🏫</span>
          </div>
          <h2 className="text-xl font-semibold mb-2 text-white group-hover:text-purple-400 transition-colors">VivaAI</h2>
          <p className="text-sm text-gray-400">Practice viva questions with a strict AI professor. Voice-enabled feedback.</p>
        </Link>

        <Link href="/dashboard/preppilot" className="block p-6 bg-gray-900 border border-gray-800 rounded-xl hover:border-purple-500 hover:shadow-[0_0_15px_rgba(108,99,255,0.2)] transition-all group">
          <div className="h-12 w-12 bg-purple-900/50 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <span className="text-2xl">✈️</span>
          </div>
          <h2 className="text-xl font-semibold mb-2 text-white group-hover:text-purple-400 transition-colors">PrepPilot</h2>
          <p className="text-sm text-gray-400">Generate a structured 7-day study plan from your syllabus PDF.</p>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white">Recent Documents</h2>
            <Link href="/dashboard/studydrive" className="text-sm text-purple-400 hover:underline">View All</Link>
          </div>
          <div className="space-y-3">
            {loading ? (
               <div className="animate-pulse space-y-3">
                 {[1,2,3].map(i => <div key={i} className="h-12 bg-gray-800 rounded-lg"></div>)}
               </div>
            ) : documents.length === 0 ? (
              <p className="text-gray-500 text-sm">No documents uploaded yet.</p>
            ) : (
              documents.map(doc => (
                <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <span className="text-lg">📄</span>
                    <span className="text-sm text-gray-300 truncate">{doc.filename}</span>
                  </div>
                  <span className="text-[10px] text-gray-500">{new Date(doc.created_at).toLocaleDateString()}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
           <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white">Pending Tasks</h2>
            <Link href="/dashboard/tasks" className="text-sm text-purple-400 hover:underline">Manage Tasks</Link>
          </div>
          <div className="space-y-3">
             {loading ? (
                <div className="animate-pulse space-y-3">
                  {[1,2,3].map(i => <div key={i} className="h-12 bg-gray-800 rounded-lg"></div>)}
                </div>
             ) : taskCount === 0 ? (
               <p className="text-gray-500 text-sm">All clear! No pending tasks.</p>
             ) : (
               <div className="flex flex-col gap-2">
                 <p className="text-sm text-gray-400">You have <strong className="text-purple-400">{taskCount}</strong> items waiting on your study list.</p>
                 <Link href="/dashboard/tasks" className="mt-2 block w-full py-2 bg-purple-600/20 text-purple-400 text-center rounded-lg border border-purple-500/30 hover:bg-purple-600/30 transition-colors text-sm font-medium">
                   Start Studying Now
                 </Link>
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  )
}
