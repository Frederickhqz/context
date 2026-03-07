// Edge Embedding Service - Run embedding models on client devices
// Supports multilingual models for global deployment

import type { Pipeline } from '@xenova/transformers';

// Supported models
const MODELS = {
  'multilingual-e5-small': {
    name: 'Xenova/multilingual-e5-small',
    dimensions: 384,
    size: '~120MB',
    languages: '50+ languages including English, Spanish, Chinese, Arabic, etc.',
    recommended: true
  },
  'nomic-embed-text-v1.5': {
    name: 'nomic-ai/nomic-embed-text-v1.5',
    dimensions: 768,
    size: '~275MB',
    languages: 'English-focused, general purpose',
    recommended: false
  },
  'all-MiniLM-L6-v2': {
    name: 'Xenova/all-MiniLM-L6-v2',
    dimensions: 384,
    size: '~80MB',
    languages: 'English only, fast',
    recommended: false
  }
} as const;

type ModelId = keyof typeof MODELS;

interface EmbeddingResult {
  vector: number[];
  model: string;
  dimensions: number;
  processingTimeMs: number;
}

interface ProgressCallback {
  (progress: { status: string; progress?: number; loaded?: number; total?: number }): void;
}

/**
 * Edge Embedding Service - Runs entirely in the browser
 */
export class EdgeEmbeddingService {
  private model: ModelId;
  private pipeline: Pipeline | null = null;
  private loading = false;
  private loadPromise: Promise<void> | null = null;
  private deviceId: string;
  private deviceModel: string;

  constructor(model: ModelId = 'multilingual-e5-small') {
    this.model = model;
    this.deviceId = this.getDeviceId();
    this.deviceModel = this.getDeviceModel();
  }

  /**
   * Load the embedding model
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

    // Configure for browser
    env.allowLocalModels = false;
    env.useBrowserCache = true;

    const modelConfig = MODELS[this.model];

    onProgress?.({ status: 'loading', progress: 0 });

    this.pipeline = await pipeline(
      'feature-extraction',
      modelConfig.name,
      {
        progress_callback: (progress: { status: string; progress?: number }) => {
          onProgress?.({
            status: progress.status,
            progress: progress.progress
          });
        }
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

    // For E5 models, prepend query prefix for better retrieval
    const processedText = this.model.startsWith('multilingual-e5')
      ? `query: ${text}`
      : text;

    const result = await this.pipeline(processedText, {
      pooling: 'mean',
      normalize: true
    });

    const processingTimeMs = performance.now() - startTime;

    // Convert tensor to array
    const vector = Array.from(result.data as Float32Array);

    return {
      vector,
      model: this.model,
      dimensions: MODELS[this.model].dimensions,
      processingTimeMs
    };
  }

  /**
   * Generate embeddings for multiple texts
   */
  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];

    for (const text of texts) {
      const result = await this.embed(text);
      results.push(result);
    }

    return results;
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
   * Check if local embedding is available
   */
  static async isAvailable(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    try {
      // Check for WebAssembly support (required for Transformers.js)
      if (typeof WebAssembly !== 'object') return false;

      // Check for enough memory (at least 512MB recommended)
      const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
      if (memory && memory < 0.5) return false;

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get supported models
   */
  static getModels(): typeof MODELS {
    return MODELS;
  }

  /**
   * Unload model to free memory
   */
  unload(): void {
    this.pipeline = null;
    this.loadPromise = null;
  }
}

// Singleton instance
let serviceInstance: EdgeEmbeddingService | null = null;

export function getEdgeEmbeddingService(model?: ModelId): EdgeEmbeddingService {
  if (!serviceInstance || (model && model !== serviceInstance['model'])) {
    serviceInstance = new EdgeEmbeddingService(model);
  }
  return serviceInstance;
}

/**
 * Process embedding queue from server
 */
export async function processEmbeddingQueue(options?: {
  model?: ModelId;
  limit?: number;
  onProgress?: (job: { id: string; progress: number }) => void;
  onComplete?: (job: { id: string; success: boolean }) => void;
}): Promise<{ processed: number; success: number; failed: number }> {
  const service = getEdgeEmbeddingService(options?.model);
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