import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

// GET /api/beats - List beats
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // event, milestone, feeling, insight
    const noteId = searchParams.get('noteId');
    const startDate = searchParams.get('start');
    const endDate = searchParams.get('end');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // TODO: Add authentication

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    
    if (type) {
      where.beatType = type;
    }
    
    if (noteId) {
      where.noteId = noteId;
    }
    
    if (startDate || endDate) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const orConditions: any[] = [
        { startedAt: {} },
        { createdAt: {} },
      ];
      
      if (startDate) {
        orConditions[0] = { startedAt: { gte: new Date(startDate) } };
        orConditions[1] = { createdAt: { gte: new Date(startDate) } };
      }
      
      if (endDate) {
        orConditions[0] = { 
          startedAt: { 
            ...orConditions[0].startedAt,
            lte: new Date(endDate) 
          } 
        };
        orConditions[1] = { 
          createdAt: { 
            ...orConditions[1].createdAt,
            lte: new Date(endDate) 
          } 
        };
      }
      
      where.OR = orConditions;
    }

    const beats = await prisma.beat.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
      include: {
        note: {
          select: { id: true, title: true },
        },
      },
    });

    return NextResponse.json({ beats });
  } catch (error) {
    console.error('Error fetching beats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch beats' },
      { status: 500 }
    );
  }
}

// POST /api/beats - Create beat
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      noteId, 
      beatType, 
      intensity = 1, 
      startedAt, 
      endedAt 
    } = body;

    // TODO: Add authentication

    if (!beatType) {
      return NextResponse.json(
        { error: 'beatType is required' },
        { status: 400 }
      );
    }

    const beat = await prisma.beat.create({
      data: {
        userId: 'demo-user', // TODO: Replace with actual user ID
        noteId,
        beatType,
        intensity,
        startedAt: startedAt ? new Date(startedAt) : null,
        endedAt: endedAt ? new Date(endedAt) : null,
      },
      include: {
        note: { select: { id: true, title: true } },
      },
    });

    return NextResponse.json({ beat }, { status: 201 });
  } catch (error) {
    console.error('Error creating beat:', error);
    return NextResponse.json(
      { error: 'Failed to create beat' },
      { status: 500 }
    );
  }
}

// PATCH /api/beats - Update beat
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Beat ID is required' },
        { status: 400 }
      );
    }

    // TODO: Add authentication

    const beat = await prisma.beat.update({
      where: { id },
      data: {
        ...updates,
        startedAt: updates.startedAt ? new Date(updates.startedAt) : undefined,
        endedAt: updates.endedAt ? new Date(updates.endedAt) : undefined,
      },
      include: {
        note: { select: { id: true, title: true } },
      },
    });

    return NextResponse.json({ beat });
  } catch (error) {
    console.error('Error updating beat:', error);
    return NextResponse.json(
      { error: 'Failed to update beat' },
      { status: 500 }
    );
  }
}

// DELETE /api/beats - Delete beat
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Beat ID is required' },
        { status: 400 }
      );
    }

    // TODO: Add authentication

    await prisma.beat.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting beats:', error);
    return NextResponse.json(
      { error: 'Failed to delete beat' },
      { status: 500 }
    );
  }
}