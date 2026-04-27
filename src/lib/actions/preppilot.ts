'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { ensureProfile } from './profile'

export async function createPrepPilotSession(title: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const ensureRes = await ensureProfile(supabase, user)
  if (!ensureRes.success) return ensureRes

  const { data, error } = await supabase
    .from('prep_pilot_sessions')
    .insert({ user_id: user.id, title })
    .select()
    .single()

  if (error) return { success: false, error: error.message }
  
  revalidatePath('/dashboard/preppilot')
  return { success: true, data }
}

export async function getPrepPilotSessions() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { data, error } = await supabase
    .from('prep_pilot_sessions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return { success: false, error: error.message }
  return { success: true, data }
}

export async function savePrepPilotMessage(sessionId: string, role: 'user' | 'assistant', content: string) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('prep_pilot_messages')
    .insert({ session_id: sessionId, role, content })

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function getPrepPilotMessages(sessionId: string) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('prep_pilot_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  if (error) return { success: false, error: error.message }
  return { success: true, data }
}

export async function deletePrepPilotSession(sessionId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('prep_pilot_sessions')
    .delete()
    .eq('id', sessionId)

  if (error) return { success: false, error: error.message }
  
  revalidatePath('/dashboard/preppilot')
  return { success: true }
}
