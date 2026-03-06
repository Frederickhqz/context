// Beat Search API - Semantic and keyword search for beats
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

// GET /api/beats/search - Search beats
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || searchParams.get('query');
    const types = searchParams.get('types')?.split(',').filter(Boolean);
    const worldId = searchParams.get('worldId');
    const timelineId = searchParams.get('timelineId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!query || query.trim().length < 2) {
      return NextResponse.json(
        { error: 'Query must be at least 2 characters' },
        { status: 400 }
      );
    }

    // Build where clause
    const conditions = [
      { name: { contains: query, mode: 'insensitive' as const } },
      { summary: { contains: query, mode: 'insensitive' as const } },
      { content: { contains: query, mode: 'insensitive' as const } }
    ];

    const where: Record<string, unknown> = { OR: conditions };

    if (types && types.length > 0) {
      where.beatType = { in: types };
    }

    if (worldId) {
      where.worldId = worldId;
    }

    if (timelineId) {
      where.timelineId = timelineId;
    }

    // Search beats
    const [beats, total] = await Promise.all([
      prisma.beat.findMany({
        where,
        orderBy: [
          { intensity: 'desc' },
          { name: 'asc' }
        ],
        take: limit,
        skip: offset,
        include: {
          noteBeats: {
            include: {
              note: { select: { id: true, title: true } }
            }
          }
        }
      }),
      prisma.beat.count({ where })
    ]);

    return NextResponse.json({
      query,
      beats: beats.map(beat => ({
        id: beat.id,
        type: beat.beatType,
        name: beat.name,
        summary: beat.summary,
        intensity: beat.intensity,
        valence: beat.valence,
        confidence: beat.confidence,
        notes: beat.noteBeats.map(nb => ({
          id: nb.note.id,
          title: nb.note.title
        }))
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: total > offset + limit
      }
    });
  } catch (error) {
    console.error('Error searching beats:', error);
    return NextResponse.json(
      { error: 'Failed to search beats' },
      { status: 500 }
    );
  }
}

// POST /api/beats/search - Semantic search (if embeddings available)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const query = body.query || body.text;
    const types = body.types;
    const limit = Math.min(body.limit || 20, 100);

    if (!query || query.trim().length < 2) {
      return NextResponse.json(
        { error: 'Query must be at least 2 characters' },
        { status: 400 }
      );
    }

    // Build where clause
    const conditions = [
      { name: { contains: query, mode: 'insensitive' as const } },
      { summary: { contains: query, mode: 'insensitive' as const } },
      { content: { contains: query, mode: 'insensitive' as const } }
    ];

    const where: Record<string, unknown> = { OR: conditions };

    if (types && types.length > 0) {
      where.beatType = { in: types };
    }

    const beats = await prisma.beat.findMany({
      where,
      orderBy: { intensity: 'desc' },
      take: limit,
      include: {
        noteBeats: {
          include: {
            note: { select: { id: true, title: true } }
          }
        }
      }
    });

    return NextResponse.json({
      query,
      searchType: 'keyword',
      beats: beats.map(beat => ({
        id: beat.id,
        type: beat.beatType,
        name: beat.name,
        summary: beat.summary,
        intensity: beat.intensity,
        valence: beat.valence,
        confidence: beat.confidence,
        notes: beat.noteBeats.map(nb => ({
          id: nb.note.id,
          title: nb.note.title
        }))
      })),
      note: 'Semantic search requires embeddings. Falling back to keyword search.'
    });
  } catch (error) {
    console.error('Error in semantic search:', error);
    return NextResponse.json(
      { error: 'Failed to search beats' },
      { status: 500 }
    );
  }
}