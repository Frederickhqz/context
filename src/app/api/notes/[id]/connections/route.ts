// Note Connections API - Get connections between beats linked to a note
// GET /api/notes/[id]/connections

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { requireUser, AuthError } from '@/lib/auth/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser(request);
    const { id: noteId } = await params;

    // Verify note ownership
    const note = await prisma.note.findFirst({
      where: { id: noteId, userId: user.id },
      select: { id: true }
    });

    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    // Get beat IDs linked to this note
    const noteBeats = await prisma.noteBeat.findMany({
      where: { noteId },
      select: { beatId: true }
    });

    const beatIds = noteBeats.map(nb => nb.beatId);

    if (beatIds.length === 0) {
      return NextResponse.json({
        noteId,
        connections: [],
        total: 0,
        byType: {}
      });
    }

    // Get connections where BOTH endpoints are in our beat set
    const connections = await prisma.beatConnection.findMany({
      where: {
        OR: [
          { fromBeatId: { in: beatIds } },
          { toBeatId: { in: beatIds } }
        ]
      },
      include: {
        fromBeat: {
          select: { id: true, name: true, beatType: true, summary: true }
        },
        toBeat: {
          select: { id: true, name: true, beatType: true, summary: true }
        }
      }
    });

    // Filter to only keep connections where BOTH beats are in this note
    const beatIdSet = new Set(beatIds);
    const filteredConnections = connections.filter(
      c => beatIdSet.has(c.fromBeatId) && beatIdSet.has(c.toBeatId)
    );

    // Group by connection type
    const byType: Record<string, number> = {};
    for (const c of filteredConnections) {
      byType[c.connectionType] = (byType[c.connectionType] || 0) + 1;
    }

    return NextResponse.json({
      noteId,
      connections: filteredConnections.map(c => ({
        id: c.id,
        fromBeat: c.fromBeat,
        toBeat: c.toBeat,
        type: c.connectionType,
        strength: c.strength,
        isContradiction: c.isContradiction,
        evidence: c.evidence,
        isSuggested: c.isSuggested,
        createdAt: c.createdAt
      })),
      total: filteredConnections.length,
      byType,
      contradictionsCount: filteredConnections.filter(c => c.isContradiction).length
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching note connections:', error);
    return NextResponse.json({ error: 'Failed to fetch connections' }, { status: 500 });
  }
}