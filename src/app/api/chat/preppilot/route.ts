import { createClient } from '@/utils/supabase/server';
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: Request) {
  try {
    const { syllabusText, question, language, history, isPanicMode, firstName, examDate } = await req.json();

    let timeRemainingInfo = '';
    if (isPanicMode && examDate) {
      const now = new Date();
      const exam = new Date(examDate);
      const diff = exam.getTime() - now.getTime();
      if (diff > 0) {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        timeRemainingInfo = `\n[URGENT] EXAM TIME REMAINING: ${days} days, ${hours} hours, and ${minutes} minutes. Mention this to motivate the student!`;
      }
    }

    let systemPrompt = `You are an expert AI tutor helping a student with their syllabus.
    You MUST respond entirely in ${language}.
    Syllabus Context: ${syllabusText.substring(0, 10000)}`;

    if (isPanicMode) {
      systemPrompt += `
      PANIC MODE ACTIVE: The student is stressed for an exam. ${timeRemainingInfo}
      Your goal is to teach complex topics fast but deeply. Use the "ELI5" (Explain Like I'm 5) method followed by a technical deep dive.
      Always provide 2 real-world examples.
      Use Markdown tables or bold text for key formulas.
      End every explanation with a "Quick Revision" summary of 3 bullet points.
      Address the student as ${firstName || 'Student'} to keep them calm.`;
    } else {
      systemPrompt += `\nAddress the student by their name, ${firstName || 'Student'}, to keep it personalized. Be a helpful and general assistant.`;
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map((msg: any) => ({ 
        role: msg.role === 'model' ? 'assistant' : 'user', 
        content: msg.content 
      })),
      { role: 'user', content: question }
    ];

    const stream = await groq.chat.completions.create({
      messages: messages as any,
      model: "llama-3.1-8b-instant",
      stream: true,
    });

    const responseStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              controller.enqueue(encoder.encode(content));
            }
          }
        } catch (err) {
          controller.error(err);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(responseStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error: any) {
    console.error("PrepPilot Streaming API Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
