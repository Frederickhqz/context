// Beats Library - Main exports
// Multidimensional knowledge mesh for Context app

// Types
export * from './types';

// Extraction
export { BeatExtractor, getBeatExtractor } from './extractor';

// On-device AI
export { WebLLMProvider, getLocalProvider, RECOMMENDED_MODEL } from './webllm-provider';

// Embeddings
export { EmbeddingService, getEmbeddingService, RECOMMENDED_EMBEDDING_MODEL } from './embedding';

// Processing Queue
export { ProcessingQueue, getProcessingQueue } from './queue';

// React Hooks
export {
  useBeatMesh,
  useBeatStats,
  useBeatSearch,
  useBeat,
} from './hooks';