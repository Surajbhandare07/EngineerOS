'use server'

import { createClient } from '@/utils/supabase/server'
import Groq from 'groq-sdk';
import { universalDocumentParser } from './document-parser';

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

    // Use universal parser
    const { text } = await universalDocumentParser(file)
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
    const clientExtractedText = formData.get('extractedText') as string | null
    const renderedImage = formData.get('renderedImage') as File | null

    if (!file) return { success: false, error: "No file provided." };

    let transcription = ''

    // Priority: Client text -> Client image -> Server fallback
    if (clientExtractedText) {
      transcription = clientExtractedText
    } else if (renderedImage) {
      const arrayBuffer = await renderedImage.arrayBuffer()
      const base64 = Buffer.from(arrayBuffer).toString('base64')
      
      const response = await groq.chat.completions.create({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "You are an advanced academic OCR. Extract all text from this syllabus accurately."
              },
              {
                type: "image_url",
                image_url: { url: `data:image/png;base64,${base64}` }
              }
            ]
          }
        ]
      })
      transcription = response.choices[0]?.message?.content?.trim() || ''
    } else {
      const { text } = await universalDocumentParser(file)
      transcription = text
    }

    if (!transcription || transcription.startsWith("Error")) {
      return { success: false, error: transcription || 'Could not read the document.' }
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileName = `preppilot_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    const storagePath = `${user.id}/${fileName}`;

    await supabase.storage
      .from('user_documents')
      .upload(storagePath, buffer, { contentType: 'application/pdf', upsert: true });

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
    
    return { success: true, data: transcription, documentId: docData?.id };
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