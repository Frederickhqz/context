// Contradiction Detection Engine
// Finds conflicts and inconsistencies in the beat mesh

// Beat type for contradiction detection (matches Prisma schema)
interface BeatForDetection {
  id: string;
  beatType: string;
  name: string;
  summary?: string | null;
  content?: string | null;
  intensity: number;
  valence?: number | null;
  frequency: number;
  metadata?: Record<string, unknown> | null;
}

interface ConnectionForDetection {
  id: string;
  fromBeatId: string;
  toBeatId: string;
  connectionType: string;
  strength: number;
  isContradiction: boolean;
  evidence?: string | null;
  contradictionNote?: string | null;
}

export interface Contradiction {
  id: string;
  beat1: BeatForDetection;
  beat2: BeatForDetection;
  type: 'temporal' | 'factual' | 'relational' | 'world' | 'character';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  evidence?: string;
  suggestedResolution?: string;
  detectedAt: Date;
}

export interface ContradictionDetectorOptions {
  // Minimum similarity to consider for contradiction
  similarityThreshold?: number;
  // Whether to use LLM for deeper analysis
  useLLMAnalysis?: boolean;
  // Custom contradiction types to check
  customTypes?: string[];
}

/**
 * Contradiction Detection Engine
 * 
 * Finds inconsistencies in narrative/story content:
 * - Temporal contradictions (events in wrong order)
 * - Factual contradictions (conflicting facts)
 * - Relational contradictions (inconsistent relationships)
 * - World contradictions (broken world rules)
 * - Character contradictions (out-of-character behavior)
 */
export class ContradictionDetector {
  private options: ContradictionDetectorOptions;
  
  constructor(options: ContradictionDetectorOptions = {}) {
    this.options = {
      similarityThreshold: 0.85,
      useLLMAnalysis: true,
      ...options
    };
  }
  
  /**
   * Find all contradictions in a set of beats
   */
  async findContradictions(
    beats: BeatForDetection[],
    connections: ConnectionForDetection[]
  ): Promise<Contradiction[]> {
    const contradictions: Contradiction[] = [];
    
    // 1. Check for explicitly marked contradictions
    const explicitContradictions = this.findExplicitContradictions(beats, connections);
    contradictions.push(...explicitContradictions);
    
    // 2. Check for temporal contradictions
    const temporalContradictions = await this.findTemporalContradictions(beats, connections);
    contradictions.push(...temporalContradictions);
    
    // 3. Check for factual contradictions (similar beats with opposite valence)
    const factualContradictions = await this.findFactualContradictions(beats);
    contradictions.push(...factualContradictions);
    
    // 4. Check for relational contradictions
    const relationalContradictions = await this.findRelationalContradictions(beats, connections);
    contradictions.push(...relationalContradictions);
    
    // Deduplicate
    return this.deduplicateContradictions(contradictions);
  }
  
  /**
   * Find beats explicitly marked as contradictions
   */
  private findExplicitContradictions(
    beats: BeatForDetection[],
    connections: ConnectionForDetection[]
  ): Contradiction[] {
    const contradictions: Contradiction[] = [];
    const beatMap = new Map(beats.map(b => [b.id, b]));
    
    for (const conn of connections) {
      if (conn.isContradiction) {
        const beat1 = beatMap.get(conn.fromBeatId);
        const beat2 = beatMap.get(conn.toBeatId);
        
        if (beat1 && beat2) {
          contradictions.push({
            id: `explicit-${conn.id}`,
            beat1,
            beat2,
            type: 'factual',
            severity: 'high',
            description: `Explicit contradiction between "${beat1.name}" and "${beat2.name}"`,
            evidence: conn.contradictionNote ?? conn.evidence ?? undefined,
            detectedAt: new Date()
          });
        }
      }
    }
    
    return contradictions;
  }
  
  /**
   * Find temporal contradictions (events in wrong order)
   */
  private async findTemporalContradictions(
    beats: BeatForDetection[],
    connections: ConnectionForDetection[]
  ): Promise<Contradiction[]> {
    const contradictions: Contradiction[] = [];
    const beatMap = new Map(beats.map(b => [b.id, b]));
    
    // Build temporal graph
    const temporalOrder = new Map<string, Set<string>>();
    
    for (const conn of connections) {
      if (conn.connectionType === 'PRECEDES') {
        if (!temporalOrder.has(conn.fromBeatId)) {
          temporalOrder.set(conn.fromBeatId, new Set());
        }
        temporalOrder.get(conn.fromBeatId)!.add(conn.toBeatId);
      }
      
      if (conn.connectionType === 'FOLLOWS') {
        if (!temporalOrder.has(conn.toBeatId)) {
          temporalOrder.set(conn.toBeatId, new Set());
        }
        temporalOrder.get(conn.toBeatId)!.add(conn.fromBeatId);
      }
    }
    
    // Check for cycles (event A precedes B, B precedes A)
    for (const [from, successors] of temporalOrder) {
      for (const successor of successors) {
        // Check if successor also precedes from
        if (temporalOrder.get(successor)?.has(from)) {
          const beat1 = beatMap.get(from);
          const beat2 = beatMap.get(successor);
          
          if (beat1 && beat2) {
            contradictions.push({
              id: `temporal-${from}-${successor}`,
              beat1,
              beat2,
              type: 'temporal',
              severity: 'high',
              description: `Temporal cycle: "${beat1.name}" and "${beat2.name}" both precede each other`,
              detectedAt: new Date()
            });
          }
        }
      }
    }
    
    return contradictions;
  }
  
