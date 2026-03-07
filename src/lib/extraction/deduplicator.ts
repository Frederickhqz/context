// Beat Deduplicator - Merge similar beats and prevent duplicates
// Uses semantic similarity and fuzzy matching

import type { BeatType } from '../beats/types';

// ============ Types ============

export interface BeatCandidate {
  id?: string;
  type: BeatType;
  name: string;
  summary?: string;
  content?: string;
  intensity?: number;
  valence?: number;
  frequency?: number;
  sourceNoteId?: string;
}

export interface ExistingBeat {
  id: string;
  type: BeatType;
  name: string;
  summary?: string;
  content?: string;
  intensity?: number;
  valence?: number;
  frequency: number;
}

export interface DeduplicationResult {
  unique: BeatCandidate[];
  duplicates: Array<{ candidate: BeatCandidate; matches: ExistingBeat[] }>;
  merged: BeatCandidate[];
}

export interface SimilarityScore {
  beat: ExistingBeat;
  score: number;
  matchType: 'name' | 'semantic' | 'type';
}

// ============ Name Similarity ============

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

/**
 * Calculate fuzzy name similarity (0-1)
 */
function nameSimilarity(name1: string, name2: string): number {
  const n1 = name1.toLowerCase().trim();
  const n2 = name2.toLowerCase().trim();
  
  // Exact match
  if (n1 === n2) return 1.0;
  
  // Check if one contains the other
  if (n1.includes(n2) || n2.includes(n1)) {
    const shorter = Math.min(n1.length, n2.length);
    const longer = Math.max(n1.length, n2.length);
    return shorter / longer;
  }
  
  // Levenshtein similarity
  const distance = levenshteinDistance(n1, n2);
  const maxLength = Math.max(n1.length, n2.length);
  const similarity = 1 - distance / maxLength;
  
  return similarity;
}

/**
 * Tokenize text for comparison
 */
function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2)
  );
}

/**
 * Calculate Jaccard similarity between token sets
 */
function jaccardSimilarity(set1: Set<string>, set2: Set<string>): number {
  if (set1.size === 0 && set2.size === 0) return 1;
  if (set1.size === 0 || set2.size === 0) return 0;
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
}

/**
 * Calculate text similarity using token overlap
 */
function textSimilarity(text1: string, text2: string): number {
  const tokens1 = tokenize(text1);
  const tokens2 = tokenize(text2);
  
  return jaccardSimilarity(tokens1, tokens2);
}

// ============ Deduplication ============

const NAME_SIMILARITY_THRESHOLD = 0.85;
const TEXT_SIMILARITY_THRESHOLD = 0.7;
const TYPE_MATCH_BOOST = 0.2;

/**
 * Find similar existing beats for a candidate
 */
export function findSimilarBeats(
  candidate: BeatCandidate,
  existingBeats: ExistingBeat[],
  options: {
    nameThreshold?: number;
    textThreshold?: number;
    useEmbedding?: boolean;
    embeddingFn?: (text: string) => Promise<number[]>;
  } = {}
): SimilarityScore[] {
  const nameThreshold = options.nameThreshold ?? NAME_SIMILARITY_THRESHOLD;
  const textThreshold = options.textThreshold ?? TEXT_SIMILARITY_THRESHOLD;
  
  const scores: SimilarityScore[] = [];
  
  for (const beat of existingBeats) {
    // Name similarity
    const nameScore = nameSimilarity(candidate.name, beat.name);
    if (nameScore >= nameThreshold) {
      scores.push({
        beat,
        score: nameScore + (beat.type === candidate.type ? TYPE_MATCH_BOOST : 0),
        matchType: 'name'
      });
      continue;
    }
    
    // Type must match for non-name similarity
    if (beat.type !== candidate.type) continue;
    
    // Text similarity (summary + content)
    const candidateText = `${candidate.name} ${candidate.summary || ''} ${candidate.content || ''}`;
    const existingText = `${beat.name} ${beat.summary || ''} ${beat.content || ''}`;
    
    const textScore = textSimilarity(candidateText, existingText);
    if (textScore >= textThreshold) {
      scores.push({
        beat,
        score: textScore,
        matchType: 'semantic'
      });
    }
  }
  
  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);
  
  return scores;
}

