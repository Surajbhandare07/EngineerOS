'use server'

import Groq from 'groq-sdk';
import { createClient } from '@/utils/supabase/server';
import { Language } from '@/types'
import { parsePdfToText } from './document-parser';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/* ─────────────────────────────────────────────────────────────────────
   New: Extract text from an uploaded PDF or Image for Viva context
 ───────────────────────────────────────────────────────────────────── */
export async function extractTextForViva(formData: FormData) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (!user || authError) throw new Error('Unauthorized')

    const file = formData.get('file') as File | null
    if (!file) return { success: false, error: 'No file provided.' }

    const isPdf = file.type === 'application/pdf'

    if (isPdf) {
      // ── PDF: extract text with fallbacks ──
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(new Uint8Array(arrayBuffer))

      let extractedText: string = '';
      try {
        extractedText = await parsePdfToText(buffer);
      } catch (parseErr: any) {
        console.error('PDF Extraction Error:', parseErr);
        return { success: false, error: 'Could not read the PDF. It might be scanned or protected.' };
      }

      if (extractedText.length < 50) {
        return { success: false, error: 'SCANNED_PDF: This PDF appears to be image-based. Please upload the pages as images instead.' }
      }

      return { success: true, extractedText }
    } else {
      // ── Image: transcribe via Groq Vision ──
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const fileName = `viva_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`

      const { error: uploadError } = await supabase.storage
        .from('handwritten_notes')
        .upload(`${user.id}/${fileName}`, buffer, { contentType: file.type, upsert: true })

      if (uploadError) return { success: false, error: 'Upload failed: ' + uploadError.message }

      const { data: { publicUrl } } = supabase.storage
        .from('handwritten_notes')
        .getPublicUrl(`${user.id}/${fileName}`)

      const visionResponse = await groq.chat.completions.create({
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'Transcribe ALL text visible in this document/image. Output plain text only, preserving structure.' },
            { type: 'image_url', image_url: { url: publicUrl } }
          ]
        }],
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      })

      const extractedText = visionResponse.choices[0]?.message?.content?.trim() ?? ''
      if (!extractedText) return { success: false, error: 'AI could not read the image.' }

      return { success: true, extractedText }
    }
  } catch (error: any) {
    console.error('extractTextForViva error:', error)
    return { success: false, error: error.message || 'Failed to extract text.' }
  }
}

export async function askVivaQuestion(topic: string, language: Language, history: any[]) {
  try {
    const profileRes = await getUserProfile();
    const firstName = profileRes.success && profileRes.data?.first_name 
      ? profileRes.data.first_name 
      : 'Student';

    const systemPrompt = `You are a Strict Indian Engineering Professor conducting a Viva examination on the topic: "${topic}". 
    Address the student by their first name, ${firstName}, in your responses to make the viva feel conversational and personalized.
    You must strictly ask one question at a time. Do not provide the answer. Wait for the student to answer.
    If the student answers incorrectly, give a strict but constructive remark and correct them. 
    If they answer correctly, give a short nod of approval and ask the next question.
    You MUST respond entirely in ${language}.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map(msg => ({ 
        role: msg.role === 'model' ? 'assistant' : 'user', 
        content: msg.content 
      }))
    ];

    const chatCompletion = await groq.chat.completions.create({
      messages: messages as any,
      model: "llama-3.1-8b-instant",
    });

    return { success: true, data: chatCompletion.choices[0]?.message?.content || "" };
  } catch (error: any) {
    console.error("Groq API Error:", error);
    return { success: false, error: error.message };
  }
}

/* ─────────────────────────────────────────────────────────────────────
   New: Viva with document context — strictly asks from source material
───────────────────────────────────────────────────────────────────── */
export async function askVivaQuestionWithContext(
  topic: string,
  language: Language,
  history: any[],
  documentContext: string
) {
  try {
    const profileRes = await getUserProfile();
    const firstName = profileRes.success && profileRes.data?.first_name 
      ? profileRes.data.first_name 
      : 'Student';

    const systemPrompt = `You are a strict but fair university professor conducting a Viva (oral exam).
You have been provided with a source document that the student studied.

YOUR RULES:
1. Address the student by their first name, ${firstName}, occasionally to keep the session engaging.
2. You MUST ONLY ask questions based on the provided source document below. Do NOT ask about anything outside it.
3. Ask EXACTLY ONE question at a time. Never ask two questions together.
4. Wait for the student to answer before evaluating.
5. After the student answers, briefly evaluate (Correct ✅ / Partially Correct 🟡 / Incorrect ❌) with a short explanation, then ask the next question.
6. Be strict but constructive. If wrong, tell them the correct answer briefly.
7. Respond entirely in ${language}.
8. Start the exam immediately with your first question.

[SOURCE DOCUMENT]:
${documentContext.slice(0, 28000)}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map(msg => ({
        role: msg.role === 'model' ? 'assistant' : 'user',
        content: msg.content
      }))
    ];

    const chatCompletion = await groq.chat.completions.create({
      messages: messages as any,
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    });

    return { success: true, data: chatCompletion.choices[0]?.message?.content || '' };
  } catch (error: any) {
    console.error('Groq Viva Context Error:', error);
    return { success: false, error: error.message };
  }
}

