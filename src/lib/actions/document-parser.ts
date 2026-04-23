'use server'

import pdfParseModule from 'pdf-parse';

export async function parsePdfToText(buffer: Buffer): Promise<string> {
  // Try pdf-parse first
  try {
    const parsePDF = typeof pdfParseModule === 'function' 
      ? pdfParseModule 
      : (pdfParseModule as any).default;

    if (typeof parsePDF === 'function') {
      const pdfData = await parsePDF(buffer);
      if (pdfData.text && pdfData.text.trim().length > 10) {
        return pdfData.text.trim();
      }
    }
  } catch (err) {
    console.error('pdf-parse failed, trying fallback...', err);
  }

  // Fallback: pdf2json
  try {
    const PDFParser = require('pdf2json');
    const pdfParser = new PDFParser(null, 1);

    return new Promise((resolve, reject) => {
      pdfParser.on("pdfParser_dataError", (errData: any) => reject(errData));
      pdfParser.on("pdfParser_dataReady", () => {
        try {
          const rawText = pdfParser.getRawTextContent();
          resolve(rawText?.trim() || "");
        } catch (e) {
          reject(e);
        }
      });
      pdfParser.parseBuffer(buffer);
    });
  } catch (err) {
    console.error('pdf2json fallback also failed:', err);
    throw new Error('Failed to extract text from PDF using all available methods.');
  }
}
