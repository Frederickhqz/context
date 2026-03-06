// Single Beat API - Get, Update, Delete individual beat
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { getBeatExtractor } from '@/lib/beats/extractor';
import { BeatSource } from '@/lib/beats/types';

// GET /api/beats/[id] - Get a single beat
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const beat = await prisma.beat.findUnique({
      where: { id },
      select: {
        id: true,
        beatType: true,
        name: true,
        summary: true,
        content: true,
        aliases: true,
        metadata: true,
        intensity: true,
        valence: true,
        source: true,
        confidence: true,
        timelineId: true,
        worldId: true,
        dimensionId: true,
        createdAt: true,
        updatedAt: true,
        noteBeats: {
          include: {
            note: {
              select: {
                id: true,
                title: true,
                contentPlain: true,
                createdAt: true,
              }
            }
          }
        },
        connections: {
          include: {
            toBeat: {
              select: { id: true, name: true, beatType: true, summary: true }
            }
          }
        },
        reverseConnections: {
          include: {
            fromBeat: {
              select: { id: true, name: true, beatType: true, summary: true }
            }
          }
        },
        timeline: {
          select: { id: true, name: true }
        },
        world: {
          select: { id: true, name: true }
        },
        dimension: {
          select: { id: true, name: true }
        },
        storylines: {
          include: {
            storyline: {
              select: { id: true, name: true }
            }
          }
        },
        scenes: {
          include: {
            scene: {
              select: { id: true, name: true }
            }
          }
        },
        characters: {
          include: {
            character: {
              select: { id: true, name: true }
            }
          }
        },
      },
    });
    
    if (!beat) {
      return NextResponse.json(
        { error: 'Beat not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      beat: {
        ...beat,
        notes: beat.noteBeats.map(nb => ({
          ...nb.note,
          relevance: nb.relevance,
          mentions: nb.mentions,
          context: nb.context,
        })),
        outgoingConnections: beat.connections,
        incomingConnections: beat.reverseConnections,
      }
    });
  } catch (error) {
    console.error('Error fetching beat:', error);
    return NextResponse.json(
      { error: 'Failed to fetch beat' },
      { status: 500 }
    );
  }
}

// PATCH /api/beats/[id] - Update a beat
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const updateData: Record<string, unknown> = {};
    
    // Updatable fields
    if (body.beatType !== undefined) updateData.beatType = body.beatType;
    if (body.name !== undefined) updateData.name = body.name;
    if (body.summary !== undefined) updateData.summary = body.summary;
    if (body.content !== undefined) updateData.content = body.content;
    if (body.aliases !== undefined) updateData.aliases = body.aliases;
    if (body.intensity !== undefined) updateData.intensity = body.intensity;
    if (body.valence !== undefined) updateData.valence = body.valence;
    if (body.metadata !== undefined) updateData.metadata = body.metadata;
    if (body.timelineId !== undefined) updateData.timelineId = body.timelineId;
    if (body.worldId !== undefined) updateData.worldId = body.worldId;
    if (body.dimensionId !== undefined) updateData.dimensionId = body.dimensionId;
    
    // Mark as manual edit if content changed
    if (Object.keys(updateData).length > 0 && body.source !== BeatSource.MANUAL) {
      updateData.source = body.source || BeatSource.HYBRID;
    }
    
    const beat = await prisma.beat.update({
      where: { id },
      data: updateData,
    });
    
    return NextResponse.json({ beat });
  } catch (error) {
    console.error('Error updating beat:', error);
    return NextResponse.json(
      { error: 'Failed to update beat' },
      { status: 500 }
    );
  }
}

// DELETE /api/beats/[id] - Delete a beat
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Delete related records first (cascade)
    await prisma.$transaction([
      prisma.noteBeat.deleteMany({ where: { beatId: id } }),
      prisma.beatConnection.deleteMany({ where: { fromBeatId: id } }),
      prisma.beatConnection.deleteMany({ where: { toBeatId: id } }),
      prisma.storylineBeat.deleteMany({ where: { beatId: id } }),
      prisma.sceneBeat.deleteMany({ where: { beatId: id } }),
      prisma.characterBeat.deleteMany({ where: { beatId: id } }),
    ]);
    
    // Delete the beat
    await prisma.beat.delete({ where: { id } });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting beat:', error);
    return NextResponse.json(
      { error: 'Failed to delete beat' },
      { status: 500 }
    );
  }
}

// POST /api/beats/[id]/analyze - Re-analyze beat for new connections
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const action = body.action;
    
    if (action === 'analyze') {
      // Re-analyze beat for new connections
      const beat = await prisma.beat.findUnique({
        where: { id },
        include: {
          noteBeats: {
            include: {
              note: { select: { content: true, contentPlain: true } }
            }
          }
        }
      });
      
      if (!beat) {
        return NextResponse.json({ error: 'Beat not found' }, { status: 404 });
      }
      
      // Get similar beats
      const similarBeats = await prisma.$queryRaw<Array<{ id: string; name: string; beatType: string; similarity: number }>>`
        SELECT id, name, beat_type as "beatType", 
               1 - (embedding <=> (SELECT embedding FROM beats_new WHERE id = ${id})) as similarity
        FROM beats_new
        WHERE id != ${id}
          AND embedding IS NOT NULL
        ORDER BY similarity DESC
        LIMIT 10
      `;
      
      // Suggest connections for high-similarity beats
      const suggestions = [];
      
      for (const similar of similarBeats) {
        if (similar.similarity > 0.85) {
          // Check if connection already exists
          const existing = await prisma.beatConnection.findFirst({
            where: {
              OR: [
                { fromBeatId: id, toBeatId: similar.id },
                { fromBeatId: similar.id, toBeatId: id },
              ]
            }
          });
          
          if (!existing) {
            suggestions.push({
              beatId: similar.id,
              beatName: similar.name,
              beatType: similar.beatType,
              similarity: similar.similarity,
              suggestedConnection: 'RELATES_TO',
            });
          }
        }
      }
      
      return NextResponse.json({
        suggestions,
        analyzedAt: new Date().toISOString(),
      });
    }
    
    if (action === 'connect') {
      // Create a new connection
      const { toBeatId, connectionType, strength, description, evidence } = body;
      
      if (!toBeatId || !connectionType) {
        return NextResponse.json(
          { error: 'toBeatId and connectionType are required' },
          { status: 400 }
        );
      }
      
      // Check for existing connection
      const existing = await prisma.beatConnection.findFirst({
        where: {
          fromBeatId: id,
          toBeatId,
          connectionType,
        }
      });
      
      if (existing) {
        return NextResponse.json(
          { error: 'Connection already exists', connection: existing },
          { status: 409 }
        );
      }
      
      // Create connection
      const connection = await prisma.beatConnection.create({
        data: {
          userId: body.userId || 'demo-user',
          fromBeatId: id,
          toBeatId,
          connectionType,
          strength: strength ?? 0.5,
          description,
          evidence,
          isSuggested: body.isSuggested ?? false,
        }
      });
      
      return NextResponse.json({ connection }, { status: 201 });
    }
    
    return NextResponse.json(
      { error: 'Unknown action. Use "analyze" or "connect"' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error in beat action:', error);
    return NextResponse.json(
      { error: 'Failed to process beat action' },
      { status: 500 }
    );
  }
}