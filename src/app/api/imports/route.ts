// Imports API - Batch import management
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

// POST /api/imports - Start a batch import
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.text && !body.noteIds) {
      return NextResponse.json(
        { error: 'Either text or noteIds is required' },
        { status: 400 }
      );
    }

    // Create import job record (in metadata for now)
    const jobId = `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    if (body.noteIds && Array.isArray(body.noteIds)) {
      // Batch analysis of existing notes
      const results = [];
      
      for (const noteId of body.noteIds) {
        try {
          // Get note content
          const note = await prisma.note.findUnique({
            where: { id: noteId },
            select: { id: true, content: true, contentPlain: true }
          });
          
          if (!note) {
            results.push({ noteId, status: 'error', error: 'Note not found' });
            continue;
          }
          
          // Trigger analysis
          const analyzeResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/notes/${noteId}/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              extractEntities: body.extractEntities ?? true,
              extractConnections: body.extractConnections ?? true
            })
          });
          
          if (analyzeResponse.ok) {
            const data = await analyzeResponse.json();
            results.push({ noteId, status: 'success', beatsExtracted: data.beatsExtracted });
          } else {
            results.push({ noteId, status: 'error', error: 'Analysis failed' });
          }
        } catch (err) {
          results.push({ noteId, status: 'error', error: err instanceof Error ? err.message : 'Unknown error' });
        }
      }
      
      return NextResponse.json({
        jobId,
        status: 'completed',
        type: 'batch_notes',
        results,
        summary: {
          total: results.length,
          successful: results.filter(r => r.status === 'success').length,
          failed: results.filter(r => r.status === 'error').length
        }
      });
    }
    
    // Single text import
    if (body.text) {
      // Create temporary note or process directly
      const result = await processTextImport(body.text, body.options || {});
      
      return NextResponse.json({
        jobId,
        status: 'completed',
        type: 'text_import',
        ...result
      });
    }
    
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error processing import:', error);
    return NextResponse.json(
      { error: 'Failed to process import' },
      { status: 500 }
    );
  }
}

// GET /api/imports/[id] - Get import status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('id');
    
    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }
    
    // For now, return placeholder (would store in DB for persistence)
    return NextResponse.json({
      jobId,
      status: 'completed',
      note: 'Import jobs are currently processed synchronously. This endpoint is for future async job tracking.'
    });
  } catch (error) {
    console.error('Error getting import status:', error);
    return NextResponse.json(
      { error: 'Failed to get import status' },
      { status: 500 }
    );
  }
}

// Helper function to process text import
async function processTextImport(text: string, options: Record<string, unknown>) {
  const { getBeatExtractor } = await import('@/lib/beats/extractor');
  const extractor = getBeatExtractor();
  
  const extractedBeats = await extractor.extract(text, {});
  
  const createdBeats = [];
  
  for (const extractedBeat of extractedBeats) {
    const beat = await prisma.beat.create({
      data: {
        userId: 'demo-user',
        beatType: extractedBeat.type,
        name: extractedBeat.name,
        summary: extractedBeat.summary,
        intensity: extractedBeat.intensity || 0.5,
        valence: extractedBeat.valence,
        source: 'IMPORTED',
        confidence: extractedBeat.confidence
      }
    });
    createdBeats.push(beat);
  }
  
  // Create connections
  let connectionsCreated = 0;
  for (const extractedBeat of extractedBeats) {
    if (extractedBeat.connections) {
      for (const conn of extractedBeat.connections) {
        const fromBeat = createdBeats.find(b => b.name === extractedBeat.name);
        const toBeat = createdBeats.find(b => b.name === conn.toBeatName);
        
        if (fromBeat && toBeat) {
          await prisma.beatConnection.create({
            data: {
              userId: 'demo-user',
              fromBeatId: fromBeat.id,
              toBeatId: toBeat.id,
              connectionType: conn.type,
              strength: conn.strength,
              isContradiction: false
            }
          });
          connectionsCreated++;
        }
      }
    }
  }
  
  return {
    beatsExtracted: createdBeats.length,
    connectionsCreated: connectionsCreated,
    beats: createdBeats.map(b => ({
      id: b.id,
      type: b.beatType,
      name: b.name,
      summary: b.summary
    }))
  };
}