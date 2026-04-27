'use server'

import { extractText, getDocumentProxy } from 'unpdf'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export interface ParsingResult {
  text: string;
}

/**
 * Universal Document Parser - Simplified for Serverless
 * Focuses on digital text extraction and direct image vision.
 * Scanned PDFs are now handled by client-side rendering.
 */
export async function universalDocumentParser(file: File): Promise<ParsingResult> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 1. Image Support
    if (file.type.startsWith('image/')) {
      const base64Data = buffer.toString('base64');
      const text = await callGroqVision([{ type: 'image_url', image_url: { url: `data:${file.type};base64,${base64Data}` } }]);
      return { text };
    }

    // 2. PDF Handling (Digital Only)
    if (file.type === 'application/pdf') {
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const { text: digitalText } = await extractText(pdf, { mergePages: true });
      
      if (digitalText && digitalText.trim().length > 100) {
        return { text: digitalText.trim() };
      }
      
      return { text: "Error: This PDF appears to be a scan. Please try again (client-side rendering should have handled this)." };
    }

    return { text: `Error: Unsupported file type: ${file.type}` };

  } catch (error: any) {
    console.error('[Parser] Fatal Error:', error);
    return { text: `Error: ${error.message || 'Unknown error'}` };
  }
}

async function callGroqVision(imageContent: any[]): Promise<string> {
  try {
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
            ...imageContent
          ]
        }
      ],
      temperature: 0.1,
    });

    return response.choices[0]?.message?.content?.trim() || "AI could not read the document content.";
  } catch (error: any) {
    console.error('[Parser] Groq Vision API Error:', error.message);
    return `AI Processing Error: ${error.message}`;
  }
}
