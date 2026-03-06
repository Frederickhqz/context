// Contradictions API - Find and manage contradictions in the beat mesh
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { getContradictionDetector, type Contradiction } from '@/lib/beats/contradiction';

// GET /api/contradictions - Find all contradictions
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Filters
    const worldId = searchParams.get('worldId');
    const timelineId = searchParams.get('timelineId');
    const dimensionId = searchParams.get('dimensionId');
    const severity = searchParams.get('severity');
    
    // Build where clause for beats
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const beatWhere: any = {};
    if (worldId) beatWhere.worldId = worldId;
    if (timelineId) beatWhere.timelineId = timelineId;
    if (dimensionId) beatWhere.dimensionId = dimensionId;
    
    // Fetch beats with connections
    const beats = await prisma.beat.findMany({
      where: beatWhere,
      include: {
        connections: {
          include: {
            toBeat: { select: { id: true, name: true, beatType: true } }
          }
        },
        reverseConnections: {
          include: {
            fromBeat: { select: { id: true, name: true, beatType: true } }
          }
        }
      }
    });
    
    // Get all connections
    const connections = await prisma.beatConnection.findMany({
      where: {
        OR: [
          { fromBeatId: { in: beats.map(b => b.id) } },
          { toBeatId: { in: beats.map(b => b.id) } }
        ]
      }
    });
    
    // Detect contradictions
    const detector = getContradictionDetector();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contradictions = await detector.findContradictions(beats as any[], connections as any[]);
    
    // Filter by severity
    let filtered = contradictions;
    if (severity) {
      filtered = contradictions.filter(c => c.severity === severity);
    }
    
    // Format for response
    const formatted = filtered.map(c => ({
      id: c.id,
      type: c.type,
      severity: c.severity,
      description: c.description,
      evidence: c.evidence,
      beats: [
        {
          id: c.beat1.id,
          name: c.beat1.name,
          type: c.beat1.beatType
        },
        {
          id: c.beat2.id,
          name: c.beat2.name,
          type: c.beat2.beatType
        }
      ],
      detectedAt: c.detectedAt.toISOString()
    }));
    
    return NextResponse.json({
      contradictions: formatted,
      total: formatted.length,
      byType: {
        temporal: formatted.filter(c => c.type === 'temporal').length,
        factual: formatted.filter(c => c.type === 'factual').length,
        relational: formatted.filter(c => c.type === 'relational').length,
        world: formatted.filter(c => c.type === 'world').length,
        character: formatted.filter(c => c.type === 'character').length,
      },
      bySeverity: {
        low: formatted.filter(c => c.severity === 'low').length,
        medium: formatted.filter(c => c.severity === 'medium').length,
        high: formatted.filter(c => c.severity === 'high').length,
        critical: formatted.filter(c => c.severity === 'critical').length,
      }
    });
    
  } catch (error) {
    console.error('Error finding contradictions:', error);
    return NextResponse.json(
      { error: 'Failed to find contradictions' },
      { status: 500 }
    );
  }
}

// POST /api/contradictions/[id]/resolve - Get resolution suggestion
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { beat1Id, beat2Id, action } = body;
    
    if (action === 'suggest') {
      // Get beats
      const [beat1, beat2] = await Promise.all([
        prisma.beat.findUnique({ where: { id: beat1Id } }),
        prisma.beat.findUnique({ where: { id: beat2Id } })
      ]);
      
      if (!beat1 || !beat2) {
        return NextResponse.json({ error: 'Beat not found' }, { status: 404 });
      }
      
      // Generate resolution suggestion using LLM
      const detector = getContradictionDetector();
      const contradiction: Contradiction = {
        id: `${beat1.id}-${beat2.id}`,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        beat1: beat1 as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        beat2: beat2 as any,
        type: 'factual',
        severity: 'medium',
        description: `Potential contradiction between "${beat1.name}" and "${beat2.name}"`,
        detectedAt: new Date()
      };
      
      const suggestion = await detector.suggestResolution(contradiction);
      
      return NextResponse.json({
        contradiction: {
          id: contradiction.id,
          type: contradiction.type,
          severity: contradiction.severity,
          description: contradiction.description
        },
        suggestion
      });
    }
    
    if (action === 'mark-resolved') {
      // Create a resolution note or connection
      const { resolution } = body;
      
      // Update both beats to indicate they're resolved
      await prisma.beat.update({
        where: { id: beat1Id },
        data: { metadata: { resolved: true, resolution } }
      });
      
      await prisma.beat.update({
        where: { id: beat2Id },
        data: { metadata: { resolved: true, resolution } }
      });
      
      // Create a RESOLVES connection
      await prisma.beatConnection.create({
        data: {
          userId: body.userId || 'demo-user',
          fromBeatId: beat1Id,
          toBeatId: beat2Id,
          connectionType: 'RESOLVES',
          description: resolution,
          strength: 1.0
        }
      });
      
      return NextResponse.json({ success: true });
    }
    
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    
  } catch (error) {
    console.error('Error resolving contradiction:', error);
    return NextResponse.json(
      { error: 'Failed to resolve contradiction' },
      { status: 500 }
    );
  }
}