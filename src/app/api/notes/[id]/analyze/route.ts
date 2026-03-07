// Note Analysis API - Trigger beat extraction for a note
// POST /api/notes/[id]/analyze
//
// On re-analysis: wipes prior note-beat links and auto-suggested connections,
// then re-extracts beats and infers connections.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { requireUser, AuthError } from '@/lib/auth/server';

// POST /api/notes/[id]/analyze - Trigger beat extraction (wipe + regenerate)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser(request);
    const { id: noteId } = await params;
    const body = await request.json();

    // Get the note
    const note = await prisma.note.findFirst({
      where: { id: noteId, userId: user.id },
      select: {
        id: true,
        userId: true,
        title: true,
        content: true,
        contentPlain: true,
        noteType: true,
        analysisStatus: true
      }
    });

    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    const text = note.contentPlain || note.content || '';

    if (!text || text.trim().length < 10) {
      return NextResponse.json(
        { error: 'Note content is too short for analysis' },
        { status: 400 }
      );
    }

    // Mark as processing
    await prisma.note.update({
      where: { id: noteId },
      data: { analysisStatus: 'PROCESSING', analyzedAt: new Date() }
    });

    try {
      // === WIPE PHASE ===
      // Get beat IDs currently linked to this note
      const existingNoteBeats = await prisma.noteBeat.findMany({
        where: { noteId },
        select: { beatId: true }
      });
      const existingBeatIds = existingNoteBeats.map(nb => nb.beatId);

      if (existingBeatIds.length > 0) {
        // Delete auto-suggested connections between these beats
        await prisma.beatConnection.deleteMany({
          where: {
            userId: user.id,
            isSuggested: true,
            OR: [
              { fromBeatId: { in: existingBeatIds } },
              { toBeatId: { in: existingBeatIds } }
            ]
          }
        });

        // Delete note-beat links
        await prisma.noteBeat.deleteMany({
          where: { noteId }
        });

        // Optional: delete orphan beats that have no other note links
        // (keeping this simple for now - beats are reusable)
      }

      // === EXTRACT PHASE ===
      const { getBeatExtractor } = await import('@/lib/beats/extractor');
      const extractor = getBeatExtractor();

      const extractedBeats = await extractor.extract(text, {
        model: body.model || 'cloud'
      });

      const createdBeats: Array<{ id: string; beatType: string; name: string; summary: string | null }> = [];

      for (const extractedBeat of extractedBeats) {
        // Check if beat already exists (global dedup by name+type)
        const existing = await prisma.beat.findFirst({
          where: {
            userId: user.id,
            name: extractedBeat.name,
            beatType: extractedBeat.type
          }
        });

        let beat: { id: string; beatType: string; name: string; summary: string | null };

        if (existing) {
          // Increment frequency and link to note
          await prisma.beat.update({
            where: { id: existing.id },
            data: { frequency: { increment: 1 } }
          });

          await prisma.noteBeat.create({
            data: {
              noteId,
              beatId: existing.id,
              relevance: extractedBeat.confidence,
              mentions: 1
            }
          });

          beat = { id: existing.id, beatType: existing.beatType, name: existing.name, summary: existing.summary };
        } else {
          // Create new beat
          const created = await prisma.beat.create({
            data: {
              userId: user.id,
              beatType: extractedBeat.type,
              name: extractedBeat.name,
              summary: extractedBeat.summary,
              intensity: extractedBeat.intensity || 0.5,
              valence: extractedBeat.valence,
              source: 'AUTO',
              confidence: extractedBeat.confidence,
              noteBeats: {
                create: { noteId, relevance: extractedBeat.confidence, mentions: 1 }
              }
            }
          });
          beat = { id: created.id, beatType: created.beatType, name: created.name, summary: created.summary };
        }

        createdBeats.push(beat);
      }

      // === CONNECTIONS PHASE ===
      // Trigger connection inference for this note
      let connectionsCreated = 0;

      if (createdBeats.length >= 2) {
        try {
          const detectRes = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/beats/detect-connections`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: user.id,
                noteId,
                maxPairs: 30,
                minStrength: 0.65
              })
            }
          );

          if (detectRes.ok) {
            const detectData = await detectRes.json();
            connectionsCreated = detectData.createdCount || 0;
          }
        } catch (connErr) {
          console.error('Connection detection failed (non-fatal):', connErr);
        }
      }

      // Mark completed
      await prisma.note.update({
        where: { id: noteId },
        data: { analysisStatus: 'COMPLETED', analysisError: null }
      });

      return NextResponse.json({
        success: true,
        noteId,
        beatsExtracted: createdBeats.length,
        connectionsCreated,
        beats: createdBeats
      });
    } catch (extractError) {
      await prisma.note.update({
        where: { id: noteId },
        data: {
          analysisStatus: 'FAILED',
          analysisError: extractError instanceof Error ? extractError.message : 'Unknown error'
        }
      });
      throw extractError;
    }
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
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
    const user = await requireUser(request);
    const { id: noteId } = await params;

    const note = await prisma.note.findFirst({
      where: { id: noteId, userId: user.id },
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
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    return NextResponse.json({
      noteId,
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
    if (error instanceof AuthError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error getting analysis status:', error);
    return NextResponse.json({ error: 'Failed to get analysis status' }, { status: 500 });
  }
}