'use client'

import { useLanguage } from '@/context/LanguageContext'
import { Language } from '@/types'

export default function LanguageSelector() {
  const { language, setLanguage } = useLanguage();
  const languages: Language[] = ['English', 'Hindi', 'Marathi', 'Tamil', 'Telugu'];

  return (
    <div className="relative inline-block text-left">
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value as Language)}
        className="bg-gray-800 text-white border border-gray-700 hover:border-purple-500 rounded-md py-2 px-4 focus:outline-none focus:ring-2 focus:ring-purple-600 appearance-none cursor-pointer transition-colors"
      >
        {languages.map((lang) => (
          <option key={lang} value={lang}>
            {lang}
          </option>
        ))}
      </select>
    </div>
  )
}
