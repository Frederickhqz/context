// Extraction Pipeline - Index
// Beat extraction, classification, deduplication, connection detection, and contradiction finding

// Note: extractor.ts is in lib/beats, not lib/extraction
export { 
  getBeatExtractor,
  type ExtractionOptions, 
  type ExtractionResult 
} from '../beats/extractor';

export {
  classifyBeatType,
  getBeatTypeConfig,
  getAllBeatTypes,
} from './classifier';

export {
  deduplicateBeats,
  findSimilarBeats,
  mergeBeats,
  areSameEntity,
  getCanonicalName,
  scoreUniqueness,
} from './deduplicator';

export {
  findPotentialConnections,
  detectConnectionType,
  getConnectionPattern,
  getAllConnectionTypes,
} from './connector';

export {
  detectContradiction,
  findAllContradictions,
  suggestResolution,
  getContradictionPattern,
  getAllContradictionTypes,
} from './contradiction-detector';

// Pipeline orchestration
export { createExtractionPipeline, extractBeats } from './pipeline';
export type { ExtractionPipeline } from './pipeline';