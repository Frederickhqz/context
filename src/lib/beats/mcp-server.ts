// Model Context Protocol Server for Context Beats
// Allows AI assistants to interact with the beat mesh

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { prisma } from '@/lib/db/client';
import { getBeatExtractor } from '@/lib/beats/extractor';
import { getContradictionDetector } from '@/lib/beats/contradiction';

// ============ Tools ============

const tools: Tool[] = [
  {
    name: 'list_beats',
    description: 'List all beats in the mesh, optionally filtered by type',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          description: 'Filter by beat type (CHARACTER, THEME, EVENT, etc.)'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of beats to return (default: 50)'
        }
      }
    }
  },
  {
    name: 'get_beat',
    description: 'Get details about a specific beat by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'The beat ID'
        }
      },
      required: ['id']
    }
  },
  {
    name: 'create_beat',
    description: 'Create a new beat manually',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          description: 'Beat type (CHARACTER, THEME, EVENT, etc.)'
        },
        name: {
          type: 'string',
          description: 'Beat name'
        },
        summary: {
          type: 'string',
          description: 'One sentence description'
        },
        intensity: {
          type: 'number',
          description: 'Impact level (0-1)'
        },
        noteId: {
          type: 'string',
          description: 'Optional note ID to link'
        }
      },
      required: ['type', 'name']
    }
  },
  {
    name: 'search_beats',
    description: 'Semantic search for beats',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query'
        },
        limit: {
          type: 'number',
          description: 'Maximum results (default: 10)'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'extract_beats',
    description: 'Extract beats from text',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Text to extract beats from'
        },
        noteId: {
          type: 'string',
          description: 'Optional note ID to link beats to'
        }
      },
      required: ['text']
    }
  },
  {
    name: 'connect_beats',
    description: 'Create a connection between two beats',
    inputSchema: {
      type: 'object',
      properties: {
        fromBeatId: {
          type: 'string',
          description: 'Source beat ID'
        },
        toBeatId: {
          type: 'string',
          description: 'Target beat ID'
        },
        connectionType: {
          type: 'string',
          description: 'Connection type (RELATES_TO, CAUSES, MIRRORS, etc.)'
        },
        evidence: {
          type: 'string',
          description: 'Evidence for the connection'
        }
      },
      required: ['fromBeatId', 'toBeatId', 'connectionType']
    }
  },
  {
    name: 'find_contradictions',
    description: 'Find contradictions in the beat mesh',
    inputSchema: {
      type: 'object',
      properties: {
        worldId: {
          type: 'string',
          description: 'Optional world ID to filter'
        }
      }
    }
  },
  {
    name: 'get_mesh_stats',
    description: 'Get statistics about the beat mesh',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
];

// ============ Tool Handlers ============

async function handleToolCall(name: string, args: Record<string, unknown>) {
  switch (name) {
    case 'list_beats':
      return handleListBeats(args);
    case 'get_beat':
      return handleGetBeat(args);
    case 'create_beat':
      return handleCreateBeat(args);
    case 'search_beats':
      return handleSearchBeats(args);
    case 'extract_beats':
      return handleExtractBeats(args);
    case 'connect_beats':
      return handleConnectBeats(args);
    case 'find_contradictions':
      return handleFindContradictions(args);
    case 'get_mesh_stats':
      return handleGetMeshStats();
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function handleListBeats(args: Record<string, unknown>) {
  const type = args.type as string | undefined;
  const limit = (args.limit as number) || 50;
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (type) where.beatType = type;
  
  const beats = await prisma.beat.findMany({
    where,
    take: limit,
    orderBy: { createdAt: 'desc' }
  });
  
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        beats: beats.map(b => ({
          id: b.id,
          type: b.beatType,
          name: b.name,
          summary: b.summary,
          intensity: b.intensity,
          valence: b.valence
        })),
        count: beats.length
      }, null, 2)
    }]
  };
}

async function handleGetBeat(args: Record<string, unknown>) {
  const id = args.id as string;
  
  const beat = await prisma.beat.findUnique({
    where: { id },
    include: {
      connections: {
        include: { toBeat: { select: { id: true, name: true, beatType: true } } }
      },
      reverseConnections: {
        include: { fromBeat: { select: { id: true, name: true, beatType: true } } }
      }
    }
  });
  
  if (!beat) {
    return { content: [{ type: 'text', text: 'Beat not found' }] };
  }
  
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        beat: {
          id: beat.id,
          type: beat.beatType,
          name: beat.name,
          summary: beat.summary,
          intensity: beat.intensity,
          valence: beat.valence,
          frequency: beat.frequency,
          outgoingConnections: beat.connections.map(c => ({
            to: c.toBeat.name,
            type: c.connectionType,
            strength: c.strength
          })),
          incomingConnections: beat.reverseConnections.map(c => ({
            from: c.fromBeat.name,
            type: c.connectionType,
            strength: c.strength
          }))
        }
      }, null, 2)
    }]
  };
}

