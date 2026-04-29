'use client'

import { useState, useEffect } from 'react'
import { getUserProfile, updateProfile } from '@/lib/actions/profile'
import { ThemeSwitcher } from '@/components/ThemeSwitcher'
import Spinner from '@/components/ui/Spinner'
import { User, Palette, Shield, Bell, Lock, Mail } from 'lucide-react'

type Tab = 'profile' | 'appearance' | 'security' | 'notifications'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('profile')
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    const res: any = await getUserProfile()
    if (res.success) {
      setProfile(res.data)
    }
    setLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    const formData = new FormData(e.currentTarget)
    const res: any = await updateProfile(formData)

    if (res.success) {
      setMessage({ type: 'success', text: 'Profile updated successfully!' })
      fetchProfile() // Refresh data
    } else {
      setMessage({ type: 'error', text: res.error || 'Failed to update profile.' })
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Spinner />
      </div>
    )
  }

  const navItems = [
    { id: 'profile' as Tab, label: 'Profile', icon: User },
    { id: 'appearance' as Tab, label: 'Appearance', icon: Palette },
    { id: 'security' as Tab, label: 'Security', icon: Shield },
    { id: 'notifications' as Tab, label: 'Notifications', icon: Bell },
  ]

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-20">
      <header>
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2">Manage your account settings and preferences.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-10 items-start">
        {/* Sidebar Nav */}
        <aside className="lg:col-span-1 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl transition-all
                  ${isActive 
                    ? 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 shadow-sm' 
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50'}`}
              >
                <Icon size={18} className={isActive ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400'} />
                {item.label}
              </button>
            )
          })}
        </aside>

        {/* Main Content Area */}
        <main className="lg:col-span-3 min-h-[400px]">
          
          {/* PROFILE TAB */}
          {activeTab === 'profile' && (
            <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="p-6 border-b border-gray-100 dark:border-gray-800">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Profile Details</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Manage how you are seen on the platform.</p>
              </div>
              
              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                {message && (
                  <div className={`p-4 rounded-xl text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'}`}>
                    {message.text}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">First Name</label>
                    <input 
                      type="text" 
                      name="first_name"
                      defaultValue={profile?.first_name}
                      placeholder="e.g. John"
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600 focus:outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Last Name</label>
                    <input 
                      type="text" 
                      name="last_name"
                      defaultValue={profile?.last_name}
                      placeholder="e.g. Doe"
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600 focus:outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Date of Birth</label>
                  <input 
                    type="date" 
                    name="date_of_birth"
                    defaultValue={profile?.date_of_birth}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600 focus:outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Bio</label>
                  <textarea 
                    name="bio"
                    rows={4}
                    defaultValue={profile?.bio}
                    placeholder="Tell us a little about yourself..."
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600 focus:outline-none transition-all resize-none"
                  />
                </div>

                <div className="pt-2">
                  <button 
                    type="submit"
                    disabled={saving}
                    className="px-8 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-purple-600/20 transition-all flex items-center gap-2"
                  >
                    {saving ? <Spinner /> : null}
                    {saving ? 'Saving Changes...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* APPEARANCE TAB */}
          {activeTab === 'appearance' && (
            <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
                <div className="mb-6">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">Appearance</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Customize how the application looks on your device.</p>
                </div>
                <ThemeSwitcher />
              </div>

              <div className="bg-purple-600/5 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-900/30 rounded-2xl p-6">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-purple-600">
                    <Palette size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-purple-900 dark:text-purple-300">Visual Experience</h3>
                    <p className="text-sm text-purple-700/70 dark:text-purple-400/70 mt-1">
                      Our dark mode is optimized for engineering environments with high-contrast text and reduced blue light for long coding sessions.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* SECURITY TAB (Placeholder) */}
          {activeTab === 'security' && (
            <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="flex flex-col items-center justify-center text-center py-10 space-y-4">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-400">
                  <Lock size={32} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Security Settings</h2>
                  <p className="text-gray-500 dark:text-gray-400 mt-2 max-w-md mx-auto">Password management and two-factor authentication will be available in the next update.</p>
                </div>
              </div>
            </section>
          )}

          {/* NOTIFICATIONS TAB (Placeholder) */}
          {activeTab === 'notifications' && (
            <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="flex flex-col items-center justify-center text-center py-10 space-y-4">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-400">
                  <Bell size={32} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Notification Preferences</h2>
                  <p className="text-gray-500 dark:text-gray-400 mt-2 max-w-md mx-auto">Configure your email and push notification alerts for study reminders and community updates.</p>
                </div>
              </div>
            </section>
          )}

        </main>
      </div>
    </div>
  )
}
