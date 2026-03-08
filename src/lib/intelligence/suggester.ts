import { Beat, BeatConnection } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { LOCKED_EMBEDDING_MODEL } from '../ai/shared-spec';

export interface ConnectionSuggestion {
  fromBeat: Beat;
  toBeat: Beat;
  type: 'SIMILARITY' | 'THEMATIC' | 'CAUSAL';
  confidence: number;
  reason: string;
}

/**
 * AI Connection Suggester
 * Finds potential relationships between beats using semantic similarity
 */
export async function getPotentialConnections(beatId: string, limit: number = 5): Promise<ConnectionSuggestion[]> {
  // 1. Get the source beat and its embedding
  const sourceBeat = await prisma.beat.findUnique({
    where: { id: beatId }
  }) as any;

  if (!sourceBeat || !sourceBeat.embedding) {
    return [];
  }

  // 2. Vector Search for nearest neighbors using pgvector
  // We look for beats with high cosine similarity that aren't already connected
  const nearestBeats: any[] = await prisma.$queryRaw`
    SELECT id, name, "beatType", summary, intensity, valence, 
    (1 - (embedding <=> ${sourceBeat.embedding}::vector)) as similarity
    FROM "Beat"
    WHERE id != ${beatId} 
    AND "userId" = ${sourceBeat.userId}
    AND id NOT IN (
      SELECT "toBeatId" FROM "BeatConnection" WHERE "fromBeatId" = ${beatId}
      UNION
      SELECT "fromBeatId" FROM "BeatConnection" WHERE "toBeatId" = ${beatId}
    )
    ORDER BY embedding <=> ${sourceBeat.embedding}::vector
    LIMIT ${limit};
  `;

  // 3. Filter and format suggestions
  return nearestBeats
    .filter(b => b.similarity > 0.82) // High confidence threshold
    .map(targetBeat => ({
      fromBeat: sourceBeat,
      toBeat: targetBeat as Beat,
      type: 'SIMILARITY',
      confidence: targetBeat.similarity,
      reason: `High semantic similarity detected between "${sourceBeat.name}" and "${targetBeat.name}"`
    }));
}
