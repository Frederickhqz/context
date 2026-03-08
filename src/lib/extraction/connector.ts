// Beat Connector - Find relationships between beats
// Uses semantic similarity and pattern matching

import type { BeatConnectionType } from '../beats/types';

// ============ Types ============

interface Beat {
  id: string;
  type: string;
  name: string;
  summary?: string;
  content?: string;
  embedding?: number[];
}

export interface ConnectionCandidate {
  fromBeatId: string;
  toBeatId: string;
  connectionType: BeatConnectionType;
  strength: number;
  evidence?: string;
  isSuggested: boolean;
}

interface ConnectionPattern {
  type: BeatConnectionType;
  keywords: string[];
  patterns: RegExp[];
  evidenceTemplate: string;
}

// ============ Connection Patterns ============

const CONNECTION_PATTERNS: Record<BeatConnectionType, ConnectionPattern> = {
  RELATES_TO: {
    type: 'RELATES_TO',
    keywords: ['relates', 'connects', 'similar', 'like', 'associated'],
    patterns: [
      /\b(?:relates?\s+to|connects?\s+with|similar\s+to|like|associated\s+with)\b/gi,
    ],
    evidenceTemplate: 'Both beats are related through shared context'
  },
  
  CAUSES: {
    type: 'CAUSES',
    keywords: ['causes', 'leads to', 'results in', 'triggers', 'produces', 'creates', 'makes'],
    patterns: [
      /\b(?:causes?|leads?\s+to|results?\s+in|triggers?|produces?|creates?)\b/gi,
      /\b(?:because\s+of|due\s+to|as\s+a\s+result\s+of)\b/gi,
    ],
    evidenceTemplate: '{from} causes {to}'
  },
  
  RESULTS_FROM: {
    type: 'RESULTS_FROM',
    keywords: ['results from', 'caused by', 'follows', 'comes from', 'derived'],
    patterns: [
      /\b(?:results?\s+from|caused\s+by|follows|comes\s+from|derived\s+from)\b/gi,
      /\b(?:a\s+result\s+of|consequence\s+of)\b/gi,
    ],
    evidenceTemplate: '{to} results from {from}'
  },
  
  FORESHADOWS: {
    type: 'FORESHADOWS',
    keywords: ['foreshadows', 'hints', 'prefigures', 'anticipates', 'presages'],
    patterns: [
      /\b(?:foreshadows?|hints?\s+at|prefigures?|anticipates?|presages?)\b/gi,
      /\b(?:early\s+sign|first\s+indication|subtle\s+hint)\b/gi,
    ],
    evidenceTemplate: '{from} foreshadows {to}'
  },
  
  MIRRORS: {
    type: 'MIRRORS',
    keywords: ['mirrors', 'parallels', 'echoes', 'reflects', 'duplicates', 'similar'],
    patterns: [
      /\b(?:mirrors?|parallels?|echoes?|reflects?|duplicates?)\b/gi,
      /\b(?:similar\s+pattern|parallel\s+structure|echoes)\b/gi,
    ],
    evidenceTemplate: '{from} mirrors {to}'
  },
  
  CONTRADICTS: {
    type: 'CONTRADICTS',
    keywords: ['contradicts', 'opposes', 'conflicts', 'contrasts', 'negates', 'undermines'],
    patterns: [
      /\b(?:contradicts?|opposes?|conflicts?\s+with|contrasts?\s+with|negates?)\b/gi,
      /\b(?:however|but|yet|although|despite|in\s+contrast)\b/gi,
    ],
    evidenceTemplate: '{from} contradicts {to}'
  },
  
  RESOLVES: {
    type: 'RESOLVES',
    keywords: ['resolves', 'solves', 'fixes', 'answers', 'concludes', 'ends'],
    patterns: [
      /\b(?:resolves?|solves?|fixes?|answers?|concludes?)\b/gi,
      /\b(?:resolution\s+of|answer\s+to|end\s+of)\b/gi,
    ],
    evidenceTemplate: '{from} resolves {to}'
  },
  
  PART_OF: {
    type: 'PART_OF',
    keywords: ['part of', 'component', 'element', 'piece', 'segment'],
    patterns: [
      /\b(?:part\s+of|component\s+of|element\s+of|piece\s+of|segment\s+of)\b/gi,
      /\b(?:contains?|includes?|comprises?|consists?\s+of)\b/gi,
    ],
    evidenceTemplate: '{from} is part of {to}'
  },
  
  CONTAINS: {
    type: 'CONTAINS',
    keywords: ['contains', 'includes', 'comprises', 'encompasses', 'has'],
    patterns: [
      /\b(?:contains?|includes?|comprises?|encompasses?)\b/gi,
      /\b(?:consists?\s+of|made\s+up\s+of|composed\s+of)\b/gi,
    ],
    evidenceTemplate: '{from} contains {to}'
  },
  
  REFERENCES: {
    type: 'REFERENCES',
    keywords: ['references', 'mentions', 'cites', 'alludes', 'refers'],
    patterns: [
      /\b(?:references?|mentions?|cites?|alludes?\s+to|refers?\s+to)\b/gi,
    ],
    evidenceTemplate: '{from} references {to}'
  },
  
  PRECEDES: {
    type: 'PRECEDES',
    keywords: ['precedes', 'before', 'earlier', 'prior'],
    patterns: [
      /\b(?:precedes?|before|earlier\s+than|prior\s+to)\b/gi,
      /\b(?:first|initially|in\s+the\s+beginning)\b/gi,
    ],
    evidenceTemplate: '{from} precedes {to}'
  },
  
  FOLLOWS: {
    type: 'FOLLOWS',
    keywords: ['follows', 'after', 'later', 'subsequent'],
    patterns: [
      /\b(?:follows?|after|later\s+than|subsequent\s+to)\b/gi,
      /\b(?:then|next|afterwards|subsequently)\b/gi,
    ],
    evidenceTemplate: '{from} follows {to}'
  },
  
  CONCURRENT: {
    type: 'CONCURRENT',
    keywords: ['simultaneous', 'concurrent', 'same time', 'parallel', 'together'],
    patterns: [
      /\b(?:simultaneous|concurrent|at\s+the\s+same\s+time|in\s+parallel)\b/gi,
      /\b(?:while|as|when|during)\b/gi,
    ],
    evidenceTemplate: '{from} occurs concurrently with {to}'
  },
  
  EVOLVES_TO: {
    type: 'EVOLVES_TO',
    keywords: ['evolves', 'transforms', 'becomes', 'develops'],
    patterns: [
      /\b(?:evolves?\s+into|transforms?\s+into|becomes?|develops?\s+into)\b/gi,
      /\b(?:grows?\s+into|changes?\s+into)\b/gi,
    ],
    evidenceTemplate: '{from} evolves into {to}'
  },
  
  EVOLVES_FROM: {
    type: 'EVOLVES_FROM',
    keywords: ['evolved from', 'transformed from', 'derived from', 'developed from'],
    patterns: [
      /\b(?:evolved\s+from|transformed\s+from|derived\s+from|developed\s+from)\b/gi,
      /\b(?:originated\s+from|came\s+from)\b/gi,
    ],
    evidenceTemplate: '{from} evolved from {to}'
  },
  
  REPLACES: {
    type: 'REPLACES',
    keywords: ['replaces', 'substitutes', 'supersedes', 'takes over'],
    patterns: [
      /\b(?:replaces?|substitutes?|supersedes?|takes?\s+over)\b/gi,
    ],
    evidenceTemplate: '{from} replaces {to}'
  },
  
  ALTERNATE_OF: {
    type: 'ALTERNATE_OF',
    keywords: ['alternate', 'version', 'variant', 'parallel'],
    patterns: [
      /\b(?:alternate\s+version|variant|parallel\s+version|different\s+version)\b/gi,
    ],
    evidenceTemplate: '{from} is an alternate of {to}'
  },
  
  PARALLEL_TO: {
    type: 'PARALLEL_TO',
    keywords: ['parallel', 'similar', 'corresponding', 'matching'],
    patterns: [
      /\b(?:parallel\s+to|similar\s+to|corresponds?\s+to|matches?)\b/gi,
    ],
    evidenceTemplate: '{from} parallels {to}'
  },
  
  SUPPORTS: {
    type: 'SUPPORTS',
    keywords: ['supports', 'reinforces', 'confirms', 'validates', 'backs'],
    patterns: [
      /\b(?:supports?|reinforces?|confirms?|validates?|backs?\s+up)\b/gi,
    ],
    evidenceTemplate: '{from} supports {to}'
  },
  
  UNDERMINES: {
    type: 'UNDERMINES',
    keywords: ['undermines', 'weakens', 'challenges', 'questions', 'doubts'],
    patterns: [
      /\b(?:undermines?|weakens?|challenges?|questions?|doubts?)\b/gi,
    ],
    evidenceTemplate: '{from} undermines {to}'
  },
  
  TENSIONS_WITH: {
    type: 'TENSIONS_WITH',
    keywords: ['tension', 'friction', 'strain', 'stress', 'pressure'],
    patterns: [
      /\b(?:tension\s+between|friction\s+between|strain\s+between)\b/gi,
      /\b(?:in\s+tension|under\s+strain)\b/gi,
    ],
    evidenceTemplate: '{from} has tension with {to}'
  },
};

