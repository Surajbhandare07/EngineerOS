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

export async function ensureProfile(supabase: any, user: any) {
  const { data: profile, error: fetchError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (fetchError) {
    console.error("Error fetching profile in ensureProfile:", fetchError);
    return { success: false, error: fetchError.message };
  }

  if (!profile) {
    console.log("Profile missing. Creating one for user:", user.id);
    const fullName = user.user_metadata?.full_name || 'Student'
    const parts = fullName.split(' ')
    const firstName = parts[0]
    const lastName = parts.slice(1).join(' ') || ''

    const { error: insertError } = await supabase.from('profiles').upsert({ 
      id: user.id, 
      first_name: firstName,
      last_name: lastName
    }, { onConflict: 'id' });

    if (insertError) {
      console.error("Error upserting profile in ensureProfile:", JSON.stringify(insertError));
      return { success: false, error: "Failed to create/update user profile: " + insertError.message };
    }
  }
  return { success: true };
}

export async function getUserProfile() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'User not authenticated' }

  const ensureRes = await ensureProfile(supabase, user);
  if (!ensureRes.success) return ensureRes;


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
    console.log("Profile still null after ensureProfile. Attempting fallback upsert...");
    const fullName = user.user_metadata?.full_name || 'Student'
    const parts = fullName.split(' ')
    const firstName = parts[0]
    const lastName = parts.slice(1).join(' ') || ''

    const { data: newProfile, error: insertError } = await supabase
      .from('profiles')
      .upsert({ 
        id: user.id, 
        first_name: firstName,
        last_name: lastName 
      }, { onConflict: 'id' })
      .select()
      .single();
    
    if (insertError) {
      console.error("Fallback upsert error:", JSON.stringify(insertError));
      return { success: false, error: insertError.message };
    }
    return { success: true, data: newProfile };
  }

  return { success: true, data }
}

export async function updatePreferredLanguage(language: Language) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'User not authenticated' }

  const ensureRes = await ensureProfile(supabase, user);
  if (!ensureRes.success) return ensureRes;


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
