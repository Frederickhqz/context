import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { embed } from "@/lib/embeddings";

// Types for MCP responses
interface SemanticResult {
  id: string;
  title: string | null;
  content_plain: string | null;
  note_type: string;
  created_at: Date;
  score: number;
}

interface EntityInfo {
  id: string;
  name: string;
  type?: string;
  entityType?: string;
  aliases?: string[];
  context?: string | null;
  mentionCount?: number;
}

interface TimelineGroup {
  date: string;
  notes: Array<{ id: string; title: string | null; type: string; createdAt: Date }>;
  beats: Array<{ id: string; type: string; intensity: number; note: { id: string; title: string | null } | null }>;
}

// MCP Server implementation for Context
// Exposes note-taking tools to AI agents

const TOOLS = [
  {
    name: "get_context",
    description: "Retrieve relevant context from the user's notes based on a query. Returns semantically similar notes that match the query.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "What context to retrieve"
        },
        includeTimeline: {
          type: "boolean",
          default: false,
          description: "Include timeline information"
        },
        includeEntities: {
          type: "boolean",
          default: true,
          description: "Include entity information"
        },
        maxResults: {
          type: "number",
          default: 5,
          description: "Maximum number of results"
        }
      },
      required: ["query"]
    }
  },
  {
    name: "add_note",
    description: "Add a new note to the user's collection. Supports markdown formatting and entity linking.",
    inputSchema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "Note content (markdown)"
        },
        title: {
          type: "string",
          description: "Note title (optional)"
        },
        type: {
          type: "string",
          enum: ["note", "journal", "beat"],
          default: "note"
        },
        entities: {
          type: "array",
          items: { type: "string" },
          description: "Entity names to link"
        },
        collections: {
          type: "array",
          items: { type: "string" },
          description: "Collection names to add to"
        }
      },
      required: ["content"]
    }
  },
  {
    name: "search_notes",
    description: "Search notes using semantic or keyword search. Returns matching notes sorted by relevance.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query"
        },
        type: {
          type: "string",
          enum: ["semantic", "keyword", "hybrid"],
          default: "semantic"
        },
        filters: {
          type: "object",
          properties: {
            dateRange: {
              type: "object",
              properties: {
                start: { type: "string", format: "date-time" },
                end: { type: "string", format: "date-time" }
              }
            },
            entities: {
              type: "array",
              items: { type: "string" }
            },
            types: {
              type: "array",
              items: { type: "string", enum: ["note", "journal", "beat"] }
            }
          }
        },
        limit: {
          type: "number",
          default: 10
        }
      },
      required: ["query"]
    }
  },
  {
    name: "get_timeline",
    description: "Get timeline of notes and beats for a date range. Useful for understanding what happened during a period.",
    inputSchema: {
      type: "object",
      properties: {
        start: {
          type: "string",
          format: "date-time",
          description: "Start date (default: 1 week ago)"
        },
        end: {
          type: "string",
          format: "date-time",
          description: "End date (default: now)"
        },
        granularity: {
          type: "string",
          enum: ["day", "week", "month", "year"],
          default: "day"
        },
        includeConnections: {
          type: "boolean",
          default: false
        }
      }
    }
  },
  {
    name: "trace_connection",
    description: "Trace connections between notes, entities, or concepts. Returns the path between two points.",
    inputSchema: {
      type: "object",
      properties: {
        from: {
          type: "string",
          description: "Starting note or entity ID"
        },
        to: {
          type: "string",
          description: "Target note or entity ID (optional)"
        },
        maxDepth: {
          type: "number",
          default: 3,
          description: "Maximum connection depth"
        },
        connectionTypes: {
          type: "array",
          items: { type: "string" },
          description: "Filter by connection types"
        }
      },
      required: ["from"]
    }
  },
  {
    name: "get_entities",
    description: "Get entities (people, places, projects, concepts) mentioned in notes or all entities.",
    inputSchema: {
      type: "object",
      properties: {
        noteId: {
          type: "string",
          description: "Note ID to get entities for"
        },
        type: {
          type: "string",
          enum: ["person", "place", "project", "concept", "event"]
        },
        limit: {
          type: "number",
          default: 20
        }
      }
    }
  },
  {
    name: "create_beat",
    description: "Create a beat (event, milestone, feeling, or insight) associated with a note.",
    inputSchema: {
      type: "object",
      properties: {
        noteId: {
          type: "string",
          description: "Note ID to associate with"
        },
        beatType: {
          type: "string",
          enum: ["event", "milestone", "feeling", "insight"],
          description: "Type of beat"
        },
        intensity: {
          type: "number",
          minimum: 1,
          maximum: 5,
          default: 1,
          description: "Intensity level (1-5)"
        },
        startedAt: {
          type: "string",
          format: "date-time",
          description: "When the beat started"
        },
        endedAt: {
          type: "string",
          format: "date-time",
          description: "When the beat ended"
        }
      },
      required: ["beatType"]
    }
  },
  {
    name: "connect_notes",
    description: "Create a connection between two notes.",
    inputSchema: {
      type: "object",
      properties: {
        fromNoteId: {
          type: "string",
          description: "Source note ID"
        },
        toNoteId: {
          type: "string",
          description: "Target note ID"
        },
        connectionType: {
          type: "string",
          enum: ["reference", "semantic", "temporal"],
          default: "reference",
          description: "Type of connection"
        },
        strength: {
          type: "number",
          minimum: 0,
          maximum: 1,
          default: 1,
          description: "Connection strength (0-1)"
        }
      },
      required: ["fromNoteId", "toNoteId"]
    }
  }
];

