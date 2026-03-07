'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  EdgeEmbeddingService,
  getEdgeEmbeddingService
} from '@/lib/embeddings/edge';

// Re-export ModelId type
type ModelId = 'embeddinggemma-300m' | 'multilingual-e5-small' | 'qwen3-embedding-0.6b' | 'nomic-embed-text-v1.5' | 'all-MiniLM-L6-v2';

interface ModelStatus {
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

/**
 * Settings component for managing embedding models
 * 
 * Shows:
 * - Available models (size, languages, quality)
 * - Download status (downloaded/downloading)
 * - Progress bars for downloads
 * - Delete cached models
 * - Device compatibility info
 */
export function EmbeddingModelSettings() {
  const [models, setModels] = useState<ModelStatus[]>([]);
  const [selectedModel, setSelectedModel] = useState<ModelId>('embeddinggemma-300m');
  const [loading, setLoading] = useState(true);
  const [downloadingModel, setDownloadingModel] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [deviceInfo, setDeviceInfo] = useState<{
    available: boolean;
    reason?: string;
    memory?: number;
  } | null>(null);

  // Load model status on mount
  useEffect(() => {
    loadModelStatus();
    checkDeviceAvailability();
  }, []);

  const loadModelStatus = async () => {
    setLoading(true);
    try {
      const status = await EdgeEmbeddingService.getModelsStatus();
      setModels(status as ModelStatus[]);
    } catch (error) {
      console.error('Failed to load model status:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkDeviceAvailability = async () => {
    const result = await EdgeEmbeddingService.isAvailable();
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    setDeviceInfo({
      ...result,
      memory
    });
  };

  const handleDownloadModel = useCallback(async (modelId: ModelId) => {
    setDownloadingModel(modelId);
    setDownloadProgress(0);

    try {
      const service = getEdgeEmbeddingService(modelId);
      
      await service.load((progress) => {
        setDownloadProgress(progress.progress || 0);
      });

      // Refresh status
      await loadModelStatus();
    } catch (error) {
      console.error('Failed to download model:', error);
    } finally {
      setDownloadingModel(null);
      setDownloadProgress(0);
    }
  }, []);

  const handleDeleteModel = useCallback(async (modelId: ModelId) => {
    try {
      await EdgeEmbeddingService.deleteCachedModel(modelId);
      await loadModelStatus();
    } catch (error) {
      console.error('Failed to delete model:', error);
    }
  }, []);

  const handleSelectModel = useCallback((modelId: ModelId) => {
    setSelectedModel(modelId);
    // Persist selection to localStorage
    localStorage.setItem('embedding_model', modelId);
  }, []);

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-4 py-1">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Device Info */}
      {deviceInfo && (
        <div className="rounded-lg border p-4 bg-muted/50">
          <h3 className="font-medium mb-2">Device Compatibility</h3>
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${deviceInfo.available ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm">
              {deviceInfo.available 
                ? deviceInfo.reason 
                : `Not available: ${deviceInfo.reason}`}
            </span>
          </div>
          {deviceInfo.memory && (
            <p className="text-sm text-muted-foreground mt-1">
              Device memory: {deviceInfo.memory}GB
            </p>
          )}
        </div>
      )}

      {/* Model List */}
      <div className="space-y-4">
        <h3 className="font-medium">Embedding Models</h3>
        
        {models.map((model) => (
          <div
            key={model.id}
            className={`rounded-lg border p-4 ${
              selectedModel === model.id ? 'border-primary' : ''
            } ${model.recommended ? 'bg-primary/5' : ''}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">{model.id}</h4>
                  {model.recommended && (
                    <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
                      Recommended
                    </span>
                  )}
                  {model.mobileOptimized && (
                    <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded">
                      Mobile
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {model.languages}
                </p>
                <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                  <span>{model.sizeMB}MB</span>
                  <span>{model.dimensions}d</span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                {/* Selection indicator */}
                {model.downloaded && (
                  <button
                    onClick={() => handleSelectModel(model.id as ModelId)}
                    className={`px-3 py-1 text-sm rounded ${
                      selectedModel === model.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground'
                    }`}
                  >
                    {selectedModel === model.id ? 'Active' : 'Select'}
                  </button>
                )}

                {/* Download/Delete buttons */}
                {downloadingModel === model.id ? (
                  <div className="w-full max-w-[120px]">
                    <div className="h-2 bg-muted rounded overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${downloadProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 text-center">
                      {Math.round(downloadProgress)}%
                    </p>
                  </div>
                ) : model.downloaded ? (
                  <button
                    onClick={() => handleDeleteModel(model.id as ModelId)}
                    className="text-xs text-destructive hover:underline"
                  >
                    Delete
                  </button>
                ) : (
                  <button
                    onClick={() => handleDownloadModel(model.id as ModelId)}
                    disabled={!!downloadingModel}
                    className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
                  >
                    Download
                  </button>
                )}
              </div>
            </div>

            {/* Download progress bar */}
            {downloadingModel === model.id && (
              <div className="mt-4">
                <div className="h-2 bg-muted rounded overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${downloadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Info */}
      <div className="text-xs text-muted-foreground">
        <p>
          Models are downloaded once and cached locally.
          Embedding happens on-device for privacy.
        </p>
        <p className="mt-1">
          Recommended: EmbeddingGemma-300M for best multilingual quality.
        </p>
      </div>
    </div>
  );
}

/**
 * Hook for managing embedding model in components
 */
export function useEmbeddingModel() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [model, setModel] = useState<ModelId | null>(null);

  // Load saved model preference on mount
  useEffect(() => {
    const savedModel = localStorage.getItem('embedding_model') as ModelId | null;
    if (savedModel) {
      setModel(savedModel);
    }
  }, []);

  const loadModel = useCallback(async (modelId?: ModelId) => {
    const targetModel = modelId || model || await EdgeEmbeddingService.getRecommendedModel();
    
    setStatus('loading');
    setProgress(0);

    try {
      const service = getEdgeEmbeddingService(targetModel);
      await service.load((p) => {
        setProgress(p.progress || 0);
      });

      setModel(targetModel);
      localStorage.setItem('embedding_model', targetModel);
      setStatus('ready');
    } catch (error) {
      console.error('Failed to load model:', error);
      setStatus('error');
    }
  }, [model]);

  const embed = useCallback(async (text: string) => {
    if (status !== 'ready' || !model) {
      throw new Error('Model not ready');
    }

    const service = getEdgeEmbeddingService(model);
    return service.embed(text);
  }, [status, model]);

  return {
    status,
    progress,
    model,
    loadModel,
    embed,
    isReady: status === 'ready'
  };
}

export default EmbeddingModelSettings;