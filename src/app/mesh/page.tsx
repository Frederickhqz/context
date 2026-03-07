'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useBeatMesh, useBeatStats } from '@/lib/beats/hooks';
import { BeatType, BeatConnectionType, BEAT_TYPE_CONFIG, CONNECTION_TYPE_CONFIG } from '@/lib/beats/types';

// Dynamic imports for SSR-safe loading
const BeatMesh3D = dynamic(
  () => import('@/components/mesh/BeatMesh3D').then(mod => ({ default: mod.BeatMesh3D })),
  { 
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 flex items-center justify-center bg-gray-950">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 rounded-full border-t-transparent mx-auto mb-2" />
          <p className="text-gray-400">Loading 3D viewer...</p>
        </div>
      </div>
    )
  }
);

const BeatMesh3DMobile = dynamic(
  () => import('@/components/mesh/BeatMeshMobile').then(mod => ({ default: mod.BeatMesh3DMobile })),
  { 
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 flex items-center justify-center bg-gray-950">
        <p className="text-gray-400">Loading 3D viewer...</p>
      </div>
    )
  }
);

const BeatMesh2D = dynamic(
  () => import('@/components/mesh/BeatMesh3D').then(mod => ({ default: mod.BeatMesh2D })),
  { 
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 flex items-center justify-center bg-gray-950">
        <p className="text-gray-400">Loading 2D viewer...</p>
      </div>
    )
  }
);

// ============ Main Page ============

