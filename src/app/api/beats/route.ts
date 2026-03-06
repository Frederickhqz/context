// Beats API - List and Create beats
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { getBeatExtractor } from '@/lib/beats/extractor';
import { BeatType, BeatSource } from '@/lib/beats/types';

// GET /api/beats - List beats with filters
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Filters
    const type = searchParams.get('type') as BeatType | null;
    const worldId = searchParams.get('worldId');
    const timelineId = searchParams.get('timelineId');
    const dimensionId = searchParams.get('dimensionId');
    const search = searchParams.get('search');
    
    // Pagination
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    
    // Sort
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    
    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    
    if (type) {
      where.beatType = type;
    }
    
    if (worldId) {
      where.worldId = worldId;
    }
    
    if (timelineId) {
      where.timelineId = timelineId;
    }
    
    if (dimensionId) {
      where.dimensionId = dimensionId;
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { summary: { contains: search, mode: 'insensitive' } },
        { aliases: { has: search } },
      ];
    }
    
    // Query
    const [beats, total] = await Promise.all([
      prisma.beat.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { [sortBy]: sortOrder },
        include: {
          noteBeats: {
            include: {
              note: {
                select: { id: true, title: true }
              }
            }
          },
          connections: {
            include: {
              toBeat: { select: { id: true, name: true, beatType: true } }
            }
          },
          reverseConnections: {
            include: {
              fromBeat: { select: { id: true, name: true, beatType: true } }
            }
          },
        },
      }),
      prisma.beat.count({ where }),
    ]);
    
    return NextResponse.json({
      beats: beats.map(beat => ({
        ...beat,
        // Include related notes
        notes: beat.noteBeats.map(nb => nb.note),
        // Include connections
        connections: beat.connections,
        incomingConnections: beat.reverseConnections,
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: total > offset + limit,
      },
    });
  } catch (error) {
    console.error('Error listing beats:', error);
    return NextResponse.json(
      { error: 'Failed to list beats' },
      { status: 500 }
    );
  }
}

// POST /api/beats - Create a new beat
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.beatType || !body.name) {
      return NextResponse.json(
        { error: 'beatType and name are required' },
        { status: 400 }
      );
    }
    
    // Create beat
    const beat = await prisma.beat.create({
      data: {
        userId: body.userId || 'demo-user', // TODO: Get from auth
        beatType: body.beatType,
        name: body.name,
        summary: body.summary,
        content: body.content,
        aliases: body.aliases || [],
        intensity: body.intensity ?? 0.5,
        valence: body.valence,
        source: body.source || BeatSource.MANUAL,
        confidence: body.confidence ?? 1.0,
        timelineId: body.timelineId,
        worldId: body.worldId,
        dimensionId: body.dimensionId,
        metadata: body.metadata,
      },
    });
    
    // If noteId provided, create note-beat relationship
    if (body.noteId) {
      await prisma.noteBeat.create({
        data: {
          noteId: body.noteId,
          beatId: beat.id,
          relevance: body.relevance ?? 0.8,
          mentions: 1,
        },
      });
    }
    
    // If connections provided, create them
    if (body.connections && Array.isArray(body.connections)) {
      for (const conn of body.connections) {
        await prisma.beatConnection.create({
          data: {
            userId: beat.userId,
            fromBeatId: beat.id,
            toBeatId: conn.toBeatId,
            connectionType: conn.connectionType,
            strength: conn.strength ?? 0.5,
            description: conn.description,
            evidence: conn.evidence,
          },
        });
      }
    }
    
    return NextResponse.json({ beat }, { status: 201 });
  } catch (error) {
    console.error('Error creating beat:', error);
    return NextResponse.json(
      { error: 'Failed to create beat' },
      { status: 500 }
    );
  }
}

// POST /api/beats/extract - Extract beats from text
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.text && !body.noteId) {
      return NextResponse.json(
        { error: 'text or noteId is required' },
        { status: 400 }
      );
    }
    
    // Get text from note if noteId provided
    let text = body.text;
    if (body.noteId) {
      const note = await prisma.note.findUnique({
        where: { id: body.noteId },
        select: { contentPlain: true, content: true },
      });
      text = note?.contentPlain || note?.content || '';
    }
    
    // Extract beats
    const extractor = getBeatExtractor();
    const extractedBeats = await extractor.extract(text, {
      model: body.model || 'cloud',
      existingBeats: body.existingBeats,
    });
    
    return NextResponse.json({
      beats: extractedBeats,
      sourceText: text?.substring(0, 500) + (text && text.length > 500 ? '...' : ''),
    });
  } catch (error) {
    console.error('Error extracting beats:', error);
    return NextResponse.json(
      { error: 'Failed to extract beats' },
      { status: 500 }
    );
  }
}