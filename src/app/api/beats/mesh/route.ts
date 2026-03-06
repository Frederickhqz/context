// Beat Mesh API - Get mesh data for 3D visualization
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { BeatType, BeatConnectionType, BEAT_TYPE_CONFIG } from '@/lib/beats/types';

// GET /api/beats/mesh - Get mesh data for visualization
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Filters
    const worldId = searchParams.get('worldId');
    const timelineId = searchParams.get('timelineId');
    const dimensionId = searchParams.get('dimensionId');
    const types = searchParams.get('types')?.split(',').filter(Boolean) as BeatType[] | undefined;
    const connectionTypes = searchParams.get('connectionTypes')?.split(',').filter(Boolean) as BeatConnectionType[] | undefined;
    const minIntensity = parseFloat(searchParams.get('minIntensity') || '0');
    const maxIntensity = parseFloat(searchParams.get('maxIntensity') || '1');
    const showContradictions = searchParams.get('showContradictions') === 'true';
    
    // Build where clause for beats
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const beatWhere: any = {};
    
    if (types && types.length > 0) {
      beatWhere.beatType = { in: types };
    }
    
    if (worldId) {
      beatWhere.worldId = worldId;
    }
    
    if (timelineId) {
      beatWhere.timelineId = timelineId;
    }
    
    if (dimensionId) {
      beatWhere.dimensionId = dimensionId;
    }
    
    beatWhere.intensity = {
      gte: minIntensity,
      lte: maxIntensity,
    };
    
    // Fetch beats
    const beats = await prisma.beat.findMany({
      where: beatWhere,
      select: {
        id: true,
        beatType: true,
        name: true,
        summary: true,
        intensity: true,
        valence: true,
        frequency: true,
      }
    });
    
    const beatIds = new Set(beats.map(b => b.id));
    
    // Fetch connections
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const connectionWhere: any = {
      OR: [
        { fromBeatId: { in: Array.from(beatIds) } },
        { toBeatId: { in: Array.from(beatIds) } },
      ]
    };
    
    if (connectionTypes && connectionTypes.length > 0) {
      connectionWhere.connectionType = { in: connectionTypes };
    }
    
    if (showContradictions === false) {
      connectionWhere.isContradiction = false;
    }
    
    const connections = await prisma.beatConnection.findMany({
      where: connectionWhere,
      select: {
        id: true,
        fromBeatId: true,
        toBeatId: true,
        connectionType: true,
        strength: true,
        isContradiction: true,
        evidence: true,
      }
    });
    
    // Filter connections where both beats are in our set
    const filteredConnections = connections.filter(
      c => beatIds.has(c.fromBeatId) && beatIds.has(c.toBeatId)
    );
    
    // Calculate node positions using force-directed layout
    const nodes = beats.map((beat, index) => {
      const config = BEAT_TYPE_CONFIG[beat.beatType as BeatType];
      
      // Initial positions in a sphere
      const phi = Math.acos(-1 + (2 * index) / beats.length);
      const theta = Math.sqrt(beats.length * Math.PI) * phi;
      const radius = 5 + beat.intensity * 3;
      
      return {
        id: beat.id,
        type: beat.beatType,
        name: beat.name,
        summary: beat.summary,
        intensity: beat.intensity,
        valence: beat.valence,
        frequency: beat.frequency,
        color: config?.color || '#888888',
        shape: config?.shape || 'sphere',
        // Initial position (will be adjusted by force simulation in client)
        position: [
          radius * Math.cos(theta) * Math.sin(phi),
          radius * Math.sin(theta) * Math.sin(phi),
          radius * Math.cos(phi)
        ] as [number, number, number],
      };
    });
    
    // Build edges
    const edges = filteredConnections.map(conn => ({
      id: conn.id,
      from: conn.fromBeatId,
      to: conn.toBeatId,
      type: conn.connectionType,
      strength: conn.strength,
      isContradiction: conn.isContradiction,
      evidence: conn.evidence,
    }));
    
    // Calculate statistics
    const stats = {
      totalBeats: nodes.length,
      totalConnections: edges.length,
      byType: {} as Record<string, number>,
      byConnectionType: {} as Record<string, number>,
      contradictions: edges.filter(e => e.isContradiction).length,
      avgIntensity: nodes.reduce((sum, n) => sum + n.intensity, 0) / nodes.length || 0,
    };
    
    for (const node of nodes) {
      stats.byType[node.type] = (stats.byType[node.type] || 0) + 1;
    }
    
    for (const edge of edges) {
      stats.byConnectionType[edge.type] = (stats.byConnectionType[edge.type] || 0) + 1;
    }
    
    return NextResponse.json({
      mesh: {
        nodes,
        edges,
      },
      stats,
      filters: {
        worldId,
        timelineId,
        dimensionId,
        types,
        connectionTypes,
        minIntensity,
        maxIntensity,
        showContradictions,
      },
    });
  } catch (error) {
    console.error('Error fetching mesh:', error);
    return NextResponse.json(
      { error: 'Failed to fetch mesh data' },
      { status: 500 }
    );
  }
}