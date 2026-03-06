// Auto Relationship Detection API - Infer connections between beats
// POST /api/beats/detect-connections
//
// Uses a hybrid strategy:
// - Cheap lexical similarity for easy RELATES_TO suggestions (no LLM call)
// - LLM-based inference for richer relationship types

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { getBeatExtractor } from '@/lib/beats/extractor';
import { detectAndCreateConnections } from '@/lib/connections/detector';

interface DetectConnectionsBody {
  userId?: string;
  noteId?: string;
  beatIds?: string[];
  // Safety limits
  maxPairs?: number; // default 30
  minStrength?: number; // default 0.65
  // If true, allow creating CONTRADICTS connections
  allowContradictions?: boolean; // default true
  // If true, try cheap similarity first before LLM calls
  preferCheapSimilarity?: boolean; // default true
  // Threshold for cheap similarity shortcut
  cheapSimilarityThreshold?: number; // default 0.72
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
    const preferCheapSimilarity = body.preferCheapSimilarity ?? true;
    const cheapSimilarityThreshold = Math.min(Math.max(body.cheapSimilarityThreshold ?? 0.72, 0), 1);

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

    const { pairsConsidered, created, skipped } = await detectAndCreateConnections({
      userId,
      beats,
      params: {
        maxPairs,
        minStrength,
        allowContradictions,
        preferCheapSimilarity,
        cheapSimilarityThreshold
      },
      deps: {
        analyzeConnection: (a, b) => extractor.analyzeConnection(a, b),
        hasExistingConnection: async (aId, bId) => {
          const existing = await prisma.beatConnection.findFirst({
            where: {
              userId,
              OR: [
                { fromBeatId: aId, toBeatId: bId },
                { fromBeatId: bId, toBeatId: aId }
              ]
            },
            select: { id: true }
          });
          return Boolean(existing);
        },
        createConnection: async (conn) => {
          const created = await prisma.beatConnection.create({
            data: {
              userId,
              fromBeatId: conn.fromBeatId,
              toBeatId: conn.toBeatId,
              connectionType: conn.connectionType,
              strength: conn.strength,
              isContradiction: conn.isContradiction,
              evidence: conn.evidence,
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
          return created;
        }
      }
    });

    return NextResponse.json({
      success: true,
      userId,
      noteId: body.noteId ?? null,
      beatsConsidered: beats.length,
      pairsConsidered,
      createdCount: created.length,
      created,
      skippedCount: skipped.length,
      skipped,
      params: { maxPairs, minStrength, allowContradictions, preferCheapSimilarity, cheapSimilarityThreshold }
    });
  } catch (error) {
    console.error('Error detecting connections:', error);
    return NextResponse.json(
      { error: 'Failed to detect connections' },
      { status: 500 }
    );
  }
}
