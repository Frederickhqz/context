// File Upload API - Handle document imports
// Supports: txt, md, doc, docx, pdf, rtf, html

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

// Supported file types
const SUPPORTED_TYPES: Record<string, { ext: string; mime: string[] }> = {
  txt: { ext: '.txt', mime: ['text/plain'] },
  md: { ext: '.md', mime: ['text/markdown', 'text/x-markdown'] },
  doc: { ext: '.doc', mime: ['application/msword'] },
  docx: { ext: '.docx', mime: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'] },
  pdf: { ext: '.pdf', mime: ['application/pdf'] },
  rtf: { ext: '.rtf', mime: ['application/rtf', 'text/rtf'] },
  html: { ext: '.html', mime: ['text/html'] },
};

// POST /api/upload - Upload and extract text from document
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const userId = formData.get('userId') as string || 'demo-user';
    const title = formData.get('title') as string | undefined;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    // Detect file type
    const fileName = file.name.toLowerCase();
    const ext = fileName.split('.').pop() || '';
    const mimeType = file.type;
    
    const supportedType = Object.entries(SUPPORTED_TYPES).find(
      ([_, config]) => config.ext === `.${ext}` || config.mime.includes(mimeType)
    );
    
    if (!supportedType) {
      return NextResponse.json(
        { error: `Unsupported file type: ${ext}. Supported: ${Object.keys(SUPPORTED_TYPES).join(', ')}` },
        { status: 400 }
      );
    }
    
    // Extract text based on file type
    let text: string;
    let metadata: Record<string, unknown> = {};
    
    switch (supportedType[0]) {
      case 'txt':
      case 'md':
        text = await extractPlainText(file);
        break;
        
      case 'html':
        text = await extractFromHtml(file);
        break;
        
      case 'doc':
        text = await extractFromDoc(file);
        break;
        
      case 'docx':
        text = await extractFromDocx(file);
        break;
        
      case 'pdf':
        text = await extractFromPdf(file);
        break;
        
      case 'rtf':
        text = await extractFromRtf(file);
        break;
        
      default:
        text = await extractPlainText(file);
    }
    
    // Calculate metadata
    const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
    const charCount = text.length;
    const lineCount = text.split('\n').length;
    
    // Estimate reading time (200 words per minute)
    const readingTimeMinutes = Math.ceil(wordCount / 200);
    
    // Estimate chunk count for extraction
    const estimatedChunks = Math.ceil(charCount / 8000);
    
    // Create note with the content
    const note = await prisma.note.create({
      data: {
        userId,
        title: title || fileName.replace(/\.[^.]+$/, ''),
        contentPlain: text,
        content: text, // Plain text for now, will be formatted later
        noteType: 'import',
        metadata: {
          source: 'file_upload',
          fileName: file.name,
          fileSize: file.size,
          mimeType,
          wordCount,
          charCount,
          lineCount,
          readingTimeMinutes,
          estimatedChunks,
          ...metadata,
        },
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
      },
    });
    
    return NextResponse.json({
      success: true,
      note: {
        id: note.id,
        title: note.title,
        createdAt: note.createdAt,
      },
      stats: {
        wordCount,
        charCount,
        lineCount,
        readingTimeMinutes,
        estimatedChunks,
      },
      message: estimatedChunks > 1 
        ? `Document uploaded. Will be processed in ${estimatedChunks} chunks.`
        : 'Document uploaded and ready for extraction.',
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to process upload', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Extract plain text from file
async function extractPlainText(file: File): Promise<string> {
  return await file.text();
}

// Extract text from HTML
async function extractFromHtml(file: File): Promise<string> {
  const html = await file.text();
  // Simple HTML to text conversion
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

// Extract text from .doc (legacy Word)
async function extractFromDoc(file: File): Promise<string> {
  // .doc files are binary, would need a library like mammoth
  // For now, return a message
  const buffer = await file.arrayBuffer();
  
  // Try to extract readable text (very basic)
  const text = Buffer.from(buffer).toString('utf-8')
    .replace(/[^\x20-\x7E\n\r]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  return text || '[Binary .doc file - please convert to .docx or .txt for better extraction]';
}

// Extract text from .docx (modern Word)
async function extractFromDocx(file: File): Promise<string> {
  // .docx is a zip with XML inside
  // For now, return placeholder - would need jszip library
  return `[.docx file: ${file.name} - Convert to .txt or paste content for best results. .docx support coming soon.]`;
}

// Extract text from PDF
async function extractFromPdf(file: File): Promise<string> {
  // PDF extraction requires pdf-parse or similar
  // For now, return placeholder
  return `[PDF file: ${file.name} - PDF text extraction requires pdf-parse library. Please convert to .txt or paste content directly.]`;
}

// Extract text from RTF
async function extractFromRtf(file: File): Promise<string> {
  const rtf = await file.text();
  
  // Basic RTF to text conversion
  return rtf
    .replace(/\\[a-z]+\d* ?/gi, '') // Remove RTF control words
    .replace(/[{}]/g, '')           // Remove braces
    .replace(/\\\\/g, '\\')         // Unescape backslashes
    .replace(/\\'/g, "'")           // Unescape quotes
    .replace(/\s+/g, ' ')
    .trim();
}

export const config = {
  api: {
    bodyParser: false, // Disable default body parser for file upload
  },
};