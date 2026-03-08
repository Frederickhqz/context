// Beats Library - Main exports
// Multidimensional knowledge mesh for Context app

// Types
export * from './types';

// Extraction
export { BeatExtractor, getBeatExtractor } from './extractor';
export { EXTRACTION_PROMPTS, getExtractionPrompt, parseExtractionResult } from './prompts';

// On-device AI
export { WebLLMProvider, getLocalProvider, RECOMMENDED_EXTRACTION_MODEL } from './webllm-provider';

// Embeddings
export { EmbeddingService, getEmbeddingService, RECOMMENDED_EMBEDDING_MODEL } from './embedding';

// Processing Queue
export { ProcessingQueue, getProcessingQueue } from './queue';

// Contradiction Detection
export { ContradictionDetector, getContradictionDetector } from './contradiction';
export type { Contradiction } from './contradiction';

// React Hooks
export {
  useBeatMesh,
  useBeatStats,
  useBeatSearch,
} from './hooks';