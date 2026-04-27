'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getFilesAndFolders(folderId: string | null = null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  // Fetch folders
  let folderQuery = supabase.from('folders').select('*').eq('user_id', user.id)
  if (folderId) {
    folderQuery = folderQuery.eq('parent_folder_id', folderId)
  } else {
    folderQuery = folderQuery.is('parent_folder_id', null)
  }
  const { data: folders, error: folderError } = await folderQuery.order('name')

  // Fetch documents
  let docQuery = supabase.from('documents').select('*').eq('user_id', user.id)
  if (folderId) {
    docQuery = docQuery.eq('parent_folder_id', folderId)
  } else {
    docQuery = docQuery.is('parent_folder_id', null)
  }
  const { data: docs, error: docError } = await docQuery.order('filename')

  if (folderError || docError) {
    return { success: false, error: folderError?.message || docError?.message }
  }

  return { success: true, folders, documents: docs }
}

export async function createFolder(name: string, parentId: string | null = null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { data, error } = await supabase.from('folders').insert({
    user_id: user.id,
    name,
    parent_folder_id: parentId
  }).select().single()

  if (error) return { success: false, error: error.message }
  
  revalidatePath('/dashboard/files')
  return { success: true, folder: data }
}

export async function uploadFile(formData: FormData, parentId: string | null = null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const file = formData.get('file') as File
  if (!file) return { success: false, error: 'No file provided' }

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`
  const storagePath = `${user.id}/${fileName}`

  const { error: uploadError } = await supabase.storage
    .from('user_documents')
    .upload(storagePath, buffer, { contentType: file.type, upsert: true })

  if (uploadError) return { success: false, error: uploadError.message }

  const { data, error: dbError } = await supabase.from('documents').insert({
    user_id: user.id,
    filename: file.name,
    storage_path: storagePath,
    document_type: file.type,
    parent_folder_id: parentId
  }).select().single()

  if (dbError) return { success: false, error: dbError.message }

  revalidatePath('/dashboard/files')
  return { success: true, document: data }
}

export async function deleteItem(id: string, type: 'file' | 'folder') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const table = type === 'file' ? 'documents' : 'folders'
  
  // If it's a file, we should also delete from storage (optional but good practice)
  if (type === 'file') {
    const { data: doc } = await supabase.from('documents').select('storage_path').eq('id', id).single()
    if (doc) {
      await supabase.storage.from('user_documents').remove([doc.storage_path])
    }
  }

  const { error } = await supabase.from(table).delete().eq('id', id)

  if (error) return { success: false, error: error.message }
  
  revalidatePath('/dashboard/files')
  return { success: true }
}

export async function toggleShare(fileId: string, isPublic: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { error } = await supabase.from('documents').update({ is_public: isPublic }).eq('id', fileId)

  if (error) return { success: false, error: error.message }
  
  revalidatePath('/dashboard/files')
  return { success: true }
}

export async function getBreadcrumbs(folderId: string | null) {
  if (!folderId) return [{ id: null, name: 'Home' }]
  
  const supabase = await createClient()
  const path = []
  let currentId = folderId

  while (currentId) {
    const { data, error } = await supabase.from('folders').select('id, name, parent_folder_id').eq('id', currentId).single()
    if (error || !data) break
    path.unshift({ id: data.id, name: data.name })
    currentId = data.parent_folder_id
  }

  path.unshift({ id: null, name: 'Home' })
  return path
}
