'use server'

import { createClient } from '@/utils/supabase/server'
import { Language } from '@/types'
import { revalidatePath } from 'next/cache'

export async function updateProfile(formData: FormData) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'User not authenticated' }

  const first_name = formData.get('first_name') as string
  const last_name = formData.get('last_name') as string
  const date_of_birth = formData.get('date_of_birth') as string
  const bio = formData.get('bio') as string

  const { error } = await supabase
    .from('profiles')
    .update({ 
      first_name, 
      last_name, 
      date_of_birth: date_of_birth || null, 
      bio 
    })
    .eq('id', user.id)

  if (error) {
    console.error("Update profile error:", error)
    return { success: false, error: error.message }
  }

  revalidatePath('/', 'layout')
  revalidatePath('/dashboard', 'layout')
  return { success: true }
}

async function ensureProfile(supabase: any, user: any) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) {
    console.log("Profile missing. Creating one for user:", user.id);
    const fullName = user.user_metadata?.full_name || 'Student'
    const parts = fullName.split(' ')
    const firstName = parts[0]
    const lastName = parts.slice(1).join(' ') || ''

    await supabase.from('profiles').insert({ 
      id: user.id, 
      first_name: firstName,
      last_name: lastName
    });
  }
}

export async function getUserProfile() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'User not authenticated' }

  await ensureProfile(supabase, user);

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    console.error("Fetch profile error:", error)
    return { success: false, error: error.message }
  }

  // Fallback if profile is still null for some reason
  if (!data) {
    const fullName = user.user_metadata?.full_name || 'Student'
    const parts = fullName.split(' ')
    const firstName = parts[0]
    const lastName = parts.slice(1).join(' ') || ''

    const { data: newProfile, error: insertError } = await supabase
      .from('profiles')
      .insert({ 
        id: user.id, 
        first_name: firstName,
        last_name: lastName 
      })
      .select()
      .single();
    
    if (insertError) return { success: false, error: insertError.message };
    return { success: true, data: newProfile };
  }

  return { success: true, data }
}

export async function updatePreferredLanguage(language: Language) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'User not authenticated' }

  await ensureProfile(supabase, user);

  const { error } = await supabase
    .from('profiles')
    .update({ preferred_language: language })
    .eq('id', user.id)

  if (error) {
    console.error("Update language error:", error)
    return { success: false, error: error.message }
  }

  return { success: true }
}
