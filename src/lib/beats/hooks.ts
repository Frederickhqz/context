// Beat Mesh Hooks - React hooks for beat visualization
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { BeatNode, BeatEdge, BeatMesh, BeatType, BeatConnectionType } from '@/lib/beats/types';

interface UseBeatMeshOptions {
  worldId?: string;
  timelineId?: string;
  dimensionId?: string;
  types?: BeatType[];
  connectionTypes?: BeatConnectionType[];
  minIntensity?: number;
  maxIntensity?: number;
  showContradictions?: boolean;
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
 * Hook for fetching and managing beat mesh data
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
      if (filters.types) params.set('types', filters.types.join(','));
      
      // Fetch beats
      const response = await fetch(`/api/beats?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch beats');
      }
      
      const data = await response.json();
      
      // Transform to mesh format
      const nodes: BeatNode[] = data.beats.map((beat: Record<string, unknown>) => ({
        id: beat.id as string,
        type: beat.beatType as BeatType,
        name: beat.name as string,
        summary: beat.summary as string | undefined,
        intensity: (beat.intensity as number) ?? 0.5,
        valence: beat.valence as number | undefined,
        frequency: (beat.frequency as number) ?? 1,
      }));
      
      // Collect all edges
      const edges: BeatEdge[] = [];
      const seenEdges = new Set<string>();
      
      for (const beat of data.beats) {
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
        for (const conn of (beat.incomingConnections as Array<Record<string, unknown>>) || []) {
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
  const filteredEdges = useMemo(() => {
    let edges = mesh?.edges || [];
    
    if (filters.connectionTypes && filters.connectionTypes.length > 0) {
      edges = edges.filter(edge => 
        filters.connectionTypes!.includes(edge.type)
      );
    }
    
    if (filters.showContradictions === false) {
      edges = edges.filter(edge => !edge.isContradiction);
    }
    
    return edges;
  }, [mesh?.edges, filters.connectionTypes, filters.showContradictions]);
  
  // Filter nodes by intensity
  const filteredNodes = useMemo(() => {
    let nodes = mesh?.nodes || [];
    
    if (filters.minIntensity !== undefined) {
      nodes = nodes.filter(n => n.intensity >= filters.minIntensity!);
    }
    
    if (filters.maxIntensity !== undefined) {
      nodes = nodes.filter(n => n.intensity <= filters.maxIntensity!);
    }
    
    return nodes;
  }, [mesh?.nodes, filters.minIntensity, filters.maxIntensity]);
  
  // Highlighted connections for selected/hovered beat
  const highlightedConnections = useMemo(() => {
    const targetBeat = selectedBeat || hoveredBeat;
    if (!targetBeat) return [];
    
    return filteredEdges.filter(
      edge => edge.from === targetBeat.id || edge.to === targetBeat.id
    );
  }, [selectedBeat, hoveredBeat, filteredEdges]);
  
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
  return useMemo(() => {
    if (!mesh) return null;
    
    const typeCounts: Record<BeatType, number> = {} as Record<BeatType, number>;
    const connectionCounts: Record<BeatConnectionType, number> = {} as Record<BeatConnectionType, number>;
    
    for (const node of mesh.nodes) {
      typeCounts[node.type] = (typeCounts[node.type] || 0) + 1;
    }
    
    for (const edge of mesh.edges) {
      connectionCounts[edge.type] = (connectionCounts[edge.type] || 0) + 1;
    }
    
    const contradictions = mesh.edges.filter(e => e.isContradiction).length;
    
    return {
      totalBeats: mesh.nodes.length,
      totalConnections: mesh.edges.length,
      typeCounts,
      connectionCounts,
      contradictions,
      avgIntensity: mesh.nodes.reduce((sum, n) => sum + n.intensity, 0) / mesh.nodes.length || 0,
    };
  }, [mesh]);
}

/**
 * Hook for search/highlight in mesh
 */
export function useBeatSearch(mesh: BeatMesh | null, query: string) {
  return useMemo(() => {
    if (!mesh || !query) return { matchedNodes: [], matchedEdges: [] };
    
    const lowerQuery = query.toLowerCase();
    
    const matchedNodes = mesh.nodes.filter(node =>
      node.name.toLowerCase().includes(lowerQuery) ||
      node.summary?.toLowerCase().includes(lowerQuery)
    );
    
    const matchedNodeIds = new Set(matchedNodes.map(n => n.id));
    
    // Find edges that connect matched nodes
    const matchedEdges = mesh.edges.filter(edge =>
      matchedNodeIds.has(edge.from) && matchedNodeIds.has(edge.to)
    );
    
    return { matchedNodes, matchedEdges };
  }, [mesh, query]);
}

/**
 * Hook for fetching a single beat
 */
export function useBeat(beatId: string | null) {
  const [beat, setBeat] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    if (!beatId) {
      setBeat(null);
      return;
    }
    
    setLoading(true);
    fetch(`/api/beats/${beatId}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch beat');
        return res.json();
      })
      .then(data => {
        setBeat(data.beat);
        setError(null);
      })
      .catch(err => {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [beatId]);
  
  return { beat, loading, error };
}