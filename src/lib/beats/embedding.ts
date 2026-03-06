// Embedding Service - Local and cloud embeddings for semantic search
// Uses Transformers.js for local embeddings, falls back to cloud

'use client';

// Embedding model options
const EMBEDDING_MODELS = {
  'local-mini': {
    name: 'all-MiniLM-L6-v2',
    dimensions: 384,
    size: '~80MB',
    local: true,
    recommended: true
  },
  'local-mpnet': {
    name: 'all-mpnet-base-v2',
    dimensions: 768,
    size: '~420MB',
    local: true,
    recommended: false
  },
  'local-bge': {
    name: 'BAAI/bge-small-en-v1.5',
    dimensions: 384,
    size: '~130MB',
    local: true,
    recommended: false
  },
  'cloud-ollama': {
    name: 'qwen3-embedding:4b',
    dimensions: 768,
    local: false,
    recommended: false
  }
};

type EmbeddingModelId = keyof typeof EMBEDDING_MODELS;

export interface EmbeddingOptions {
  model?: EmbeddingModelId;
  onProgress?: (progress: number) => void;
}

export class EmbeddingService {
  private model: EmbeddingModelId;
  private pipeline: unknown = null;
  private loaded = false;
  private onProgress?: (progress: number) => void;
  
  constructor(options: EmbeddingOptions = {}) {
    this.model = options.model || 'local-mini';
    this.onProgress = options.onProgress;
  }
  
  /**
   * Check if local embeddings are available
   */
  static async isLocalAvailable(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    
    try {
      await import('@xenova/transformers');
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Load the embedding model
   */
  async load(): Promise<void> {
    if (this.loaded) return;
    
    const modelConfig = EMBEDDING_MODELS[this.model];
    
    if (!modelConfig.local) {
      // Cloud model - no loading needed
      this.loaded = true;
      return;
    }
    
    this.onProgress?.(10);
    
    try {
      const { pipeline } = await import('@xenova/transformers');
      
      this.onProgress?.(30);
      
      this.pipeline = await pipeline(
        'feature-extraction',
        modelConfig.name,
        {
          progress_callback: (progress: { status: string; progress?: number }) => {
            if (progress.progress !== undefined) {
              this.onProgress?.(30 + progress.progress * 0.6);
            }
          }
        }
      );
      
      this.onProgress?.(100);
      this.loaded = true;
      
    } catch (error) {
      console.error('Failed to load embedding model:', error);
      throw error;
    }
  }
  
  /**
   * Generate embedding for a single text
   */
  async embed(text: string): Promise<number[]> {
    await this.load();
    
    const modelConfig = EMBEDDING_MODELS[this.model];
    
    if (modelConfig.local && this.pipeline) {
      // Local embedding
      const result = await (this.pipeline as (text: string) => Promise<{ data: Float32Array }>)(text);
      
      // Convert Float32Array to number array
      return Array.from(result.data);
      
    } else {
      // Cloud embedding via Ollama
      return this.embedCloud(text);
    }
  }
  
  /**
   * Generate embeddings for multiple texts
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    await this.load();
    
    // Process in batches of 10 for efficiency
    const batchSize = 10;
    const embeddings: number[][] = [];
    
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchEmbeddings = await Promise.all(
        batch.map(text => this.embed(text))
      );
      embeddings.push(...batchEmbeddings);
    }
    
    return embeddings;
  }
  
  /**
   * Cloud embedding via Ollama
   */
  private async embedCloud(text: string): Promise<number[]> {
    const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
    const OLLAMA_EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || 'qwen3-embedding:4b';
    
    try {
      const response = await fetch(`${OLLAMA_URL}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: OLLAMA_EMBED_MODEL,
          prompt: text
        })
      });
      
      if (!response.ok) {
        throw new Error(`Ollama embedding error: ${response.status}`);
      }
      
      const data = await response.json();
      return data.embedding;
      
    } catch (error) {
      console.error('Cloud embedding failed:', error);
      throw error;
    }
  }
  
  /**
   * Calculate cosine similarity between two embeddings
   */
  static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Embeddings must have the same dimension');
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
  
  /**
   * Find most similar embeddings
   */
  static findSimilar(
    query: number[],
    embeddings: Array<{ id: string; embedding: number[] }>,
    threshold: number = 0.8,
    limit: number = 10
  ): Array<{ id: string; similarity: number }> {
    const similarities = embeddings.map(item => ({
      id: item.id,
      similarity: this.cosineSimilarity(query, item.embedding)
    }));
    
    return similarities
      .filter(s => s.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }
  
  /**
   * Get embedding dimension for current model
   */
  getDimension(): number {
    return EMBEDDING_MODELS[this.model].dimensions;
  }
  
  /**
   * Unload model to free memory
   */
  async unload(): Promise<void> {
    this.pipeline = null;
    this.loaded = false;
  }
}

// Singleton instance
let embeddingService: EmbeddingService | null = null;

/**
 * Get or create embedding service
 */
export function getEmbeddingService(options?: EmbeddingOptions): EmbeddingService {
  if (!embeddingService) {
    embeddingService = new EmbeddingService(options);
  }
  return embeddingService;
}

/**
 * Recommended local embedding model
 */
export const RECOMMENDED_EMBEDDING_MODEL: EmbeddingModelId = 'local-mini';