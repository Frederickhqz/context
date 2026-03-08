// Smart Text Chunking - Split long texts for beat extraction
// Respects semantic boundaries (chapters, paragraphs, sentences)

export interface TextChunk {
  id: string;
  text: string;
  index: number;
  startChar: number;
  endChar: number;
  wordCount: number;
  type: 'chapter' | 'section' | 'paragraph' | 'overflow';
  title?: string;
}

export interface ChunkingOptions {
  maxChunkSize?: number;      // Target chunk size in chars (default: 8000)
  minChunkSize?: number;      // Minimum chunk size (default: 2000)
  overlapSize?: number;       // Overlap between chunks (default: 500)
  respectBoundaries?: boolean; // Split at chapter/section breaks
  detectChapters?: boolean;   // Auto-detect chapter boundaries
}

// Chapter/section detection patterns
const BOUNDARY_PATTERNS = [
  /^chapter\s+(\d+|[ivxlc]+)[.:]?\s*(.*)$/im,           // "Chapter 1" or "Chapter I: Title"
  /^part\s+(\d+|[ivxlc]+)[.:]?\s*(.*)$/im,              // "Part 1" or "Part I: Title"
  /^section\s+(\d+|[ivxlc]+)[.:]?\s*(.*)$/im,           // "Section 1"
  /^act\s+(\d+|[ivxlc]+)[.:]?\s*(.*)$/im,               // "Act 1"
  /^prologue[.:]?\s*(.*)$/im,                            // "Prologue"
  /^epilogue[.:]?\s*(.*)$/im,                            // "Epilogue"
  /^book\s+(\d+|[ivxlc]+)[.:]?\s*(.*)$/im,              // "Book 1"
  /^#{1,3}\s+(.+)$/m,                                    // Markdown headers
  /^(\d+)\.\s+(.+)$/m,                                   // Numbered sections "1. Title"
];

// Scene break patterns
const SCENE_BREAK = /\n{3,}|\*{3,}|_{3,}|-{3,}|#{3,}/;

/**
 * Smart text chunking for beat extraction
 */
export function chunkText(text: string, options: ChunkingOptions = {}): TextChunk[] {
  const {
    maxChunkSize = 8000,
    minChunkSize = 2000,
    overlapSize = 500,
    respectBoundaries = true,
    detectChapters = true,
  } = options;

  // If text is small enough, return as single chunk
  if (text.length <= maxChunkSize) {
    return [{
      id: `chunk_0`,
      text: text.trim(),
      index: 0,
      startChar: 0,
      endChar: text.length,
      wordCount: countWords(text),
      type: 'paragraph',
    }];
  }

  const chunks: TextChunk[] = [];

  // Try to split by chapters first
  if (detectChapters && respectBoundaries) {
    const chapters = detectChapterBoundaries(text);
    
    if (chapters.length > 1) {
      // Process each chapter
      for (let i = 0; i < chapters.length; i++) {
        const chapter = chapters[i];
        
        if (chapter.text.length <= maxChunkSize) {
          // Chapter fits in one chunk
          chunks.push({
            id: `chunk_${chunks.length}`,
            text: chapter.text,
            index: chunks.length,
            startChar: chapter.start,
            endChar: chapter.end,
            wordCount: countWords(chapter.text),
            type: 'chapter',
            title: chapter.title,
          });
        } else {
          // Chapter too long, split further
          const subChunks = splitLongSection(
            chapter.text,
            chapter.start,
            maxChunkSize,
            minChunkSize,
            overlapSize
          );
          
          for (const subChunk of subChunks) {
            chunks.push({
              ...subChunk,
              id: `chunk_${chunks.length}`,
              index: chunks.length,
              type: 'section',
              title: chapter.title ? `${chapter.title} (part ${subChunk.index + 1})` : undefined,
            });
          }
        }
      }
      
      return chunks;
    }
  }

  // No chapter boundaries, split by paragraphs
  return splitLongSection(text, 0, maxChunkSize, minChunkSize, overlapSize);
}

/**
 * Detect chapter boundaries in text
 */
