// Embedding Upload API - Client uploads computed embedding
// POST /api/embeddings/upload

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { requireUser, AuthError } from '@/lib/auth/server';

interface UploadRequest {
  id?: string;           // Embedding record ID (if known)
  entityType: string;    // NOTE | BEAT | CONNECTION
  entityId: string;
  model: string;
  vector: number[];      // The computed embedding
  deviceId?: string;
  deviceModel?: string;
}

// POST /api/embeddings/upload - Upload computed embedding
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const body = await request.json() as UploadRequest;

    if (!body.vector || !Array.isArray(body.vector)) {
      return NextResponse.json({ error: 'Vector is required' }, { status: 400 });
    }

    if (!['NOTE', 'BEAT', 'CONNECTION'].includes(body.entityType)) {
      return NextResponse.json({ error: 'Invalid entityType' }, { status: 400 });
    }

    const model = body.model || 'multilingual-e5-small';
    const dimensions = body.vector.length;

    // Find the embedding record
    let embedding = body.id
      ? await prisma.embedding.findFirst({
          where: { id: body.id, userId: user.id }
        })
      : await prisma.embedding.findFirst({
          where: {
            userId: user.id,
            entityType: body.entityType,
            entityId: body.entityId,
            model
          }
        });

    // Store vector as string for pgvector
    const vectorStr = `[${body.vector.join(',')}]`;

    if (embedding) {
      // Update existing record
      embedding = await prisma.embedding.update({
        where: { id: embedding.id },
        data: {
          dimensions,
          status: 'COMPLETED',
          deviceId: body.deviceId,
          deviceModel: body.deviceModel,
          updatedAt: new Date()
        }
      });

      // Update vector column via raw SQL (Unsupported type)
      await prisma.$executeRaw`
        UPDATE embeddings SET vector = ${vectorStr}::vector WHERE id = ${embedding.id}
      `;
    } else {
      // Create new record
      embedding = await prisma.embedding.create({
        data: {
          userId: user.id,
          entityType: body.entityType,
          entityId: body.entityId,
          model,
          dimensions,
          status: 'COMPLETED',
          deviceId: body.deviceId,
          deviceModel: body.deviceModel
        }
      });

      // Set vector via raw SQL
      await prisma.$executeRaw`
        UPDATE embeddings SET vector = ${vectorStr}::vector WHERE id = ${embedding.id}
      `;
    }

    // Also update the entity's embedding column if it exists
    await updateEntityEmbedding(body.entityType, body.entityId, vectorStr);

    return NextResponse.json({
      success: true,
      id: embedding.id,
      entityType: embedding.entityType,
      entityId: embedding.entityId,
      dimensions: embedding.dimensions,
      status: embedding.status
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error uploading embedding:', error);
    return NextResponse.json({ error: 'Failed to upload embedding' }, { status: 500 });
  }
}

// Update the entity's embedding column (Note, Beat, BeatConnection)
async function updateEntityEmbedding(entityType: string, entityId: string, vectorStr: string): Promise<void> {
  try {
    switch (entityType) {
      case 'NOTE':
        await prisma.$executeRaw`
          UPDATE notes SET embedding = ${vectorStr}::vector WHERE id = ${entityId}
        `;
        break;
      case 'BEAT':
        await prisma.$executeRaw`
          UPDATE beats_new SET embedding = ${vectorStr}::vector WHERE id = ${entityId}
        `;
        break;
      case 'CONNECTION':
        await prisma.$executeRaw`
          UPDATE beat_connections SET embedding = ${vectorStr}::vector WHERE id = ${entityId}
        `;
        break;
    }
  } catch (error) {
    // Entity might not exist; ignore
    console.error('Failed to update entity embedding:', error);
  }
}