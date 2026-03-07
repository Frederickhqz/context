// Edge Embedding Service - Run embedding models on client devices
// Supports multilingual models for global deployment (App Store, Play Store, Web)

import type { Pipeline } from '@xenova/transformers';

// Supported models - optimized for mobile/web deployment
const MODELS = {
  // Recommended: Best balance of size, multilingual support, and quality
  'embeddinggemma-300m': {
    name: 'google/embeddinggemma-300m', // Hypothetical HuggingFace path
    dimensions: 768, // Matryoshka: can truncate to 512/256/128
    sizeMB: 200,
    languages: '100+ languages including English, Spanish, Chinese, Arabic, Hindi, etc.',
    recommended: true,
    mobileOptimized: true,
    matryoshka: true,
    minRamMB: 200
  },
  // Alternative: Multilingual E5 Small (smaller but lower quality)
  'multilingual-e5-small': {
    name: 'Xenova/multilingual-e5-small',
    dimensions: 384,
    sizeMB: 120,
    languages: '50+ languages',
    recommended: false,
    mobileOptimized: true,
    matryoshka: false,
    minRamMB: 150
  },
  // Alternative: Qwen3 Embedding (larger but better quality)
  'qwen3-embedding-0.6b': {
    name: 'Qwen/qwen3-embedding-0.6b',
    dimensions: 1024, // Matryoshka: can truncate
    sizeMB: 400,
    languages: '100+ languages, instruction-aware',
    recommended: false,
    mobileOptimized: true,
    matryoshka: true,
    minRamMB: 400
  },
  // Fallback: English-only, smallest
  'all-MiniLM-L6-v2': {
    name: 'Xenova/all-MiniLM-L6-v2',
    dimensions: 384,
    sizeMB: 80,
    languages: 'English only',
    recommended: false,
    mobileOptimized: true,
    matryoshka: false,
    minRamMB: 100
  },
  // Legacy: For backwards compatibility
  'nomic-embed-text-v1.5': {
    name: 'nomic-ai/nomic-embed-text-v1.5',
    dimensions: 768,
    sizeMB: 275,
    languages: 'English-focused, general purpose',
    recommended: false,
    mobileOptimized: false,
    matryoshka: true,
    minRamMB: 300
  }
} as const;

interface EmbeddingResult {
  vector: number[];
  model: string;
  dimensions: number;
  processingTimeMs: number;
}

interface ProgressCallback {
  (progress: { status: string; progress?: number; loaded?: number; total?: number }): void;
}

interface ModelInfo {
  id: string;
  name: string;
  dimensions: number;
  sizeMB: number;
  languages: string;
  recommended: boolean;
  mobileOptimized: boolean;
  downloaded: boolean;
  downloading: boolean;
  progress: number;
}

type ModelId = keyof typeof MODELS;

/**
 * Edge Embedding Service - Runs entirely in the browser/app
 * 
 * Features:
 * - Automatic model download with progress tracking
 * - Persistent model caching (IndexedDB)
 * - Matryoshka dimension support (truncate embeddings for speed)
 * - Device capability detection (RAM, WebGPU, etc.)
 */
export class EdgeEmbeddingService {
  private model: ModelId;
  private pipeline: Pipeline | null = null;
  private loading = false;
  private loadPromise: Promise<void> | null = null;
  private deviceId: string;
  private deviceModel: string;
  private targetDimensions: number;

  constructor(model: ModelId = 'embeddinggemma-300m', targetDimensions?: number) {
    this.model = model;
    this.deviceId = this.getDeviceId();
    this.deviceModel = this.getDeviceModel();
    this.targetDimensions = targetDimensions || MODELS[model].dimensions;
  }

  /**
   * Load the embedding model (downloads if not cached)
   */
  async load(onProgress?: ProgressCallback): Promise<void> {
    if (this.pipeline) return;
    if (this.loading && this.loadPromise) return this.loadPromise;

    this.loading = true;
    this.loadPromise = this.loadModel(onProgress);
    await this.loadPromise;
    this.loading = false;
  }