// Handle MCP requests
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { method, params } = body;

    // TODO: Add authentication
    // const user = await authenticateMCPRequest(request);
    // if (!user) return errorResponse("Unauthorized", 401);

    switch (method) {
      case "tools/list":
        return NextResponse.json({ tools: TOOLS });

      case "tools/call":
        return handleToolCall(params.name, params.arguments);

      default:
        return NextResponse.json(
          { error: `Unknown method: ${method}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("MCP error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Handle tool calls
async function handleToolCall(name: string, args: Record<string, unknown>) {
  try {
    switch (name) {
      case "get_context":
        return handleGetContext(args);

      case "add_note":
        return handleAddNote(args);

      case "search_notes":
        return handleSearchNotes(args);

      case "get_timeline":
        return handleGetTimeline(args);

      case "trace_connection":
        return handleTraceConnection(args);

      case "get_entities":
        return handleGetEntities(args);

      case "create_beat":
        return handleCreateBeat(args);

      case "connect_notes":
        return handleConnectNotes(args);

      default:
        return NextResponse.json(
          { error: `Unknown tool: ${name}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error(`Tool error (${name}):`, error);
    return NextResponse.json({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: error instanceof Error ? error.message : "Unknown error",
            tool: name
          }, null, 2)
        }
      ]
    });
  }
}

// Tool implementations
async function handleGetContext(args: Record<string, unknown>) {
  const { query, maxResults = 5, includeEntities = true } = args as {
    query: string;
    maxResults?: number;
    includeEntities?: boolean;
  };

  // Generate embedding for query
  let queryEmbedding: number[];
  try {
    queryEmbedding = await embed(query);
  } catch {
    // Fall back to keyword search if embedding fails
    const notes = await prisma.note.findMany({
      where: {
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { contentPlain: { contains: query, mode: 'insensitive' } },
        ]
      },
      take: maxResults,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      content: [{
        type: "text",
        text: JSON.stringify({
          query,
          results: notes.map(n => ({
            id: n.id,
            title: n.title,
            content: n.contentPlain?.slice(0, 500),
            type: n.noteType,
            createdAt: n.createdAt,
          })),
          searchType: 'keyword_fallback'
        }, null, 2)
      }]
    });
  }

  // Semantic search using pgvector
  const results = await prisma.$queryRaw`
    SELECT 
      n.id, n.title, n.content_plain, n.note_type, n.created_at,
      1 - (n.embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as score
    FROM notes n
    ORDER BY n.embedding <=> ${JSON.stringify(queryEmbedding)}::vector
    LIMIT ${maxResults}
  ` as SemanticResult[];

  // Fetch entities if requested
  let entities: EntityInfo[] = [];
  if (includeEntities && results.length > 0) {
    const noteIds = results.map(r => r.id);
    const mentions = await prisma.entityMention.findMany({
      where: { noteId: { in: noteIds } },
      include: { entity: true },
    });
    entities = mentions.map((m): EntityInfo => ({
      id: m.entity.id,
      name: m.entity.name,
      type: m.entity.entityType,
    }));
  }

  return NextResponse.json({
    content: [{
      type: "text",
      text: JSON.stringify({
        query,
        results: results.map(r => ({
          id: r.id,
          title: r.title,
          content: r.content_plain?.slice(0, 500),
          type: r.note_type,
          score: r.score,
          createdAt: r.created_at,
        })),
        entities: includeEntities ? entities : undefined,
        searchType: 'semantic'
      }, null, 2)
    }]
  });
}

