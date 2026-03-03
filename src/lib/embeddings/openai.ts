import { EmbeddingProvider } from './types';

/**
 * OpenAI Embedding Provider
 * Uses OpenAI's text-embedding-3-small or text-embedding-3-large
 */
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  name = 'openai';
  type = 'cloud' as const;
  dimensions: number;
  
  private apiKey: string;
  private model: string;
  
  constructor(apiKey: string, model: string = 'text-embedding-3-small', dimensions?: number) {
    this.apiKey = apiKey;
    this.model = model;
    
    // Set dimensions based on model
    if (model === 'text-embedding-3-large') {
      this.dimensions = dimensions || 3072;
    } else {
      this.dimensions = dimensions || 1536;
    }
  }
  
  async isReady(): Promise<boolean> {
    return !!this.apiKey;
  }
  
  async embed(text: string): Promise<number[]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        input: text,
        dimensions: this.dimensions,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI embedding error: ${error.error?.message || 'Unknown error'}`);
    }
    
    const data = await response.json();
    return data.data[0].embedding;
  }
  
  async embedBatch(texts: string[]): Promise<number[][]> {
    // OpenAI supports batch embedding
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        input: texts,
        dimensions: this.dimensions,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI embedding error: ${error.error?.message || 'Unknown error'}`);
    }
    
    const data = await response.json();
    
    // Sort by index to maintain order
    const sorted = data.data.sort((a: any, b: any) => a.index - b.index);
    return sorted.map((item: any) => item.embedding);
  }
}