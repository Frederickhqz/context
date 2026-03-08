// Embedding Provider Interface
// Supports both local (EmbeddingGemma) and cloud (OpenAI) embeddings
//
// ⚠️ IMPORTANT: Always use the SAME embedding model for all vectors in the database.
// Mixing different models will cause semantic search to fail because:
// - Different models produce vectors with different dimensions
// - Similar concepts won't have similar vectors across models
// - Cosine similarity between different model embeddings is meaningless

export interface EmbeddingProvider {
  name: string;
  type: 'local' | 'cloud';
  dimensions: number;
  
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  isReady(): Promise<boolean>;
}

export interface EmbeddingConfig {
  provider: 'local' | 'openai';
  model?: string;
  apiKey?: string;
  dimensions?: number;
  device?: 'cpu' | 'cuda' | 'metal';
}

// Default configuration - DO NOT CHANGE MODEL AFTER DATA EXISTS
// If you need to switch models, you must re-embed ALL existing data
export const defaultEmbeddingConfig: EmbeddingConfig = {
  provider: 'local',
  model: 'embeddinggemma',  // 768 dimensions, runs locally
  device: 'cpu',
  dimensions: 768,
};

// Available models with their dimensions
export const EMBEDDING_MODELS = {
  // Local models (via QMD/Ollama)
  'embeddinggemma': { dimensions: 768, type: 'local' as const },
  'nomic-embed-text': { dimensions: 768, type: 'local' as const },
  'all-minilm': { dimensions: 384, type: 'local' as const },
  
  // OpenAI models (cloud)
  'text-embedding-3-small': { dimensions: 1536, type: 'cloud' as const },
  'text-embedding-3-large': { dimensions: 3072, type: 'cloud' as const },
  'text-embedding-ada-002': { dimensions: 1536, type: 'cloud' as const },
} as const;