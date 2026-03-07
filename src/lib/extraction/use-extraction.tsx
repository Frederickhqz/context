'use client';

import { useState, useCallback, useRef } from 'react';
import {
  EdgeExtractionService,
  getEdgeExtractionService,
  type ModelId
} from './edge-service';

// Re-export ModelId for convenience
export type { ModelId };

/**
 * React hook for extraction service (client-side only)
 */
export function useEdgeExtraction(model?: ModelId) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'extracting' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const serviceRef = useRef<EdgeExtractionService | null>(null);

  const loadModel = useCallback(async () => {
    try {
      setStatus('loading');
      setProgress(0);

      const service = getEdgeExtractionService(model);
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

  const extract = useCallback(async (text: string) => {
    if (!serviceRef.current) {
      throw new Error('Model not loaded');
    }

    setStatus('extracting');
    setProgress(0);

    try {
      const result = await serviceRef.current.extract(text, (p) => {
        setProgress(p.progress || 0);
      });

      setStatus('ready');
      return result;
    } catch (err) {
      setStatus('error');
      throw err;
    }
  }, []);

  return {
    status,
    progress,
    error,
    loadModel,
    extract,
    service: serviceRef.current
  };
}