function detectChapterBoundaries(text: string): Array<{
  start: number;
  end: number;
  text: string;
  title?: string;
}> {
  const chapters: Array<{ start: number; end: number; text: string; title?: string }> = [];
  const lines = text.split('\n');
  
  let currentStart = 0;
  let currentTitle: string | undefined;
  let lastBoundary = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    for (const pattern of BOUNDARY_PATTERNS) {
      const match = line.match(pattern);
      if (match) {
        // Found a boundary
        const boundaryPos = text.indexOf(lines[i], lastBoundary);
        
        if (boundaryPos > currentStart) {
          // Save previous chapter
          chapters.push({
            start: currentStart,
            end: boundaryPos,
            text: text.slice(currentStart, boundaryPos).trim(),
            title: currentTitle,
          });
        }
        
        currentStart = boundaryPos;
        currentTitle = match[2] || match[1] || line.slice(0, 50);
        lastBoundary = boundaryPos + lines[i].length;
        break;
      }
    }
  }
  
  // Add final chapter
  if (currentStart < text.length) {
    chapters.push({
      start: currentStart,
      end: text.length,
      text: text.slice(currentStart).trim(),
      title: currentTitle,
    });
  }
  
  // If no chapters found, return entire text as one section
  if (chapters.length === 0) {
    chapters.push({
      start: 0,
      end: text.length,
      text: text.trim(),
    });
  }
  
  return chapters;
}

/**
 * Split a long section into smaller chunks
 */
function splitLongSection(
  text: string,
  startOffset: number,
  maxSize: number,
  minSize: number,
  overlap: number
): TextChunk[] {
  const chunks: TextChunk[] = [];
  const paragraphs = text.split(/\n\n+/);
  
  let currentChunk: string[] = [];
  let currentSize = 0;
  let chunkStart = startOffset;
  let currentIndex = 0;
  
  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i];
    const paraSize = para.length + 2; // +2 for paragraph break
    
    if (currentSize + paraSize > maxSize && currentSize >= minSize) {
      // Current chunk is full, save it
      const chunkText = currentChunk.join('\n\n');
      chunks.push({
        id: `chunk_${currentIndex}`,
        text: chunkText,
        index: currentIndex,
        startChar: chunkStart,
        endChar: chunkStart + chunkText.length,
        wordCount: countWords(chunkText),
        type: 'paragraph',
      });
      
      // Start new chunk with overlap
      const overlapText = getOverlapText(currentChunk, overlap);
      currentChunk = overlapText ? [overlapText] : [];
      currentSize = overlapText ? overlapText.length : 0;
      chunkStart = chunkStart + chunkText.length - (overlapText?.length || 0);
      currentIndex++;
    }
    
    currentChunk.push(para);
    currentSize += paraSize;
  }
  
  // Add final chunk
  if (currentChunk.length > 0) {
    const chunkText = currentChunk.join('\n\n');
    chunks.push({
      id: `chunk_${currentIndex}`,
      text: chunkText,
      index: currentIndex,
      startChar: chunkStart,
      endChar: chunkStart + chunkText.length,
      wordCount: countWords(chunkText),
      type: 'paragraph',
    });
  }
  
  return chunks;
}

/**
 * Get overlap text from previous chunk
 */
function getOverlapText(paragraphs: string[], overlapSize: number): string | null {
  if (overlapSize <= 0) return null;
  
  const text = paragraphs.join('\n\n');
  if (text.length <= overlapSize) return text;
  
  // Find a good break point (sentence boundary)
  const overlapText = text.slice(-overlapSize);
  const sentenceBreak = overlapText.indexOf('. ');
  
  if (sentenceBreak > 0 && sentenceBreak < overlapText.length - 100) {
    return overlapText.slice(sentenceBreak + 2);
  }
  
  return overlapText;
}

/**
 * Count words in text
 */
function countWords(text: string): number {
  return text.split(/\s+/).filter(w => w.length > 0).length;
}

/**
 * Merge extraction results from multiple chunks
 */
export function mergeChunkResults<T extends { name: string; type?: string }>(
  results: Array<{ chunk: TextChunk; items: T[] }>,
  options: { deduplicate?: boolean } = {}
): T[] {
  const { deduplicate = true } = options;
  
  if (!deduplicate) {
    return results.flatMap(r => r.items);
  }
  
  // Deduplicate by name (case-insensitive) and type
  const seen = new Map<string, T>();
  
  for (const { items } of results) {
    for (const item of items) {
      const key = `${(item.type || 'unknown')}:${item.name.toLowerCase()}`;
      
      if (!seen.has(key)) {
        seen.set(key, item);
      }
    }
  }
  
  return Array.from(seen.values());
}

export default chunkText;