'use server'

import { createClient } from '@/utils/supabase/server'

export async function saveStudyPlanAndTasks(planContent: any) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Please login to generate a study plan.' }

  // Self-healing: ensure profile exists
  const { data: profile } = await supabase.from('profiles').select('id').eq('id', user.id).single();
  if (!profile) {
    await supabase.from('profiles').insert({ id: user.id, full_name: user.user_metadata?.full_name || 'Student' });
  }

  // 1. Save Study Plan
  const { data: planData, error: planError } = await supabase
    .from('study_plans')
    .insert({
      user_id: user.id,
      plan_content: planContent
    })
    .select('id')
    .single()

  if (planError) {
    console.error("Save plan error:", planError)
    return { success: false, error: planError.message }
  }

  // 2. Save Tasks
  const tasksToInsert = []
  for (const day of planContent.schedule) {
    for (const taskStr of day.tasks) {
      tasksToInsert.push({
        user_id: user.id,
        study_plan_id: planData.id,
        title: taskStr,
        description: `Day ${day.day}: ${day.topic} - ${day.description}`,
        status: 'pending'
      })
    }
  }

  if (tasksToInsert.length > 0) {
    const { error: tasksError } = await supabase.from('tasks').insert(tasksToInsert)
    if (tasksError) {
      console.error("Save tasks error:", tasksError)
      return { success: false, error: tasksError.message }
    }
  }

  return { success: true, planId: planData.id }
}

export async function getUserTasks() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Please login to generate a study plan.' }

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data }
}

export async function updateTaskStatus(taskId: string, status: 'pending' | 'completed') {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Please login to generate a study plan.' }

  const { error } = await supabase
    .from('tasks')
    .update({ status })
    .eq('id', taskId)
    .eq('user_id', user.id)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}
