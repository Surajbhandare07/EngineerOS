'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { Language } from '@/types'
import { getUserProfile, updatePreferredLanguage } from '@/lib/actions/profile'

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('English');

  useEffect(() => {
    // try to load from local storage first for instant feedback
    const saved = localStorage.getItem('engineerOS_lang') as Language;
    if (saved) {
      setLanguageState(saved);
    }
    
    // sync with Supabase
    getUserProfile().then(res => {
      if (res.success && res.data?.preferred_language) {
        setLanguageState(res.data.preferred_language as Language);
        localStorage.setItem('engineerOS_lang', res.data.preferred_language);
      }
    });
  }, []);

  const handleSetLanguage = async (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('engineerOS_lang', lang);
    await updatePreferredLanguage(lang);
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
