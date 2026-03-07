// Edge Extraction Service - Run LLM extraction on client devices
// Uses WebLLM for browser-based inference with Gemma 3 models

import type { ExtractedBeat, BeatType, BeatConnectionType } from '../beats/types';
import { EXTRACTION_MODELS, type ExtractionModelId, RECOMMENDED_EXTRACTION_MODEL } from '../beats/config';

// Re-export model ID type
export type ModelId = ExtractionModelId;

// Extraction prompt for beats
const EXTRACTION_PROMPT = `You are a literary analysis assistant. Extract "beats" from the given text.

A beat is an atomic unit of meaning - the smallest meaningful element in a narrative or text.

Beat types:
- CHARACTER: A person, being, or entity with agency
- PLACE: A location with significance
- OBJECT: A significant item
- CREATURE: A non-character being
- THEME: A recurring abstract concept
- MOTIF: A recurring symbol, image, or pattern
- IDEA: An abstract concept or notion
- QUESTION: An unresolved mystery or question
- INSIGHT: A key realization or understanding
- RELATIONSHIP: A dynamic between entities
- CONFLICT: A tension or opposition
- EVENT: An occurrence or happening
- FEELING: An emotional beat
- MOOD: An atmospheric quality

For each beat, identify:
1. type: The beat type (from the list above)
2. name: A short, memorable identifier (2-5 words)
3. summary: A one-sentence description
4. intensity: Impact level (0.0-1.0, where 1.0 is maximum impact)
5. valence: Emotional tone (-1.0 to 1.0, where -1 is negative, 0 is neutral, 1 is positive)

Output ONLY valid JSON in this format:
{
  "beats": [
    {
      "type": "CHARACTER",
      "name": "The Mentor",
      "summary": "A guiding figure who knows more than they reveal",
      "intensity": 0.8,
      "valence": 0.2
    }
  ]
}

Text to analyze:
---
{text}
---

Output ONLY the JSON, no other text.`;

// Connection analysis prompt
const CONNECTION_PROMPT = `Analyze the relationship between these two beats and determine how they connect.

Beat 1:
Type: {type1}
Name: {name1}
Summary: {summary1}

Beat 2:
Type: {type2}
Name: {name2}
Summary: {summary2}

Connection types:
- RELATES_TO: General association
- MIRRORS: Parallel or echo (similar pattern)
- CAUSES: Beat 1 causes Beat 2
- RESULTS_FROM: Beat 1 results from Beat 2
- FORESHADOWS: Beat 1 foreshadows Beat 2
- CONTRADICTS: Beat 1 contradicts Beat 2
- SUPPORTS: Beat 1 supports/reinforces Beat 2
- UNDERMINES: Beat 1 undermines/weakens Beat 2
- EVOLVES_TO: Beat 1 evolves into Beat 2

Output ONLY valid JSON:
{
  "connectionType": "MIRRORS",
  "strength": 0.85,
  "evidence": "Both involve betrayal by trusted figures",
  "isContradiction": false
}`;

interface ExtractionResult {
  beats: ExtractedBeat[];
  model: string;
  processingTimeMs: number;
  fromCache: boolean;
}

interface ProgressCallback {
  (progress: { status: string; progress?: number; loaded?: number; total?: number }): void;
}

interface ModelStatus {
  id: string;
  name: string;
  sizeMB: number;
  minRamMB: number;
  contextWindow: number;
  multimodal: boolean;
  recommended: boolean;
  description: string;
  downloaded: boolean;
  downloading: boolean;
  progress: number;
}

/**
 * Edge Extraction Service - Runs LLM inference entirely on device
 * 
 * Features:
 * - WebLLM-based inference with Gemma 3 models
 * - JSON mode for structured extraction
 * - Automatic model download with progress
 * - IndexedDB caching for offline use
 * - Fallback to cloud when device can't run model
 */
export class EdgeExtractionService {
  private model: ModelId;
  private engine: unknown = null; // WebLLM engine
  private loading = false;
  private loadPromise: Promise<void> | null = null;
  private deviceId: string;
  private deviceModel: string;

