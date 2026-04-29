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
      const [tasksRes, docsRes]: [any, any] = await Promise.all([
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
          <h1 className="text-4xl font-bold mb-2 text-foreground tracking-tight">Welcome to EngineerOS</h1>
          <p className="text-lg text-muted-foreground font-medium">
            Your AI-powered study companion. Currently translating to: <strong className="text-purple-600 dark:text-purple-400">{language}</strong>
          </p>
        </div>
        
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Spinner /> Loading stats...
          </div>
        ) : (
          <div className="flex gap-4">
            <div className="bg-card border border-border p-5 rounded-[1.5rem] min-w-[140px] shadow-sm">
              <div className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-2">Pending Tasks</div>
              <div className="text-3xl font-black text-purple-600 dark:text-purple-400 tracking-tighter">{taskCount}</div>
            </div>
            <div className="bg-card border border-border p-5 rounded-[1.5rem] min-w-[140px] shadow-sm">
              <div className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-2">Documents</div>
              <div className="text-3xl font-black text-foreground tracking-tighter">{documents.length}</div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/dashboard/preppilot" className="block p-8 bg-card border border-border rounded-[2rem] hover:border-purple-500 hover:shadow-[0_20px_40px_-15px_rgba(108,99,255,0.1)] transition-all group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 blur-3xl -mr-16 -mt-16 group-hover:bg-purple-500/10 transition-colors" />
          <div className="h-14 w-14 bg-purple-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
            <span className="text-3xl">🧠</span>
          </div>
          <h2 className="text-xl font-bold mb-3 text-foreground group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">EngineerOS Chat</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">Multimodal AI Workspace. Upload PDFs, Images, or just chat to solve complex engineering problems.</p>
        </Link>

        <Link href="/dashboard/viva-ai" className="block p-8 bg-card border border-border rounded-[2rem] hover:border-blue-500 hover:shadow-[0_20px_40px_-15px_rgba(59,130,246,0.1)] transition-all group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl -mr-16 -mt-16 group-hover:bg-blue-500/10 transition-colors" />
          <div className="h-14 w-14 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:-rotate-3 transition-all duration-500">
            <span className="text-3xl">🧑‍🏫</span>
          </div>
          <h2 className="text-xl font-bold mb-3 text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">VivaAI</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">Practice viva questions with a strict AI professor. Voice-enabled feedback and real-time evaluation.</p>
        </Link>

        <Link href="/dashboard/cgpa-predictor" className="block p-8 bg-card border border-border rounded-[2rem] hover:border-amber-500 hover:shadow-[0_20px_40px_-15px_rgba(245,158,11,0.1)] transition-all group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-3xl -mr-16 -mt-16 group-hover:bg-amber-500/10 transition-colors" />
          <div className="h-14 w-14 bg-amber-500/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
            <span className="text-3xl">📊</span>
          </div>
          <h2 className="text-xl font-bold mb-3 text-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">CGPA Predictor</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">Track your grades and predict your future CGPA with smart academic analytics and goal setting.</p>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-card border border-border rounded-[2rem] p-8 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-foreground tracking-tight">Recent Documents</h2>
            <Link href="/dashboard/smart-notes" className="text-sm font-bold text-purple-600 dark:text-purple-400 hover:opacity-80 transition-opacity">View All</Link>
          </div>
          <div className="space-y-4">
            {loading ? (
               <div className="animate-pulse space-y-4">
                 {[1,2,3].map(i => <div key={i} className="h-16 bg-muted rounded-2xl"></div>)}
               </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-12 bg-muted/30 rounded-2xl border border-dashed border-border">
                <p className="text-muted-foreground text-sm font-medium">No documents uploaded yet.</p>
              </div>
            ) : (
              documents.map(doc => (
                <div key={doc.id} className="flex items-center justify-between p-4 bg-muted/20 hover:bg-muted/40 transition-colors rounded-2xl border border-border group cursor-pointer">
                  <div className="flex items-center gap-4 overflow-hidden">
                    <div className="w-10 h-10 bg-background rounded-xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                      <span className="text-xl">📄</span>
                    </div>
                    <span className="text-sm font-semibold text-foreground truncate">{doc.filename}</span>
                  </div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{new Date(doc.created_at).toLocaleDateString()}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-card border border-border rounded-[2rem] p-8 shadow-sm">
           <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-foreground tracking-tight">Pending Tasks</h2>
            <Link href="/dashboard/tasks" className="text-sm font-bold text-purple-600 dark:text-purple-400 hover:opacity-80 transition-opacity">Manage Tasks</Link>
          </div>
          <div className="space-y-4">
             {loading ? (
                <div className="animate-pulse space-y-4">
                  {[1,2,3].map(i => <div key={i} className="h-16 bg-muted rounded-2xl"></div>)}
                </div>
             ) : taskCount === 0 ? (
               <div className="text-center py-12 bg-muted/30 rounded-2xl border border-dashed border-border">
                 <p className="text-muted-foreground text-sm font-medium">All clear! No pending tasks.</p>
               </div>
             ) : (
               <div className="flex flex-col gap-4">
                 <p className="text-muted-foreground leading-relaxed font-medium">You have <strong className="text-purple-600 dark:text-purple-400">{taskCount}</strong> items waiting on your study list. Ready to conquer them?</p>
                 <Link href="/dashboard/tasks" className="mt-2 block w-full py-4 bg-purple-600 text-white text-center rounded-2xl hover:bg-purple-700 transition-all font-bold text-sm shadow-lg shadow-purple-500/20 active:scale-[0.98]">
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
