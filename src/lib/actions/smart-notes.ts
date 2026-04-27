'use server'

import { createClient } from '@/utils/supabase/server'
import Groq from 'groq-sdk'
import { revalidatePath } from 'next/cache'
import { getDocumentProxy, renderPageAsImage } from 'unpdf'
import { universalDocumentParser } from './document-parser'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/* ─────────────────────────────────────────────────────────────────────
   Helper: ask Groq to format raw text into notebook markdown + title.
   Uses response_format: json_object to guarantee parseable output.
───────────────────────────────────────────────────────────────────── */
async function formatWithGroq(rawText: string): Promise<{ title: string; markdown: string }> {
  const prompt = `You are a high-performance academic synthesizer. Your goal is to transform raw, messy document text into ultra-efficient, "to-the-point" digital study notes.

STRATEGY:
1. Synthesize: Do NOT just transcribe. Summarize complex paragraphs into concise bullet points.
2. Structure: Use a logical flow (Concept -> Explanation -> Examples -> Key Takeaway).
3. Visuals: Include ASCII-style diagrams or structured tables to explain relationships (e.g., [A] -> [B]).
4. Exam Intelligence: Add an "Exam Tip" or "Common Mistake" block for important topics.
5. Language: Reproduce content in the EXACT SAME language (Hindi, English, or Hinglish mix). Do NOT translate.

RULES:
1. Title: Generate a short, authoritative title (3–4 words).
2. Sections: Use # for the main title, ## for sections.
3. Highlights: Use > blockquote for "Key Takeaways" or "Exam Tips".
4. Formatting: Use **bold** for definitions and \`code\` for technical terms/formulas.

You MUST respond ONLY with a valid JSON object with exactly two keys:
- "title": a short 3–4 word string
- "content": the fully synthesized markdown notes as a string

Do NOT wrap the JSON in markdown code blocks. Do NOT include any other commentary.

RAW NOTES:
${rawText.slice(0, 12000)}`   // guard against token overflow

  const completion = await groq.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    response_format: { type: 'json_object' },
  })

  const raw = completion.choices[0]?.message?.content?.trim() ?? '{}'

  try {
    const parsed = JSON.parse(raw)
    const title    = (parsed.title    as string | undefined)?.trim() || 'Untitled Note'
    const markdown = (parsed.content  as string | undefined)?.trim() || raw
    return { title, markdown }
  } catch (e) {
    console.error('Groq JSON parse failed, using raw text as markdown:', e)
    // Extract first non-empty line as fallback title
    const fallbackTitle = raw.split('\n').find(l => l.trim())?.replace(/^[#\s*-]+/, '').trim() ?? 'Untitled Note'
    return { title: fallbackTitle, markdown: raw }
  }
}

/* ─────────────────────────────────────────────────────────────────────
   Helper: Save a copy of the generated note to Engineer Drive
───────────────────────────────────────────────────────────────────── */
async function copyToEngineerDrive(supabase: any, user: any, title: string, content: string) {
  try {
    // 1. Ensure "Digital Notes" folder exists
    let { data: folder, error: folderError } = await supabase
      .from('folders')
      .select('id')
      .eq('user_id', user.id)
      .eq('name', 'Digital Notes')
      .maybeSingle()

    if (!folder && !folderError) {
      const { data: newFolder, error: createError } = await supabase
        .from('folders')
        .insert({ user_id: user.id, name: 'Digital Notes' })
        .select('id')
        .single()
      
      if (!createError) folder = newFolder
    }

    const folderId = folder?.id || null

    // 2. Upload .md file to storage
    const fileName = `${title.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.md`
    const storagePath = `${user.id}/${fileName}`
    const buffer = Buffer.from(content)

    const { error: uploadError } = await supabase.storage
      .from('user_documents')
      .upload(storagePath, buffer, { contentType: 'text/markdown', upsert: true })

    if (uploadError) {
      console.error('Drive Auto-Save Storage Error:', uploadError)
      return
    }

    // 3. Register in documents table
    await supabase.from('documents').insert({
      user_id: user.id,
      filename: `${title}.md`,
      storage_path: storagePath,
      document_type: 'text/markdown',
      parent_folder_id: folderId
    })

    revalidatePath('/dashboard/files')
  } catch (err) {
    console.error('Drive Auto-Save Failed:', err)
  }
}

/* ─────────────────────────────────────────────────────────────────────
   Action: Process an IMAGE file via Groq Vision
───────────────────────────────────────────────────────────────────── */
export async function generateNotesFromImage(formData: FormData) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (!user || authError) throw new Error('Unauthorized: User not found')

    const file = formData.get('file') as File | null
    if (!file) return { success: false, error: 'No file provided.' }

    // 1. Upload original image to Supabase Storage
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`
    const storagePath = `${user.id}/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('handwritten_notes')
      .upload(storagePath, buffer, { contentType: file.type || 'image/jpeg', upsert: true })

    if (uploadError) {
      console.error('Storage Upload Error:', uploadError)
      return { success: false, error: 'Cloud Storage Error: ' + uploadError.message }
    }

    const { data: { publicUrl } } = supabase.storage
      .from('handwritten_notes')
      .getPublicUrl(storagePath)

    // 2. Universal Parsing — handles text extraction or Vision fallback
    const { text: rawTranscription } = await universalDocumentParser(file)
    if (!rawTranscription || rawTranscription.startsWith("Error")) {
      return { success: false, error: rawTranscription || 'AI failed to transcribe the image.' }
    }

    // 3. Format + generate title via JSON-mode Groq call
    const { title, markdown: markdownContent } = await formatWithGroq(rawTranscription)

    // 4. Persist to DB
    const { error: dbError } = await supabase
      .from('smart_notes')
      .insert({ user_id: user.id, title, clean_content: markdownContent })

    if (dbError) {
      console.error('Supabase Insert Error:', dbError)
      return { success: false, error: 'Failed to save note to database.' }
    }

    revalidatePath('/dashboard/smart-notes')
    
    // 5. AUTO-SAVE TO ENGINEER DRIVE
    await copyToEngineerDrive(supabase, user, title, markdownContent)

    return { success: true, publicUrl, markdownContent, title }

  } catch (error: any) {
    console.error('Vision Processing Error:', error)
    return { success: false, error: error.message || 'Failed to process image.' }
  }
}

