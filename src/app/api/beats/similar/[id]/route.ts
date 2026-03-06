// Similar Beats API - Find similar beats by ID
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

// GET /api/beats/similar/[id] - Find similar beats
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);
    const threshold = parseFloat(searchParams.get('threshold') || '0.5');

    // Get the source beat
    const sourceBeat = await prisma.beat.findUnique({
      where: { id },
      include: {
        connections: { include: { toBeat: true } },
        reverseConnections: { include: { fromBeat: true } },
        noteBeats: { select: { noteId: true } }
      }
    });

    if (!sourceBeat) {
      return NextResponse.json(
        { error: 'Beat not found' },
        { status: 404 }
      );
    }

    // Find similar beats based on:
    // 1. Same type
    // 2. Shared connections
    // 3. Name/summary similarity (keyword)
    
    const similarBeats = await prisma.beat.findMany({
      where: {
        AND: [
          { id: { not: id } }, // Exclude self
          {
            OR: [
              // Same type
              { beatType: sourceBeat.beatType },
              // Similar name (contains same words)
              {
                name: {
                  contains: sourceBeat.name.split(' ')[0],
                  mode: 'insensitive'
                }
              },
              // Shared connections (via same notes)
              {
                noteBeats: {
                  some: {
                    noteId: {
                      in: (await prisma.noteBeat.findMany({
                        where: { beatId: id },
                        select: { noteId: true }
                      })).map(nb => nb.noteId)
                    }
                  }
                }
              }
            ]
          }
        ]
      },
      take: limit,
      include: {
        noteBeats: {
          include: { note: { select: { id: true, title: true } } }
        }
      }
    });

    // Calculate similarity scores
    const scoredBeats = similarBeats.map(beat => {
      let score = 0;
      
      // Same type bonus
      if (beat.beatType === sourceBeat.beatType) {
        score += 0.3;
      }
      
      // Name similarity
      const nameWords = sourceBeat.name.toLowerCase().split(' ');
      const beatWords = beat.name.toLowerCase().split(' ');
      const sharedWords = nameWords.filter(w => beatWords.includes(w)).length;
      score += Math.min(sharedWords / Math.max(nameWords.length, 1), 0.3);
      
      // Shared notes
      const sourceNoteIds = new Set(sourceBeat.noteBeats.map(nb => nb.noteId));
      const sharedNotes = beat.noteBeats.filter(nb => sourceNoteIds.has(nb.noteId)).length;
      score += Math.min(sharedNotes * 0.1, 0.4);
      
      return {
        beat: {
          id: beat.id,
          type: beat.beatType,
          name: beat.name,
          summary: beat.summary,
          intensity: beat.intensity,
          notes: beat.noteBeats.map(nb => ({
            id: nb.note.id,
            title: nb.note.title
          }))
        },
        similarityScore: Math.min(score, 1)
      };
    });

    // Filter by threshold and sort
    const filteredBeats = scoredBeats
      .filter(b => b.similarityScore >= threshold)
      .sort((a, b) => b.similarityScore - a.similarityScore);

    return NextResponse.json({
      sourceBeat: {
        id: sourceBeat.id,
        type: sourceBeat.beatType,
        name: sourceBeat.name
      },
      similarBeats: filteredBeats,
      total: filteredBeats.length,
      threshold
    });
  } catch (error) {
    console.error('Error finding similar beats:', error);
    return NextResponse.json(
      { error: 'Failed to find similar beats' },
      { status: 500 }
    );
  }
}