export async function generateStudyPlan(syllabusText: string, language: Language) {
  try {
    const profileRes = await getUserProfile();
    const firstName = profileRes.success && profileRes.data?.first_name 
      ? profileRes.data.first_name 
      : 'Student';

    const prompt = `You are tutoring ${firstName}. Use their name occasionally to keep them engaged.
    Analyze the following syllabus text and create a 7-day structured study plan. 
    Identify the top 5 most important topics. 
    Respond ONLY with a valid JSON object matching this schema:
    {
      "top_topics": ["topic1", "topic2", "topic3", "topic4", "topic5"],
      "schedule": [
        { "day": 1, "topic": "string", "description": "string", "tasks": ["task1", "task2"] }
      ]
    }
    The description and tasks must be in ${language}.
    
    Syllabus text:
    ${syllabusText}`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'user', content: prompt }
      ],
      model: "llama-3.1-8b-instant",
      response_format: { type: "json_object" }
    });

    const text = chatCompletion.choices[0]?.message?.content || "{}";
    
    return { success: true, data: JSON.parse(text) };
  } catch (error: any) {
    console.error("Groq API Error:", error);
      return { success: false, error: error.message };
  }
}

export async function askStudyDriveQuestion(documentText: string, question: string, language: Language, history: any[]) {
  try {
    const systemPrompt = `You are a helpful AI study assistant. 
    You have been provided with the extracted text from a student's document below.
    You MUST answer the student's question strictly based on the information provided in the document.
    If the answer is not in the document, politely say that you cannot find the answer in the provided text.
    You MUST respond entirely in ${language}.
    
    Document Context:
    ${documentText.substring(0, 30000)} /* Truncate if extremely large to save tokens */`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map(msg => ({ 
        role: msg.role === 'model' ? 'assistant' : 'user', 
        content: msg.content 
      })),
      { role: 'user', content: question }
    ];

    const chatCompletion = await groq.chat.completions.create({
      messages: messages as any,
      model: "llama-3.1-8b-instant",
    });

    return { success: true, data: chatCompletion.choices[0]?.message?.content || "" };
  } catch (error: any) {
    console.error("Groq RAG Error:", error);
    return { success: false, error: error.message };
  }
}
export async function askPrepPilotQuestion(syllabusText: string, question: string, language: Language, history: any[], isPanicMode: boolean) {
  try {
    const profileRes = await getUserProfile();
    const firstName = profileRes.success && profileRes.data?.first_name 
      ? profileRes.data.first_name 
      : 'Student';

    let systemPrompt = `You are an expert AI tutor helping a student with their syllabus.
    You MUST respond entirely in ${language}.
    Syllabus Context: ${syllabusText.substring(0, 10000)}`;

    if (isPanicMode) {
      systemPrompt += `
      PANIC MODE ACTIVE: The student is stressed for an exam. Your goal is to teach complex topics fast but deeply. Use the "ELI5" (Explain Like I'm 5) method followed by a technical deep dive.
      Always provide 2 real-world examples.
      Use Markdown tables or bold text for key formulas.
      End every explanation with a "Quick Revision" summary of 3 bullet points.
      Address the student as ${firstName} to keep them calm.`;
    } else {
      systemPrompt += `\nAddress the student by their name, ${firstName}, to keep it personalized. Be a helpful and general assistant.`;
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map(msg => ({ 
        role: msg.role === 'model' ? 'assistant' : 'user', 
        content: msg.content 
      })),
      { role: 'user', content: question }
    ];

    const chatCompletion = await groq.chat.completions.create({
      messages: messages as any,
      model: "llama-3.1-8b-instant",
    });

    return { success: true, data: chatCompletion.choices[0]?.message?.content || "" };
  } catch (error: any) {
    console.error("PrepPilot Chat Error:", error);
    return { success: false, error: error.message };
  }
}
