'use client';

import { BeatUniverse } from '@/components/universe/BeatUniverse';
import { useBeatMesh } from '@/lib/beats/hooks';
import type { BeatNode } from '@/lib/beats/types';
import { useState } from 'react';

export default function UniversePage() {
  const { mesh, loading, error, refetch } = useBeatMesh();
  const [showLabels, setShowLabels] = useState(true);
  const [showConnections, setShowConnections] = useState(true);
  const [colorMode, setColorMode] = useState<'type' | 'intensity' | 'valence'>('type');
  const [selectedBeat, setSelectedBeat] = useState<BeatNode | null>(null);
  
  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Beat Universe</h1>
            <p className="text-sm text-gray-400">
              Gravitational visualization of concept relationships
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Controls */}
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={showLabels}
                  onChange={(e) => setShowLabels(e.target.checked)}
                  className="rounded"
                />
                Labels
              </label>
              
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={showConnections}
                  onChange={(e) => setShowConnections(e.target.checked)}
                  className="rounded"
                />
                Connections
              </label>
            </div>
            
            {/* Color mode */}
            <select
              value={colorMode}
              onChange={(e) => setColorMode(e.target.value as typeof colorMode)}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm"
            >
              <option value="type">Color by Type</option>
              <option value="intensity">Color by Intensity</option>
              <option value="valence">Color by Valence</option>
            </select>
            
            {/* Refresh */}
            <button
              onClick={() => refetch()}
              disabled={loading}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-sm"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>
      </header>
      
      {/* Main content */}
      <div className="flex-1 relative">
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <div className="text-center">
              <p className="text-red-400 mb-4">{error.message}</p>
              <button
                onClick={() => refetch()}
                className="px-4 py-2 bg-blue-600 rounded"
              >
                Retry
              </button>
            </div>
          </div>
        )}
        
        {loading && !mesh && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-gray-400">Loading universe...</p>
            </div>
          </div>
        )}
        
        {mesh && mesh.nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <div className="text-center">
              <p className="text-gray-400 mb-4">No beats found</p>
              <p className="text-sm text-gray-500">
                Create notes and extract beats to see your universe
              </p>
            </div>
          </div>
        )}
        
        {mesh && mesh.nodes.length > 0 && (
          <BeatUniverse
            mesh={mesh}
            onBeatSelect={(beat) => setSelectedBeat(beat)}
            showLabels={showLabels}
            showConnections={showConnections}
            colorMode={colorMode}
          />
        )}
        
        {/* Selected beat info */}
        {selectedBeat && (
          <div className="absolute top-4 right-4 w-64 bg-black/80 rounded-lg p-4 border border-gray-700">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs text-gray-400 uppercase">{selectedBeat.type}</div>
                <h3 className="font-bold">{selectedBeat.name}</h3>
              </div>
              <button
                onClick={() => setSelectedBeat(null)}
                className="text-gray-400 hover:text-white"
              >
                ×
              </button>
            </div>
            
            {selectedBeat.summary && (
              <p className="text-sm text-gray-300 mt-2">{selectedBeat.summary}</p>
            )}
            
            <div className="flex gap-4 mt-3 text-xs text-gray-400">
              <span>Intensity: {(selectedBeat.intensity * 100).toFixed(0)}%</span>
              {selectedBeat.valence !== undefined && (
                <span>Valence: {selectedBeat.valence.toFixed(2)}</span>
              )}
              {selectedBeat.frequency > 1 && (
                <span>Frequency: {selectedBeat.frequency}</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}