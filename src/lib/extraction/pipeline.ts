// Extraction Pipeline - Orchestrates the full extraction process
// Combines: extraction → classification → deduplication → embedding → connection detection

import { getBeatExtractor } from '../beats/extractor';
import { classifyBeatType } from './classifier';
import { deduplicateBeats } from './deduplicator';
import { findPotentialConnections } from './connector';
import { findAllContradictions } from './contradiction-detector';
import type { BeatType, ExtractedBeat } from '../beats/types';

// Re-export for convenience
export type { ExtractionOptions } from '../beats/extractor';

// ============ Local Types ============

interface BeatCandidate {
  id?: string;
  type: BeatType;
  name: string;
  summary?: string;
  intensity?: number;
  valence?: number;
}

interface ExistingBeat {
  id: string;
  type: BeatType;
  name: string;
  summary?: string;
  intensity?: number;
  valence?: number;
  frequency: number;
}

interface ConnectionCandidate {
  fromBeatId: string;
  toBeatId: string;
  connectionType: string;
  strength: number;
  evidence?: string;
}

interface Contradiction {
  id: string;
  type: string;
  severity: string;
  description: string;
  beatIds: string[];
}

// ============ Pipeline Types ============

interface PipelineConfig {
  // Extraction
  extractionModel?: 'edge' | 'cloud' | 'auto';
  onProgress?: (stage: string, progress: number) => void;
  
  // Classification
  classifyTypes?: boolean;
  
  // Deduplication
  deduplicate?: boolean;
  existingBeats?: ExistingBeat[];
  mergeStrategy?: 'keepExisting' | 'keepNew' | 'merge';
  
  // Connection detection
  findConnections?: boolean;
  maxConnectionsPerBeat?: number;
  connectionThreshold?: number;
  
  // Contradiction detection
  findContradictions?: boolean;
  
  // Embedding
  generateEmbeddings?: boolean;
  embeddingFn?: (text: string) => Promise<number[]>;
}

interface ExtractionPipelineResult {
  beats: ExtractedBeat[];
  newBeats: ExtractedBeat[];
  updatedBeats: ExtractedBeat[];
  duplicates: Array<{ candidate: BeatCandidate; matches: ExistingBeat[] }>;
  connections: ConnectionCandidate[];
  contradictions: Contradiction[];
  metadata: {
    extractionTimeMs: number;
    totalBeatsFound: number;
    uniqueBeats: number;
    duplicateBeats: number;
    connectionsFound: number;
    contradictionsFound: number;
    model: string;
  };
}

// ============ Pipeline Class ============

export class ExtractionPipeline {
  private config: PipelineConfig;
  
  constructor(config: PipelineConfig = {}) {
    this.config = {
      extractionModel: 'auto',
      classifyTypes: true,
      deduplicate: true,
      findConnections: true,
      findContradictions: true,
      generateEmbeddings: false,
      maxConnectionsPerBeat: 5,
      connectionThreshold: 0.7,
      mergeStrategy: 'merge',
      ...config
    };
  }
  
  /**
   * Run the full extraction pipeline
   */
  async run(text: string, options: Partial<PipelineConfig> = {}): Promise<ExtractionPipelineResult> {
    const config = { ...this.config, ...options };
    const startTime = Date.now();
    
    // Stage 1: Extract beats
    config.onProgress?.('extracting', 0);
    const extractor = getBeatExtractor();
    const extractedBeats = await extractor.extract(text, {});
    config.onProgress?.('extracting', 100);
    
    // Stage 2: Classify types (if needed)
    config.onProgress?.('classifying', 0);
    const classifiedBeats = config.classifyTypes
      ? extractedBeats.map(b => ({ ...b, type: classifyBeatType(b.name + ' ' + (b.summary || '')) }))
      : extractedBeats;
    config.onProgress?.('classifying', 100);
    
    // Stage 3: Deduplicate
    config.onProgress?.('deduplicating', 0);
    const dedupeResult = config.deduplicate && config.existingBeats
      ? deduplicateBeats(classifiedBeats as BeatCandidate[], config.existingBeats)
      : { unique: classifiedBeats as BeatCandidate[], duplicates: [], merged: [] };
    config.onProgress?.('deduplicating', 100);
    
    // Stage 4: Find connections
    config.onProgress?.('connecting', 0);
    const connections: ConnectionCandidate[] = [];
    if (config.findConnections && dedupeResult.unique.length > 0) {
      for (const beat of dedupeResult.unique) {
        try {
          const beatConnections = await findPotentialConnections(
            { id: (beat as any).id || '', type: (beat as any).type || 'EVENT', name: (beat as any).name || '', summary: (beat as any).summary },
            dedupeResult.unique.map(b => ({ id: (b as any).id || '', type: (b as any).type || 'EVENT', name: (b as any).name || '', summary: (b as any).summary })),
            { threshold: config.connectionThreshold, maxConnections: config.maxConnectionsPerBeat }
          );
          connections.push(...beatConnections);
        } catch {
          // Skip if connection detection fails
        }
      }
    }
    config.onProgress?.('connecting', 100);
    
    // Stage 5: Find contradictions
    config.onProgress?.('analyzing', 0);
    let contradictions: any[] = [];
    if (config.findContradictions) {
      try {
        contradictions = findAllContradictions(
          dedupeResult.unique.map(b => ({ id: (b as any).id || '', type: (b as any).type || 'EVENT', name: (b as any).name || '', summary: (b as any).summary }))
        );
      } catch {
        // Skip if contradiction detection fails
      }
    }
    config.onProgress?.('analyzing', 100);
    
    const metadata = {
      extractionTimeMs: Date.now() - startTime,
      totalBeatsFound: extractedBeats.length,
      uniqueBeats: dedupeResult.unique.length,
      duplicateBeats: dedupeResult.duplicates.length,
      connectionsFound: connections.length,
      contradictionsFound: contradictions.length,
      model: config.extractionModel || 'auto',
    };
    
    return {
      beats: extractedBeats,
      newBeats: dedupeResult.unique as ExtractedBeat[],
      updatedBeats: [],
      duplicates: dedupeResult.duplicates,
      connections,
      contradictions,
      metadata,
    };
  }
}

/**
 * Convenience function to extract beats from text
 */
export async function extractBeats(
  text: string,
  options: Partial<PipelineConfig> = {}
): Promise<ExtractionPipelineResult> {
  const pipeline = new ExtractionPipeline(options);
  return pipeline.run(text, options);
}

/**
 * Create a reusable extraction pipeline
 */
export function createExtractionPipeline(config: PipelineConfig = {}): ExtractionPipeline {
  return new ExtractionPipeline(config);
}