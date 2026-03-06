// Auto Relationship Detection API - Infer connections between beats
// POST /api/beats/detect-connections
//
// Uses BeatExtractor.analyzeConnection (LLM) over a limited set of candidate beat pairs.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { getBeatExtractor } from '@/lib/beats/extractor';
import type { BeatConnectionType, BeatType } from '@/lib/beats/types';

interface DetectConnectionsBody {
  userId?: string;
  noteId?: string;
  beatIds?: string[];
  // Safety limits
  maxPairs?: number; // default 30
  minStrength?: number; // default 0.65
  // If true, allow creating CONTRADICTS connections (still marked isContradiction=false unless model says otherwise)
  allowContradictions?: boolean; // default true
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as DetectConnectionsBody;

    const userId = body.userId || 'demo-user';
    const maxPairs = Math.min(Math.max(body.maxPairs ?? 30, 1), 200);
    const minStrength = Math.min(Math.max(body.minStrength ?? 0.65, 0), 1);
    const allowContradictions = body.allowContradictions ?? true;

    if (!body.noteId && (!body.beatIds || body.beatIds.length < 2)) {
      return NextResponse.json(
        { error: 'Provide either noteId or beatIds (>= 2)' },
        { status: 400 }
      );
    }

    // 1) Resolve candidate beats
    let beats: Array<{ id: string; beatType: string; name: string; summary: string | null }> = [];

    if (body.noteId) {
      const note = await prisma.note.findUnique({
        where: { id: body.noteId },
        select: {
          id: true,
          noteBeats: {
            select: {
              beat: { select: { id: true, beatType: true, name: true, summary: true } }
            }
          }
        }
      });

      if (!note) {
        return NextResponse.json({ error: 'Note not found' }, { status: 404 });
      }

      beats = note.noteBeats.map(nb => nb.beat);
    } else if (body.beatIds) {
      const ids = uniq(body.beatIds).slice(0, 200);
      beats = await prisma.beat.findMany({
        where: { id: { in: ids }, userId },
        select: { id: true, beatType: true, name: true, summary: true }
      });
    }

    if (beats.length < 2) {
      return NextResponse.json(
        { error: 'Not enough beats to detect connections' },
        { status: 400 }
      );
    }

    // 2) Generate candidate pairs (simple heuristic: only within same note / provided set)
    // Keep it bounded by maxPairs.
    const pairs: Array<[typeof beats[number], typeof beats[number]]> = [];
    for (let i = 0; i < beats.length; i++) {
      for (let j = i + 1; j < beats.length; j++) {
        pairs.push([beats[i], beats[j]]);
        if (pairs.length >= maxPairs) break;
      }
      if (pairs.length >= maxPairs) break;
    }

    const extractor = getBeatExtractor();

    // 3) Analyze each pair and create connections
    const created: Array<{ fromBeatId: string; toBeatId: string; connectionType: BeatConnectionType; strength: number }> = [];
    const skipped: Array<{ reason: string; fromBeatId: string; toBeatId: string }> = [];

    for (const [a, b] of pairs) {
      // Skip if a->b already has any connection (any type) to reduce duplicates.
      const existing = await prisma.beatConnection.findFirst({
        where: {
          userId,
          OR: [
            { fromBeatId: a.id, toBeatId: b.id },
            { fromBeatId: b.id, toBeatId: a.id }
          ]
        },
        select: { id: true }
      });

      if (existing) {
        skipped.push({ reason: 'existing_connection', fromBeatId: a.id, toBeatId: b.id });
        continue;
      }

      const analysis = await extractor.analyzeConnection(
        { type: a.beatType as BeatType, name: a.name, summary: a.summary ?? undefined },
        { type: b.beatType as BeatType, name: b.name, summary: b.summary ?? undefined }
      );

      if (!analysis) {
        skipped.push({ reason: 'analysis_failed', fromBeatId: a.id, toBeatId: b.id });
        continue;
      }

      if (!allowContradictions && analysis.connectionType === 'CONTRADICTS') {
        skipped.push({ reason: 'contradictions_disabled', fromBeatId: a.id, toBeatId: b.id });
        continue;
      }

      if (analysis.strength < minStrength) {
        skipped.push({ reason: 'below_threshold', fromBeatId: a.id, toBeatId: b.id });
        continue;
      }

      try {
        const conn = await prisma.beatConnection.create({
          data: {
            userId,
            fromBeatId: a.id,
            toBeatId: b.id,
            connectionType: analysis.connectionType,
            strength: analysis.strength,
            isContradiction: analysis.isContradiction || false,
            evidence: analysis.evidence,
            isSuggested: true,
            suggestedBy: 'auto-relationship-detector'
          },
          select: {
            fromBeatId: true,
            toBeatId: true,
            connectionType: true,
            strength: true
          }
        });
        created.push(conn);
      } catch (e) {
        // Likely unique constraint / race; just skip.
        skipped.push({ reason: 'create_failed', fromBeatId: a.id, toBeatId: b.id });
      }
    }

    return NextResponse.json({
      success: true,
      userId,
      noteId: body.noteId ?? null,
      beatsConsidered: beats.length,
      pairsConsidered: pairs.length,
      createdCount: created.length,
      created,
      skippedCount: skipped.length,
      skipped,
      params: { maxPairs, minStrength, allowContradictions }
    });
  } catch (error) {
    console.error('Error detecting connections:', error);
    return NextResponse.json(
      { error: 'Failed to detect connections' },
      { status: 500 }
    );
  }
}
