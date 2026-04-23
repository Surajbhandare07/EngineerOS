'use client'

import * as React from 'react'
import { useTheme } from 'next-themes'
import { Sun, Moon, Monitor, Check } from 'lucide-react'

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  // Avoid hydration mismatch
  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  const themes = [
    { id: 'light', label: 'Light', icon: Sun },
    { id: 'dark', label: 'Dark', icon: Moon },
    { id: 'system', label: 'System', icon: Monitor },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {themes.map((t) => {
        const Icon = t.icon
        const isActive = theme === t.id

        return (
          <button
            key={t.id}
            onClick={() => setTheme(t.id)}
            className={`flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 transition-all duration-200 group
              ${isActive 
                ? 'bg-purple-600/10 border-purple-600 ring-2 ring-purple-600/20' 
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-purple-400 dark:hover:border-purple-500'}`}
          >
            <div className={`p-3 rounded-xl transition-colors
              ${isActive ? 'bg-purple-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 group-hover:bg-purple-100 dark:group-hover:bg-purple-900/30'}`}>
              <Icon size={24} />
            </div>
            <div className="flex items-center gap-2">
              <span className={`font-semibold text-sm ${isActive ? 'text-purple-600 dark:text-purple-400' : 'text-gray-700 dark:text-gray-300'}`}>
                {t.label}
              </span>
              {isActive && <Check size={14} className="text-purple-600 dark:text-purple-400" />}
            </div>
          </button>
        )
      })}
    </div>
  )
}
