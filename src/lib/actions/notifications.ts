'use server'

import { createClient } from '@/utils/supabase/server'

export async function getNotifications() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'User not authenticated' }

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data }
}

export async function markNotificationAsRead(notificationId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'User not authenticated' }

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('user_id', user.id)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

// Utility to insert notifications (used by other actions)
export async function createNotification(supabase: any, userId: string, type: string, message: string) {
  try {
    await supabase.from('notifications').insert({
      user_id: userId,
      type,
      message,
      is_read: false
    })
  } catch (error) {
    console.error("Failed to create notification:", error)
  }
}