/**
 * Merge a duplicate beat with its existing match
 */
export function mergeBeats(
  candidate: BeatCandidate,
  existing: ExistingBeat
): BeatCandidate {
  // Increment frequency
  const newFrequency = (existing.frequency || 1) + 1;
  
  // Merge summary if candidate has new info
  let mergedSummary = existing.summary || candidate.summary || '';
  if (candidate.summary && existing.summary && candidate.summary !== existing.summary) {
    // Keep longer summary or combine
    if (candidate.summary.length > existing.summary.length) {
      mergedSummary = candidate.summary;
    }
  }
  
  // Average intensity and valence
  const mergedIntensity = existing.intensity && candidate.intensity
    ? (existing.intensity + candidate.intensity) / 2
    : existing.intensity || candidate.intensity || 0.5;
  
  const mergedValence = existing.valence !== undefined && candidate.valence !== undefined
    ? (existing.valence + candidate.valence) / 2
    : existing.valence ?? candidate.valence ?? 0;
  
  return {
    id: existing.id,
    type: existing.type,
    name: existing.name, // Keep existing name
    summary: mergedSummary,
    intensity: mergedIntensity,
    valence: mergedValence,
    frequency: newFrequency,
    sourceNoteId: candidate.sourceNoteId
  };
}

/**
 * Deduplicate beat candidates against existing beats
 */
export function deduplicateBeats(
  candidates: BeatCandidate[],
  existingBeats: ExistingBeat[],
  options: {
    nameThreshold?: number;
    textThreshold?: number;
    mergeStrategy?: 'keepExisting' | 'keepNew' | 'merge';
  } = {}
): DeduplicationResult {
  const mergeStrategy = options.mergeStrategy ?? 'merge';
  const unique: BeatCandidate[] = [];
  const duplicates: Array<{ candidate: BeatCandidate; matches: ExistingBeat[] }> = [];
  const merged: BeatCandidate[] = [];
  
  for (const candidate of candidates) {
    const similarBeats = findSimilarBeats(candidate, existingBeats, options);
    
    if (similarBeats.length === 0) {
      // No match found - this is unique
      unique.push(candidate);
    } else {
      // Found duplicates
      const bestMatch = similarBeats[0];
      
      duplicates.push({
        candidate,
        matches: similarBeats.map(s => s.beat)
      });
      
      if (mergeStrategy === 'merge') {
        const mergedBeat = mergeBeats(candidate, bestMatch.beat);
        merged.push(mergedBeat);
      }
    }
  }
  
  return { unique, duplicates, merged };
}

/**
 * Check if two beat names are likely the same entity
 */
export function areSameEntity(name1: string, name2: string): boolean {
  const similarity = nameSimilarity(name1, name2);
  return similarity >= NAME_SIMILARITY_THRESHOLD;
}

/**
 * Get canonical form of a beat name
 */
export function getCanonicalName(
  candidate: string,
  existing: ExistingBeat[]
): { name: string; isNew: boolean } {
  for (const beat of existing) {
    if (areSameEntity(candidate, beat.name)) {
      return { name: beat.name, isNew: false };
    }
  }
  return { name: candidate, isNew: true };
}

/**
 * Score uniqueness of a beat candidate
 */
export function scoreUniqueness(
  candidate: BeatCandidate,
  existingBeats: ExistingBeat[]
): { score: number; isUnique: boolean; similarBeats: SimilarityScore[] } {
  const similarBeats = findSimilarBeats(candidate, existingBeats);
  
  const bestScore = similarBeats[0]?.score ?? 0;
  const isUnique = similarBeats.length === 0 || bestScore < NAME_SIMILARITY_THRESHOLD;
  
  return {
    score: 1 - bestScore,
    isUnique,
    similarBeats
  };
}

export default deduplicateBeats;