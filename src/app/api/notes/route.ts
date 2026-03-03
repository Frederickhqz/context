import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

// GET /api/notes - List notes
export async function GET(request: NextRequest) {
  try {
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
      where: type ? { noteType: type } : undefined,
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
    console.error("Error fetching notes:", error);
    return NextResponse.json(
      { error: "Failed to fetch notes" },
      { status: 500 }
    );
  }
}

// POST /api/notes - Create note
export async function POST(request: NextRequest) {
  try {
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
        userId: "demo-user",
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
    console.error("Error creating note:", error);
    return NextResponse.json(
      { error: "Failed to create note" },
      { status: 500 }
    );
  }
}