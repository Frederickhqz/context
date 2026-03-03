import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

// GET /api/timeline - Get timeline data
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const granularity = searchParams.get('granularity') || 'day'; // day, week, month, year
    const includeConnections = searchParams.get('includeConnections') === 'true';
    
    // Calculate date range
    const startDate = start ? new Date(start) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 1 week ago
    const endDate = end ? new Date(end) : new Date();

    // TODO: Add authentication

    // Fetch notes in date range
    const notes = await prisma.note.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        entityMentions: {
          include: { entity: true },
        },
        beats: true,
        tags: {
          include: { tag: true },
        },
      },
    });

    // Fetch beats in date range
    const beats = await prisma.beat.findMany({
      where: {
        startedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { startedAt: 'asc' },
      include: {
        note: true,
      },
    });

    // Group by granularity
    const grouped = groupByGranularity(notes, beats, granularity as 'day' | 'week' | 'month' | 'year');

    // Include connections if requested
    if (includeConnections) {
      const noteIds = notes.map(n => n.id);
      const connections = await prisma.connection.findMany({
        where: {
          OR: [
            { fromNoteId: { in: noteIds } },
            { toNoteId: { in: noteIds } },
          ],
        },
        include: {
          fromNote: { select: { id: true, title: true } },
          toNote: { select: { id: true, title: true } },
        },
      });
      
      return NextResponse.json({
        timeline: grouped,
        connections,
        start: startDate,
        end: endDate,
        granularity,
      });
    }

    return NextResponse.json({
      timeline: grouped,
      start: startDate,
      end: endDate,
      granularity,
    });
  } catch (error) {
    console.error('Error fetching timeline:', error);
    return NextResponse.json(
      { error: 'Failed to fetch timeline' },
      { status: 500 }
    );
  }
}

// Group notes and beats by granularity
function groupByGranularity(
  notes: any[],
  beats: any[],
  granularity: 'day' | 'week' | 'month' | 'year'
) {
  const groups: Record<string, any> = {};

  // Add notes to groups
  for (const note of notes) {
    const key = getDateKey(note.createdAt, granularity);
    
    if (!groups[key]) {
      groups[key] = {
        date: key,
        notes: [],
        beats: [],
        entities: [],
      };
    }
    
    groups[key].notes.push({
      id: note.id,
      title: note.title,
      content: note.contentPlain || note.content,
      type: note.noteType,
      createdAt: note.createdAt,
    });
    
    // Add entities
    for (const em of note.entityMentions) {
      if (!groups[key].entities.find((e: any) => e.id === em.entity.id)) {
        groups[key].entities.push(em.entity);
      }
    }
  }

  // Add beats to groups
  for (const beat of beats) {
    const key = getDateKey(beat.startedAt || beat.createdAt, granularity);
    
    if (!groups[key]) {
      groups[key] = {
        date: key,
        notes: [],
        beats: [],
        entities: [],
      };
    }
    
    groups[key].beats.push({
      id: beat.id,
      type: beat.beatType,
      intensity: beat.intensity,
      startedAt: beat.startedAt,
      endedAt: beat.endedAt,
      note: beat.note,
    });
  }

  // Sort groups by date
  return Object.values(groups).sort((a: any, b: any) => 
    a.date.localeCompare(b.date)
  );
}

// Get date key based on granularity
function getDateKey(date: Date, granularity: 'day' | 'week' | 'month' | 'year'): string {
  const d = new Date(date);
  
  switch (granularity) {
    case 'day':
      return d.toISOString().split('T')[0]; // YYYY-MM-DD
    case 'week': {
      // Get start of week
      const startOfWeek = new Date(d);
      startOfWeek.setDate(d.getDate() - d.getDay());
      return startOfWeek.toISOString().split('T')[0];
    }
    case 'month':
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
    case 'year':
      return String(d.getFullYear());
    default:
      return d.toISOString().split('T')[0];
  }
}