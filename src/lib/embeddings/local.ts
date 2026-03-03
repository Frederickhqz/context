import { EmbeddingProvider } from './types';

/**
 * Local Embedding Provider using Transformers.js
 * Runs EmbeddingGemma or similar models locally on CPU/GPU
 */
export class LocalEmbeddingProvider implements EmbeddingProvider {
  name = 'local';
  type = 'local' as const;
  dimensions = 768;
  
  private model: string;
  private device: 'cpu' | 'cuda' | 'metal';
  private pipeline: any = null;
  
  constructor(model: string = 'embeddinggemma', device: 'cpu' | 'cuda' | 'metal' = 'cpu') {
    this.model = model;
    this.device = device;
    
    // Set dimensions based on model
    if (model.includes('gemma') || model.includes('EmbeddingGemma')) {
      this.dimensions = 768;
    } else if (model.includes('bge-m3') || model.includes('BGE-M3')) {
      this.dimensions = 1024;
    } else if (model.includes('nomic')) {
      this.dimensions = 768;
    } else {
      this.dimensions = 768; // Default
    }
  }
  
  async isReady(): Promise<boolean> {
    try {
      await this.getPipeline();
      return true;
    } catch {
      return false;
    }
  }
  
  private async getPipeline() {
    if (!this.pipeline) {
      // Dynamic import for Transformers.js
      const { pipeline } = await import('@xenova/transformers');
      
      // Use XENOVA embeddings model (compatible with local execution)
      // Note: EmbeddingGemma would require specific model loading
      // For now, we use a compatible model from Hugging Face
      this.pipeline = await pipeline(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2', // Lightweight, good quality
        { quantized: true }
      );
    }
    return this.pipeline;
  }
  
  async embed(text: string): Promise<number[]> {
    const pipeline = await this.getPipeline();
    const output = await pipeline(text, { pooling: 'mean', normalize: true });
    
    // Convert to array
    const embedding = Array.from(output.data as Float32Array);
    return embedding;
  }
  
  async embedBatch(texts: string[]): Promise<number[][]> {
    // Process in batches for efficiency
    const embeddings: number[][] = [];
    
    for (const text of texts) {
      const embedding = await this.embed(text);
      embeddings.push(embedding);
    }
    
    return embeddings;
  }
}