async function handleAddNote(args: Record<string, unknown>) {
  const { content, title, type = "note", entities = [], collections = [] } = args as {
    content: string;
    title?: string;
    type?: string;
    entities?: string[];
    collections?: string[];
  };

  // Generate embedding
  let embedding: number[] | null = null;
  try {
    embedding = await embed(content);
  } catch (e) {
    console.warn("Failed to generate embedding:", e);
  }

  // Create note
  const note = await prisma.note.create({
    data: {
      userId: "demo-user", // TODO: Replace with actual user ID
      title: title || null,
      content,
      contentPlain: content.replace(/[#*_`]/g, ''), // Strip markdown
      noteType: type,
      // embedding is set separately via vector query
    },
  });

  // Link entities if provided
  if (entities.length > 0) {
    for (const entityName of entities) {
      // Find or create entity
      let entity = await prisma.entity.findFirst({
        where: {
          userId: "demo-user",
          name: entityName,
          entityType: "concept",
        },
      });

      if (!entity) {
        entity = await prisma.entity.create({
          data: {
            userId: "demo-user",
            name: entityName,
            entityType: "concept",
          },
        });
      }

      // Create mention
      await prisma.entityMention.create({
        data: {
          noteId: note.id,
          entityId: entity.id,
          context: content.slice(0, 200),
        },
      });
    }
  }

  // Add to collections if provided
  if (collections.length > 0) {
    for (const collectionName of collections) {
      const collection = await prisma.collection.findFirst({
        where: {
          userId: "demo-user",
          name: collectionName,
        },
      });

      if (collection) {
        await prisma.collectionNote.create({
          data: {
            noteId: note.id,
            collectionId: collection.id,
          },
        });
      }
    }
  }

  return NextResponse.json({
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        note: {
          id: note.id,
          title: note.title,
          type: note.noteType,
          createdAt: note.createdAt,
          entitiesLinked: entities.length,
          collectionsAdded: collections.length,
        }
      }, null, 2)
    }]
  });
}

async function handleSearchNotes(args: Record<string, unknown>) {
  const { query, type = "semantic", limit = 10, filters } = args as {
    query: string;
    type?: string;
    limit?: number;
    filters?: {
      dateRange?: { start?: string; end?: string };
      entities?: string[];
      types?: string[];
    };
  };

  let results: SemanticResult[] = [];

  if (type === "semantic" || type === "hybrid") {
    try {
      const queryEmbedding = await embed(query);
      
      results = await prisma.$queryRaw`
        SELECT 
          n.id, n.title, n.content_plain, n.note_type, n.created_at,
          1 - (n.embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as score
        FROM notes n
        WHERE 1=1
          ${filters?.types?.length ? prisma.$queryRaw`AND n.note_type IN (${filters.types})` : prisma.$queryRaw``}
          ${filters?.dateRange?.start ? prisma.$queryRaw`AND n.created_at >= ${filters.dateRange.start}::timestamp` : prisma.$queryRaw``}
          ${filters?.dateRange?.end ? prisma.$queryRaw`AND n.created_at <= ${filters.dateRange.end}::timestamp` : prisma.$queryRaw``}
        ORDER BY n.embedding <=> ${JSON.stringify(queryEmbedding)}::vector
        LIMIT ${limit}
      ` as SemanticResult[];
    } catch {
      // Fall back to keyword search
    }
  }

  if (type === "keyword" || (type === "hybrid" && results.length === 0)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { contentPlain: { contains: query, mode: 'insensitive' } },
      ],
    };

    if (filters?.types?.length) {
      where.noteType = { in: filters.types };
    }

    if (filters?.dateRange?.start || filters?.dateRange?.end) {
      where.createdAt = {};
      if (filters.dateRange.start) where.createdAt.gte = new Date(filters.dateRange.start);
      if (filters.dateRange.end) where.createdAt.lte = new Date(filters.dateRange.end);
    }

    const keywordResults = await prisma.note.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    results = keywordResults.map((n): SemanticResult => ({
      id: n.id,
      title: n.title,
      content_plain: n.contentPlain,
      note_type: n.noteType,
      created_at: n.createdAt,
      score: 0.5, // Default score for keyword results
    }));
  }

  return NextResponse.json({
    content: [{
      type: "text",
      text: JSON.stringify({
        query,
        type,
        results: results.map(r => ({
          id: r.id,
          title: r.title,
          content: r.content_plain?.slice(0, 500),
          type: r.note_type,
          score: r.score,
          createdAt: r.created_at,
        })),
        count: results.length,
      }, null, 2)
    }]
  });
}

