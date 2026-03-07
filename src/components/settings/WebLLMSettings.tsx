'use client';

import { useState, useEffect, useCallback } from 'react';
import { useBeatExtraction, type ExtractionMode } from '@/lib/extraction/use-beat-extraction';
import { EXTRACTION_MODELS, type ExtractionModelId } from '@/lib/beats/config';

interface ModelStatus {
  id: ExtractionModelId;
  displayName: string;
  size: string;
  contextLength: number;
  multimodal: boolean;
  recommended: boolean;
  description: string;
  downloaded: boolean;
  downloading: boolean;
  progress: number;
}

// Convert config to model status
function getModelStatus(): ModelStatus[] {
  return Object.entries(EXTRACTION_MODELS).map(([id, config]) => ({
    id: id as ExtractionModelId,
    displayName: config.displayName || id,
    size: config.size || 'Unknown',
    contextLength: config.contextLength || 32000,
    multimodal: (config.capabilities as readonly string[] | undefined)?.some(c => c === 'vision') || false,
    recommended: config.recommended || false,
    description: config.description || '',
    downloaded: false, // Would need to check IndexedDB
    downloading: false,
    progress: 0,
  }));
}

export function WebLLMSettings() {
  const [models, setModels] = useState<ModelStatus[]>([]);
  const [selectedModel, setSelectedModel] = useState<ExtractionModelId>('gemma-3-1b');
  const [extractionMode, setExtractionMode] = useState<ExtractionMode>('auto');
  
  const {
    status,
    progress,
    progressText,
    error,
    edgeAvailable,
    currentModel,
    modelDownloadProgress,
    loadModel,
    unloadModel,
    reset,
  } = useBeatExtraction({
    model: selectedModel,
    mode: extractionMode,
  });
  
  useEffect(() => {
    setModels(getModelStatus());
  }, []);
  
  const handleLoadModel = async () => {
    if (status === 'loading-model') return;
    await loadModel();
  };
  
  const handleUnloadModel = () => {
    unloadModel();
  };
  
  const handleModeChange = (mode: ExtractionMode) => {
    setExtractionMode(mode);
    reset();
  };
  
  const formatSize = (size: string) => {
    return size.replace('~', '');
  };
  
  return (
    <div className="space-y-6">
      {/* Extraction Mode */}
      <div>
        <h3 className="text-lg font-medium mb-3">Extraction Mode</h3>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="extractionMode"
              value="auto"
              checked={extractionMode === 'auto'}
              onChange={() => handleModeChange('auto')}
              className="text-blue-500"
            />
            <span>Auto</span>
            <span className="text-xs text-gray-400">(Edge when available, fallback to cloud)</span>
          </label>
          
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="extractionMode"
              value="edge"
              checked={extractionMode === 'edge'}
              onChange={() => handleModeChange('edge')}
              className="text-blue-500"
            />
            <span>Edge Only</span>
            <span className="text-xs text-gray-400">(On-device, may need download)</span>
          </label>
          
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="extractionMode"
              value="cloud"
              checked={extractionMode === 'cloud'}
              onChange={() => handleModeChange('cloud')}
              className="text-blue-500"
            />
            <span>Cloud Only</span>
            <span className="text-xs text-gray-400">(Always use server)</span>
          </label>
        </div>
      </div>
      
      {/* Edge Availability */}
      <div className="p-4 rounded-lg bg-gray-800">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-medium">On-Device AI Status</h4>
          <span className={`px-2 py-1 rounded text-xs ${
            edgeAvailable === null ? 'bg-gray-600' :
            edgeAvailable ? 'bg-green-600' : 'bg-red-600'
          }`}>
            {edgeAvailable === null ? 'Checking...' :
             edgeAvailable ? 'Available' : 'Not Available'}
          </span>
        </div>
        
        {edgeAvailable === false && (
          <p className="text-sm text-gray-400">
            WebGPU is required for on-device AI. Your browser or device doesn&apos;t support it.
            Cloud extraction will be used instead.
          </p>
        )}
        
        {edgeAvailable && (
          <p className="text-sm text-gray-400">
            Your device supports on-device AI. Models will run locally for privacy-first processing.
          </p>
        )}
      </div>
      
      {/* Model Selection */}
      {edgeAvailable && (
        <div>
          <h3 className="text-lg font-medium mb-3">Model Selection</h3>
          <div className="grid gap-3">
            {models.map((model) => (
              <div
                key={model.id}
                className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                  selectedModel === model.id
                    ? 'border-blue-500 bg-blue-900/20'
                    : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                }`}
                onClick={() => setSelectedModel(model.id)}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{model.displayName}</span>
                    {model.recommended && (
                      <span className="px-2 py-0.5 bg-blue-600 rounded text-xs">Recommended</span>
                    )}
                  </div>
                  <span className="text-sm text-gray-400">{formatSize(model.size)}</span>
                </div>
                <p className="text-sm text-gray-400">{model.description}</p>
                <div className="flex gap-4 mt-2 text-xs text-gray-500">
                  <span>{(model.contextLength / 1000).toFixed(0)}K context</span>
                  {model.multimodal && <span>Multimodal</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Model Loading */}
      {edgeAvailable && (
        <div>
          <h3 className="text-lg font-medium mb-3">Model Status</h3>
          
          <div className="p-4 rounded-lg bg-gray-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium">Current Model: </span>
                <span className="text-gray-400">
                  {currentModel 
                    ? EXTRACTION_MODELS[currentModel]?.displayName || currentModel
                    : 'None'}
                </span>
              </div>
              <div className="flex gap-2">
                {status === 'ready' && (
                  <button
                    onClick={handleUnloadModel}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
                  >
                    Unload
                  </button>
                )}
                
                {(status === 'idle' || status === 'error') && (
                  <button
                    onClick={handleLoadModel}
                    disabled={false}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded text-sm"
                  >
                    Load Model
                  </button>
                )}
                {status === 'loading-model' && (
                  <button
                    disabled
                    className="px-3 py-1 bg-gray-600 rounded text-sm cursor-not-allowed"
                  >
                    Loading...
                  </button>
                )}
              </div>
            </div>
            
            {/* Progress bar for loading */}
            {(status === 'loading-model' || status === 'extracting') && (
              <div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">{progressText}</p>
              </div>
            )}
            
            {/* Status indicator */}
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                status === 'ready' ? 'bg-green-500' :
                status === 'loading-model' ? 'bg-yellow-500' :
                status === 'extracting' ? 'bg-blue-500' :
                status === 'error' ? 'bg-red-500' :
                'bg-gray-500'
              }`} />
              <span className="text-sm capitalize">{status.replace('-', ' ')}</span>
            </div>
            
            {/* Error display */}
            {error && (
              <div className="p-3 bg-red-900/50 rounded text-sm text-red-300">
                {error}
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Cloud Settings */}
      <div>
        <h3 className="text-lg font-medium mb-3">Cloud Extraction</h3>
        <div className="p-4 rounded-lg bg-gray-800">
          <p className="text-sm text-gray-400 mb-2">
            Cloud extraction uses the Ollama server for processing when edge is unavailable.
          </p>
          <div className="text-xs text-gray-500">
            <span>Server: </span>
            <code className="bg-gray-700 px-1 rounded">
              {process.env.NODE_ENV === 'development' ? 'localhost:11434' : 'ollama-ivie-ollama-1:11434'}
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WebLLMSettings;