// Book Import API - Import and extract beats from books/large texts
// POST /api/imports/book - Start book import
// GET /api/imports/book/[id] - Get book import status

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { getBeatExtractor } from '@/lib/beats/extractor';
import type { BeatType } from '@/lib/beats/types';

// Book structure detection patterns
const CHAPTER_PATTERNS = [
  /^chapter\s+(\d+|[ivxlc]+)/i,           // "Chapter 1" or "Chapter I"
  /^part\s+(\d+|[ivxlc]+)/i,              // "Part 1" or "Part I"
  /^section\s+(\d+|[ivxlc]+)/i,           // "Section 1"
  /^(\d+)\.\s+/,                          // "1. Title"
  /^#{1,2}\s+.+/,                         // Markdown headers
];

const SCENE_BREAK = /\n{3,}|\*{3,}|-{3,}|_{3,}/;

interface BookSection {
  id: string;
  title: string;
  type: 'chapter' | 'section' | 'prologue' | 'epilogue' | 'scene';
  index: number;
  text: string;
  wordCount: number;
}

interface BookImportOptions {
  bookTitle?: string;
  author?: string;
  splitByChapters?: boolean;
  maxSectionLength?: number;
  extractConnections?: boolean;
  userId?: string;
}

interface BookImportResult {
  bookId: string;
  title: string;
  sections: {
    total: number;
    processed: number;
    failed: number;
  };
  beats: {
    total: number;
    byType: Record<string, number>;
  };
  connections: {
    total: number;
  };
  processingTime: number;
}