  private async loadModel(onProgress?: ProgressCallback): Promise<void> {
    const { pipeline, env } = await import('@xenova/transformers');

    // Configure for browser/mobile
    env.allowLocalModels = false;
    env.useBrowserCache = true;

    // Use IndexedDB for persistent model cache
    env.cacheDir = 'indexeddb://embedding-models';

    const modelConfig = MODELS[this.model];

    onProgress?.({ status: 'loading', progress: 0 });

    this.pipeline = await pipeline(
      'feature-extraction',
      modelConfig.name,
      {
        progress_callback: (progress: { status: string; progress?: number; loaded?: number; total?: number }) => {
          onProgress?.({
            status: progress.status,
            progress: progress.progress,
            loaded: progress.loaded,
            total: progress.total
          });
        },
        // Use quantized model for smaller download
        quantized: true
      }
    ) as Pipeline;

    onProgress?.({ status: 'loaded', progress: 100 });
  }

  /**
   * Generate embedding for text
   */
  async embed(text: string): Promise<EmbeddingResult> {
    await this.load();

    if (!this.pipeline) {
      throw new Error('Pipeline not loaded');
    }

    const startTime = performance.now();
    const modelConfig = MODELS[this.model];

    // For E5 models, prepend query prefix for better retrieval
    const processedText = this.model.includes('e5') || this.model.includes('gemma')
      ? `query: ${text}`
      : text;

    const result = await this.pipeline(processedText, {
      pooling: 'mean',
      normalize: true
    });

    const processingTimeMs = performance.now() - startTime;

    // Convert tensor to array
    let vector = Array.from(result.data as Float32Array);

    // Matryoshka dimension reduction if supported and requested
    if (modelConfig.matryoshka && this.targetDimensions < vector.length) {
      vector = vector.slice(0, this.targetDimensions);
    }

    return {
      vector,
      model: this.model,
      dimensions: vector.length,
      processingTimeMs
    };
  }

  /**
   * Generate embeddings for multiple texts (batch processing)
   */
  async embedBatch(texts: string[], onProgress?: (current: number, total: number) => void): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];

    for (let i = 0; i < texts.length; i++) {
      const result = await this.embed(texts[i]);
      results.push(result);
      onProgress?.(i + 1, texts.length);
    }

    return results;
  }

  /**
   * Check if model is downloaded
   */
  static async isModelDownloaded(model: ModelId): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    try {
      // Check IndexedDB cache
      const cache = await caches.open('embedding-models');
      const response = await cache.match(MODELS[model].name);
      return !!response;
    } catch {
      return false;
    }
  }

  /**
   * Get all model info (for settings UI)
   */
  static async getModelsStatus(): Promise<ModelInfo[]> {
    const models: ModelInfo[] = [];

    for (const [id, config] of Object.entries(MODELS)) {
      const downloaded = await EdgeEmbeddingService.isModelDownloaded(id as ModelId);

      models.push({
        id,
        name: config.name,
        dimensions: config.dimensions,
        sizeMB: config.sizeMB,
        languages: config.languages,
        recommended: config.recommended,
        mobileOptimized: config.mobileOptimized,
        downloaded,
        downloading: false,
        progress: downloaded ? 100 : 0
      });
    }

    return models;
  }

  /**
   * Check if local embedding is available on this device
   */
  static async isAvailable(): Promise<{ available: boolean; reason?: string }> {
    if (typeof window === 'undefined') {
      return { available: false, reason: 'Server environment' };
    }

    try {
      // Check for WebAssembly support (required for Transformers.js)
      if (typeof WebAssembly !== 'object') {
        return { available: false, reason: 'WebAssembly not supported' };
      }

      // Check for IndexedDB (required for model caching)
      if (!window.indexedDB) {
        return { available: false, reason: 'IndexedDB not supported' };
      }

      // Check for memory (at least 512MB recommended)
      const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
      if (memory && memory < 0.5) {
        return { available: false, reason: 'Insufficient device memory' };
      }

      // Check for WebGPU (optional but faster)
      const hasWebGPU = 'gpu' in navigator;

      return {
        available: true,
        reason: hasWebGPU ? 'WebGPU available (faster)' : 'WebAssembly mode'
      };
    } catch (error) {
      return { available: false, reason: String(error) };
    }
  }

  /**
   * Get supported models info
   */
  static getModels(): typeof MODELS {
    return MODELS;
  }

  /**
   * Get recommended model for current device
   */
  static async getRecommendedModel(): Promise<ModelId> {
    const { available, reason } = await EdgeEmbeddingService.isAvailable();

    if (!available) {
      // Return smallest model for fallback
      return 'all-MiniLM-L6-v2';
    }

    // Check device memory
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory || 4;

    if (memory >= 4) {
      return 'embeddinggemma-300m'; // Best quality
    } else if (memory >= 2) {
      return 'multilingual-e5-small'; // Smaller
    } else {
      return 'all-MiniLM-L6-v2'; // Smallest
    }
  }

  /**
   * Get device info for tracking
   */
  getDeviceInfo(): { deviceId: string; deviceModel: string } {
    return {
      deviceId: this.deviceId,
      deviceModel: this.deviceModel
    };
  }

  private getDeviceId(): string {
    if (typeof window === 'undefined') return 'server';

    // Generate or retrieve device ID from localStorage
    let deviceId = localStorage.getItem('edge_embedding_device_id');
    if (!deviceId) {
      deviceId = crypto.randomUUID();
      localStorage.setItem('edge_embedding_device_id', deviceId);
    }
    return deviceId;
  }

  private getDeviceModel(): string {
    if (typeof window === 'undefined') return 'server';
    if (typeof navigator === 'undefined') return 'unknown';

    const ua = navigator.userAgent;

    // Detect device type
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
    this.pipeline = null;
    this.loadPromise = null;
  }

  /**
   * Delete cached model
   */
  static async deleteCachedModel(model: ModelId): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      const cache = await caches.open('embedding-models');
      await cache.delete(MODELS[model].name);
    } catch (error) {
      console.error('Failed to delete cached model:', error);
    }
  }
}

