// Connection Detector - infer/suggest beat connections
//
// This module is intentionally DB-agnostic and can run without pgvector.
// When embeddings/vector search are available, plug them into candidate generation.

import type { BeatConnectionType, BeatType } from '@/lib/beats/types';

export interface BeatLite {
  id: string;
  beatType: BeatType | string;
  name: string;
  summary?: string | null;
}

export interface ConnectionAnalysis {
  connectionType: BeatConnectionType;
  strength: number; // 0-1
  evidence?: string;
  isContradiction?: boolean;
}

export interface DetectorParams {
  maxPairs: number;
  minStrength: number;
  allowContradictions: boolean;

  /** If true, attempt a cheap similarity heuristic before calling the LLM. */
  preferCheapSimilarity?: boolean;
  /** Similarity threshold for cheap RELATES_TO suggestion. */
  cheapSimilarityThreshold?: number;
}

export interface DetectorDeps {
  analyzeConnection: (
    a: { type: BeatType; name: string; summary?: string },
    b: { type: BeatType; name: string; summary?: string }
  ) => Promise<ConnectionAnalysis | null>;
  hasExistingConnection: (aId: string, bId: string) => Promise<boolean>;
  createConnection: (conn: {
    fromBeatId: string;
    toBeatId: string;
    connectionType: BeatConnectionType;
    strength: number;
    isContradiction: boolean;
    evidence?: string;
  }) => Promise<{ fromBeatId: string; toBeatId: string; connectionType: BeatConnectionType; strength: number }>;
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenSet(s: string): Set<string> {
  const norm = normalizeText(s);
  if (!norm) return new Set();
  // Drop tiny tokens; keep it simple.
  const toks = norm.split(' ').filter(t => t.length >= 3);
  return new Set(toks);
}

/**
 * Cheap lexical similarity fallback (Jaccard) for when embeddings/vector search aren’t available.
 * Returns [0..1].
 */
export function cheapSimilarity(a: BeatLite, b: BeatLite): number {
  const aText = `${a.name} ${a.summary ?? ''}`;
  const bText = `${b.name} ${b.summary ?? ''}`;
  const A = tokenSet(aText);
  const B = tokenSet(bText);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function generatePairs(beats: BeatLite[], maxPairs: number): Array<[BeatLite, BeatLite]> {
  const pairs: Array<[BeatLite, BeatLite]> = [];
  for (let i = 0; i < beats.length; i++) {
    for (let j = i + 1; j < beats.length; j++) {
      pairs.push([beats[i], beats[j]]);
      if (pairs.length >= maxPairs) return pairs;
    }
  }
  return pairs;
}

export async function detectAndCreateConnections(opts: {
  userId: string;
  beats: BeatLite[];
  params: DetectorParams;
  deps: DetectorDeps;
}): Promise<{
  pairsConsidered: number;
  created: Array<{ fromBeatId: string; toBeatId: string; connectionType: BeatConnectionType; strength: number }>;
  skipped: Array<{ reason: string; fromBeatId: string; toBeatId: string }>;
}> {
  const { beats, params, deps } = opts;

  const maxPairs = Math.min(Math.max(params.maxPairs, 1), 5000);
  const minStrength = clamp01(params.minStrength);
  const allowContradictions = params.allowContradictions;

  const preferCheapSimilarity = params.preferCheapSimilarity ?? true;
  const cheapThreshold = clamp01(params.cheapSimilarityThreshold ?? 0.72);

  const ids = uniq(beats.map(b => b.id));
  if (ids.length < 2) {
    return { pairsConsidered: 0, created: [], skipped: [] };
  }

  const pairs = generatePairs(beats, maxPairs);
  const created: Array<{ fromBeatId: string; toBeatId: string; connectionType: BeatConnectionType; strength: number }> = [];
  const skipped: Array<{ reason: string; fromBeatId: string; toBeatId: string }> = [];

  for (const [a, b] of pairs) {
    const exists = await deps.hasExistingConnection(a.id, b.id);
    if (exists) {
      skipped.push({ reason: 'existing_connection', fromBeatId: a.id, toBeatId: b.id });
      continue;
    }

    // 1) Cheap similarity shortcut: suggest RELATES_TO without an LLM call.
    if (preferCheapSimilarity) {
      const sim = cheapSimilarity(a, b);
      if (sim >= cheapThreshold) {
        const strength = clamp01(sim * 0.9);
        if (strength >= minStrength) {
          const conn = await deps.createConnection({
            fromBeatId: a.id,
            toBeatId: b.id,
            connectionType: 'RELATES_TO',
            strength,
            isContradiction: false,
            evidence: `Lexical overlap (cheap similarity=${sim.toFixed(2)}) between beat titles/summaries.`
          });
          created.push(conn);
          continue;
        }
      }
    }

    // 2) Otherwise ask the extractor/LLM for a richer relationship.
    const analysis = await deps.analyzeConnection(
      { type: a.beatType as BeatType, name: a.name, summary: a.summary ?? undefined },
      { type: b.beatType as BeatType, name: b.name, summary: b.summary ?? undefined }
    );

    if (!analysis) {
      skipped.push({ reason: 'analysis_failed', fromBeatId: a.id, toBeatId: b.id });
      continue;
    }

    if (!allowContradictions && analysis.connectionType === 'CONTRADICTS') {
      skipped.push({ reason: 'contradictions_disabled', fromBeatId: a.id, toBeatId: b.id });
      continue;
    }

    if (analysis.strength < minStrength) {
      skipped.push({ reason: 'below_threshold', fromBeatId: a.id, toBeatId: b.id });
      continue;
    }

    try {
      const conn = await deps.createConnection({
        fromBeatId: a.id,
        toBeatId: b.id,
        connectionType: analysis.connectionType,
        strength: clamp01(analysis.strength),
        isContradiction: analysis.isContradiction || false,
        evidence: analysis.evidence
      });
      created.push(conn);
    } catch {
      skipped.push({ reason: 'create_failed', fromBeatId: a.id, toBeatId: b.id });
    }
  }

  return { pairsConsidered: pairs.length, created, skipped };
}
