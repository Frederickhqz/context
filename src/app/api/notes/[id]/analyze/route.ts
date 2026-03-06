// Note Analysis API - Trigger beat extraction for a note
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

// POST /api/notes/[id]/analyze - Trigger beat extraction
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Get the note
    const note = await prisma.note.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        content: true,
        contentPlain: true,
        noteType: true,
        analysisStatus: true
      }
    });

    if (!note) {
      return NextResponse.json(
        { error: 'Note not found' },
        { status: 404 }
      );
    }

    // Get the text to analyze
    const text = note.contentPlain || note.content || '';

    if (!text || text.trim().length < 10) {
      return NextResponse.json(
        { error: 'Note content is too short for analysis' },
        { status: 400 }
      );
    }

    // Update analysis status
    await prisma.note.update({
      where: { id },
      data: {
        analysisStatus: 'PROCESSING',
        analyzedAt: new Date()
      }
    });

    try {
      // Import the beat extractor
      const { getBeatExtractor } = await import('@/lib/beats/extractor');
      const extractor = getBeatExtractor();

      // Extract beats from the text
      const extractedBeats = await extractor.extract(text, {});

      // Store extracted beats
      const createdBeats = [];
      for (const extractedBeat of extractedBeats) {
        // Check if beat already exists
        const existing = await prisma.beat.findFirst({
          where: {
            userId: 'demo-user',
            name: extractedBeat.name,
            beatType: extractedBeat.type
          }
        });

        if (existing) {
          // Link existing beat to note
          await prisma.noteBeat.create({
            data: {
              noteId: id,
              beatId: existing.id,
              relevance: extractedBeat.confidence,
              mentions: 1
            }
          });
          createdBeats.push(existing);
        } else {
          // Create new beat
          const beat = await prisma.beat.create({
            data: {
              userId: 'demo-user',
              beatType: extractedBeat.type,
              name: extractedBeat.name,
              summary: extractedBeat.summary,
              intensity: extractedBeat.intensity || 0.5,
              valence: extractedBeat.valence,
              source: 'AUTO',
              confidence: extractedBeat.confidence,
              noteBeats: {
                create: {
                  noteId: id,
                  relevance: extractedBeat.confidence,
                  mentions: 1
                }
              }
            }
          });
          createdBeats.push(beat);
        }
      }

      // Create connections between beats
      let connectionsCreated = 0;
      for (const extractedBeat of extractedBeats) {
        if (extractedBeat.connections) {
          for (const conn of extractedBeat.connections) {
            const fromBeat = createdBeats.find(b => b.name === extractedBeat.name);
            const toBeat = createdBeats.find(b => b.name === conn.toBeatName);
            if (fromBeat && toBeat) {
              await prisma.beatConnection.create({
                data: {
                  userId: 'demo-user',
                  fromBeatId: fromBeat.id,
                  toBeatId: toBeat.id,
                  connectionType: conn.type,
                  strength: conn.strength,
                  isContradiction: false
                }
              });
              connectionsCreated++;
            }
          }
        }
      }

      // Update analysis status
      await prisma.note.update({
        where: { id },
        data: {
          analysisStatus: 'COMPLETED',
          analysisError: null
        }
      });

      return NextResponse.json({
        success: true,
        noteId: id,
        beatsExtracted: createdBeats.length,
        connectionsCreated,
        beats: createdBeats.map(b => ({
          id: b.id,
          type: b.beatType,
          name: b.name,
          summary: b.summary
        }))
      });
    } catch (extractError) {
      // Mark analysis as failed
      await prisma.note.update({
        where: { id },
        data: {
          analysisStatus: 'FAILED',
          analysisError: extractError instanceof Error ? extractError.message : 'Unknown error'
        }
      });

      throw extractError;
    }
  } catch (error) {
    console.error('Error analyzing note:', error);
    return NextResponse.json(
      { error: 'Failed to analyze note', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET /api/notes/[id]/analyze - Get analysis status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const note = await prisma.note.findUnique({
      where: { id },
      select: {
        id: true,
        analysisStatus: true,
        analyzedAt: true,
        analysisError: true,
        noteBeats: {
          include: {
            beat: {
              select: {
                id: true,
                beatType: true,
                name: true,
                summary: true,
                intensity: true
              }
            }
          }
        }
      }
    });

    if (!note) {
      return NextResponse.json(
        { error: 'Note not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      noteId: id,
      status: note.analysisStatus,
      analyzedAt: note.analyzedAt,
      error: note.analysisError,
      beats: note.noteBeats.map(nb => ({
        id: nb.beat.id,
        type: nb.beat.beatType,
        name: nb.beat.name,
        summary: nb.beat.summary,
        intensity: nb.beat.intensity,
        context: nb.context,
        relevance: nb.relevance
      }))
    });
  } catch (error) {
    console.error('Error getting analysis status:', error);
    return NextResponse.json(
      { error: 'Failed to get analysis status' },
      { status: 500 }
    );
  }
}