async function handleGetTimeline(args: Record<string, unknown>) {
  const { start, end, granularity = "day", includeConnections = false } = args as {
    start?: string;
    end?: string;
    granularity?: string;
    includeConnections?: boolean;
  };

  const startDate = start ? new Date(start) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const endDate = end ? new Date(end) : new Date();

  const notes = await prisma.note.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });

  const beats = await prisma.beat.findMany({
    where: {
      startedAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: { startedAt: 'asc' },
    include: { note: { select: { id: true, title: true } } },
    take: 50,
  });

  // Group by granularity
  const grouped: Record<string, TimelineGroup> = {};
  
  for (const note of notes) {
    const key = getDateKey(note.createdAt, granularity as 'day' | 'week' | 'month' | 'year');
    if (!grouped[key]) grouped[key] = { date: key, notes: [], beats: [] };
    grouped[key].notes.push({
      id: note.id,
      title: note.title,
      type: note.noteType,
      createdAt: note.createdAt,
    });
  }

  for (const beat of beats) {
    const key = getDateKey(beat.startedAt || beat.createdAt, granularity as 'day' | 'week' | 'month' | 'year');
    if (!grouped[key]) grouped[key] = { date: key, notes: [], beats: [] };
    grouped[key].beats.push({
      id: beat.id,
      type: beat.beatType,
      intensity: beat.intensity,
      note: beat.note ? { id: beat.note.id, title: beat.note.title } : null,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let connections: any[] = [];
  if (includeConnections) {
    const noteIds = notes.map(n => n.id);
    connections = await prisma.connection.findMany({
      where: {
        OR: [
          { fromNoteId: { in: noteIds } },
          { toNoteId: { in: noteIds } },
        ],
      },
      include: {
        fromNote: { select: { id: true, title: true } },
        toNote: { select: { id: true, title: true } },
      },
    });
  }

  return NextResponse.json({
    content: [{
      type: "text",
      text: JSON.stringify({
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        granularity,
        timeline: Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date)),
        connections: includeConnections ? connections : undefined,
      }, null, 2)
    }]
  });
}

async function handleTraceConnection(args: Record<string, unknown>) {
  const { from, to, maxDepth = 3, connectionTypes } = args as {
    from: string;
    to?: string;
    maxDepth?: number;
    connectionTypes?: string[];
  };

  // BFS to find paths
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type PathInfo = { path: string[]; connections: any[] };
  const visited = new Set<string>();
  const queue: Array<{ id: string; path: string[] }> = [{ id: from, path: [from] }];
  const paths: PathInfo[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { fromNoteId: from };
  if (connectionTypes?.length) {
    where.connectionType = { in: connectionTypes };
  }

  while (queue.length > 0 && paths.length < 5) {
    const current = queue.shift()!;
    if (visited.has(current.id)) continue;
    visited.add(current.id);

    // Get outgoing connections
    const connections = await prisma.connection.findMany({
      where: { fromNoteId: current.id },
      include: {
        toNote: { select: { id: true, title: true } },
      },
    });

    for (const conn of connections) {
      const newPath = [...current.path, conn.toNoteId];
      
      if (to && conn.toNoteId === to) {
        paths.push({ path: newPath, connections: [] });
      } else if (newPath.length < maxDepth && !visited.has(conn.toNoteId)) {
        queue.push({ id: conn.toNoteId, path: newPath });
      }
    }
  }

  return NextResponse.json({
    content: [{
      type: "text",
      text: JSON.stringify({
        from,
        to,
        maxDepth,
        pathsFound: paths.length,
        paths: paths.map(p => ({
          length: p.path.length,
          nodes: p.path,
        })),
      }, null, 2)
    }]
  });
}

async function handleGetEntities(args: Record<string, unknown>) {
  const { noteId, type, limit = 20 } = args as {
    noteId?: string;
    type?: string;
    limit?: number;
  };

  let entities: EntityInfo[];

  if (noteId) {
    const mentions = await prisma.entityMention.findMany({
      where: { noteId },
      include: { entity: true },
      take: limit,
    });
    entities = mentions.map((m): EntityInfo => ({
      id: m.entity.id,
      name: m.entity.name,
      type: m.entity.entityType,
      aliases: m.entity.aliases,
      context: m.context,
    }));
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (type) where.entityType = type;

    const results = await prisma.entity.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { mentions: true } },
      },
    });

    entities = results.map((e): EntityInfo => ({
      id: e.id,
      name: e.name,
      type: e.entityType,
      aliases: e.aliases,
      mentionCount: e._count.mentions,
    }));
  }

  return NextResponse.json({
    content: [{
      type: "text",
      text: JSON.stringify({
        noteId,
        type,
        count: entities.length,
        entities,
      }, null, 2)
    }]
  });
}

