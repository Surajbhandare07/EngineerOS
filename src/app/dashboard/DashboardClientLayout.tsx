'use client'

import { useState, useEffect, useRef } from 'react'
import { LanguageProvider } from '@/context/LanguageContext'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getNotifications, markNotificationAsRead } from '@/lib/actions/notifications'

import { 
  Home, 
  MessageSquare, 
  FolderRoot, 
  TrendingUp, 
  Users, 
  Settings, 
  LogOut,
  GraduationCap,
  Notebook
} from 'lucide-react'

function BellIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  )
}

export default function DashboardClientLayout({
  children,
  initialProfile
}: {
  children: React.ReactNode,
  initialProfile: any
}) {
  const router = useRouter()
  const supabase = createClient()
  
  const [notifications, setNotifications] = useState<any[]>([])
  const [showNotifications, setShowNotifications] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchNotifications()
    
    // Close dropdown on click outside
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowNotifications(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const fetchNotifications = async () => {
    const res: any = await getNotifications()
    if (res.success) {
      setNotifications(res.data || [])
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleNotificationClick = async (notif: any) => {
    if (!notif.is_read) {
      await markNotificationAsRead(notif.id)
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n))
    }
  }

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <LanguageProvider>
      <div className="flex h-screen bg-background text-foreground transition-colors duration-300">
        {/* Sidebar */}
        <div className="w-64 bg-card border-r border-border flex flex-col shadow-2xl">
          <div className="p-8 border-b border-border">
            <h1 className="text-2xl font-black text-primary italic tracking-tighter">Engineer<span className="text-foreground">OS</span></h1>
          </div>
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            <Link href="/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-muted transition-all group hover:scale-[1.02] active:scale-95">
              <Home size={18} className="text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="font-medium text-sm">Home</span>
            </Link>
            <Link href="/dashboard/viva-ai" className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-muted transition-all group hover:scale-[1.02] active:scale-95">
              <GraduationCap size={18} className="text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="font-medium text-sm">VivaAI</span>
            </Link>
            <Link href="/dashboard/files" className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-muted transition-all group hover:scale-[1.02] active:scale-95">
              <FolderRoot size={18} className="text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="font-medium text-sm">Engineer Drive</span>
            </Link>
            <Link href="/dashboard/preppilot" className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-muted transition-all group hover:scale-[1.02] active:scale-95">
              <MessageSquare size={18} className="text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="font-medium text-sm">OS Chat</span>
            </Link>
            <Link href="/dashboard/cgpa-predictor" className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-muted transition-all group hover:scale-[1.02] active:scale-95">
              <TrendingUp size={18} className="text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="font-medium text-sm">CGPA Prediction</span>
            </Link>
            <Link href="/dashboard/community" className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-muted transition-all group hover:scale-[1.02] active:scale-95">
              <Users size={18} className="text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="font-medium text-sm">Engineering Square</span>
            </Link>
            <Link href="/dashboard/smart-notes" className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-muted transition-all group hover:scale-[1.02] active:scale-95">
              <Notebook size={18} className="text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="font-medium text-sm">Digital Notebook</span>
            </Link>
            <Link href="/dashboard/settings" className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-muted transition-all group hover:scale-[1.02] active:scale-95">
              <Settings size={18} className="text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="font-medium text-sm">Settings</span>
            </Link>
          </nav>
          
          <div className="p-6 border-t border-border space-y-4">
            <div className="flex items-center gap-3 px-4 py-3 bg-muted/50 rounded-2xl border border-border/50 shadow-inner">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-black text-sm shrink-0 shadow-lg">
                {`${initialProfile?.first_name?.[0] || 'E'}${initialProfile?.last_name?.[0] || 'U'}`.toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold truncate">
                  {initialProfile?.first_name ? `${initialProfile.first_name} ${initialProfile.last_name || ''}` : 'Engineer User'}
                </p>
                <p className="text-[10px] text-muted-foreground truncate uppercase tracking-widest font-black opacity-60">
                  {initialProfile?.bio?.slice(0, 20) || 'Engineering Student'}
                </p>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="w-full text-left px-4 py-3 text-destructive hover:bg-destructive/10 rounded-2xl transition-all text-xs font-black uppercase tracking-widest flex items-center gap-3 group active:scale-95"
            >
              <LogOut size={16} className="transition-transform group-hover:-translate-x-1" />
              Logout
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* Top Navbar */}
          <header className="h-16 bg-card border-b border-border flex items-center justify-end px-6 relative z-50">
            <div className="flex items-center gap-6">
              
              {/* Notifications Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button 
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                >
                  <BellIcon className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1.5 w-2.5 h-2.5 bg-destructive border-2 border-card rounded-full"></span>
                  )}
                </button>

                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                    <div className="p-4 border-b border-border flex justify-between items-center bg-muted/30">
                      <h3 className="font-semibold">Notifications</h3>
                      {unreadCount > 0 && (
                        <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full font-medium">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center text-sm text-muted-foreground">
                          You have no notifications yet.
                        </div>
                      ) : (
                        <ul className="divide-y divide-border">
                          {notifications.map(notif => (
                            <li 
                              key={notif.id}
                              onClick={() => handleNotificationClick(notif)}
                              className={`p-4 cursor-pointer transition-colors ${notif.is_read ? 'hover:bg-muted/50' : 'bg-muted/30 hover:bg-muted/50'}`}
                            >
                              <div className="flex gap-3">
                                <div className="mt-1">
                                  {!notif.is_read && <div className="w-2 h-2 bg-primary rounded-full"></div>}
                                </div>
                                <div>
                                  <p className={`text-sm ${notif.is_read ? 'text-muted-foreground' : 'font-medium'}`}>
                                    {notif.message}
                                  </p>
                                  <span className="text-xs text-muted-foreground mt-1 block">
                                    {new Date(notif.created_at).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="h-6 w-px bg-border"></div>

            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto p-8 bg-background/50">
            {children}
          </main>
        </div>
      </div>
    </LanguageProvider>
  )
}
