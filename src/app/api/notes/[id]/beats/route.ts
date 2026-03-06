// Note Beats API - Extract beats from a note
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { getBeatExtractor } from '@/lib/beats/extractor';
import { BeatSource } from '@/lib/beats/types';

// GET /api/notes/[id]/beats - Get beats associated with a note
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const noteBeats = await prisma.noteBeat.findMany({
      where: { noteId: id },
      include: {
        beat: {
          include: {
            connections: {
              include: {
                toBeat: { select: { id: true, name: true, beatType: true } }
              }
            },
            reverseConnections: {
              include: {
                fromBeat: { select: { id: true, name: true, beatType: true } }
              }
            }
          }
        }
      }
    });
    
    return NextResponse.json({
      noteBeats: noteBeats.map(nb => ({
        ...nb.beat,
        relevance: nb.relevance,
        mentions: nb.mentions,
        context: nb.context,
      }))
    });
  } catch (error) {
    console.error('Error fetching note beats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch note beats' },
      { status: 500 }
    );
  }
}

// POST /api/notes/[id]/beats - Extract and create beats from note
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
      select: { id: true, content: true, contentPlain: true, userId: true }
    });
    
    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }
    
    // Update note status to processing
    await prisma.note.update({
      where: { id },
      data: { 
        analysisStatus: 'PROCESSING',
        analyzedAt: new Date()
      }
    });
    
    try {
      // Extract beats using AI
      const extractor = getBeatExtractor();
      const text = note.contentPlain || note.content;
      const extractedBeats = await extractor.extract(text, {
        model: body.model || 'cloud',
        existingBeats: body.existingBeats,
        onProgress: body.onProgress,
      });
      
      // Create beats in database
      const createdBeats = [];
      
      for (const extracted of extractedBeats) {
        // Check for existing beat with similar name
        const existingBeat = await prisma.beat.findFirst({
          where: {
            userId: note.userId,
            name: { equals: extracted.name, mode: 'insensitive' }
          }
        });
        
        let beat;
        
        if (existingBeat) {
          // Update frequency
          beat = await prisma.beat.update({
            where: { id: existingBeat.id },
            data: { 
              frequency: { increment: 1 },
              updatedAt: new Date()
            }
          });
        } else {
          // Create new beat
          beat = await prisma.beat.create({
            data: {
              userId: note.userId,
              beatType: extracted.type,
              name: extracted.name,
              summary: extracted.summary,
              intensity: extracted.intensity,
              valence: extracted.valence,
              source: BeatSource.AUTO,
              confidence: extracted.confidence,
            }
          });
          
          // Create connections if any
          if (extracted.connections && extracted.connections.length > 0) {
            for (const conn of extracted.connections) {
              // Find or create the connected beat
              let toBeat = await prisma.beat.findFirst({
                where: {
                  userId: note.userId,
                  name: { equals: conn.toBeatName, mode: 'insensitive' }
                }
              });
              
              if (!toBeat && body.createConnectedBeats) {
                // Create the connected beat with minimal info
                toBeat = await prisma.beat.create({
                  data: {
                    userId: note.userId,
                    beatType: 'THEME', // Default
                    name: conn.toBeatName,
                    source: BeatSource.AUTO,
                    confidence: 0.5,
                  }
                });
              }
              
              if (toBeat) {
                await prisma.beatConnection.create({
                  data: {
                    userId: note.userId,
                    fromBeatId: beat.id,
                    toBeatId: toBeat.id,
                    connectionType: conn.type,
                    strength: conn.strength,
                    evidence: conn.evidence,
                    isSuggested: true,
                  }
                });
              }
            }
          }
        }
        
        // Create note-beat relationship
        await prisma.noteBeat.create({
          data: {
            noteId: note.id,
            beatId: beat.id,
            relevance: extracted.confidence,
            mentions: 1,
          }
        });
        
        createdBeats.push(beat);
      }
      
      // Update note status to completed
      await prisma.note.update({
        where: { id },
        data: { 
          analysisStatus: 'COMPLETED',
          analyzedAt: new Date()
        }
      });
      
      return NextResponse.json({
        beats: createdBeats,
        count: createdBeats.length,
        noteId: note.id,
      }, { status: 201 });
      
    } catch (extractionError) {
      // Update note status to failed
      await prisma.note.update({
        where: { id },
        data: { 
          analysisStatus: 'FAILED',
          analysisError: extractionError instanceof Error ? extractionError.message : 'Unknown error',
        }
      });
      
      throw extractionError;
    }
    
  } catch (error) {
    console.error('Error extracting beats:', error);
    return NextResponse.json(
      { error: 'Failed to extract beats', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}