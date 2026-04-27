'use server'

import Groq from 'groq-sdk';
import { createClient } from '@/utils/supabase/server';
import { Language } from '@/types'
import { universalDocumentParser } from './document-parser'
import { getUserProfile } from './profile'

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
    const clientExtractedText = formData.get('extractedText') as string | null
    const renderedImage = formData.get('renderedImage') as File | null

    if (!file) return { success: false, error: 'No file provided.' }

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
                text: "You are an advanced academic OCR. Extract all text from this study material accurately."
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
      return { success: false, error: transcription || 'AI could not read the document.' }
    }
    return { success: true, extractedText: transcription }
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
    Match the student's language naturally. Respond in the same language and style that the student uses to communicate with you.`;

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
7. Match the student's language naturally. Respond in the same language that the student uses to communicate with you.
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
    Match the student's language naturally. Respond in the same language that the student uses to communicate with you.
    
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
    Match the student's language naturally. Respond in the same language that the student uses to communicate with you.
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

/* ─────────────────────────────────────────────────────────────────────
   New: High-fidelity Text to Speech using Groq Orpheus
───────────────────────────────────────────────────────────────────── */
export async function generateSpeech(text: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    // Clean text: remove markdown artifacts like ** and *
    const cleanText = text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#/g, '').trim()

    const response = await groq.audio.speech.create({
      model: "canopylabs/orpheus-v1-english",
      voice: "hannah", 
      input: cleanText,
      response_format: "wav",
    });
    
    const buffer = Buffer.from(await response.arrayBuffer());
    const base64 = buffer.toString('base64');
    
    return { success: true, audio: `data:audio/wav;base64,${base64}` };
  } catch (error: any) {
    console.error('Groq TTS Error:', error);
    return { success: false, error: error.message };
  }
}
