// Beat Connections API - Get and create connections for a beat
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

// GET /api/beats/[id]/connections - Get beat connections
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Get beat with connections
    const beat = await prisma.beat.findUnique({
      where: { id },
      include: {
        connections: {
          include: {
            toBeat: {
              select: { id: true, name: true, beatType: true, summary: true }
            }
          }
        },
        reverseConnections: {
          include: {
            fromBeat: {
              select: { id: true, name: true, beatType: true, summary: true }
            }
          }
        }
      }
    });

    if (!beat) {
      return NextResponse.json(
        { error: 'Beat not found' },
        { status: 404 }
      );
    }

    // Transform to unified connection format
    const outgoing = beat.connections.map(c => ({
      id: c.id,
      fromBeatId: c.fromBeatId,
      toBeatId: c.toBeatId,
      type: c.connectionType,
      strength: c.strength,
      isContradiction: c.isContradiction,
      direction: 'outgoing' as const,
      otherBeat: c.toBeat
    }));

    const incoming = beat.reverseConnections.map(c => ({
      id: c.id,
      fromBeatId: c.fromBeatId,
      toBeatId: c.toBeatId,
      type: c.connectionType,
      strength: c.strength,
      isContradiction: c.isContradiction,
      direction: 'incoming' as const,
      otherBeat: c.fromBeat
    }));

    return NextResponse.json({
      beatId: id,
      connections: [...outgoing, ...incoming],
      total: outgoing.length + incoming.length,
      outgoingCount: outgoing.length,
      incomingCount: incoming.length
    });
  } catch (error) {
    console.error('Error fetching beat connections:', error);
    return NextResponse.json(
      { error: 'Failed to fetch connections' },
      { status: 500 }
    );
  }
}

// POST /api/beats/[id]/connections - Create a connection
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Validate required fields
    if (!body.toBeatId || !body.connectionType) {
      return NextResponse.json(
        { error: 'toBeatId and connectionType are required' },
        { status: 400 }
      );
    }

    // Check both beats exist
    const [fromBeat, toBeat] = await Promise.all([
      prisma.beat.findUnique({ where: { id } }),
      prisma.beat.findUnique({ where: { id: body.toBeatId } })
    ]);

    if (!fromBeat || !toBeat) {
      return NextResponse.json(
        { error: 'One or both beats not found' },
        { status: 404 }
      );
    }

    // Create connection
    const connection = await prisma.beatConnection.create({
      data: {
        userId: body.userId || 'demo-user',
        fromBeatId: id,
        toBeatId: body.toBeatId,
        connectionType: body.connectionType,
        strength: body.strength || 0.5,
        isContradiction: body.isContradiction || false,
        description: body.description,
        evidence: body.evidence
      },
      include: {
        toBeat: {
          select: { id: true, name: true, beatType: true, summary: true }
        }
      }
    });

    return NextResponse.json({
      success: true,
      connection: {
        id: connection.id,
        fromBeatId: connection.fromBeatId,
        toBeatId: connection.toBeatId,
        type: connection.connectionType,
        strength: connection.strength,
        isContradiction: connection.isContradiction,
        toBeat: connection.toBeat
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating connection:', error);
    return NextResponse.json(
      { error: 'Failed to create connection' },
      { status: 500 }
    );
  }
}

// DELETE /api/beats/[id]/connections - Delete a connection
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const connectionId = searchParams.get('connectionId');

    if (!connectionId) {
      return NextResponse.json(
        { error: 'connectionId is required' },
        { status: 400 }
      );
    }

    await prisma.beatConnection.delete({
      where: { id: connectionId }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting connection:', error);
    return NextResponse.json(
      { error: 'Failed to delete connection' },
      { status: 500 }
    );
  }
}