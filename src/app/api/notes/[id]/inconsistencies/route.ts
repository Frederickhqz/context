// Note Inconsistencies API - Find contradictions among beats linked to a note
// GET /api/notes/[id]/inconsistencies

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

    if (beatIds.length < 2) {
      return NextResponse.json({
        noteId,
        inconsistencies: [],
        total: 0,
        byType: {},
        bySeverity: {}
      });
    }

    // Get beats with their connections
    const beats = await prisma.beat.findMany({
      where: { id: { in: beatIds } },
      select: {
        id: true,
        beatType: true,
        name: true,
        summary: true,
        intensity: true,
        valence: true,
        frequency: true,
        metadata: true
      }
    });

    // Get connections where BOTH endpoints are in our beat set
    const connections = await prisma.beatConnection.findMany({
      where: {
        OR: [
          { fromBeatId: { in: beatIds } },
          { toBeatId: { in: beatIds } }
        ]
      },
      select: {
        id: true,
        fromBeatId: true,
        toBeatId: true,
        connectionType: true,
        strength: true,
        isContradiction: true,
        evidence: true,
        contradictionNote: true
      }
    });

    const beatIdSet = new Set(beatIds);
    const noteConnections = connections.filter(
      c => beatIdSet.has(c.fromBeatId) && beatIdSet.has(c.toBeatId)
    );

    // Build inconsistency list
    const inconsistencies: Array<{
      id: string;
      type: 'explicit' | 'temporal' | 'factual' | 'relational';
      severity: 'low' | 'medium' | 'high' | 'critical';
      beat1: { id: string; name: string; type: string };
      beat2: { id: string; name: string; type: string };
      description: string;
      evidence?: string | null;
      connectionType: string;
    }> = [];

    const beatMap = new Map(beats.map(b => [b.id, b]));

    // 1. Explicit contradictions (marked isContradiction=true)
    for (const conn of noteConnections) {
      if (conn.isContradiction) {
        const beat1 = beatMap.get(conn.fromBeatId);
        const beat2 = beatMap.get(conn.toBeatId);
        if (beat1 && beat2) {
          inconsistencies.push({
            id: `explicit-${conn.id}`,
            type: 'explicit',
            severity: 'high',
            beat1: { id: beat1.id, name: beat1.name, type: beat1.beatType },
            beat2: { id: beat2.id, name: beat2.name, type: beat2.beatType },
            description: `Marked contradiction: "${beat1.name}" and "${beat2.name}"`,
            evidence: conn.contradictionNote || conn.evidence,
            connectionType: conn.connectionType
          });
        }
      }
    }

    // 2. Temporal contradictions (PRECEDES/FOLLOWS cycles)
    const temporalGraph = new Map<string, Set<string>>();
    for (const conn of noteConnections) {
      if (conn.connectionType === 'PRECEDES') {
        if (!temporalGraph.has(conn.fromBeatId)) {
          temporalGraph.set(conn.fromBeatId, new Set());
        }
        temporalGraph.get(conn.fromBeatId)!.add(conn.toBeatId);
      }
    }

    for (const [from, successors] of temporalGraph) {
      for (const successor of successors) {
        if (temporalGraph.get(successor)?.has(from)) {
          const beat1 = beatMap.get(from);
          const beat2 = beatMap.get(successor);
          if (beat1 && beat2) {
            inconsistencies.push({
              id: `temporal-${from}-${successor}`,
              type: 'temporal',
              severity: 'high',
              beat1: { id: beat1.id, name: beat1.name, type: beat1.beatType },
              beat2: { id: beat2.id, name: beat2.name, type: beat2.beatType },
              description: `Temporal cycle: "${beat1.name}" and "${beat2.name}" precede each other`,
              connectionType: 'PRECEDES'
            });
          }
        }
      }
    }

    // 3. Relational contradictions (SUPPORTS/UNDERMINES, CAUSES/CONTRADICTS pairs)
    const pairConnections = new Map<string, typeof noteConnections>();
    for (const conn of noteConnections) {
      const key = [conn.fromBeatId, conn.toBeatId].sort().join('-');
      if (!pairConnections.has(key)) {
        pairConnections.set(key, []);
      }
      pairConnections.get(key)!.push(conn);
    }

    const oppositePairs: Array<[string, string]> = [
      ['SUPPORTS', 'UNDERMINES'],
      ['CAUSES', 'CONTRADICTS'],
      ['FORESHADOWS', 'CONTRADICTS']
    ];

    for (const [, conns] of pairConnections) {
      if (conns.length < 2) continue;

      for (const [type1, type2] of oppositePairs) {
        const has1 = conns.some(c => c.connectionType === type1);
        const has2 = conns.some(c => c.connectionType === type2);

        if (has1 && has2) {
          const beat1 = beatMap.get(conns[0].fromBeatId);
          const beat2 = beatMap.get(conns[0].toBeatId);
          if (beat1 && beat2) {
            inconsistencies.push({
              id: `relational-${beat1.id}-${beat2.id}`,
              type: 'relational',
              severity: 'medium',
              beat1: { id: beat1.id, name: beat1.name, type: beat1.beatType },
              beat2: { id: beat2.id, name: beat2.name, type: beat2.beatType },
              description: `Relational conflict between "${beat1.name}" and "${beat2.name}"`,
              evidence: `Has both ${type1} and ${type2} connections`,
              connectionType: `${type1}/${type2}`
            });
          }
        }
      }
    }

    // Group by type and severity
    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};

    for (const inc of inconsistencies) {
      byType[inc.type] = (byType[inc.type] || 0) + 1;
      bySeverity[inc.severity] = (bySeverity[inc.severity] || 0) + 1;
    }

    return NextResponse.json({
      noteId,
      inconsistencies,
      total: inconsistencies.length,
      byType,
      bySeverity
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error finding inconsistencies:', error);
    return NextResponse.json({ error: 'Failed to find inconsistencies' }, { status: 500 });
  }
}