// Singleton instance
let serviceInstance: EdgeEmbeddingService | null = null;

export function getEdgeEmbeddingService(model?: ModelId, dimensions?: number): EdgeEmbeddingService {
  if (!serviceInstance || (model && model !== serviceInstance['model'])) {
    serviceInstance = new EdgeEmbeddingService(model, dimensions);
  }
  return serviceInstance;
}

/**
 * Process embedding queue from server (for background sync)
 */
export async function processEmbeddingQueue(options?: {
  model?: ModelId;
  limit?: number;
  onProgress?: (job: { id: string; progress: number }) => void;
  onComplete?: (job: { id: string; success: boolean }) => void;
}): Promise<{ processed: number; success: number; failed: number }> {
  const model = options?.model || await EdgeEmbeddingService.getRecommendedModel();
  const service = getEdgeEmbeddingService(model);
  const limit = options?.limit || 10;

  // Fetch pending jobs
  const queueRes = await fetch(`/api/embeddings/queue?limit=${limit}`);
  const { jobs } = await queueRes.json();

  if (!jobs || jobs.length === 0) {
    return { processed: 0, success: 0, failed: 0 };
  }

  let success = 0;
  let failed = 0;

  for (const job of jobs) {
    try {
      options?.onProgress?.({ id: job.id, progress: 0 });

      // Generate embedding
      const result = await service.embed(job.sourceText);

      options?.onProgress?.({ id: job.id, progress: 100 });

      // Upload to server
      const deviceInfo = service.getDeviceInfo();
      const uploadRes = await fetch('/api/embeddings/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: job.id,
          entityType: job.entityType,
          entityId: job.entityId,
          model: result.model,
          vector: result.vector,
          ...deviceInfo
        })
      });

      if (uploadRes.ok) {
        success++;
        options?.onComplete?.({ id: job.id, success: true });
      } else {
        failed++;
        options?.onComplete?.({ id: job.id, success: false });
      }
    } catch (error) {
      console.error(`Failed to process job ${job.id}:`, error);
      failed++;
      options?.onComplete?.({ id: job.id, success: false });
    }
  }

  return {
    processed: jobs.length,
    success,
    failed
  };
}

/**
 * React hook for embedding service (for UI integration)
 */
export function useEdgeEmbedding(model?: ModelId) {
  const [status, setStatus] = React.useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [progress, setProgress] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);

  const serviceRef = React.useRef<EdgeEmbeddingService | null>(null);

  const loadModel = React.useCallback(async () => {
    try {
      setStatus('loading');
      setProgress(0);

      const service = getEdgeEmbeddingService(model);
      serviceRef.current = service;

      await service.load((p) => {
        setProgress(p.progress || 0);
      });

      setStatus('ready');
      setError(null);
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Failed to load model');
    }
  }, [model]);

  const embed = React.useCallback(async (text: string) => {
    if (!serviceRef.current) {
      throw new Error('Model not loaded');
    }
    return serviceRef.current.embed(text);
  }, []);

  return {
    status,
    progress,
    error,
    loadModel,
    embed,
    service: serviceRef.current
  };
}

// Import React for hook
import React from 'react';