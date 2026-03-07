import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { requireUser, AuthError } from '@/lib/auth/server';

function toPlainText(markdown: string): string {
  return (markdown || '')
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/`/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n+/g, ' ')
    .trim()
    .slice(0, 500);
}

// GET /api/notes/[id] - Get a note by id
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser(request);
    const { id } = await params;

    const note = await prisma.note.findFirst({
      where: { id, userId: user.id },
      include: {
        tags: { include: { tag: true } },
        entityMentions: { include: { entity: true } }
      }
    });

    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    return NextResponse.json({ note });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error fetching note:', error);
    return NextResponse.json({ error: 'Failed to fetch note' }, { status: 500 });
  }
}

// PATCH /api/notes/[id] - Update a note
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser(request);
    const { id } = await params;
    const body = await request.json();

    const data: Record<string, unknown> = {};

    if (typeof body.title !== 'undefined') data.title = body.title;
    if (typeof body.noteType !== 'undefined') data.noteType = body.noteType;
    if (typeof body.metadata !== 'undefined') data.metadata = body.metadata;

    if (typeof body.content !== 'undefined') {
      data.content = body.content;
      data.contentPlain = toPlainText(String(body.content || ''));
      // mark analysis as stale; extraction pipeline will re-run on save
      data.analysisStatus = 'PENDING';
      data.analysisError = null;
    }

    const note = await prisma.note.update({
      where: { id, userId: user.id },
      data,
    });

    // Trigger re-analysis if content changed (wipe + regenerate)
    if (typeof body.content !== 'undefined') {
      // Fire-and-forget; don't block response
      fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/notes/${id}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      }).catch(err => console.error('Failed to trigger re-analysis:', err));
    }

    return NextResponse.json({ note });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error updating note:', error);
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 });
  }
}

// DELETE /api/notes/[id] - Delete a note
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser(request);
    const { id } = await params;

    await prisma.note.delete({
      where: { id, userId: user.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error deleting note:', error);
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 });
  }
}
