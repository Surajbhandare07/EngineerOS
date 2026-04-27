import { createClient } from '@/utils/supabase/server';
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: Request) {
  try {
    const { syllabusText, question, language, history, firstName, complexMode } = await req.json();

    let systemInstructions = `You are EngineerOS, an advanced Multimodal Engineering AI. 
    You MUST respond entirely in ${language}.
    
    Identity: You are the core intelligence of EngineerOS. Your goal is to be an interactive engineering tutor, not just a document reader.
    
    Response Style:
    - BE INTERACTIVE: Don't dump everything at once. Give a high-level intuitive explanation first, then ask the user if they want to see the mathematical derivation or a real-world example.
    - ENGAGING: Use analogies (e.g., "Think of voltage like water pressure").
    - CONCISE BUT DEEP: Use structured Markdown (bolding, lists) but keep paragraphs short.
    - FORMATTING: Use LaTeX for all formulas.
    
    Context Handling:
    ${syllabusText ? `Attached Documents/Context:\n${syllabusText.substring(0, 15000)}` : "No external documents attached. Answer based on your internal engineering knowledge."}
    
    Capabilities:
    - Address the student as ${firstName || 'Engineer'}.
    - If a user asks for "Notes," be thorough. For general chat, stay interactive.`;

    if (complexMode) {
      systemInstructions += `\nShow your internal reasoning process clearly within <think> tags.`;
    }

    const formattedMessages = history.map((msg: any) => ({ 
      role: msg.role === 'model' ? 'assistant' : 'user', 
      content: msg.content 
    }));

    // Construct clean history without duplication
    const messages = [
      { 
        role: 'system', 
        content: systemInstructions 
      },
      ...formattedMessages
    ];

    const modelId = complexMode ? "openai/gpt-oss-120b" : "llama-3.3-70b-versatile";

    const stream = await groq.chat.completions.create({
      messages: messages as any,
      model: modelId,
      temperature: complexMode ? 0.6 : 0.7,
      max_completion_tokens: 4096,
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