  /**
   * Find factual contradictions (similar beats with opposite meanings)
   */
  private async findFactualContradictions(
    beats: BeatForDetection[]
  ): Promise<Contradiction[]> {
    const contradictions: Contradiction[] = [];
    
    // Group beats by type
    const beatsByType = new Map<string, BeatForDetection[]>();
    for (const beat of beats) {
      if (!beatsByType.has(beat.beatType)) {
        beatsByType.set(beat.beatType, []);
      }
      beatsByType.get(beat.beatType)!.push(beat);
    }
    
    // Check CHARACTER beats for contradictions
    const characterBeats = beatsByType.get('CHARACTER') || [];
    for (let i = 0; i < characterBeats.length; i++) {
      for (let j = i + 1; j < characterBeats.length; j++) {
        const beat1 = characterBeats[i];
        const beat2 = characterBeats[j];
        
        // Check if names are similar but valence is opposite
        if (this.namesAreSimilar(beat1.name, beat2.name)) {
          if (beat1.valence !== null && beat2.valence !== null) {
            const valenceDiff = Math.abs((beat1.valence || 0) - (beat2.valence || 0));
            if (valenceDiff > 1.5) { // Significantly different
              contradictions.push({
                id: `factual-${beat1.id}-${beat2.id}`,
                beat1,
                beat2,
                type: 'factual',
                severity: 'medium',
                description: `Character contradiction: "${beat1.name}" and "${beat2.name}" have conflicting portrayals`,
                detectedAt: new Date()
              });
            }
          }
        }
      }
    }
    
    // Check EVENT beats for contradictions
    const eventBeats = beatsByType.get('EVENT') || [];
    // Similar logic for events...
    
    return contradictions;
  }
  
  /**
   * Find relational contradictions (A loves B, A hates B)
   */
  private async findRelationalContradictions(
    beats: BeatForDetection[],
    connections: ConnectionForDetection[]
  ): Promise<Contradiction[]> {
    const contradictions: Contradiction[] = [];
    
    // Group connections by beat pairs
    const connectionsByPair = new Map<string, ConnectionForDetection[]>();
    
    for (const conn of connections) {
      const key = [conn.fromBeatId, conn.toBeatId].sort().join('-');
      if (!connectionsByPair.has(key)) {
        connectionsByPair.set(key, []);
      }
      connectionsByPair.get(key)!.push(conn);
    }
    
    // Find pairs with contradictory connection types
    const oppositePairs: Array<[string, string]> = [
      ['SUPPORTS', 'UNDERMINES'],
      ['CAUSES', 'CONTRADICTS'],
      ['FORESHADOWS', 'CONTRADICTS'],
    ];
    
    const beatMap = new Map(beats.map(b => [b.id, b]));
    
    for (const [, conns] of connectionsByPair) {
      if (conns.length < 2) continue;
      
      for (const [type1, type2] of oppositePairs) {
        const has1 = conns.some(c => c.connectionType === type1);
        const has2 = conns.some(c => c.connectionType === type2);
        
        if (has1 && has2) {
          const beat1 = beatMap.get(conns[0].fromBeatId);
          const beat2 = beatMap.get(conns[0].toBeatId);
          
          if (beat1 && beat2) {
            contradictions.push({
              id: `relational-${beat1.id}-${beat2.id}`,
              beat1,
              beat2,
              type: 'relational',
              severity: 'medium',
              description: `Relational contradiction between "${beat1.name}" and "${beat2.name}"`,
              evidence: `Has both ${type1} and ${type2} connections`,
              detectedAt: new Date()
            });
          }
        }
      }
    }
    
    return contradictions;
  }
  
  /**
   * Check if two names are similar (for contradiction detection)
   */
  private namesAreSimilar(name1: string, name2: string): boolean {
    // Normalize names
    const n1 = name1.toLowerCase().replace(/[^a-z0-9]/g, '');
    const n2 = name2.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Exact match
    if (n1 === n2) return true;
    
    // One contains the other
    if (n1.includes(n2) || n2.includes(n1)) return true;
    
    // Check for common variations (The Mentor vs Mentor)
    const words1 = n1.split(/\s+/);
    const words2 = n2.split(/\s+/);
    
    for (const w1 of words1) {
      for (const w2 of words2) {
        if (w1 === w2 && w1.length > 3) return true;
      }
    }
    
    return false;
  }
  
  /**
   * Deduplicate contradictions
   */
  private deduplicateContradictions(contradictions: Contradiction[]): Contradiction[] {
    const seen = new Set<string>();
    const result: Contradiction[] = [];
    
    for (const c of contradictions) {
      const key = [c.beat1.id, c.beat2.id].sort().join('-');
      if (!seen.has(key)) {
        seen.add(key);
        result.push(c);
      }
    }
    
    return result;
  }
  
  /**
   * Generate resolution suggestions for a contradiction
   */
  async suggestResolution(contradiction: Contradiction): Promise<string | undefined> {
    // This would use LLM to generate suggestions
    // For now, return a template
    
    const templates: Record<string, string> = {
      temporal: `Consider revising the timeline so that "${contradiction.beat1.name}" occurs ${contradiction.beat2.name.includes('before') ? 'after' : 'before'} "${contradiction.beat2.name}".`,
      factual: `The beats "${contradiction.beat1.name}" and "${contradiction.beat2.name}" present conflicting information. Consider: (1) Merging them into a single nuanced beat, (2) Adding context that explains the contradiction, or (3) Removing one.`,
      relational: `The relationship between "${contradiction.beat1.name}" and "${contradiction.beat2.name}" is contradictory. Consider adding a beat that explains the evolution or change in relationship.`,
    };
    
    return templates[contradiction.type];
  }
}

// Singleton
let detectorInstance: ContradictionDetector | null = null;

export function getContradictionDetector(options?: ContradictionDetectorOptions): ContradictionDetector {
  if (!detectorInstance) {
    detectorInstance = new ContradictionDetector(options);
  }
  return detectorInstance;
}