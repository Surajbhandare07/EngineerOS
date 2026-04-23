'use server'

import { createClient } from '@/utils/supabase/server'
import { ChatMessage } from '@/types'

export async function saveVivaSession(topic: string, language: string, messages: ChatMessage[], score?: number) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'User not authenticated' }

  const { error } = await supabase
    .from('viva_sessions')
    .insert({
      user_id: user.id,
      topic,
      language,
      messages,
      final_score: score
    })

  if (error) {
    console.error("Save viva session error:", error)
    return { success: false, error: error.message }
  }

  return { success: true }
}

export async function getVivaSessions() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'User not authenticated' }

  const { data, error } = await supabase
    .from('viva_sessions')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error("Fetch viva sessions error:", error)
    return { success: false, error: error.message }
  }

  return { success: true, data }
}
