'use client';

import { useState, useCallback } from 'react';
import { ExtractedBeat, BeatType, BEAT_TYPE_CONFIG } from '@/lib/beats/types';

// ============ Types ============

interface BeatExtractionPanelProps {
  noteId: string;
  noteContent: string;
  onBeatsExtracted?: (beats: ExtractedBeat[]) => void;
  onBeatCreated?: (beat: ExtractedBeat) => void;
}

// ============ Component ============

export function BeatExtractionPanel({
  noteId,
  noteContent,
  onBeatsExtracted,
  onBeatCreated
}: BeatExtractionPanelProps) {
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedBeats, setExtractedBeats] = useState<ExtractedBeat[]>([]);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedBeats, setSelectedBeats] = useState<Set<string>>(new Set());
  
  // Extract beats from note
  const handleExtract = useCallback(async () => {
    setIsExtracting(true);
    setProgress(0);
    setError(null);
    
    try {
      // Call extraction API
      const response = await fetch(`/api/notes/${noteId}/beats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'cloud' })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Extraction failed');
      }
      
      const data = await response.json();
      setExtractedBeats(data.beats || []);
      setProgress(100);
      
      if (onBeatsExtracted) {
        onBeatsExtracted(data.beats || []);
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsExtracting(false);
    }
  }, [noteId, onBeatsExtracted]);
  
  // Toggle beat selection
  const toggleBeat = (beatName: string) => {
    setSelectedBeats(prev => {
      const next = new Set(prev);
      if (next.has(beatName)) {
        next.delete(beatName);
      } else {
        next.add(beatName);
      }
      return next;
    });
  };
  
  // Create selected beats
  const handleCreateSelected = async () => {
    const beatsToCreate = extractedBeats.filter(b => selectedBeats.has(b.name));
    
    for (const beat of beatsToCreate) {
      try {
        await fetch('/api/beats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            beatType: beat.type,
            name: beat.name,
            summary: beat.summary,
            intensity: beat.intensity,
            valence: beat.valence,
            noteId,
            source: 'AUTO'
          })
        });
        
        if (onBeatCreated) {
          onBeatCreated(beat);
        }
      } catch (err) {
        console.error('Failed to create beat:', err);
      }
    }
    
    // Clear extraction
    setExtractedBeats([]);
    setSelectedBeats(new Set());
  };
  
  return (
    <div className="beat-extraction-panel bg-gray-900 rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium">Extract Beats</h3>
        
        {!extractedBeats.length && (
          <button
            onClick={handleExtract}
            disabled={isExtracting || !noteContent}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded text-sm"
          >
            {isExtracting ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin">⏳</span>
                Extracting...
              </span>
            ) : (
              'Extract Beats'
            )}
          </button>
        )}
      </div>
      
      {/* Progress */}
      {isExtracting && (
        <div className="mb-4">
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Analyzing text for beats...
          </p>
        </div>
      )}
      
      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/50 rounded text-red-300 text-sm">
          {error}
        </div>
      )}
      
      {/* Extracted beats */}
      {extractedBeats.length > 0 && (
        <div>
          <p className="text-sm text-gray-400 mb-3">
            Found {extractedBeats.length} beat{extractedBeats.length !== 1 && 's'}.
            Select the ones to create:
          </p>
          
          <div className="space-y-2 max-h-80 overflow-y-auto mb-4">
            {extractedBeats.map((beat, index) => {
              const config = BEAT_TYPE_CONFIG[beat.type];
              const isSelected = selectedBeats.has(beat.name);
              
              return (
                <button
                  key={index}
                  onClick={() => toggleBeat(beat.name)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    isSelected
                      ? 'bg-blue-900/50 border-blue-500'
                      : 'bg-gray-800 hover:bg-gray-700 border-transparent'
                  } border`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className="px-2 py-0.5 rounded text-xs"
                      style={{ backgroundColor: config?.color }}
                    >
                      {config?.label}
                    </div>
                    <span className="font-medium">{beat.name}</span>
                  </div>
                  
                  {beat.summary && (
                    <p className="text-sm text-gray-400 mb-2">{beat.summary}</p>
                  )}
                  
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>Intensity: {(beat.intensity * 100).toFixed(0)}%</span>
                    <span>
                      Valence: {beat.valence > 0 ? '+' : ''}{(beat.valence * 100).toFixed(0)}
                    </span>
                    <span>Confidence: {(beat.confidence * 100).toFixed(0)}%</span>
                  </div>
                  
                  {beat.connections && beat.connections.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {beat.connections.slice(0, 3).map((conn, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 bg-gray-700 rounded text-xs"
                        >
                          {conn.type}: {conn.toBeatName}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          
          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleCreateSelected}
              disabled={selectedBeats.size === 0}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded text-sm"
            >
              Create {selectedBeats.size || ''} Beat{selectedBeats.size !== 1 && 's'}
            </button>
            <button
              onClick={() => {
                setExtractedBeats([]);
                setSelectedBeats(new Set());
              }}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      
      {/* Empty state */}
      {!isExtracting && !extractedBeats.length && !error && (
        <p className="text-sm text-gray-500">
          Click "Extract Beats" to analyze this note and discover
          characters, themes, events, and other story elements.
        </p>
      )}
    </div>
  );
}

export default BeatExtractionPanel;