async function handleCreateBeat(args: Record<string, unknown>) {
  const beat = await prisma.beat.create({
    data: {
      userId: 'mcp-user',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      beatType: args.type as any,
      name: args.name as string,
      summary: args.summary as string | undefined,
      intensity: (args.intensity as number) || 0.5,
      source: 'MANUAL'
    }
  });
  
  if (args.noteId) {
    await prisma.noteBeat.create({
      data: {
        noteId: args.noteId as string,
        beatId: beat.id,
        relevance: 0.8,
        mentions: 1
      }
    });
  }
  
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ beat: { id: beat.id, name: beat.name } }, null, 2)
    }]
  };
}

async function handleSearchBeats(args: Record<string, unknown>) {
  const query = args.query as string;
  const limit = (args.limit as number) || 10;
  
  const beats = await prisma.beat.findMany({
    where: {
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { summary: { contains: query, mode: 'insensitive' } }
      ]
    },
    take: limit
  });
  
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        query,
        results: beats.map(b => ({
          id: b.id,
          type: b.beatType,
          name: b.name,
          summary: b.summary
        })),
        count: beats.length
      }, null, 2)
    }]
  };
}

async function handleExtractBeats(args: Record<string, unknown>) {
  const text = args.text as string;
  const noteId = args.noteId as string | undefined;
  
  const extractor = getBeatExtractor();
  const beats = await extractor.extract(text);
  
  if (noteId && beats.length > 0) {
    // Create beats and link to note
    for (const beat of beats) {
      const created = await prisma.beat.create({
        data: {
          userId: 'mcp-user',
          beatType: beat.type,
          name: beat.name,
          summary: beat.summary,
          intensity: beat.intensity,
          valence: beat.valence,
          source: 'AUTO'
        }
      });
      
      await prisma.noteBeat.create({
        data: {
          noteId,
          beatId: created.id,
          relevance: beat.confidence,
          mentions: 1
        }
      });
    }
  }
  
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        extracted: beats.length,
        beats: beats.map(b => ({
          type: b.type,
          name: b.name,
          summary: b.summary,
          intensity: b.intensity,
          valence: b.valence
        }))
      }, null, 2)
    }]
  };
}

async function handleConnectBeats(args: Record<string, unknown>) {
  const connection = await prisma.beatConnection.create({
    data: {
      userId: 'mcp-user',
      fromBeatId: args.fromBeatId as string,
      toBeatId: args.toBeatId as string,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      connectionType: args.connectionType as any,
      strength: 0.5,
      evidence: args.evidence as string | undefined
    }
  });
  
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ connection: { id: connection.id } }, null, 2)
    }]
  };
}

async function handleFindContradictions(args: Record<string, unknown>) {
  const worldId = args.worldId as string | undefined;
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (worldId) where.worldId = worldId;
  
  const beats = await prisma.beat.findMany({ where });
  const connections = await prisma.beatConnection.findMany({
    where: {
      OR: [
        { fromBeatId: { in: beats.map(b => b.id) } },
        { toBeatId: { in: beats.map(b => b.id) } }
      ]
    }
  });
  
  const detector = getContradictionDetector();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contradictions = await detector.findContradictions(beats as any[], connections as any[]);
  
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        count: contradictions.length,
        contradictions: contradictions.map(c => ({
          type: c.type,
          severity: c.severity,
          description: c.description,
          beats: [c.beat1.name, c.beat2.name]
        }))
      }, null, 2)
    }]
  };
}

async function handleGetMeshStats() {
  const [beatCount, connectionCount, beatTypes] = await Promise.all([
    prisma.beat.count(),
    prisma.beatConnection.count(),
    prisma.beat.groupBy({
      by: ['beatType'],
      _count: true
    })
  ]);
  
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        totalBeats: beatCount,
        totalConnections: connectionCount,
        byType: beatTypes.reduce((acc, { beatType, _count }) => {
          acc[beatType] = _count;
          return acc;
        }, {} as Record<string, number>)
      }, null, 2)
    }]
  };
}

// ============ Server ============

const server = new Server(
  { name: 'context-beats', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  return handleToolCall(name, args || {});
});

// ============ Start ============

export async function startMCPServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Context Beats MCP server running on stdio');
}

// For standalone execution
if (require.main === module) {
  startMCPServer().catch(console.error);
}

export default server;