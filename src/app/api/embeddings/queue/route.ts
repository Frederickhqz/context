// Embedding Queue API - Queue entities for embedding
// POST /api/embeddings/queue - Queue pending embeddings
// GET /api/embeddings/queue - Get pending jobs for client processing

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { requireUser, AuthError } from '@/lib/auth/server';

const SUPPORTED_MODELS: Record<string, number> = {
  'embeddinggemma-300m': 768,
  'multilingual-e5-small': 384,
  'qwen3-embedding-0.6b': 1024,
  'nomic-embed-text-v1.5': 768,
  'all-MiniLM-L6-v2': 384,
};

const DEFAULT_MODEL = 'embeddinggemma-300m';

interface QueueRequest {
  entityType: 'NOTE' | 'BEAT' | 'CONNECTION';
  entityId: string;
  sourceText: string;
  model?: string;
}

// POST /api/embeddings/queue - Queue one or more entities for embedding
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const body = await request.json();

    // Support single or batch
    const items: QueueRequest[] = Array.isArray(body.items) ? body.items : [body];

    const queued: Array<{ id: string; entityType: string; entityId: string; status: string }> = [];

    for (const item of items) {
      if (!['NOTE', 'BEAT', 'CONNECTION'].includes(item.entityType)) {
        continue;
      }

      const model = item.model || DEFAULT_MODEL;
      const dimensions = SUPPORTED_MODELS[model] || 384;

      // Upsert embedding record
      const embedding = await prisma.embedding.upsert({
        where: {
          entityType_entityId_model: {
            entityType: item.entityType,
            entityId: item.entityId,
            model
          }
        },
        update: {
          sourceText: item.sourceText,
          status: 'PENDING',
          error: null,
          updatedAt: new Date()
        },
        create: {
          userId: user.id,
          entityType: item.entityType,
          entityId: item.entityId,
          model,
          dimensions,
          sourceText: item.sourceText,
          status: 'PENDING'
        }
      });

      queued.push({
        id: embedding.id,
        entityType: embedding.entityType,
        entityId: embedding.entityId,
        status: embedding.status
      });
    }

    return NextResponse.json({
      success: true,
      queued: queued.length,
      items: queued
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error queueing embeddings:', error);
    return NextResponse.json({ error: 'Failed to queue embeddings' }, { status: 500 });
  }
}

// GET /api/embeddings/queue - Get pending jobs for client processing
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const { searchParams } = new URL(request.url);

    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);
    const model = searchParams.get('model') || DEFAULT_MODEL;
    const status = searchParams.get('status') || 'PENDING';

    const jobs = await prisma.embedding.findMany({
      where: {
        userId: user.id,
        model,
        status: status as 'PENDING' | 'PROCESSING'
      },
      take: limit,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        entityType: true,
        entityId: true,
        model: true,
        dimensions: true,
        sourceText: true,
        status: true,
        createdAt: true
      }
    });

    return NextResponse.json({
      jobs,
      total: jobs.length,
      model
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching embedding queue:', error);
    return NextResponse.json({ error: 'Failed to fetch queue' }, { status: 500 });
  }
}