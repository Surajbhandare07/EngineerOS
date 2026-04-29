'use client'

import { useState, useEffect } from 'react'
import { useLanguage } from '@/context/LanguageContext'
import { getUserTasks, updateTaskStatus } from '@/lib/actions/tasks'
import Spinner from '@/components/ui/Spinner'

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'completed';
  created_at: string;
}

export default function TasksPage() {
  const { language } = useLanguage()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTasks()
  }, [])

  const fetchTasks = async () => {
    setLoading(true)
    const res: any = await getUserTasks()
    if (res.success && res.data) {
      setTasks(res.data)
    }
    setLoading(false)
  }

  const handleToggleStatus = async (task: Task) => {
    const newStatus = task.status === 'pending' ? 'completed' : 'pending'
    
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t))
    
    const res: any = await updateTaskStatus(task.id, newStatus)
    if (!res.success) {
      // Revert if failed
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: task.status } : t))
      alert("Failed to update task status")
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-purple-400">Study Tasks</h1>
          <p className="text-gray-400">Track and manage your AI-generated study goals.</p>
        </div>
        <button 
          onClick={fetchTasks}
          className="text-sm px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded text-gray-300 border border-gray-700 transition-colors"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : tasks.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <div className="text-4xl mb-4">📋</div>
          <h3 className="text-xl font-semibold text-white mb-2">No tasks found</h3>
          <p className="text-gray-400">Generate a study plan in EngineerOS Chat to see your tasks here.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {tasks.map(task => (
            <div 
              key={task.id} 
              className={`bg-gray-900 border ${task.status === 'completed' ? 'border-green-900/50 bg-gray-950' : 'border-gray-800'} p-5 rounded-xl flex items-start gap-4 transition-all hover:border-purple-500/50`}
            >
              <button 
                onClick={() => handleToggleStatus(task)}
                className={`mt-1 w-6 h-6 rounded border flex items-center justify-center transition-colors ${task.status === 'completed' ? 'bg-green-600 border-green-600 text-white' : 'border-gray-600 hover:border-purple-500'}`}
              >
                {task.status === 'completed' && (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                )}
              </button>
              
              <div className="flex-1">
                <h3 className={`text-lg font-semibold ${task.status === 'completed' ? 'text-gray-500 line-through' : 'text-white'}`}>
                  {task.title}
                </h3>
                {task.description && (
                  <p className={`text-sm mt-1 ${task.status === 'completed' ? 'text-gray-600' : 'text-gray-400'}`}>
                    {task.description}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-3">
                  <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold tracking-wider ${task.status === 'completed' ? 'bg-green-900/30 text-green-500' : 'bg-purple-900/30 text-purple-400'}`}>
                    {task.status}
                  </span>
                  <span className="text-[10px] text-gray-600">
                    {new Date(task.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
