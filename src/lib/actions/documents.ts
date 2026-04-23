'use server'

import { createClient } from '@/utils/supabase/server'
import Groq from 'groq-sdk';
import { parsePdfToText } from './document-parser';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function ensureProfile(supabase: any, user: any) {
  const { data: profile } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle();
  if (!profile) {
    console.log("Creating missing profile for user:", user.id);
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

export async function extractTextFromImage(formData: FormData) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Please login to continue.' }

    await ensureProfile(supabase, user);

    const file = formData.get('file') as File | null;
    if (!file) return { success: false, error: "No file provided." };

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileName = `preppilot_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;

    const { error: uploadError } = await supabase.storage
      .from('user_documents')
      .upload(`${user.id}/${fileName}`, buffer, { contentType: file.type, upsert: true })

    if (uploadError) return { success: false, error: 'Upload failed: ' + uploadError.message }

    const { data: { publicUrl } } = supabase.storage
      .from('user_documents')
      .getPublicUrl(`${user.id}/${fileName}`)

    const visionResponse = await groq.chat.completions.create({
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'Extract all syllabus topics and text from this image. Output ONLY plain text.' },
          { type: 'image_url', image_url: { url: publicUrl } }
        ]
      }],
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    })

    const text = visionResponse.choices[0]?.message?.content?.trim() || ''
    return { success: true, data: text };
  } catch (error: any) {
    console.error("Image Processing Error:", error);
    return { success: false, error: "Failed to process image with Groq Vision." };
  }
}

export async function extractTextFromPDF(formData: FormData) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Please login to continue.' }

    await ensureProfile(supabase, user);

    const file = formData.get('file') as File | null;
    if (!file) return { success: false, error: "No file provided." };

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(new Uint8Array(arrayBuffer));

    let text: string = '';
    try {
      text = await parsePdfToText(buffer);
    } catch (parseErr: any) {
      console.error('PDF Extraction Error:', parseErr);
      return { success: false, error: 'Could not read the PDF. It might be scanned or protected. Try uploading as an image if it contains mostly diagrams.' };
    }

    if (text.length < 50) {
      return { success: false, error: 'SCANNED_PDF: This PDF contains images instead of text. Please upload the pages as Images so the Vision AI can read them.' }
    }

    const fileName = `preppilot_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    const storagePath = `${user.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('user_documents')
      .upload(storagePath, buffer, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadError) return { success: false, error: "Cloud Storage Error: " + uploadError.message };

    const { data: docData } = await supabase
      .from('documents')
      .insert({
        user_id: user.id,
        filename: file.name,
        storage_path: storagePath,
        document_type: 'pdf'
      })
      .select('id')
      .maybeSingle();
    
    return { success: true, data: text, documentId: docData?.id };
  } catch (error: any) {
    console.error("PDF Processing Error:", error);
    return { success: false, error: error.message || "Failed to process PDF." };
  }
}

export async function getUserDocuments() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'User not authenticated' }

  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data }
}