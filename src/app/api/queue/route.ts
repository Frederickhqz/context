// Queue API - Manage processing jobs
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { getProcessingQueue } from '@/lib/beats/queue';

// GET /api/queue - Get queue status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }
    
    // Get import jobs from database
    const where: Record<string, unknown> = { userId };
    if (status) where.status = status;
    
    const imports = await prisma.import.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    
    // Get queue stats
    const stats = {
      pending: await prisma.import.count({ where: { userId, status: 'QUEUED' } }),
      processing: await prisma.import.count({ where: { userId, status: 'PROCESSING' } }),
      completed: await prisma.import.count({ where: { userId, status: 'COMPLETED' } }),
      failed: await prisma.import.count({ where: { userId, status: 'FAILED' } }),
    };
    
    // Get pending embeddings
    const pendingEmbeddings = await prisma.embedding.count({
      where: { userId, status: 'PENDING' }
    });
    
    const processingEmbeddings = await prisma.embedding.count({
      where: { userId, status: 'PROCESSING' }
    });
    
    return NextResponse.json({
      imports,
      stats,
      embeddings: {
        pending: pendingEmbeddings,
        processing: processingEmbeddings
      }
    });
  } catch (error) {
    console.error('Error fetching queue:', error);
    return NextResponse.json(
      { error: 'Failed to fetch queue', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/queue - Add job to queue
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, data, userId } = body;
    
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }
    
    if (type === 'import') {
      // Create import job
      const importJob = await prisma.import.create({
        data: {
          userId,
          filename: data.filename || 'unknown',
          fileSize: data.fileSize || 0,
          status: 'QUEUED',
          totalChunks: data.totalChunks || 0,
          processedChunks: 0,
          notesCreated: 0,
          beatsExtracted: 0,
          connectionsFound: 0
        }
      });
      
      return NextResponse.json({
        jobId: importJob.id,
        type: 'import',
        status: 'queued'
      }, { status: 201 });
    }
    
    if (type === 'extraction') {
      // Queue extraction job
      const queue = getProcessingQueue();
      await queue.init();
      const jobId = await queue.addJob('extraction', {
        noteId: data.noteId,
        text: data.text
      });
      
      return NextResponse.json({
        jobId,
        type: 'extraction',
        status: 'queued'
      }, { status: 201 });
    }
    
    if (type === 'connection') {
      // Queue connection analysis job
      const queue = getProcessingQueue();
      await queue.init();
      const jobId = await queue.addJob('connection', {
        beatIds: data.beatIds
      });
      
      return NextResponse.json({
        jobId,
        type: 'connection',
        status: 'queued'
      }, { status: 201 });
    }
    
    return NextResponse.json({ error: 'Invalid job type' }, { status: 400 });
  } catch (error) {
    console.error('Error adding to queue:', error);
    return NextResponse.json(
      { error: 'Failed to add job', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE /api/queue - Cancel job
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    const type = searchParams.get('type');
    
    if (!jobId) {
      return NextResponse.json({ error: 'jobId required' }, { status: 400 });
    }
    
    if (type === 'import') {
      // Cancel import job
      await prisma.import.update({
        where: { id: jobId },
        data: { status: 'FAILED' }
      });
    } else {
      // Cancel queue job
      const queue = getProcessingQueue();
      await queue.init();
      await queue.cancelJob(jobId);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error cancelling job:', error);
    return NextResponse.json(
      { error: 'Failed to cancel job', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}