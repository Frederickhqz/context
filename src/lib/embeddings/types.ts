// Embedding Provider Interface
// Supports both local (EmbeddingGemma) and cloud (OpenAI) embeddings

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

// Default configuration
export const defaultEmbeddingConfig: EmbeddingConfig = {
  provider: 'local',
  model: 'embeddinggemma',
  device: 'cpu',
  dimensions: 768,
};