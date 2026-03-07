// Process Embeddings API - Handle pending embedding jobs
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { CLOUD_CONFIG } from '@/lib/beats/config';

// POST /api/embeddings/process - Process pending embeddings
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, batchSize = 10 } = body;
    
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }
    
    // Get pending embeddings
    const pending = await prisma.embedding.findMany({
      where: {
        userId,
        status: 'PENDING'
      },
      take: batchSize,
      orderBy: { createdAt: 'asc' }
    });
    
    if (pending.length === 0) {
      return NextResponse.json({
        processed: 0,
        remaining: 0,
        message: 'No pending embeddings'
      });
    }
    
    // Mark as processing
    const ids = pending.map(e => e.id);
    await prisma.embedding.updateMany({
      where: { id: { in: ids } },
      data: { status: 'PROCESSING' }
    });
    
    const results = {
      processed: 0,
      failed: 0,
      errors: [] as string[]
    };
    
    // Process each embedding
    for (const embedding of pending) {
      try {
        // Get the source text
        let text = embedding.sourceText;
        
        if (!text) {
          // Fetch text from entity
          text = await fetchSourceText(embedding.entityType, embedding.entityId);
        }
        
        if (!text) {
          throw new Error('No source text available');
        }
        
        // Call Ollama for embedding
        const vector = await generateEmbedding(text);
        
        // Update embedding with vector (using Prisma.raw for pgvector)
        await prisma.$executeRaw`
          UPDATE embeddings 
          SET vector = ${vector}::vector, status = 'COMPLETED', "updatedAt" = NOW()
          WHERE id = ${embedding.id}
        `;
        
        // Update source entity with embedding
        await updateEntityEmbedding(embedding.entityType, embedding.entityId, vector);
        
        results.processed++;
        
      } catch (error) {
        results.failed++;
        results.errors.push(`${embedding.entityType}:${embedding.entityId} - ${error instanceof Error ? error.message : 'Unknown error'}`);
        
        // Mark as failed
        await prisma.embedding.update({
          where: { id: embedding.id },
          data: {
            status: 'FAILED',
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        });
      }
    }
    
    // Get remaining count
    const remaining = await prisma.embedding.count({
      where: { userId, status: 'PENDING' }
    });
    
    return NextResponse.json({
      ...results,
      remaining
    });
    
  } catch (error) {
    console.error('Error processing embeddings:', error);
    return NextResponse.json(
      { error: 'Failed to process embeddings', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Fetch source text from entity
async function fetchSourceText(entityType: string, entityId: string): Promise<string | null> {
  try {
    if (entityType === 'NOTE') {
      const note = await prisma.note.findUnique({
        where: { id: entityId },
        select: { contentPlain: true, content: true }
      });
      return note?.contentPlain || note?.content || null;
    }
    
    if (entityType === 'BEAT') {
      const beat = await prisma.beat.findUnique({
        where: { id: entityId },
        select: { name: true, summary: true, content: true }
      });
      if (!beat) return null;
      return `${beat.name}: ${beat.summary || ''} ${beat.content || ''}`;
    }
    
    if (entityType === 'CONNECTION') {
      const conn = await prisma.beatConnection.findUnique({
        where: { id: entityId },
        select: { description: true, evidence: true }
      });
      if (!conn) return null;
      return `${conn.description || ''} ${conn.evidence || ''}`;
    }
    
    return null;
  } catch {
    return null;
  }
}

// Generate embedding via Ollama
async function generateEmbedding(text: string): Promise<string> {
  const { ollamaUrl, ollamaEmbedModel } = CLOUD_CONFIG;
  
  const response = await fetch(`${ollamaUrl}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: ollamaEmbedModel,
      prompt: text
    })
  });
  
  if (!response.ok) {
    throw new Error(`Ollama embedding failed: ${response.status}`);
  }
  
  const data = await response.json();
  
  // Convert to pgvector format
  const vector = data.embedding;
  if (!Array.isArray(vector)) {
    throw new Error('Invalid embedding response');
  }
  
  // Return as pgvector string
  return `[${vector.join(',')}]`;
}

// Update entity with embedding reference
async function updateEntityEmbedding(
  entityType: string,
  entityId: string,
  vector: string
): Promise<void> {
  try {
    // Use raw SQL for pgvector columns
    if (entityType === 'NOTE') {
      await prisma.$executeRaw`
        UPDATE notes 
        SET embedding = ${vector}::vector, "updatedAt" = NOW()
        WHERE id = ${entityId}
      `;
    }
    
    if (entityType === 'BEAT') {
      await prisma.$executeRaw`
        UPDATE beats_new 
        SET embedding = ${vector}::vector, "updatedAt" = NOW()
        WHERE id = ${entityId}
      `;
    }
    
    if (entityType === 'CONNECTION') {
      await prisma.$executeRaw`
        UPDATE beat_connections 
        SET embedding = ${vector}::vector, "updatedAt" = NOW()
        WHERE id = ${entityId}
      `;
    }
  } catch (error) {
    console.error('Failed to update entity embedding:', error);
    // Non-critical, continue
  }
}