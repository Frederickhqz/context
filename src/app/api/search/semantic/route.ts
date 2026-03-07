// Semantic Search API - Search notes/beats/connections by embedding similarity
// GET /api/search/semantic

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { requireUser, AuthError } from '@/lib/auth/server';

// GET /api/search/semantic - Semantic search using pgvector
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const { searchParams } = new URL(request.url);

    const query = searchParams.get('q');
    const types = searchParams.get('types')?.split(',').filter(Boolean) || ['NOTE', 'BEAT'];
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const threshold = parseFloat(searchParams.get('threshold') || '0.5');
    const model = searchParams.get('model') || 'multilingual-e5-small';

    if (!query) {
      return NextResponse.json({ error: 'Query parameter q is required' }, { status: 400 });
    }

    // Check if we have an embedding service available
    // For now, fall back to text search if no embedding service
    // In production, this would call the edge embedding model

    // Try to find existing embeddings with similar source text
    // This is a simplified version - real semantic search requires computing the query embedding

    const results: Array<{
      id: string;
      type: string;
      name: string;
      content?: string;
      summary?: string;
      similarity: number;
    }> = [];

    // For NOTES: search by title and content
    if (types.includes('NOTE')) {
      const notes = await prisma.note.findMany({
        where: {
          userId: user.id,
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { contentPlain: { contains: query, mode: 'insensitive' } }
          ]
        },
        take: limit,
        select: {
          id: true,
          title: true,
          contentPlain: true,
          createdAt: true
        }
      });

      for (const note of notes) {
        results.push({
          id: note.id,
          type: 'NOTE',
          name: note.title || 'Untitled',
          content: note.contentPlain?.slice(0, 500),
          similarity: calculateTextSimilarity(query, `${note.title} ${note.contentPlain}`)
        });
      }
    }

    // For BEATS: search by name and summary
    if (types.includes('BEAT')) {
      const beats = await prisma.beat.findMany({
        where: {
          userId: user.id,
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { summary: { contains: query, mode: 'insensitive' } }
          ]
        },
        take: limit,
        select: {
          id: true,
          beatType: true,
          name: true,
          summary: true,
          intensity: true
        }
      });

      for (const beat of beats) {
        results.push({
          id: beat.id,
          type: 'BEAT',
          name: beat.name,
          summary: beat.summary ?? undefined,
          similarity: calculateTextSimilarity(query, `${beat.name} ${beat.summary}`)
        });
      }
    }

    // For CONNECTIONS: search by evidence/description
    if (types.includes('CONNECTION')) {
      const connections = await prisma.beatConnection.findMany({
        where: {
          userId: user.id,
          OR: [
            { evidence: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } }
          ]
        },
        take: limit,
        select: {
          id: true,
          connectionType: true,
          evidence: true,
          description: true,
          fromBeat: { select: { id: true, name: true } },
          toBeat: { select: { id: true, name: true } }
        }
      });

      for (const conn of connections) {
        results.push({
          id: conn.id,
          type: 'CONNECTION',
          name: `${conn.fromBeat.name} → ${conn.toBeat.name}`,
          content: conn.evidence || conn.description || undefined,
          similarity: calculateTextSimilarity(query, `${conn.evidence} ${conn.description}`)
        });
      }
    }

    // Filter by threshold and sort by similarity
    const filtered = results
      .filter(r => r.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return NextResponse.json({
      query,
      results: filtered,
      total: filtered.length,
      types: types,
      model,
      note: 'Using text-based search. For semantic search, compute query embedding client-side and POST to /api/search/semantic/vector'
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error in semantic search:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}

// POST /api/search/semantic - Search with pre-computed query vector
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const body = await request.json();

    const { vector, types, limit = 20, threshold = 0.5 } = body;

    if (!vector || !Array.isArray(vector)) {
      return NextResponse.json({ error: 'Vector is required' }, { status: 400 });
    }

    const entityTypes = types || ['NOTE', 'BEAT', 'CONNECTION'];
    const limitNum = Math.min(limit, 100);

    // Convert vector to string for pgvector
    const vectorStr = `[${vector.join(',')}]`;

    const results: Array<{
      id: string;
      type: string;
      name: string;
      similarity: number;
    }> = [];

    // Search NOTES by embedding similarity using pgvector
    if (entityTypes.includes('NOTE')) {
      const notes = await prisma.$queryRaw`
        SELECT id, title, content_plain, 1 - (embedding <=> ${vectorStr}::vector) as similarity
        FROM notes
        WHERE user_id = ${user.id} AND embedding IS NOT NULL
        ORDER BY embedding <=> ${vectorStr}::vector
        LIMIT ${limitNum}
      ` as Array<{ id: string; title: string | null; content_plain: string | null; similarity: number }>;

      for (const note of notes) {
        if (note.similarity >= threshold) {
          results.push({
            id: note.id,
            type: 'NOTE',
            name: note.title || 'Untitled',
            similarity: note.similarity
          });
        }
      }
    }

    // Search BEATS by embedding similarity
    if (entityTypes.includes('BEAT')) {
      const beats = await prisma.$queryRaw`
        SELECT id, name, summary, 1 - (embedding <=> ${vectorStr}::vector) as similarity
        FROM beats_new
        WHERE user_id = ${user.id} AND embedding IS NOT NULL
        ORDER BY embedding <=> ${vectorStr}::vector
        LIMIT ${limitNum}
      ` as Array<{ id: string; name: string; summary: string | null; similarity: number }>;

      for (const beat of beats) {
        if (beat.similarity >= threshold) {
          results.push({
            id: beat.id,
            type: 'BEAT',
            name: beat.name,
            similarity: beat.similarity
          });
        }
      }
    }

    // Search CONNECTIONS by embedding similarity
    if (entityTypes.includes('CONNECTION')) {
      const connections = await prisma.$queryRaw`
        SELECT id, description, evidence, 1 - (embedding <=> ${vectorStr}::vector) as similarity
        FROM beat_connections
        WHERE user_id = ${user.id} AND embedding IS NOT NULL
        ORDER BY embedding <=> ${vectorStr}::vector
        LIMIT ${limitNum}
      ` as Array<{ id: string; description: string | null; evidence: string | null; similarity: number }>;

      for (const conn of connections) {
        if (conn.similarity >= threshold) {
          results.push({
            id: conn.id,
            type: 'CONNECTION',
            name: conn.description || conn.evidence || 'Connection',
            similarity: conn.similarity
          });
        }
      }
    }

    // Sort by similarity and limit
    const sorted = results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limitNum);

    return NextResponse.json({
      results: sorted,
      total: sorted.length,
      threshold
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error in vector search:', error);
    return NextResponse.json({ error: 'Vector search failed' }, { status: 500 });
  }
}

// Simple text similarity (Jaccard on tokens)
function calculateTextSimilarity(a: string, b: string): number {
  const tokenize = (s: string) =>
    s.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length >= 3);

  const setA = new Set(tokenize(a));
  const setB = new Set(tokenize(b));

  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}