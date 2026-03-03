import { EmbeddingProvider, EmbeddingConfig, defaultEmbeddingConfig } from './types';

// Factory to create the appropriate embedding provider
export async function createEmbeddingProvider(config: EmbeddingConfig = defaultEmbeddingConfig): Promise<EmbeddingProvider> {
  if (config.provider === 'openai') {
    const { OpenAIEmbeddingProvider } = await import('./openai');
    return new OpenAIEmbeddingProvider(config.apiKey!, config.model, config.dimensions);
  }
  
  // Default to local
  const { LocalEmbeddingProvider } = await import('./local');
  return new LocalEmbeddingProvider(config.model, config.device);
}

// Get the singleton embedding provider
let _provider: EmbeddingProvider | null = null;

export async function getEmbeddingProvider(): Promise<EmbeddingProvider> {
  if (!_provider) {
    const config: EmbeddingConfig = {
      provider: (process.env.EMBEDDING_PROVIDER as 'local' | 'openai') || 'local',
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.EMBEDDING_MODEL,
      dimensions: process.env.EMBEDDING_DIMENSIONS ? parseInt(process.env.EMBEDDING_DIMENSIONS) : undefined,
    };
    
    _provider = await createEmbeddingProvider(config);
  }
  
  return _provider;
}

// Convenience function to embed a single text
export async function embed(text: string): Promise<number[]> {
  const provider = await getEmbeddingProvider();
  return provider.embed(text);
}

// Convenience function to embed multiple texts
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const provider = await getEmbeddingProvider();
  return provider.embedBatch(texts);
}