import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

// GET /api/connections - List connections
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const noteId = searchParams.get('noteId');
    const type = searchParams.get('type'); // reference, semantic, temporal
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // TODO: Add authentication

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    
    if (noteId) {
      where.OR = [
        { fromNoteId: noteId },
        { toNoteId: noteId },
      ];
    }
    
    if (type) {
      where.connectionType = type;
    }

    const connections = await prisma.connection.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
      include: {
        fromNote: {
          select: { id: true, title: true, noteType: true },
        },
        toNote: {
          select: { id: true, title: true, noteType: true },
        },
      },
    });

    return NextResponse.json({ connections });
  } catch (error) {
    console.error('Error fetching connections:', error);
    return NextResponse.json(
      { error: 'Failed to fetch connections' },
      { status: 500 }
    );
  }
}

// POST /api/connections - Create connection
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fromNoteId, toNoteId, connectionType = 'reference', strength = 1.0 } = body;

    // TODO: Add authentication

    if (!fromNoteId || !toNoteId) {
      return NextResponse.json(
        { error: 'fromNoteId and toNoteId are required' },
        { status: 400 }
      );
    }

    // Check if connection already exists
    const existing = await prisma.connection.findFirst({
      where: {
        fromNoteId,
        toNoteId,
        connectionType,
      },
    });

    if (existing) {
      return NextResponse.json({ connection: existing, created: false });
    }

    const connection = await prisma.connection.create({
      data: {
        userId: 'demo-user', // TODO: Replace with actual user ID
        fromNoteId,
        toNoteId,
        connectionType,
        strength,
      },
      include: {
        fromNote: { select: { id: true, title: true } },
        toNote: { select: { id: true, title: true } },
      },
    });

    return NextResponse.json({ connection, created: true }, { status: 201 });
  } catch (error) {
    console.error('Error creating connection:', error);
    return NextResponse.json(
      { error: 'Failed to create connection' },
      { status: 500 }
    );
  }
}

// DELETE /api/connections - Delete connection
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Connection ID is required' },
        { status: 400 }
      );
    }

    await prisma.connection.delete({
      where: { id },
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