// Embedding Queue Helper - Queue embeddings for entities

import { prisma } from '@/lib/db/client';

const DEFAULT_MODEL = 'multilingual-e5-small';

interface QueueOptions {
  userId: string;
  model?: string;
}

/**
 * Queue note for embedding
 */
export async function queueNoteEmbedding(
  noteId: string,
  content: string,
  options: QueueOptions
): Promise<void> {
  const model = options.model || DEFAULT_MODEL;
  const sourceText = content.slice(0, 2000); // Truncate for embedding

  await prisma.embedding.upsert({
    where: {
      entityType_entityId_model: {
        entityType: 'NOTE',
        entityId: noteId,
        model
      }
    },
    update: {
      sourceText,
      status: 'PENDING',
      error: null
    },
    create: {
      userId: options.userId,
      entityType: 'NOTE',
      entityId: noteId,
      model,
      dimensions: 384,
      sourceText,
      status: 'PENDING'
    }
  });
}

/**
 * Queue beat for embedding
 */
export async function queueBeatEmbedding(
  beatId: string,
  name: string,
  summary: string | null,
  options: QueueOptions
): Promise<void> {
  const model = options.model || DEFAULT_MODEL;
  const sourceText = `${name}: ${summary || ''}`.slice(0, 1000);

  await prisma.embedding.upsert({
    where: {
      entityType_entityId_model: {
        entityType: 'BEAT',
        entityId: beatId,
        model
      }
    },
    update: {
      sourceText,
      status: 'PENDING',
      error: null
    },
    create: {
      userId: options.userId,
      entityType: 'BEAT',
      entityId: beatId,
      model,
      dimensions: 384,
      sourceText,
      status: 'PENDING'
    }
  });
}

/**
 * Queue connection for embedding (evidence)
 */
export async function queueConnectionEmbedding(
  connectionId: string,
  evidence: string | null,
  description: string | null,
  options: QueueOptions
): Promise<void> {
  const model = options.model || DEFAULT_MODEL;
  const sourceText = `${evidence || ''} ${description || ''}`.trim().slice(0, 1000);

  if (!sourceText) return; // Nothing to embed

  await prisma.embedding.upsert({
    where: {
      entityType_entityId_model: {
        entityType: 'CONNECTION',
        entityId: connectionId,
        model
      }
    },
    update: {
      sourceText,
      status: 'PENDING',
      error: null
    },
    create: {
      userId: options.userId,
      entityType: 'CONNECTION',
      entityId: connectionId,
      model,
      dimensions: 384,
      sourceText,
      status: 'PENDING'
    }
  });
}

/**
 * Queue multiple entities at once
 */
export async function queueEmbeddingsBatch(
  items: Array<{
    type: 'NOTE' | 'BEAT' | 'CONNECTION';
    id: string;
    text: string;
  }>,
  options: QueueOptions
): Promise<number> {
  const model = options.model || DEFAULT_MODEL;
  let queued = 0;

  for (const item of items) {
    try {
      await prisma.embedding.upsert({
        where: {
          entityType_entityId_model: {
            entityType: item.type,
            entityId: item.id,
            model
          }
        },
        update: {
          sourceText: item.text.slice(0, 2000),
          status: 'PENDING',
          error: null
        },
        create: {
          userId: options.userId,
          entityType: item.type,
          entityId: item.id,
          model,
          dimensions: 384,
          sourceText: item.text.slice(0, 2000),
          status: 'PENDING'
        }
      });
      queued++;
    } catch (error) {
      console.error(`Failed to queue ${item.type} ${item.id}:`, error);
    }
  }

  return queued;
}

/**
 * Wipe embeddings for entities
 */
export async function wipeEmbeddings(
  entityType: 'NOTE' | 'BEAT' | 'CONNECTION',
  entityIds: string[],
  options: QueueOptions
): Promise<void> {
  if (entityIds.length === 0) return;

  await prisma.embedding.deleteMany({
    where: {
      userId: options.userId,
      entityType,
      entityId: { in: entityIds }
    }
  });
}

/**
 * Wipe all embeddings for a note and its beats
 */
export async function wipeNoteEmbeddings(
  noteId: string,
  beatIds: string[],
  connectionIds: string[],
  options: QueueOptions
): Promise<void> {
  const entityIds = [
    { type: 'NOTE' as const, ids: [noteId] },
    { type: 'BEAT' as const, ids: beatIds },
    { type: 'CONNECTION' as const, ids: connectionIds }
  ];

  for (const { type, ids } of entityIds) {
    if (ids.length > 0) {
      await prisma.embedding.deleteMany({
        where: {
          userId: options.userId,
          entityType: type,
          entityId: { in: ids }
        }
      });
    }
  }
}