export default function MeshPage() {
  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d');
  const [selectedBeatId, setSelectedBeatId] = useState<string | null>(null);
  const [hoveredBeatId, setHoveredBeatId] = useState<string | null>(null);
  
  // Filters
  const [selectedTypes, setSelectedTypes] = useState<BeatType[]>([]);
  const [selectedConnectionTypes, setSelectedConnectionTypes] = useState<BeatConnectionType[]>([]);
  const [intensityRange, setIntensityRange] = useState<[number, number]>([0, 1]);
  const [showContradictions, setShowContradictions] = useState(true);
  
  // Fetch mesh data
  const { mesh, loading, error, refetch } = useBeatMesh({
    types: selectedTypes.length > 0 ? selectedTypes : undefined,
    connectionTypes: selectedConnectionTypes.length > 0 ? selectedConnectionTypes : undefined,
    minIntensity: intensityRange[0],
    maxIntensity: intensityRange[1],
    showContradictions,
  });
  
  // Stats
  const stats = useBeatStats(mesh);
  
  // Toggle type filter
  const toggleType = (type: BeatType) => {
    setSelectedTypes(prev => 
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };
  
  // Toggle connection type filter
  const toggleConnectionType = (type: BeatConnectionType) => {
    setSelectedConnectionTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };
  
  return (
    <div className="h-screen flex flex-col bg-gray-950 text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div>
          <h1 className="text-xl font-bold">Beat Mesh</h1>
          {stats && (
            <p className="text-sm text-gray-400">
              {stats.totalBeats} beats • {stats.totalConnections} connections
              {stats.contradictions > 0 && ` • ${stats.contradictions} contradictions`}
            </p>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('3d')}
              className={`px-3 py-1 rounded text-sm ${
                viewMode === '3d' ? 'bg-blue-600' : 'text-gray-400'
              }`}
            >
              3D
            </button>
            <button
              onClick={() => setViewMode('2d')}
              className={`px-3 py-1 rounded text-sm ${
                viewMode === '2d' ? 'bg-blue-600' : 'text-gray-400'
              }`}
            >
              2D
            </button>
          </div>
          
          {/* Refresh */}
          <button
            onClick={() => refetch()}
            className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-sm"
          >
            Refresh
          </button>
        </div>
      </header>
      
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Filters */}
        <aside className="w-64 border-r border-gray-800 overflow-y-auto p-4">
          {/* Beat Types */}
          <div className="mb-6">
            <h3 className="text-sm font-medium mb-2 text-gray-400">Beat Types</h3>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {Object.entries(BEAT_TYPE_CONFIG)
                .filter(([type]) => stats?.typeCounts[type as BeatType])
                .sort((a, b) => (stats?.typeCounts[b[0] as BeatType] || 0) - (stats?.typeCounts[a[0] as BeatType] || 0))
                .map(([type, config]) => (
                  <button
                    key={type}
                    onClick={() => toggleType(type as BeatType)}
                    className={`w-full flex items-center gap-2 px-2 py-1 rounded text-sm ${
                      selectedTypes.includes(type as BeatType)
                        ? 'bg-gray-700'
                        : 'hover:bg-gray-800'
                    }`}
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: config.color }}
                    />
                    <span className="flex-1 text-left">{config.label}</span>
                    <span className="text-gray-500">
                      {stats?.typeCounts[type as BeatType] || 0}
                    </span>
                  </button>
                ))}
            </div>
          </div>
          
          {/* Connection Types */}
          <div className="mb-6">
            <h3 className="text-sm font-medium mb-2 text-gray-400">Connections</h3>
            <div className="space-y-1">
              {Object.entries(CONNECTION_TYPE_CONFIG)
                .filter(([type]) => stats?.connectionCounts[type as BeatConnectionType])
                .sort((a, b) => (stats?.connectionCounts[b[0] as BeatConnectionType] || 0) - (stats?.connectionCounts[a[0] as BeatConnectionType] || 0))
                .slice(0, 8)
                .map(([type, config]) => (
                  <button
                    key={type}
                    onClick={() => toggleConnectionType(type as BeatConnectionType)}
                    className={`w-full flex items-center gap-2 px-2 py-1 rounded text-sm ${
                      selectedConnectionTypes.includes(type as BeatConnectionType)
                        ? 'bg-gray-700'
                        : 'hover:bg-gray-800'
                    }`}
                  >
                    <div
                      className="w-6 h-0.5"
                      style={{
                        backgroundColor: config.color,
                        borderStyle: config.style === 'dashed' ? 'dashed' : 'dotted'
                      }}
                    />
                    <span className="flex-1 text-left">{config.label}</span>
                    <span className="text-gray-500">
                      {stats?.connectionCounts[type as BeatConnectionType] || 0}
                    </span>
                  </button>
                ))}
            </div>
          </div>
          
          {/* Intensity */}
          <div className="mb-6">
            <h3 className="text-sm font-medium mb-2 text-gray-400">Intensity</h3>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="100"
                value={intensityRange[0] * 100}
                onChange={e => setIntensityRange([Number(e.target.value) / 100, intensityRange[1]])}
                className="flex-1"
              />
              <span className="text-sm">{(intensityRange[0] * 100).toFixed(0)}%</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="range"
                min="0"
                max="100"
                value={intensityRange[1] * 100}
                onChange={e => setIntensityRange([intensityRange[0], Number(e.target.value) / 100])}
                className="flex-1"
              />
              <span className="text-sm">{(intensityRange[1] * 100).toFixed(0)}%</span>
            </div>
          </div>
          
          {/* Contradictions */}
          <div className="mb-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showContradictions}
                onChange={e => setShowContradictions(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">Show contradictions</span>
            </label>
            {stats && stats.contradictions > 0 && (
              <div className="mt-1 px-2 py-1 bg-red-900/50 rounded text-xs text-red-300">
                {stats.contradictions} contradiction{stats.contradictions !== 1 && 's'} found
              </div>
            )}
          </div>
          
          {/* Clear filters */}
          {(selectedTypes.length > 0 || selectedConnectionTypes.length > 0) && (
            <button
              onClick={() => {
                setSelectedTypes([]);
                setSelectedConnectionTypes([]);
              }}
              className="w-full px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded text-sm"
            >
              Clear Filters
            </button>
          )}
        </aside>
        
        {/* Main - Mesh Visualization */}
        <main className="flex-1 relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-950/50">
              <div className="text-center">
                <div className="animate-spin w-8 h-8 border-2 border-blue-500 rounded-full border-t-transparent mx-auto mb-2" />
                <p className="text-gray-400">Loading mesh...</p>
              </div>
            </div>
          )}
          
          {error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p className="text-red-400 mb-2">{error.message}</p>
                <button
                  onClick={() => refetch()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
                >
                  Retry
                </button>
              </div>
            </div>
          )}
          
          {!loading && !error && mesh && (
            <>
              {viewMode === '3d' ? (
                <BeatMesh3DMobile
                  mesh={mesh}
                  selectedBeatId={selectedBeatId}
                  hoveredBeatId={hoveredBeatId}
                  onSelectBeat={(beat) => setSelectedBeatId(beat?.id ?? null)}
                  onHoverBeat={(beat) => setHoveredBeatId(beat?.id ?? null)}
                  filters={{
                    types: selectedTypes.length > 0 ? selectedTypes : undefined,
                    connectionTypes: selectedConnectionTypes.length > 0 ? selectedConnectionTypes : undefined,
                    minIntensity: intensityRange[0],
                    maxIntensity: intensityRange[1],
                    showContradictions,
                  }}
                />
              ) : (
                <BeatMesh2D
                  mesh={mesh}
                  selectedBeatId={selectedBeatId}
                  onSelectBeat={(beat) => setSelectedBeatId(beat?.id ?? null)}
                  filters={{
                    types: selectedTypes.length > 0 ? selectedTypes : undefined,
                    connectionTypes: selectedConnectionTypes.length > 0 ? selectedConnectionTypes : undefined,
                    minIntensity: intensityRange[0],
                    maxIntensity: intensityRange[1],
                    showContradictions,
                  }}
                />
              )}
            </>
          )}
          
          {/* Empty state */}
          {!loading && !error && mesh && mesh.nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p className="text-gray-400 mb-4">No beats found</p>
                <p className="text-gray-500 text-sm">Create some notes and extract beats to see them here</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}