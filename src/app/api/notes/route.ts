import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { requireUser, AuthError } from "@/lib/auth/server";
import { isDemoMode, getDemoNotes, createDemoNote, DemoNote } from "@/lib/demo/client";

// GET /api/notes - List notes
export async function GET(request: NextRequest) {
  // Demo mode - return from localStorage (passed via header)
  const demoMode = request.headers.get('x-demo-mode') === 'true';
  if (demoMode || isDemoMode()) {
    const notes = getDemoNotes();
    return NextResponse.json({ notes });
  }

  try {
    const user = await requireUser(request);

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");
    const type = searchParams.get("type");

    // TODO: Add authentication
    // const user = await getCurrentUser();
    // if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const notes = await prisma.note.findMany({
      take: limit,
      skip: offset,
      orderBy: { createdAt: "desc" },
      where: {
        userId: user.id,
        ...(type ? { noteType: type } : {}),
      },
      include: {
        tags: {
          include: { tag: true }
        },
        entityMentions: {
          include: { entity: true }
        }
      }
    });

    return NextResponse.json({ notes });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error("Error fetching notes:", error);
    return NextResponse.json(
      { error: "Failed to fetch notes" },
      { status: 500 }
    );
  }
}

// PATCH /api/notes - Update note (legacy client path)
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const body = await request.json();
    const { id, title, content, noteType, metadata } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    // Build update object
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};

    if (typeof title !== 'undefined') data.title = title;
    if (typeof noteType !== 'undefined') data.noteType = noteType;
    if (typeof metadata !== 'undefined') data.metadata = metadata;

    if (typeof content !== 'undefined') {
      const contentPlain = String(content || '')
        .replace(/#{1,6}\s/g, '')
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/`/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/\n+/g, ' ')
        .trim()
        .slice(0, 500);

      data.content = content;
      data.contentPlain = contentPlain;
      data.analysisStatus = 'PENDING';
      data.analysisError = null;
    }

    const note = await prisma.note.update({
      where: { id, userId: user.id },
      data,
    });

    return NextResponse.json({ note });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Error updating note:', error);
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 });
  }
}

// DELETE /api/notes - Delete note (legacy client path: /api/notes?id=...)
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

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

// POST /api/notes - Create note
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const body = await request.json();
    const { title, content, noteType = "note", metadata, entityIds = [], collectionIds = [], tagIds = [] } = body;

    // TODO: Add authentication
    // const user = await getCurrentUser();
    // if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!content) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    // Extract plain text from markdown (basic implementation)
    const contentPlain = content
      .replace(/#{1,6}\s/g, "")
      .replace(/\*\*/g, "")
      .replace(/\*/g, "")
      .replace(/`/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/\n+/g, " ")
      .trim()
      .slice(0, 500);

    const note = await prisma.note.create({
      data: {
        // TODO: Replace with actual user ID from auth
        userId: user.id,
        title,
        content,
        contentPlain,
        noteType,
        metadata,
      },
    });

    // Create entity mentions if provided
    if (entityIds.length > 0) {
      await prisma.entityMention.createMany({
        data: entityIds.map((entityId: string) => ({
          entityId,
          noteId: note.id,
        })),
      });
    }

    // Add to collections if provided
    if (collectionIds.length > 0) {
      await prisma.collectionNote.createMany({
        data: collectionIds.map((collectionId: string) => ({
          collectionId,
          noteId: note.id,
        })),
      });
    }

    // Add tags if provided
    if (tagIds.length > 0) {
      await prisma.noteTag.createMany({
        data: tagIds.map((tagId: string) => ({
          tagId,
          noteId: note.id,
        })),
      });
    }

    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error("Error creating note:", error);
    return NextResponse.json(
      { error: "Failed to create note" },
      { status: 500 }
    );
  }
}