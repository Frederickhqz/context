import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { embed } from '@/lib/embeddings';

interface SearchResult {
  id: string;
  title: string | null;
  content: string;
  content_plain: string | null;
  note_type: string;
  created_at: Date;
  score: number;
}

// GET /api/search - Search notes
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const type = searchParams.get('type') || 'semantic'; // semantic, keyword, hybrid
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    // Filters
    const noteType = searchParams.get('noteType');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const entityIds = searchParams.get('entities')?.split(',').filter(Boolean);
    const collectionId = searchParams.get('collection');
    const tagIds = searchParams.get('tags')?.split(',').filter(Boolean);

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter "q" is required' },
        { status: 400 }
      );
    }

    // TODO: Add authentication
    // const user = await getCurrentUser();
    // if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let results: SearchResult[] = [];

    if (type === 'semantic' || type === 'hybrid') {
      // Generate embedding for query
      const queryEmbedding = await embed(query);
      
      // Semantic search using pgvector
      // Note: This requires pgvector extension to be enabled in PostgreSQL
      const semanticResults = await prisma.$queryRaw`
        SELECT 
          n.id, n.title, n.content, n.content_plain, n.note_type, n.created_at,
          1 - (n.embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as score
        FROM notes n
        WHERE 1=1
          ${noteType ? prisma.$queryRaw`AND n.note_type = ${noteType}` : prisma.$queryRaw``}
          ${startDate ? prisma.$queryRaw`AND n.created_at >= ${startDate}::timestamp` : prisma.$queryRaw``}
          ${endDate ? prisma.$queryRaw`AND n.created_at <= ${endDate}::timestamp` : prisma.$queryRaw``}
        ORDER BY n.embedding <=> ${JSON.stringify(queryEmbedding)}::vector
        LIMIT ${limit}
        OFFSET ${offset}
      `;
      
      results = semanticResults as SearchResult[];
    }

    if (type === 'keyword') {
      // Full-text search using PostgreSQL tsvector
      const keywordResults = await prisma.$queryRaw`
        SELECT 
          n.id, n.title, n.content, n.content_plain, n.note_type, n.created_at,
          ts_rank_cd(to_tsvector('english', coalesce(n.title, '') || ' ' || n.content), plainto_tsquery('english', ${query})) as score
        FROM notes n
        WHERE to_tsvector('english', coalesce(n.title, '') || ' ' || n.content) @@ plainto_tsquery('english', ${query})
          ${noteType ? prisma.$queryRaw`AND n.note_type = ${noteType}` : prisma.$queryRaw``}
          ${startDate ? prisma.$queryRaw`AND n.created_at >= ${startDate}::timestamp` : prisma.$queryRaw``}
          ${endDate ? prisma.$queryRaw`AND n.created_at <= ${endDate}::timestamp` : prisma.$queryRaw``}
        ORDER BY score DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;
      
      results = keywordResults as SearchResult[];
    }

    // TODO: Hybrid search (combine semantic + keyword)

    // Fetch related entities for each result
    const notesWithEntities = await Promise.all(
      results.map(async (note) => {
        const entityMentions = await prisma.entityMention.findMany({
          where: { noteId: note.id },
          include: { entity: true },
        });
        
        return {
          ...note,
          entities: entityMentions.map(em => em.entity),
        };
      })
    );

    return NextResponse.json({
      query,
      type,
      results: notesWithEntities,
      count: notesWithEntities.length,
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    );
  }
}