// ============ Connection Detection ============

/**
 * Detect potential connection type from text context
 */
export function detectConnectionType(
  contextText: string
): { type: BeatConnectionType; confidence: number } {
  const lowerText = contextText.toLowerCase();
  
  let bestType: BeatConnectionType = 'RELATES_TO';
  let bestScore = 0;
  
  for (const [type, pattern] of Object.entries(CONNECTION_PATTERNS)) {
    let score = 0;
    
    // Keyword matching
    for (const kw of pattern.keywords) {
      if (lowerText.includes(kw.toLowerCase())) {
        score += 2;
      }
    }
    
    // Pattern matching
    for (const regex of pattern.patterns) {
      const matches = contextText.match(regex);
      if (matches) {
        score += matches.length * 3;
      }
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestType = type as BeatConnectionType;
    }
  }
  
  const confidence = Math.min(0.95, bestScore * 0.1 + 0.3);
  
  return { type: bestType, confidence };
}

/**
 * Find potential connections between beats based on embedding similarity
 */
export async function findPotentialConnections(
  beat: Beat,
  allBeats: Beat[],
  options: {
    threshold?: number;
    maxConnections?: number;
    excludeExisting?: Set<string>;
    embeddingFn?: (text: string) => Promise<number[]>;
  } = {}
): Promise<ConnectionCandidate[]> {
  const threshold = options.threshold ?? 0.7;
  const maxConnections = options.maxConnections ?? 5;
  const excludeExisting = options.excludeExisting ?? new Set();
  
  const candidates: ConnectionCandidate[] = [];
  
  // Compute embedding for the beat if not present
  let beatEmbedding = beat.embedding;
  if (!beatEmbedding && options.embeddingFn) {
    const text = `${beat.name} ${beat.summary || ''} ${beat.content || ''}`;
    beatEmbedding = await options.embeddingFn(text);
  }
  
  for (const otherBeat of allBeats) {
    // Skip self and existing connections
    if (otherBeat.id === beat.id) continue;
    if (excludeExisting.has(otherBeat.id)) continue;
    
    // Compute similarity
    let similarity = 0;
    
    if (beatEmbedding && otherBeat.embedding) {
      // Cosine similarity
      similarity = cosineSimilarity(beatEmbedding, otherBeat.embedding);
    } else {
      // Fallback to text similarity
      const text1 = `${beat.name} ${beat.summary || ''}`;
      const text2 = `${otherBeat.name} ${otherBeat.summary || ''}`;
      similarity = textSimilarity(text1, text2);
    }
    
    if (similarity >= threshold) {
      // Detect connection type based on beat types
      const connectionType = inferConnectionType(beat.type, otherBeat.type, similarity);
      
      candidates.push({
        fromBeatId: beat.id,
        toBeatId: otherBeat.id,
        connectionType,
        strength: similarity,
        evidence: `Semantic similarity: ${(similarity * 100).toFixed(0)}%`,
        isSuggested: true
      });
    }
  }
  
  // Sort by strength and limit
  candidates.sort((a, b) => b.strength - a.strength);
  return candidates.slice(0, maxConnections);
}