// POST /api/imports/book - Import a book
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();

    if (!body.text) {
      return NextResponse.json(
        { error: 'Book text is required' },
        { status: 400 }
      );
    }

    const options: BookImportOptions = {
      bookTitle: body.bookTitle || 'Untitled Book',
      author: body.author,
      splitByChapters: body.splitByChapters ?? true,
      maxSectionLength: body.maxSectionLength || 10000, // chars
      extractConnections: body.extractConnections ?? true,
      userId: body.userId || 'demo-user',
    };

    // Split text into sections
    const sections = splitTextIntoSections(body.text, options);

    // Create import record
    const importId = `book_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Process sections
    const extractor = getBeatExtractor();
    const allBeats: Array<{
      id: string;
      name: string;
      type: string;
      summary?: string | null;
      sectionIndex: number;
    }> = [];
    const allConnections: Array<{
      fromId: string;
      toId: string;
      type: string;
      strength: number;
    }> = [];

    let processed = 0;
    let failed = 0;
    const beatsByType: Record<string, number> = {};

    for (const section of sections) {
      try {
        // Extract beats from section
        const extractedBeats = await extractor.extract(section.text, {
          existingBeats: allBeats.map(b => ({
            name: b.name,
            type: b.type as BeatType,
            summary: b.summary || '',
            intensity: 0.5,
            valence: 0,
            confidence: 1,
          })),
        });

        // Create beat records
        for (const extractedBeat of extractedBeats) {
          try {
            const beat = await prisma.beat.create({
              data: {
                userId: options.userId!,
                beatType: extractedBeat.type,
                name: extractedBeat.name,
                summary: extractedBeat.summary,
                intensity: extractedBeat.intensity || 0.5,
                valence: extractedBeat.valence,
                source: 'IMPORTED',
                confidence: extractedBeat.confidence,
                metadata: {
                  importId,
                  sectionIndex: section.index,
                  sectionTitle: section.title,
                },
              },
            });

            allBeats.push({
              id: beat.id,
              name: beat.name,
              type: beat.beatType,
              summary: beat.summary,
              sectionIndex: section.index,
            });

            beatsByType[beat.beatType] = (beatsByType[beat.beatType] || 0) + 1;

            // Track connections
            if (extractedBeat.connections) {
              for (const conn of extractedBeat.connections) {
                const toBeat = allBeats.find(b => b.name === conn.toBeatName);
                if (toBeat) {
                  allConnections.push({
                    fromId: beat.id,
                    toId: toBeat.id,
                    type: conn.type,
                    strength: conn.strength,
                  });
                }
              }
            }
          } catch (err) {
            console.warn(`Failed to create beat: ${extractedBeat.name}`, err);
          }
        }

        processed++;
      } catch (err) {
        console.warn(`Failed to process section ${section.index}:`, err);
        failed++;
      }
    }

    // Create connections
    let connectionsCreated = 0;
    for (const conn of allConnections) {
      try {
        // Check if connection already exists
        const existing = await prisma.beatConnection.findFirst({
          where: {
            userId: options.userId!,
            OR: [
              { fromBeatId: conn.fromId, toBeatId: conn.toId },
              { fromBeatId: conn.toId, toBeatId: conn.fromId },
            ],
          },
        });

        if (!existing) {
          await prisma.beatConnection.create({
            data: {
              userId: options.userId!,
              fromBeatId: conn.fromId,
              toBeatId: conn.toId,
              connectionType: conn.type as any,
              strength: conn.strength,
              isSuggested: false,
            },
          });
          connectionsCreated++;
        }
      } catch (err) {
        console.warn('Failed to create connection:', err);
      }
    }

    // Create import record for tracking
    const result: BookImportResult = {
      bookId: importId,
      title: options.bookTitle!,
      sections: {
        total: sections.length,
        processed,
        failed,
      },
      beats: {
        total: allBeats.length,
        byType: beatsByType,
      },
      connections: {
        total: connectionsCreated,
      },
      processingTime: Date.now() - startTime,
    };

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Book import error:', error);
    return NextResponse.json(
      { error: 'Failed to import book', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET /api/imports/book - List book imports
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'demo-user';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);

    // Get beats from book imports (source is stored in metadata)
    const imports = await prisma.beat.findMany({
      where: { userId },
      select: { source: true, metadata: true },
    });
    
    // Group by import ID from metadata
    const importGroups: Record<string, number> = {};
    for (const beat of imports) {
      const importId = beat.metadata as Record<string, string> | null;
      if (importId?.importId) {
        importGroups[importId.importId] = (importGroups[importId.importId] || 0) + 1;
      }
    }

    return NextResponse.json({
      imports: Object.entries(importGroups).map(([importId, count]) => ({
        importId,
        beatCount: count,
      })),
      note: 'Book imports are tracked via beat source metadata',
    });
  } catch (error) {
    console.error('Error listing imports:', error);
    return NextResponse.json(
      { error: 'Failed to list imports' },
      { status: 500 }
    );
  }
}

// Helper: Split text into sections
function splitTextIntoSections(text: string, options: BookImportOptions): BookSection[] {
  const sections: BookSection[] = [];
  const maxLen = options.maxSectionLength!;

  if (options.splitByChapters) {
    // Try to detect chapters
    const lines = text.split('\n');
    let currentChapter: string[] = [];
    let currentTitle = 'Prologue';
    let chapterIndex = 0;

    for (const line of lines) {
      const trimmed = line.trim();

      // Check for chapter markers
      let isChapterStart = false;
      for (const pattern of CHAPTER_PATTERNS) {
        if (pattern.test(trimmed)) {
          isChapterStart = true;
          break;
        }
      }

      if (isChapterStart && currentChapter.length > 0) {
        // Save previous chapter
        const chapterText = currentChapter.join('\n');
        if (chapterText.trim().length > 100) {
          sections.push({
            id: `section_${sections.length}`,
            title: currentTitle,
            type: 'chapter',
            index: chapterIndex++,
            text: chapterText.trim(),
            wordCount: chapterText.split(/\s+/).length,
          });
        }
        currentChapter = [line];
        currentTitle = trimmed;
      } else {
        currentChapter.push(line);

        // Check if section is too long
        if (currentChapter.join('\n').length > maxLen) {
          const chapterText = currentChapter.join('\n');
          // Split at scene breaks or create chunks
          const sceneBreaks = chapterText.split(SCENE_BREAK);
          for (const scene of sceneBreaks) {
            if (scene.trim().length > 100) {
              sections.push({
                id: `section_${sections.length}`,
                title: `${currentTitle} (cont.)`,
                type: 'scene',
                index: chapterIndex++,
                text: scene.trim(),
                wordCount: scene.split(/\s+/).length,
              });
            }
          }
          currentChapter = [];
        }
      }
    }

    // Final chapter
    if (currentChapter.length > 0) {
      const chapterText = currentChapter.join('\n');
      if (chapterText.trim().length > 100) {
        sections.push({
          id: `section_${sections.length}`,
          title: currentTitle,
          type: 'chapter',
          index: chapterIndex,
          text: chapterText.trim(),
          wordCount: chapterText.split(/\s+/).length,
        });
      }
    }
  }

  // Fallback: split by size
  if (sections.length === 0) {
    const chunks = chunkText(text, maxLen);
    for (let i = 0; i < chunks.length; i++) {
      sections.push({
        id: `section_${i}`,
        title: `Section ${i + 1}`,
        type: 'section',
        index: i,
        text: chunks[i],
        wordCount: chunks[i].split(/\s+/).length,
      });
    }
  }

  return sections;
}

// Helper: Chunk text by size
function chunkText(text: string, maxLen: number): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\n+/);

  let current = '';
  for (const para of paragraphs) {
    if (current.length + para.length + 2 > maxLen && current.length > 0) {
      chunks.push(current.trim());
      current = para;
    } else {
      current += (current ? '\n\n' : '') + para;
    }
  }

  if (current.trim().length > 0) {
    chunks.push(current.trim());
  }

  return chunks;
}