'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function saveCgpaPrediction(data: {
  semester: string
  subjects_data: any
  predicted_sgpa: number
  target_sgpa: number | null
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'User not authenticated' }

  const { error } = await supabase
    .from('cgpa_predictions')
    .insert({
      user_id: user.id,
      semester: data.semester,
      subjects_data: data.subjects_data,
      predicted_sgpa: data.predicted_sgpa,
      target_sgpa: data.target_sgpa,
    })

  if (error) {
    console.error('Save CGPA prediction error:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/cgpa-predictor')
  return { success: true }
}

export async function getCgpaPredictions() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'User not authenticated' }

  const { data, error } = await supabase
    .from('cgpa_predictions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Fetch CGPA predictions error:', error)
    return { success: false, error: error.message }
  }

  return { success: true, data }
}
