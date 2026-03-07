// Client-side Beat Extraction Hook
// Uses WebLLM (edge) when available, falls back to cloud API

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { getEdgeExtractionService, EdgeExtractionService, type ModelId } from './edge-service';
import type { ExtractedBeat } from '../beats/types';

export type ExtractionMode = 'auto' | 'edge' | 'cloud';

interface UseBeatExtractionOptions {
  mode?: ExtractionMode;
  model?: ModelId;
  noteId?: string;
  onSuccess?: (beats: ExtractedBeat[]) => void;
  onError?: (error: Error) => void;
}

interface UseBeatExtractionResult {
  // State
  status: 'idle' | 'checking' | 'loading-model' | 'ready' | 'extracting' | 'success' | 'error';
  progress: number;
  progressText: string;
  error: string | null;
  beats: ExtractedBeat[];
  
  // Model info
  edgeAvailable: boolean | null;
  currentModel: ModelId | null;
  modelDownloadProgress: number;
  
  // Actions
  checkEdgeAvailability: () => Promise<void>;
  loadModel: () => Promise<void>;
  extract: (text: string) => Promise<ExtractedBeat[]>;
  extractFromNote: (noteId: string) => Promise<ExtractedBeat[]>;
  reset: () => void;
  unloadModel: () => void;
}

/**
 * Hook for client-side beat extraction
 * Handles edge/cloud switching automatically
 */
export function useBeatExtraction(options: UseBeatExtractionOptions = {}): UseBeatExtractionResult {
  const {
    mode = 'auto',
    model = 'gemma-3-1b',
    noteId: defaultNoteId,
    onSuccess,
    onError
  } = options;
  
  // State
  const [status, setStatus] = useState<'idle' | 'checking' | 'loading-model' | 'ready' | 'extracting' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [beats, setBeats] = useState<ExtractedBeat[]>([]);
  
  // Edge availability
  const [edgeAvailable, setEdgeAvailable] = useState<boolean | null>(null);
  const [currentModel, setCurrentModel] = useState<ModelId | null>(null);
  const [modelDownloadProgress, setModelDownloadProgress] = useState(0);
  
  // Service reference
  const serviceRef = useRef<EdgeExtractionService | null>(null);
  
  // Check if edge extraction is available
  const checkEdgeAvailability = useCallback(async () => {
    setStatus('checking');
    try {
      const result = await EdgeExtractionService.isAvailable();
      setEdgeAvailable(result.available);
      if (result.recommendedModel) {
        setCurrentModel(result.recommendedModel as ModelId);
      }
      setStatus('idle');
    } catch (err) {
      setEdgeAvailable(false);
      setStatus('idle');
    }
  }, []);
  
  // Check on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      checkEdgeAvailability();
    }
  }, [checkEdgeAvailability]);
  
  // Load model for edge extraction
  const loadModel = useCallback(async () => {
    if (!edgeAvailable) {
      setError('Edge extraction not available on this device');
      return;
    }
    
    setStatus('loading-model');
    setProgress(0);
    setProgressText('Initializing...');
    setModelDownloadProgress(0);
    
    try {
      const service = getEdgeExtractionService(model);
      serviceRef.current = service;
      
      await service.load((p) => {
        const pct = p.progress || 0;
        setProgress(pct);
        setProgressText(p.status || 'Loading...');
        setModelDownloadProgress(pct);
      });
      
      setCurrentModel(model);
      setStatus('ready');
      setProgress(100);
      setProgressText('Model ready');
      setError(null);
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Failed to load model');
      if (onError) onError(err instanceof Error ? err : new Error('Unknown error'));
    }
  }, [edgeAvailable, model, onError]);
  
  // Extract beats from text
  const extract = useCallback(async (text: string): Promise<ExtractedBeat[]> => {
    // Determine extraction mode
    const useEdge = mode === 'edge' || (mode === 'auto' && edgeAvailable);
    
    if (useEdge && edgeAvailable) {
      // Edge extraction
      if (!serviceRef.current || status !== 'ready') {
        await loadModel();
      }
      
      if (!serviceRef.current) {
        throw new Error('Model not loaded');
      }
      
      setStatus('extracting');
      setProgress(0);
      setProgressText('Extracting beats...');
      
      try {
        const result = await serviceRef.current.extract(text, (p) => {
          setProgress(p.progress || 0);
          setProgressText(p.status || 'Extracting...');
        });
        
        setBeats(result.beats);
        setStatus('success');
        setProgress(100);
        setProgressText(`Extracted ${result.beats.length} beats`);
        
        if (onSuccess) onSuccess(result.beats);
        
        return result.beats;
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Extraction failed');
        if (onError) onError(err instanceof Error ? err : new Error('Unknown error'));
        throw err;
      }
    } else {
      // Cloud extraction via API
      setStatus('extracting');
      setProgress(0);
      setProgressText('Connecting to cloud...');
      
      try {
        const response = await fetch('/api/beats/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, model: 'cloud' })
        });
        
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Cloud extraction failed');
        }
        
        setProgress(50);
        setProgressText('Processing...');
        
        const data = await response.json();
        setBeats(data.beats);
        setStatus('success');
        setProgress(100);
        setProgressText(`Extracted ${data.beats.length} beats`);
        
        if (onSuccess) onSuccess(data.beats);
        
        return data.beats;
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Extraction failed');
        if (onError) onError(err instanceof Error ? err : new Error('Unknown error'));
        throw err;
      }
    }
  }, [mode, edgeAvailable, status, loadModel, onSuccess, onError]);
  
  // Extract from note via API
  const extractFromNote = useCallback(async (noteId: string): Promise<ExtractedBeat[]> => {
    setStatus('extracting');
    setProgress(0);
    setProgressText('Extracting from note...');
    
    try {
      const response = await fetch(`/api/notes/${noteId}/beats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: mode === 'edge' ? 'edge' : 'cloud' })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Extraction failed');
      }
      
      setProgress(50);
      
      const data = await response.json();
      setBeats(data.beats);
      setStatus('success');
      setProgress(100);
      setProgressText(`Extracted ${data.beats.length} beats`);
      
      if (onSuccess) onSuccess(data.beats);
      
      return data.beats;
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Extraction failed');
      if (onError) onError(err instanceof Error ? err : new Error('Unknown error'));
      throw err;
    }
  }, [mode, onSuccess, onError]);
  
  // Reset state
  const reset = useCallback(() => {
    setStatus('idle');
    setProgress(0);
    setProgressText('');
    setError(null);
    setBeats([]);
  }, []);
  
  // Unload model
  const unloadModel = useCallback(() => {
    if (serviceRef.current) {
      serviceRef.current.unload();
      serviceRef.current = null;
      setCurrentModel(null);
      setStatus('idle');
      setProgress(0);
    }
  }, []);
  
  return {
    status,
    progress,
    progressText,
    error,
    beats,
    edgeAvailable,
    currentModel,
    modelDownloadProgress,
    checkEdgeAvailability,
    loadModel,
    extract,
    extractFromNote,
    reset,
    unloadModel,
  };
}

export default useBeatExtraction;