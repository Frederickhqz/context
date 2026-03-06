'use client';

// Beat Mesh Visualization
// TODO: Phase 5 - Implement 3D visualization with proper three.js dependencies
// Currently using a simple list view as placeholder

import { useMemo } from 'react';
import {
  BeatMesh,
  BeatNode,
  BeatType,
  BeatConnectionType,
  BEAT_TYPE_CONFIG,
  CONNECTION_TYPE_CONFIG
} from '@/lib/beats/types';

// ============ Types ============

interface BeatMeshProps {
  mesh: BeatMesh;
  selectedBeatId?: string | null;
  hoveredBeatId?: string | null;
  onSelectBeat?: (beat: BeatNode | null) => void;
  onHoverBeat?: (beat: BeatNode | null) => void;
  filters?: {
    types?: BeatType[];
    connectionTypes?: BeatConnectionType[];
    minIntensity?: number;
    maxIntensity?: number;
    showContradictions?: boolean;
  };
  className?: string;
}

// ============ 3D Component (Placeholder) ============

export function BeatMesh3D({
  mesh,
  selectedBeatId,
  hoveredBeatId,
  onSelectBeat,
  onHoverBeat,
  filters,
  className
}: BeatMeshProps) {
  // Filter nodes
  const filteredNodes = useMemo(() => {
    return mesh.nodes.filter(node => {
      if (filters?.types && !filters.types.includes(node.type)) return false;
      if (filters?.minIntensity !== undefined && node.intensity < filters.minIntensity) return false;
      if (filters?.maxIntensity !== undefined && node.intensity > filters.maxIntensity) return false;
      return true;
    });
  }, [mesh.nodes, filters]);

  // Filter edges
  const filteredEdges = useMemo(() => {
    return mesh.edges.filter(edge => {
      if (filters?.connectionTypes && !filters.connectionTypes.includes(edge.type)) return false;
      if (filters?.showContradictions === false && edge.isContradiction) return false;
      return true;
    });
  }, [mesh.edges, filters]);

  return (
    <div className={`w-full h-full bg-gray-900 flex flex-col ${className || ''}`}>
      {/* Header */}
      <div className="p-4 bg-gray-800/50 border-b border-gray-700">
        <h2 className="text-lg font-semibold text-white">3D Beat Mesh</h2>
        <p className="text-sm text-gray-400">
          {filteredNodes.length} nodes • {filteredEdges.length} connections
        </p>
      </div>
      
      {/* Placeholder visualization */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
            </svg>
          </div>
          <p className="text-gray-300 font-medium">3D Visualization Coming Soon</p>
          <p className="text-gray-500 text-sm mt-1">
            {filteredNodes.length} beats ready to visualize
          </p>
          <p className="text-gray-600 text-xs mt-4 max-w-xs">
            Phase 5: 3D mesh visualization requires react-force-graph compatibility update
          </p>
        </div>
      </div>
      
      {/* Node list for now */}
      <div className="h-64 overflow-y-auto border-t border-gray-700 p-4">
        <h3 className="text-sm font-medium text-gray-400 mb-2">Beats</h3>
        <div className="grid grid-cols-2 gap-2">
          {filteredNodes.slice(0, 20).map(node => {
            const config = BEAT_TYPE_CONFIG[node.type];
            return (
              <button
                key={node.id}
                onClick={() => onSelectBeat?.(node)}
                onMouseEnter={() => onHoverBeat?.(node)}
                onMouseLeave={() => onHoverBeat?.(null)}
                className={`p-2 rounded text-left transition-colors ${
                  selectedBeatId === node.id 
                    ? 'bg-blue-600/30 border border-blue-500' 
                    : 'bg-gray-800 hover:bg-gray-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div 
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: config?.color || '#888' }}
                  />
                  <span className="text-sm text-white truncate">{node.name}</span>
                </div>
                {node.summary && (
                  <p className="text-xs text-gray-400 truncate mt-1">{node.summary}</p>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============ 2D Component ============

export function BeatMesh2D({
  mesh,
  selectedBeatId,
  onSelectBeat,
  filters
}: BeatMeshProps) {
  // Filter nodes
  const filteredNodes = useMemo(() => {
    return mesh.nodes.filter(node => {
      if (filters?.types && !filters.types.includes(node.type)) return false;
      if (filters?.minIntensity !== undefined && node.intensity < filters.minIntensity) return false;
      if (filters?.maxIntensity !== undefined && node.intensity > filters.maxIntensity) return false;
      return true;
    });
  }, [mesh.nodes, filters]);

  // Filter edges
  const filteredEdges = useMemo(() => {
    return mesh.edges.filter(edge => {
      if (filters?.connectionTypes && !filters.connectionTypes.includes(edge.type)) return false;
      if (filters?.showContradictions === false && edge.isContradiction) return false;
      return true;
    });
  }, [mesh.edges, filters]);

  // Group nodes by type
  const nodesByType = useMemo(() => {
    const grouped: Record<BeatType, BeatNode[]> = {} as Record<BeatType, BeatNode[]>;
    for (const node of filteredNodes) {
      if (!grouped[node.type]) grouped[node.type] = [];
      grouped[node.type].push(node);
    }
    return grouped;
  }, [filteredNodes]);

  return (
    <div className="w-full h-full bg-gray-900 overflow-auto p-4">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-white">Beat Overview</h2>
        <p className="text-sm text-gray-400">
          {filteredNodes.length} beats • {filteredEdges.length} connections
        </p>
      </div>
      
      {/* Beat type sections */}
      <div className="space-y-6">
        {Object.entries(nodesByType).map(([type, nodes]) => {
          const config = BEAT_TYPE_CONFIG[type as BeatType];
          return (
            <div key={type}>
              <div className="flex items-center gap-2 mb-2">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: config?.color || '#888' }}
                />
                <h3 className="text-sm font-medium text-gray-300">
                  {config?.label || type}
                </h3>
                <span className="text-xs text-gray-500">({nodes.length})</span>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {nodes.map(node => (
                  <button
                    key={node.id}
                    onClick={() => onSelectBeat?.(node)}
                    className={`p-3 rounded-lg text-left transition-colors ${
                      selectedBeatId === node.id
                        ? 'bg-blue-600/30 border border-blue-500'
                        : 'bg-gray-800 hover:bg-gray-700'
                    }`}
                  >
                    <div className="font-medium text-white text-sm truncate">
                      {node.name}
                    </div>
                    {node.summary && (
                      <p className="text-xs text-gray-400 truncate mt-1">
                        {node.summary}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                      <span>Intensity: {(node.intensity * 100).toFixed(0)}%</span>
                      {node.valence !== undefined && (
                        <span className={node.valence > 0 ? 'text-green-400' : node.valence < 0 ? 'text-red-400' : ''}>
                          {node.valence > 0 ? '+' : ''}{(node.valence * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default BeatMesh3D;