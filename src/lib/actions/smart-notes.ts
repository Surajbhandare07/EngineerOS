'use server'

import { createClient } from '@/utils/supabase/server'
import Groq from 'groq-sdk'
import { revalidatePath } from 'next/cache'
import pdfParseModule from 'pdf-parse'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/* ─────────────────────────────────────────────────────────────────────
   Helper: ask Groq to format raw text into notebook markdown + title.
   Uses response_format: json_object to guarantee parseable output.
───────────────────────────────────────────────────────────────────── */
async function formatWithGroq(rawText: string): Promise<{ title: string; markdown: string }> {
  const prompt = `You are a multilingual academic assistant. Convert the following raw notes into a clean, structured digital notebook page.

RULES:
1. Language: Reproduce content in the EXACT SAME language (Hindi, English, or Hinglish mix). Do NOT translate.
2. Title: Generate a short catchy 3–4 word title that captures the topic (e.g. "Photosynthesis Basics", "Java Inheritance").
3. Sections: Use # for the main title, ## for sections. Do NOT use ### or #### ever.
4. Bullets: Use "- " bullet syntax for lists.
5. Highlights: Wrap important callouts in > blockquote (e.g. > Note: This is important).
6. Bold: Use **bold** for key terms.

You MUST respond ONLY with a valid JSON object with exactly two keys:
- "title": a short 3–4 word string
- "content": the full markdown notes as a string

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

    // 2. Vision — transcribe raw text from image
    const visionPrompt = `You are a multilingual academic assistant.
Read ALL handwritten text in this image carefully.
Transcribe every word exactly as written, preserving the original language (Hindi/English/Hinglish).
Do NOT translate. Output plain text only — no markdown, no commentary.`

    const visionResponse = await groq.chat.completions.create({
      messages: [{
        role: 'user',
        content: [
          { type: 'text',      text: visionPrompt },
          { type: 'image_url', image_url: { url: publicUrl } }
        ]
      }],
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    })

    const rawTranscription = visionResponse.choices[0]?.message?.content?.trim()
    if (!rawTranscription) return { success: false, error: 'AI failed to transcribe the image.' }

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
    if (!file) return { success: false, error: 'No file provided.' }

    // 1. Convert Web File → Node Buffer first, then parse
    //    (Next.js Server Actions receive a Web File/Blob, not a Node Buffer)
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(new Uint8Array(arrayBuffer))

    let rawText: string = '';
    try {
      // Bypass Turbopack's forced .default static binding by resolving it dynamically at runtime
      const parsePDF = typeof pdfParseModule === 'function' 
        ? pdfParseModule 
        : (pdfParseModule as any).default;

      if (typeof parsePDF !== 'function') {
        throw new Error('PDF parser could not be resolved as a function.');
      }

      const pdfData = await parsePDF(buffer);
      rawText = pdfData.text?.trim() ?? '';
    } catch (parseErr: any) {
      console.error('pdf-parse error:', parseErr);
      return { success: false, error: 'Could not read the PDF. Ensure it contains selectable text.' };
    }

    // 2. Scanned PDF guard — image-only PDFs yield almost no text
    if (rawText.length < 50) {
      return {
        success: false,
        error: 'SCANNED_PDF: This PDF contains images instead of text. Please upload the pages directly as Images so the Vision AI can read them.'
      }
    }

    // 2. Format + generate title via JSON-mode Groq call
    const { title, markdown: markdownContent } = await formatWithGroq(rawText)

    // 3. Optionally store PDF for history record
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