  constructor(model: ModelId = RECOMMENDED_EXTRACTION_MODEL) {
    this.model = model;
    this.deviceId = this.getDeviceId();
    this.deviceModel = this.getDeviceModel();
  }

  /**
   * Load the extraction model (downloads if not cached)
   */
  async load(onProgress?: ProgressCallback): Promise<void> {
    if (this.engine) return;
    if (this.loading && this.loadPromise) return this.loadPromise;

    this.loading = true;
    this.loadPromise = this.loadModel(onProgress);
    await this.loadPromise;
    this.loading = false;
  }

  private async loadModel(onProgress?: ProgressCallback): Promise<void> {
    // Check if WebLLM is available
    if (typeof window === 'undefined') {
      throw new Error('WebLLM only available in browser');
    }

    try {
      // Dynamically import WebLLM
      const webllm = await import('@mlc-ai/web-llm');
      const modelConfig = EXTRACTION_MODELS[this.model];

      onProgress?.({ status: 'loading', progress: 0 });

      // Create engine with progress callback
      this.engine = await webllm.CreateMLCEngine(modelConfig.name, {
        initProgressCallback: (progress: { progress: number; text: string }) => {
          onProgress?.({
            status: progress.text,
            progress: progress.progress * 100
          });
        }
      });

      onProgress?.({ status: 'loaded', progress: 100 });
    } catch (error) {
      console.error('Failed to load WebLLM engine:', error);
      throw error;
    }
  }