async function handleCreateBeat(args: Record<string, unknown>) {
  const { noteId, beatType, intensity = 1, startedAt, endedAt } = args as {
    noteId?: string;
    beatType: string;
    intensity?: number;
    startedAt?: string;
    endedAt?: string;
  };

  if (!noteId) {
    return NextResponse.json({
      content: [{
        type: "text",
        text: JSON.stringify({
          success: false,
          error: "noteId is required for creating a beat",
        }, null, 2)
      }]
    });
  }

  const beat = await prisma.beat.create({
    data: {
      userId: "demo-user",
      noteId,
      beatType,
      intensity,
      startedAt: startedAt ? new Date(startedAt) : null,
      endedAt: endedAt ? new Date(endedAt) : null,
    },
  });

  return NextResponse.json({
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        beat: {
          id: beat.id,
          type: beat.beatType,
          intensity: beat.intensity,
          startedAt: beat.startedAt,
          endedAt: beat.endedAt,
        },
      }, null, 2)
    }]
  });
}

async function handleConnectNotes(args: Record<string, unknown>) {
  const { fromNoteId, toNoteId, connectionType = "reference", strength = 1 } = args as {
    fromNoteId: string;
    toNoteId: string;
    connectionType?: string;
    strength?: number;
  };

  // Check if connection exists
  const existing = await prisma.connection.findFirst({
    where: {
      fromNoteId,
      toNoteId,
      connectionType,
    },
  });

  if (existing) {
    return NextResponse.json({
      content: [{
        type: "text",
        text: JSON.stringify({
          success: false,
          message: "Connection already exists",
          connection: existing,
        }, null, 2)
      }]
    });
  }

  const connection = await prisma.connection.create({
    data: {
      userId: "demo-user",
      fromNoteId,
      toNoteId,
      connectionType,
      strength,
    },
  });

  return NextResponse.json({
    content: [{
      type: "text",
      text: JSON.stringify({
        success: true,
        connection: {
          id: connection.id,
          from: fromNoteId,
          to: toNoteId,
          type: connectionType,
          strength,
        },
      }, null, 2)
    }]
  });
}

// Helper function
function getDateKey(date: Date, granularity: 'day' | 'week' | 'month' | 'year'): string {
  const d = new Date(date);
  
  switch (granularity) {
    case 'day':
      return d.toISOString().split('T')[0];
    case 'week': {
      const startOfWeek = new Date(d);
      startOfWeek.setDate(d.getDate() - d.getDay());
      return startOfWeek.toISOString().split('T')[0];
    }
    case 'month':
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    case 'year':
      return String(d.getFullYear());
    default:
      return d.toISOString().split('T')[0];
  }
}