// WebLLM Provider - On-device AI processing with Gemma 3 Family
// Falls back to cloud (Ollama) when local model unavailable

'use client';

import type { ExtractedBeat } from './types';
import { EXTRACTION_MODELS, type ExtractionModelId, RECOMMENDED_EXTRACTION_MODEL, CLOUD_CONFIG } from './config';

// WebLLM types (from @mlc-ai/web-llm)
interface ChatCompletionMessageParam {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletion {
  choices: Array<{
    message: ChatCompletionMessageParam;
    finish_reason: string;
  }>;
}

interface WebLLMLoadResult {
  model: string;
  status: 'loading' | 'ready' | 'error';
  progress?: number;
  error?: string;
}

export interface WebLLMConfig {
  model?: ExtractionModelId;
  onProgress?: (progress: number, status: string) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

export class WebLLMProvider {
  private model: ExtractionModelId;
  private engine: unknown = null;
  private loaded = false;
  private loading = false;
  private onProgress?: (progress: number, status: string) => void;
  
  constructor(config: WebLLMConfig = {}) {
    this.model = config.model || RECOMMENDED_EXTRACTION_MODEL;
    this.onProgress = config.onProgress;
  }
  
  /**
   * Check if WebLLM is available in this environment
   */
  static async isAvailable(): Promise<boolean> {
    // Check if running in browser
    if (typeof window === 'undefined') {
      return false;
    }
    
    // Check if WebLLM is available
    try {
      const hasWebLLM = 'WebLLM' in window || 
        // Check for createMLCEngine (newer API)
        !!(await import('@mlc-ai/web-llm').catch(() => null));
      return hasWebLLM;
    } catch {
      return false;
    }
  }
  
  /**
   * Load the local model
   */
  async load(): Promise<WebLLMLoadResult> {
    if (this.loaded) {
      return { model: this.model, status: 'ready' };
    }
    
    if (this.loading) {
      throw new Error('Model is already loading');
    }
    
    this.loading = true;
    
    try {
      this.onProgress?.(0, 'Initializing...');
      
      // Dynamic import for client-side only
      const { CreateMLCEngine, hasModelInCache } = await import('@mlc-ai/web-llm');
      
      // Check if model is cached
      const modelId = this.getModelId();
      const cached = await hasModelInCache(modelId);
      
      if (!cached) {
        this.onProgress?.(10, 'Downloading model...');
      } else {
        this.onProgress?.(50, 'Loading cached model...');
      }
      
      // Create engine with progress callback
      this.engine = await CreateMLCEngine(modelId, {
        initProgressCallback: (progress: { progress: number; text: string }) => {
          this.onProgress?.(
            10 + progress.progress * 80, // 10-90% for loading
            progress.text
          );
        }
      });
      
      this.loaded = true;
      this.loading = false;
      this.onProgress?.(100, 'Ready');
      
      return { model: this.model, status: 'ready' };
      
    } catch (error) {
      this.loading = false;
      this.onProgress?.(0, `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        model: this.model,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Get the full model ID for WebLLM
   */
  private getModelId(): string {
    const modelConfig = EXTRACTION_MODELS[this.model];
    return modelConfig.webllmId || `gemma-3-1b-it-q4f16_1-MLC`;
  }
  
  /**
   * Generate completion using local model
   */
  async chat(messages: ChatCompletionMessageParam[]): Promise<string> {
    if (!this.loaded || !this.engine) {
      await this.load();
    }
    
    try {
      // Use the engine to generate completion
      const engine = this.engine as {
        chat: {
          completions: {
            create: (options: {
              messages: ChatCompletionMessageParam[];
              temperature?: number;
              max_tokens?: number;
            }) => Promise<ChatCompletion>;
          };
        };
      };
      
      const response = await engine.chat.completions.create({
        messages,
        temperature: 0.3,
        max_tokens: 4096
      });
      
      return response.choices[0]?.message?.content || '';
      
    } catch (error) {
      console.error('Local model inference failed:', error);
      throw error;
    }
  }
  
  /**
   * Extract beats from text using local model
   */
  async extractBeats(text: string): Promise<ExtractedBeat[]> {
    const systemPrompt = `You are a literary analysis assistant. Extract "beats" (atomic units of meaning) from text.
Output ONLY valid JSON with this structure:
{
  "beats": [
    {
      "type": "CHARACTER|THEME|EVENT|MOTIF|INSIGHT|QUESTION|PLACE|OBJECT|RELATIONSHIP|CONFLICT",
      "name": "Short identifier",
      "summary": "One sentence description",
      "intensity": 0.0-1.0,
      "valence": -1.0 to 1.0
    }
  ]
}`;

    const userPrompt = `Extract beats from this text:\n\n${text}`;
    
    const response = await this.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]);
    
    // Parse JSON from response
    return this.parseBeats(response);
  }
  
  /**
   * Parse beats from LLM response
   */
  private parseBeats(response: string): ExtractedBeat[] {
    try {
      const jsonMatch = response.match(/\{[\s\S]*"beats"[\s\S]*\}/);
      if (!jsonMatch) return [];
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      if (!Array.isArray(parsed.beats)) return [];
      
      return parsed.beats.map((beat: Record<string, unknown>) => ({
        type: beat.type as string,
        name: String(beat.name || 'Unnamed'),
        summary: String(beat.summary || ''),
        intensity: Math.max(0, Math.min(1, Number(beat.intensity) || 0.5)),
        valence: Math.max(-1, Math.min(1, Number(beat.valence) || 0)),
        confidence: 0.7, // Lower confidence for local model
        connections: []
      }));
    } catch {
      return [];
    }
  }
  
  /**
   * Unload model to free memory
   */
  async unload(): Promise<void> {
    if (this.engine && typeof this.engine === 'object' && this.engine !== null && 'unload' in this.engine) {
      await (this.engine as { unload: () => Promise<void> }).unload();
    }
    this.engine = null;
    this.loaded = false;
  }
  
  /**
   * Get model info
   */
  getModelInfo() {
    return EXTRACTION_MODELS[this.model];
  }
  
  /**
   * Check if model is loaded
   */
  isLoaded(): boolean {
    return this.loaded;
  }
}

// Singleton instance
let localProvider: WebLLMProvider | null = null;

/**
 * Get or create the local LLM provider
 */
export function getLocalProvider(config?: WebLLMConfig): WebLLMProvider {
  if (!localProvider) {
    localProvider = new WebLLMProvider(config);
  }
  return localProvider!;
}

/**
 * Recommended model for extraction tasks (Gemma 3 1B)
 */
export { RECOMMENDED_EXTRACTION_MODEL } from './config';