/* ─────────────────────────────────────────────────────────────────────
   Action: Process a PDF file via pdf-parse → Groq text formatting
───────────────────────────────────────────────────────────────────── */
export async function generateNotesFromPDF(formData: FormData) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (!user || authError) throw new Error('Unauthorized: User not found')

    const file = formData.get('file') as File | null
    const clientExtractedText = formData.get('extractedText') as string | null
    const renderedImage = formData.get('renderedImage') as File | null

    if (!file) return { success: false, error: 'No file provided.' }

    let rawTranscription = ''

    // 1. Logic Priority: Client-side text -> Client-side image -> Server-side parser fallback
    if (clientExtractedText) {
      console.log("[Server] Using client-extracted digital text.")
      rawTranscription = clientExtractedText
    } else if (renderedImage) {
      console.log("[Server] Using client-rendered PDF image.")
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
                text: "You are an advanced academic OCR. Extract all text, formulas, and handwritten notes from this document accurately. Maintain the structural hierarchy and respond only with the transcribed content."
              },
              {
                type: "image_url",
                image_url: { url: `data:image/png;base64,${base64}` }
              }
            ]
          }
        ],
        temperature: 0.1,
      })
      rawTranscription = response.choices[0]?.message?.content?.trim() || ''
    } else {
      console.log("[Server] No client pre-processing, falling back to universalDocumentParser.")
      const { text } = await universalDocumentParser(file)
      rawTranscription = text
    }

    if (!rawTranscription || rawTranscription.startsWith("Error")) {
      return { success: false, error: rawTranscription || 'AI failed to transcribe the document.' }
    }

    // 2. Format + generate title via JSON-mode Groq call
    const { title, markdown: markdownContent } = await formatWithGroq(rawTranscription)

    // 3. Store original PDF for history record
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`
    
    await supabase.storage
      .from('handwritten_notes')
      .upload(`${user.id}/${fileName}`, buffer, { contentType: 'application/pdf', upsert: true })

    // 4. Persist to DB
    const { error: dbError } = await supabase
      .from('smart_notes')
      .insert({ user_id: user.id, title, clean_content: markdownContent })

    if (dbError) {
      console.error('Supabase Insert Error:', dbError)
      return { success: false, error: 'Failed to save note to database.' }
    }

    revalidatePath('/dashboard/smart-notes')
    
    // 5. AUTO-SAVE TO ENGINEER DRIVE
    await copyToEngineerDrive(supabase, user, title, markdownContent)

    return { success: true, markdownContent, title }

  } catch (error: any) {
    console.error('PDF Processing Error:', error)
    return { success: false, error: error.message || 'Failed to process PDF.' }
  }
}

/* ─────────────────────────────────────────────────────────────────────
   Query: Fetch saved notes for the current user
───────────────────────────────────────────────────────────────────── */
export async function getSmartNotes() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'User not authenticated' }

  const { data, error } = await supabase
    .from('smart_notes')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return { success: false, error: error.message }
  return { success: true, data }
}
