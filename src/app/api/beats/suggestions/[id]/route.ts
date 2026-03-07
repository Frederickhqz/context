// Beat Suggestions API - AI-powered connection suggestions
// GET /api/beats/suggestions/[id] - Get connection suggestions for a beat
// POST /api/beats/suggestions/[id] - Generate fresh suggestions using LLM

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { getBeatExtractor } from '@/lib/beats/extractor';
import { cheapSimilarity } from '@/lib/connections/detector';
import type { BeatConnectionType } from '@/lib/beats/types';

interface SuggestedConnection {
  fromBeatId: string;
  toBeatId: string;
  toBeatName: string;
  toBeatType: string;
  toBeatSummary?: string | null;
  suggestedType: BeatConnectionType;
  strength: number;
  confidence: 'high' | 'medium' | 'low';
  evidence?: string;
  source: 'embedding' | 'lexical' | 'llm';
}

interface SuggestionResponse {
  beatId: string;
  beatName: string;
  suggestions: SuggestedConnection[];
  generatedAt: string;
  stats: {
    embeddingCandidates: number;
    lexicalCandidates: number;
    llmAnalyzed: number;
    totalSuggestions: number;
  };
}

// GET /api/beats/suggestions/[id] - Get cached or compute suggestions
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId') || 'demo-user';
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);
    const minConfidence = searchParams.get('minConfidence') || 'medium';
    const useLLM = searchParams.get('useLLM') !== 'false';

    // Get the beat
    const beat = await prisma.beat.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        beatType: true,
        summary: true,
      },
    });

    if (!beat) {
      return NextResponse.json({ error: 'Beat not found' }, { status: 404 });
    }

    // Get embedding separately (it's an Unsupported type)
    const beatWithEmbedding = await prisma.$queryRaw<
      Array<{ embedding: string | null }>
    >`
      SELECT embedding FROM beats_new WHERE id = ${id}
    `;
    const embedding = beatWithEmbedding[0]?.embedding;

    const suggestions: SuggestedConnection[] = [];
    let embeddingCandidates = 0;
    let lexicalCandidates = 0;
    let llmAnalyzed = 0;

    // Get existing connections to exclude
    const existingConnections = await prisma.beatConnection.findMany({
      where: {
        OR: [{ fromBeatId: id }, { toBeatId: id }],
      },
      select: { fromBeatId: true, toBeatId: true },
    });
    const connectedIds = new Set<string>();
    for (const conn of existingConnections) {
      connectedIds.add(conn.fromBeatId);
      connectedIds.add(conn.toBeatId);
    }
    connectedIds.add(id); // Exclude self

    // 1. Find candidates via embedding similarity
    if (embedding) {
      const similarBeats = await prisma.$queryRaw<
        Array<{ id: string; name: string; beatType: string; summary: string | null; similarity: number }>
      >`
        SELECT id, name, beat_type as "beatType", summary,
               1 - (embedding <=> ${embedding}::vector) as similarity
        FROM beats_new
        WHERE id != ${id}
          AND embedding IS NOT NULL
        ORDER BY similarity DESC
        LIMIT 20
      `;

      embeddingCandidates = similarBeats.length;

      for (const similar of similarBeats) {
        if (connectedIds.has(similar.id)) continue;

        const confidence: 'high' | 'medium' | 'low' =
          similar.similarity > 0.9 ? 'high' :
          similar.similarity > 0.8 ? 'medium' : 'low';

        if (confidence === 'low' && minConfidence !== 'low') continue;

        suggestions.push({
          fromBeatId: id,
          toBeatId: similar.id,
          toBeatName: similar.name,
          toBeatType: similar.beatType,
          toBeatSummary: similar.summary,
          suggestedType: 'RELATES_TO',
          strength: similar.similarity,
          confidence,
          evidence: `High semantic similarity (${(similar.similarity * 100).toFixed(0)}%)`,
          source: 'embedding',
        });
      }
    }

    // 2. Find candidates via lexical similarity (cheap)
    const allBeats = await prisma.beat.findMany({
      where: {
        id: { notIn: Array.from(connectedIds).slice(0, 100) },
      },
      select: { id: true, name: true, beatType: true, summary: true },
      take: 100,
    });

    for (const candidate of allBeats) {
      if (connectedIds.has(candidate.id)) continue;

      const lexicalSim = cheapSimilarity(
        { id: beat.id, beatType: beat.beatType, name: beat.name, summary: beat.summary },
        { id: candidate.id, beatType: candidate.beatType, name: candidate.name, summary: candidate.summary }
      );

      if (lexicalSim > 0.6) {
        lexicalCandidates++;

        // Check if already in suggestions from embeddings
        if (suggestions.some(s => s.toBeatId === candidate.id)) continue;

        const confidence: 'high' | 'medium' | 'low' =
          lexicalSim > 0.8 ? 'high' :
          lexicalSim > 0.7 ? 'medium' : 'low';

        if (confidence === 'low' && minConfidence !== 'low') continue;

        suggestions.push({
          fromBeatId: id,
          toBeatId: candidate.id,
          toBeatName: candidate.name,
          toBeatType: candidate.beatType,
          toBeatSummary: candidate.summary,
          suggestedType: 'RELATES_TO',
          strength: lexicalSim,
          confidence,
          evidence: `Lexical overlap (${(lexicalSim * 100).toFixed(0)}%)`,
          source: 'lexical',
        });
      }
    }

    // 3. Use LLM to refine top suggestions with specific relationship types
    const topSuggestions = suggestions
      .filter(s => s.confidence !== 'low')
      .slice(0, 10);

    if (useLLM && topSuggestions.length > 0 && topSuggestions.length <= 5) {
      try {
        const extractor = getBeatExtractor();

        for (const suggestion of topSuggestions.slice(0, 3)) {
          const analysis = await extractor.analyzeConnection(
            { type: beat.beatType as any, name: beat.name, summary: beat.summary ?? undefined },
            { type: suggestion.toBeatType as any, name: suggestion.toBeatName, summary: suggestion.toBeatSummary ?? undefined }
          );

          if (analysis && analysis.connectionType !== 'RELATES_TO') {
            // LLM found a more specific relationship type
            suggestion.suggestedType = analysis.connectionType;
            suggestion.strength = Math.max(suggestion.strength, analysis.strength);
            suggestion.evidence = analysis.evidence || suggestion.evidence;
            suggestion.source = 'llm';
            llmAnalyzed++;
          }
        }
      } catch (error) {
        console.warn('LLM analysis failed, using embedding/lexical suggestions:', error);
      }
    }

    // Sort by strength and confidence
    const confidenceOrder = { high: 3, medium: 2, low: 1 };
    suggestions.sort((a, b) => {
      const confDiff = confidenceOrder[b.confidence] - confidenceOrder[a.confidence];
      if (confDiff !== 0) return confDiff;
      return b.strength - a.strength;
    });

    return NextResponse.json({
      beatId: id,
      beatName: beat.name,
      suggestions: suggestions.slice(0, limit),
      generatedAt: new Date().toISOString(),
      stats: {
        embeddingCandidates,
        lexicalCandidates,
        llmAnalyzed,
        totalSuggestions: suggestions.length,
      },
    } as SuggestionResponse);
  } catch (error) {
    console.error('Error generating suggestions:', error);
    return NextResponse.json(
      { error: 'Failed to generate suggestions' },
      { status: 500 }
    );
  }
}

// POST /api/beats/suggestions/[id] - Force regenerate with specific options
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const {
      limit = 10,
      useLLM = true,
      minStrength = 0.5,
      maxCandidates = 50,
      relationshipTypes, // Limit to specific types
    } = body;

    // Similar logic to GET but with custom options
    // For now, delegate to GET with params
    const url = new URL(request.url);
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('useLLM', String(useLLM));

    const fakeRequest = new NextRequest(url, { method: 'GET' });
    return GET(fakeRequest, { params });
  } catch (error) {
    console.error('Error in POST suggestions:', error);
    return NextResponse.json(
      { error: 'Failed to process suggestion request' },
      { status: 500 }
    );
  }
}