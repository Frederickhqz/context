'use client';

import { useState, useEffect, useCallback } from 'react';
import type { BeatNode, BeatEdge, BeatMesh, BeatType, BeatConnectionType } from '@/lib/beats/types';

interface UseBeatMeshOptions {
  worldId?: string;
  timelineId?: string;
  dimensionId?: string;
  types?: BeatType[];
  connectionTypes?: BeatConnectionType[];
  minIntensity?: number;
  maxIntensity?: number;
  showContradictions?: boolean;
  userId?: string;
}

interface UseBeatMeshResult {
  mesh: BeatMesh | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  selectedBeat: BeatNode | null;
  setSelectedBeat: (beat: BeatNode | null) => void;
  hoveredBeat: BeatNode | null;
  setHoveredBeat: (beat: BeatNode | null) => void;
  highlightedConnections: BeatEdge[];
  filters: UseBeatMeshOptions;
  setFilters: (filters: UseBeatMeshOptions) => void;
}

/**
 * Hook for fetching real beat mesh data from database
 */
export function useBeatMesh(options: UseBeatMeshOptions = {}): UseBeatMeshResult {
  const [mesh, setMesh] = useState<BeatMesh | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [selectedBeat, setSelectedBeat] = useState<BeatNode | null>(null);
  const [hoveredBeat, setHoveredBeat] = useState<BeatNode | null>(null);
  const [filters, setFilters] = useState<UseBeatMeshOptions>(options);

  const fetchMesh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Build query params
      const params = new URLSearchParams();
      if (filters.worldId) params.set('worldId', filters.worldId);
      if (filters.timelineId) params.set('timelineId', filters.timelineId);
      if (filters.dimensionId) params.set('dimensionId', filters.dimensionId);
      if (filters.types?.length) params.set('types', filters.types.join(','));
      if (filters.userId) params.set('userId', filters.userId);

      // Fetch beats from API
      const response = await fetch(`/api/beats?${params.toString()}`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch beats');
      }

      const data = await response.json();

      // Transform to mesh format
      const nodes: BeatNode[] = (data.beats || []).map((beat: Record<string, unknown>) => ({
        id: beat.id as string,
        type: (beat.beatType || beat.type) as BeatType,
        name: beat.name as string,
        summary: beat.summary as string | undefined,
        content: beat.content as string | undefined,
        intensity: (beat.intensity as number) ?? 0.5,
        valence: beat.valence as number | undefined,
        frequency: (beat.frequency as number) ?? 1,
      }));

      // Collect all edges
      const edges: BeatEdge[] = [];
      const seenEdges = new Set<string>();

      for (const beat of data.beats || []) {
        // Outgoing connections
        for (const conn of (beat.connections as Array<Record<string, unknown>>) || []) {
          const edgeId = `${beat.id}-${conn.toBeatId}`;
          if (!seenEdges.has(edgeId)) {
            seenEdges.add(edgeId);
            edges.push({
              id: conn.id as string,
              from: beat.id as string,
              to: conn.toBeatId as string,
              type: conn.connectionType as BeatConnectionType,
              strength: (conn.strength as number) ?? 0.5,
              isContradiction: (conn.isContradiction as boolean) ?? false,
            });
          }
        }

        // Incoming connections
        for (const conn of (beat.reverseConnections as Array<Record<string, unknown>>) || (beat.incomingConnections as Array<Record<string, unknown>>) || []) {
          const edgeId = `${conn.fromBeatId}-${beat.id}`;
          if (!seenEdges.has(edgeId)) {
            seenEdges.add(edgeId);
            edges.push({
              id: conn.id as string,
              from: conn.fromBeatId as string,
              to: beat.id as string,
              type: conn.connectionType as BeatConnectionType,
              strength: (conn.strength as number) ?? 0.5,
              isContradiction: (conn.isContradiction as boolean) ?? false,
            });
          }
        }
      }

      setMesh({ nodes, edges });
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchMesh();
  }, [fetchMesh]);

  // Filter edges by connection type and contradictions
  const filteredEdges = mesh?.edges?.filter(edge => {
    if (filters.connectionTypes?.length && !filters.connectionTypes.includes(edge.type)) {
      return false;
    }
    if (filters.showContradictions === false && edge.isContradiction) {
      return false;
    }
    return true;
  }) || [];

  // Filter nodes by intensity
  const filteredNodes = mesh?.nodes?.filter(node => {
    if (filters.minIntensity !== undefined && node.intensity < filters.minIntensity) {
      return false;
    }
    if (filters.maxIntensity !== undefined && node.intensity > filters.maxIntensity) {
      return false;
    }
    return true;
  }) || [];

  // Highlighted connections for selected/hovered beat
  const highlightedConnections = (selectedBeat || hoveredBeat)
    ? filteredEdges.filter(edge =>
        edge.from === (selectedBeat || hoveredBeat)?.id ||
        edge.to === (selectedBeat || hoveredBeat)?.id
      )
    : [];

  return {
    mesh: mesh ? { nodes: filteredNodes, edges: filteredEdges } : null,
    loading,
    error,
    refetch: fetchMesh,
    selectedBeat,
    setSelectedBeat,
    hoveredBeat,
    setHoveredBeat,
    highlightedConnections,
    filters,
    setFilters,
  };
}

/**
 * Hook for beat statistics
 */
export function useBeatStats(mesh: BeatMesh | null) {
  const stats = {
    totalBeats: mesh?.nodes?.length || 0,
    totalConnections: mesh?.edges?.length || 0,
    typeCounts: {} as Record<BeatType, number>,
    connectionCounts: {} as Record<BeatConnectionType, number>,
    contradictions: 0,
    avgIntensity: 0,
  };

  if (!mesh || !mesh.nodes.length) return stats;

  for (const node of mesh.nodes) {
    stats.typeCounts[node.type] = (stats.typeCounts[node.type] || 0) + 1;
  }

  for (const edge of mesh.edges) {
    stats.connectionCounts[edge.type] = (stats.connectionCounts[edge.type] || 0) + 1;
    if (edge.isContradiction) stats.contradictions++;
  }

  stats.avgIntensity = mesh.nodes.reduce((sum, n) => sum + n.intensity, 0) / mesh.nodes.length;

  return stats;
}

/**
 * Hook for search/highlight in mesh
 */
export function useBeatSearch(mesh: BeatMesh | null, query: string) {
  if (!mesh || !query) return { matchedNodes: [], matchedEdges: [] };

  const lowerQuery = query.toLowerCase();

  const matchedNodes = mesh.nodes.filter(node =>
    node.name.toLowerCase().includes(lowerQuery) ||
    node.summary?.toLowerCase().includes(lowerQuery)
  );

  const matchedNodeIds = new Set(matchedNodes.map(n => n.id));

  const matchedEdges = mesh.edges.filter(edge =>
    matchedNodeIds.has(edge.from) && matchedNodeIds.has(edge.to)
  );

  return { matchedNodes, matchedEdges };
}

export default useBeatMesh;