/**
 * Infer connection type based on beat types
 */
function inferConnectionType(
  fromType: string,
  toType: string,
  similarity: number
): BeatConnectionType {
  // Character-Character: usually relationship
  if (fromType === 'CHARACTER' && toType === 'CHARACTER') {
    return similarity > 0.9 ? 'RELATES_TO' : 'MIRRORS';
  }
  
  // Place-Place: usually part_of or contains
  if (fromType === 'PLACE' && toType === 'PLACE') {
    return 'PART_OF';
  }
  
  // Event-Event: usually precedes, follows, or concurrent
  if (fromType === 'EVENT' && toType === 'EVENT') {
    return 'RELATES_TO'; // Would need temporal info to determine direction
  }
  
  // Theme-Theme: usually mirrors
  if (fromType === 'THEME' && toType === 'THEME') {
    return similarity > 0.9 ? 'MIRRORS' : 'RELATES_TO';
  }
  
  // Question-Insight: usually resolves
  if (fromType === 'QUESTION' && toType === 'INSIGHT') {
    return 'RESOLVES';
  }
  
  if (fromType === 'INSIGHT' && toType === 'QUESTION') {
    return 'RELATES_TO';
  }
  
  // Character-Place: usually references
  if ((fromType === 'CHARACTER' && toType === 'PLACE') ||
      (fromType === 'PLACE' && toType === 'CHARACTER')) {
    return 'REFERENCES';
  }
  
  // Default
  return 'RELATES_TO';
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);
  
  if (normA === 0 || normB === 0) return 0;
  
  return dotProduct / (normA * normB);
}

/**
 * Calculate text similarity using token overlap
 */
function textSimilarity(text1: string, text2: string): number {
  const tokens1 = new Set(text1.toLowerCase().split(/\s+/).filter(t => t.length > 2));
  const tokens2 = new Set(text2.toLowerCase().split(/\s+/).filter(t => t.length > 2));
  
  if (tokens1.size === 0 && tokens2.size === 0) return 1;
  if (tokens1.size === 0 || tokens2.size === 0) return 0;
  
  const intersection = new Set([...tokens1].filter(t => tokens2.has(t)));
  const union = new Set([...tokens1, ...tokens2]);
  
  return intersection.size / union.size;
}

/**
 * Get connection pattern by type
 */
export function getConnectionPattern(type: BeatConnectionType): ConnectionPattern {
  return CONNECTION_PATTERNS[type] || CONNECTION_PATTERNS.RELATES_TO;
}

/**
 * Get all connection types
 */
export function getAllConnectionTypes(): Array<{ type: BeatConnectionType; description: string }> {
  return Object.entries(CONNECTION_PATTERNS).map(([type, pattern]) => ({
    type: type as BeatConnectionType,
    description: pattern.evidenceTemplate
  }));
}

export default findPotentialConnections;