  /**
   * Extract beats from text
   */
  async extract(text: string, onProgress?: ProgressCallback): Promise<ExtractionResult> {
    const startTime = performance.now();

    // Ensure model is loaded
    await this.load(onProgress);

    if (!this.engine) {
      throw new Error('Engine not loaded');
    }

    const webllm = await import('@mlc-ai/web-llm');
    const modelConfig = EXTRACTION_MODELS[this.model];

    // Truncate text if needed (respect context window)
    const maxLength = (modelConfig.contextLength || 32000) - 1000; // Leave room for prompt + response
    const truncatedText = text.length > maxLength 
      ? text.slice(0, maxLength) + '\n...[truncated]'
      : text;

    const prompt = EXTRACTION_PROMPT.replace('{text}', truncatedText);

    onProgress?.({ status: 'extracting', progress: 50 });

    // Call LLM with JSON mode for structured output
    const response = await (this.engine as {
      chat: {
        completions: {
          create: (options: {
            messages: Array<{ role: string; content: string }>;
            response_format: { type: string };
            temperature: number;
            max_tokens: number;
          }) => Promise<{ choices: Array<{ message?: { content?: string } }> }>;
        };
      };
    }).chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 4096
    });

    const content = response.choices[0]?.message?.content || '';
    
    onProgress?.({ status: 'parsing', progress: 90 });

    // Parse JSON response
    const beats = this.parseExtractionResult(content);

    const processingTimeMs = performance.now() - startTime;

    onProgress?.({ status: 'complete', progress: 100 });

    return {
      beats,
      model: this.model,
      processingTimeMs,
      fromCache: false // Would need to track this
    };
  }

  /**
   * Analyze connection between two beats
   */
  async analyzeConnection(
    beat1: { type: BeatType; name: string; summary?: string },
    beat2: { type: BeatType; name: string; summary?: string }
  ): Promise<{ connectionType: BeatConnectionType; strength: number; evidence: string; isContradiction: boolean } | null> {
    await this.load();

    if (!this.engine) {
      throw new Error('Engine not loaded');
    }

    const webllm = await import('@mlc-ai/web-llm');

    const prompt = CONNECTION_PROMPT
      .replace('{type1}', beat1.type)
      .replace('{name1}', beat1.name)
      .replace('{summary1}', beat1.summary || '')
      .replace('{type2}', beat2.type)
      .replace('{name2}', beat2.name)
      .replace('{summary2}', beat2.summary || '');

    try {
      const response = await (this.engine as {
        chat: {
          completions: {
            create: (options: {
              messages: Array<{ role: string; content: string }>;
              response_format: { type: string };
              temperature: number;
              max_tokens: number;
            }) => Promise<{ choices: Array<{ message?: { content?: string } }> }>;
          };
        };
      }).chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 512
      });

      const content = response.choices[0]?.message?.content || '';
      const parsed = JSON.parse(content);

      return {
        connectionType: this.validateConnectionType(parsed.connectionType),
        strength: this.clamp(Number(parsed.strength) || 0.5, 0, 1),
        evidence: String(parsed.evidence || ''),
        isContradiction: Boolean(parsed.isContradiction),
      };
    } catch (error) {
      console.error('Failed to analyze connection:', error);
      return null;
    }
  }

  /**
   * Parse extraction result from LLM
   */
  private parseExtractionResult(response: string): ExtractedBeat[] {
    try {
      // Find JSON in response
      const jsonMatch = response.match(/\{[\s\S]*"beats"[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('No JSON found in response');
        return [];
      }

      const parsed = JSON.parse(jsonMatch[0]);

      if (!Array.isArray(parsed.beats)) {
        return [];
      }

      // Validate and normalize each beat
      return parsed.beats.map((beat: Record<string, unknown>) => ({
        type: this.validateBeatType(beat.type),
        name: String(beat.name || 'Unnamed Beat'),
        summary: String(beat.summary || ''),
        intensity: this.clamp(Number(beat.intensity) || 0.5, 0, 1),
        valence: this.clamp(Number(beat.valence) || 0, -1, 1),
        confidence: Number(beat.confidence) || 0.8,
        connections: this.validateConnections(beat.connections),
      }));
    } catch (error) {
      console.error('Failed to parse extraction result:', error);
      return [];
    }
  }

  /**
   * Check if extraction is available on this device
   */
  static async isAvailable(): Promise<{ available: boolean; reason?: string; recommendedModel?: ModelId }> {
    if (typeof window === 'undefined') {
      return { available: false, reason: 'Server environment' };
    }

    try {
      // Check for WebGPU (required for WebLLM)
      if (!('gpu' in navigator)) {
        return { available: false, reason: 'WebGPU not supported' };
      }

      // Check for IndexedDB (required for model caching)
      if (!window.indexedDB) {
        return { available: false, reason: 'IndexedDB not supported' };
      }

      // Check for memory
      const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory || 4;

      // Recommend model based on memory
      let recommendedModel: ModelId;
      if (memory >= 6) {
        recommendedModel = 'gemma-3n-e2b'; // Multimodal
      } else if (memory >= 4) {
        recommendedModel = 'gemma-3-1b'; // Standard
      } else if (memory >= 2) {
        recommendedModel = 'gemma-3-1b'; // Still 1B, but will be slower
      } else {
        return { available: false, reason: 'Insufficient device memory (need at least 2GB)' };
      }

      return {
        available: true,
        reason: `WebGPU available, ${memory}GB RAM`,
        recommendedModel
      };
    } catch (error) {
      return { available: false, reason: String(error) };
    }
  }

  /**
   * Get all model info (for settings UI)
   */
  static async getModelsStatus(): Promise<ModelStatus[]> {
    const models: ModelStatus[] = [];

    for (const [id, config] of Object.entries(EXTRACTION_MODELS)) {
      models.push({
        id,
        name: config.displayName,
        sizeMB: parseInt(config.size?.replace(/[^\d]/g, '') || '0'),
        minRamMB: parseInt(config.size?.replace(/[^\d]/g, '') || '0') * 2, // Estimate 2x for RAM
        contextWindow: config.contextLength || 32000,
        multimodal: (config.capabilities as readonly string[] | undefined)?.some(c => c === 'vision') || false,
        recommended: config.recommended || false,
        description: config.description || '',
        downloaded: false, // Would need to check IndexedDB
        downloading: false,
        progress: 0
      });
    }

    return models;
  }

  /**
   * Get device info
   */
  getDeviceInfo(): { deviceId: string; deviceModel: string } {
    return {
      deviceId: this.deviceId,
      deviceModel: this.deviceModel
    };
  }

  private getDeviceId(): string {
    if (typeof window === 'undefined') return 'server';

    let deviceId = localStorage.getItem('edge_extraction_device_id');
    if (!deviceId) {
      deviceId = crypto.randomUUID();
      localStorage.setItem('edge_extraction_device_id', deviceId);
    }
    return deviceId;
  }

  private getDeviceModel(): string {
    if (typeof window === 'undefined') return 'server';
    if (typeof navigator === 'undefined') return 'unknown';

    const ua = navigator.userAgent;

    if (/iPhone/.test(ua)) return 'iPhone';
    if (/iPad/.test(ua)) return 'iPad';
    if (/Android/.test(ua)) return 'Android';
    if (/Windows/.test(ua)) return 'Windows';
    if (/Mac/.test(ua)) return 'Mac';
    if (/Linux/.test(ua)) return 'Linux';

    return 'unknown';
  }

  /**
   * Unload model to free memory
   */
  unload(): void {
    if (this.engine) {
      (this.engine as { unload?: () => void }).unload?.();
      this.engine = null;
    }
    this.loadPromise = null;
  }

  /**
   * Delete cached model
   */
  static async deleteCachedModel(model: ModelId): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      const cache = await caches.open('webllm-models');
      await cache.delete(EXTRACTION_MODELS[model].webllmId || '');
    } catch (error) {
      console.error('Failed to delete cached model:', error);
    }
  }

  private validateBeatType(type: unknown): BeatType {
    const validTypes: BeatType[] = [
      'CHARACTER', 'PLACE', 'OBJECT', 'CREATURE', 'THEME', 'MOTIF',
      'IDEA', 'QUESTION', 'INSIGHT', 'RELATIONSHIP', 'CONFLICT',
      'FEELING', 'MOOD', 'STORY', 'SCENE', 'CHAPTER',
      'WORLD', 'DIMENSION', 'TIMELINE', 'RESOLUTION', 'CUSTOM', 'EVENT'
    ];

    if (typeof type === 'string' && validTypes.includes(type as BeatType)) {
      return type as BeatType;
    }

    return 'IDEA';
  }

  private validateConnections(connections: unknown): ExtractedBeat['connections'] {
    if (!Array.isArray(connections)) return [];

    return connections.map((conn: Record<string, unknown>) => ({
      toBeatName: String(conn.toBeatName || ''),
      type: this.validateConnectionType(conn.type),
      strength: this.clamp(Number(conn.strength) || 0.5, 0, 1),
      evidence: String(conn.evidence || ''),
    })).filter(conn => conn.toBeatName);
  }

  private validateConnectionType(type: unknown): BeatConnectionType {
    const validTypes: BeatConnectionType[] = [
      'RELATES_TO', 'PART_OF', 'CONTAINS', 'REFERENCES',
      'CAUSES', 'RESULTS_FROM', 'FORESHADOWS', 'MIRRORS', 'CONTRADICTS', 'RESOLVES',
      'PRECEDES', 'FOLLOWS', 'CONCURRENT',
      'EVOLVES_TO', 'EVOLVES_FROM', 'REPLACES',
      'ALTERNATE_OF', 'PARALLEL_TO',
      'SUPPORTS', 'UNDERMINES', 'TENSIONS_WITH'
    ];

    if (typeof type === 'string' && validTypes.includes(type as BeatConnectionType)) {
      return type as BeatConnectionType;
    }

    return 'RELATES_TO';
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }
}

// Singleton instance
let serviceInstance: EdgeExtractionService | null = null;

export function getEdgeExtractionService(model?: ModelId): EdgeExtractionService {
  if (!serviceInstance || (model && model !== serviceInstance['model'])) {
    serviceInstance = new EdgeExtractionService(model);
  }
  return serviceInstance;
}