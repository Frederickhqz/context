'use client';

import { useMemo, useRef, useState, useCallback, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text, Line, Float } from '@react-three/drei';
import * as THREE from 'three';
import {
  BeatMesh,
  BeatNode,
  BeatEdge,
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

interface NodePositions {
  [id: string]: [number, number, number];
}

// ============ Force Layout ============

function computeForceLayout(nodes: BeatNode[], edges: BeatEdge[], iterations = 50): NodePositions {
  const positions: NodePositions = {};
  const nodeMap = new Map<string, { x: number; y: number; z: number; vx: number; vy: number; vz: number }>();

  // Initialize positions randomly in a sphere
  for (const node of nodes) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 5 + Math.random() * 5;
    nodeMap.set(node.id, {
      x: r * Math.sin(phi) * Math.cos(theta),
      y: r * Math.sin(phi) * Math.sin(theta),
      z: r * Math.cos(phi),
      vx: 0,
      vy: 0,
      vz: 0,
    });
  }

  // Build adjacency
  const adjacency = new Map<string, Set<string>>();
  for (const edge of edges) {
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, new Set());
    if (!adjacency.has(edge.to)) adjacency.set(edge.to, new Set());
    adjacency.get(edge.from)!.add(edge.to);
    adjacency.get(edge.to)!.add(edge.from);
  }

  // Force simulation
  const repulsion = 2.0;
  const attraction = 0.1;
  const damping = 0.9;

  for (let iter = 0; iter < iterations; iter++) {
    // Repulsion between all pairs
    for (const [id1, n1] of nodeMap) {
      for (const [id2, n2] of nodeMap) {
        if (id1 === id2) continue;
        const dx = n1.x - n2.x;
        const dy = n1.y - n2.y;
        const dz = n1.z - n2.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.1;
        const force = repulsion / (dist * dist);
        n1.vx += (dx / dist) * force;
        n1.vy += (dy / dist) * force;
        n1.vz += (dz / dist) * force;
      }
    }

    // Attraction along edges
    for (const edge of edges) {
      const n1 = nodeMap.get(edge.from);
      const n2 = nodeMap.get(edge.to);
      if (!n1 || !n2) continue;

      const dx = n2.x - n1.x;
      const dy = n2.y - n1.y;
      const dz = n2.z - n1.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.1;

      const force = attraction * dist;
      n1.vx += (dx / dist) * force;
      n1.vy += (dy / dist) * force;
      n1.vz += (dz / dist) * force;
      n2.vx -= (dx / dist) * force;
      n2.vy -= (dy / dist) * force;
      n2.vz -= (dz / dist) * force;
    }

    // Apply velocity with damping
    for (const node of nodeMap.values()) {
      node.x += node.vx;
      node.y += node.vy;
      node.z += node.vz;
      node.vx *= damping;
      node.vy *= damping;
      node.vz *= damping;
    }
  }

  // Convert to tuples
  for (const [id, node] of nodeMap) {
    positions[id] = [node.x, node.y, node.z];
  }

  return positions;
}

// ============ 3D Components ============

interface NodeProps {
  node: BeatNode;
  position: [number, number, number];
  isSelected: boolean;
  isHovered: boolean;
  onClick: () => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}

function BeatNodeMesh({ node, position, isSelected, isHovered, onClick, onPointerEnter, onPointerLeave }: NodeProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const config = BEAT_TYPE_CONFIG[node.type];
  const color = config?.color || '#888888';
  const baseSize = 0.3 + (node.intensity || 0.5) * 0.4;
  const size = isSelected ? baseSize * 1.3 : isHovered ? baseSize * 1.15 : baseSize;

  useFrame(() => {
    if (meshRef.current && (isSelected || isHovered)) {
      meshRef.current.rotation.y += 0.02;
    }
  });

  const shape = config?.shape || 'sphere';

  return (
    <group position={position}>
      <Float speed={isSelected ? 0 : 1} rotationIntensity={0.1} floatIntensity={0.3}>
        <mesh
          ref={meshRef}
          onClick={onClick}
          onPointerEnter={onPointerEnter}
          onPointerLeave={onPointerLeave}
        >
          {shape === 'octahedron' ? (
            <octahedronGeometry args={[size, 0]} />
          ) : shape === 'torus' ? (
            <torusGeometry args={[size, size * 0.4, 8, 16]} />
          ) : shape === 'icosahedron' ? (
            <icosahedronGeometry args={[size, 0]} />
          ) : shape === 'cube' ? (
            <boxGeometry args={[size * 1.5, size * 1.5, size * 1.5]} />
          ) : shape === 'cone' ? (
            <coneGeometry args={[size, size * 2, 8]} />
          ) : shape === 'dodecahedron' ? (
            <dodecahedronGeometry args={[size, 0]} />
          ) : (
            <sphereGeometry args={[size, 16, 16]} />
          )}
          <meshStandardMaterial
            color={color}
            emissive={isSelected ? color : isHovered ? color : '#000000'}
            emissiveIntensity={isSelected ? 0.5 : isHovered ? 0.2 : 0}
            metalness={0.3}
            roughness={0.6}
          />
        </mesh>
      </Float>

      {/* Label */}
      {(isSelected || isHovered) && (
        <Text
          position={[0, size + 0.5, 0]}
          fontSize={0.25}
          color="white"
          anchorX="center"
          anchorY="bottom"
        >
          {node.name}
        </Text>
      )}
    </group>
  );
}

interface EdgeProps {
  edge: BeatEdge;
  positions: NodePositions;
  isHighlighted: boolean;
}

function BeatEdgeLine({ edge, positions, isHighlighted }: EdgeProps) {
  const fromPos = positions[edge.from];
  const toPos = positions[edge.to];

  if (!fromPos || !toPos) return null;

  const config = CONNECTION_TYPE_CONFIG[edge.type];
  const color = config?.color || '#666666';
  const opacity = isHighlighted ? 1 : 0.4;

  const points = useMemo(() => [
    new THREE.Vector3(...fromPos),
    new THREE.Vector3(...toPos),
  ], [fromPos, toPos]);

  return (
    <Line
      points={points}
      color={color}
      lineWidth={isHighlighted ? 2 : 1}
      opacity={opacity}
      transparent
    />
  );
}

interface SceneProps {
  nodes: BeatNode[];
  edges: BeatEdge[];
  positions: NodePositions;
  selectedBeatId: string | null;
  hoveredBeatId: string | null;
  onSelectBeat: (beat: BeatNode | null) => void;
  onHoverBeat: (beat: BeatNode | null) => void;
}

function Scene({ nodes, edges, positions, selectedBeatId, hoveredBeatId, onSelectBeat, onHoverBeat }: SceneProps) {
  const nodeMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);

  const handleNodeClick = useCallback((node: BeatNode) => {
    onSelectBeat(node);
  }, [onSelectBeat]);

  const handleNodeHover = useCallback((node: BeatNode | null) => {
    onHoverBeat(node);
  }, [onHoverBeat]);

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <pointLight position={[-10, -10, -10]} intensity={0.5} />

      {/* Nodes */}
      {nodes.map(node => (
        <BeatNodeMesh
          key={node.id}
          node={node}
          position={positions[node.id] || [0, 0, 0]}
          isSelected={selectedBeatId === node.id}
          isHovered={hoveredBeatId === node.id}
          onClick={() => handleNodeClick(node)}
          onPointerEnter={() => handleNodeHover(node)}
          onPointerLeave={() => handleNodeHover(null)}
        />
      ))}

      {/* Edges */}
      {edges.map(edge => {
        const isHighlighted = selectedBeatId === edge.from || selectedBeatId === edge.to ||
                              hoveredBeatId === edge.from || hoveredBeatId === edge.to;
        return (
          <BeatEdgeLine
            key={edge.id}
            edge={edge}
            positions={positions}
            isHighlighted={isHighlighted}
          />
        );
      })}

      {/* Controls */}
      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={2}
        maxDistance={50}
      />
    </>
  );
}

// ============ Main Component ============

export function BeatMesh3D({
  mesh,
  selectedBeatId,
  hoveredBeatId,
  onSelectBeat,
  onHoverBeat,
  filters,
  className
}: BeatMeshProps) {
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);
  const [internalHoveredId, setInternalHoveredId] = useState<string | null>(null);

  const selectedId = selectedBeatId ?? internalSelectedId;
  const hoveredId = hoveredBeatId ?? internalHoveredId;

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
      // Only include edges between nodes that exist
      const hasFrom = filteredNodes.some(n => n.id === edge.from);
      const hasTo = filteredNodes.some(n => n.id === edge.to);
      return hasFrom && hasTo;
    });
  }, [mesh.edges, filters, filteredNodes]);

  // Compute layout
  const positions = useMemo(() => {
    return computeForceLayout(filteredNodes, filteredEdges, 80);
  }, [filteredNodes, filteredEdges]);

  const handleSelect = useCallback((beat: BeatNode | null) => {
    setInternalSelectedId(beat?.id ?? null);
    onSelectBeat?.(beat);
  }, [onSelectBeat]);

  const handleHover = useCallback((beat: BeatNode | null) => {
    setInternalHoveredId(beat?.id ?? null);
    onHoverBeat?.(beat);
  }, [onHoverBeat]);

  // Stats for legend
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const node of filteredNodes) {
      counts[node.type] = (counts[node.type] || 0) + 1;
    }
    return counts;
  }, [filteredNodes]);

  const connectionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const edge of filteredEdges) {
      counts[edge.type] = (counts[edge.type] || 0) + 1;
    }
    return counts;
  }, [filteredEdges]);

  return (
    <div className={`w-full h-full flex ${className || ''}`}>
      {/* 3D Canvas */}
      <div className="flex-1 relative">
        <Canvas
          camera={{ position: [15, 15, 15], fov: 50 }}
          gl={{ antialias: true, alpha: true }}
          style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}
        >
          <Suspense fallback={null}>
            <Scene
              nodes={filteredNodes}
              edges={filteredEdges}
              positions={positions}
              selectedBeatId={selectedId}
              hoveredBeatId={hoveredId}
              onSelectBeat={handleSelect}
              onHoverBeat={handleHover}
            />
          </Suspense>
        </Canvas>

        {/* Stats overlay */}
        <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm rounded-lg p-3">
          <p className="text-white text-sm font-medium">
            {filteredNodes.length} nodes • {filteredEdges.length} connections
          </p>
        </div>

        {/* Selected node info */}
        {selectedId && (() => {
          const node = filteredNodes.find(n => n.id === selectedId);
          if (!node) return null;
          const config = BEAT_TYPE_CONFIG[node.type];
          return (
            <div className="absolute bottom-4 left-4 bg-black/70 backdrop-blur-sm rounded-lg p-4 max-w-xs">
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: config?.color || '#888' }}
                />
                <span className="text-white font-medium">{node.name}</span>
              </div>
              {node.summary && (
                <p className="text-gray-300 text-sm mb-2">{node.summary}</p>
              )}
              <div className="flex gap-3 text-xs text-gray-400">
                <span>Intensity: {(node.intensity * 100).toFixed(0)}%</span>
                {node.valence !== undefined && (
                  <span className={node.valence > 0 ? 'text-green-400' : node.valence < 0 ? 'text-red-400' : ''}>
                    {node.valence > 0 ? '+' : ''}{(node.valence * 100).toFixed(0)}%
                  </span>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Legend sidebar */}
      <div className="w-48 bg-gray-900/90 border-l border-gray-700 p-4 overflow-y-auto">
        <h3 className="text-sm font-medium text-gray-300 mb-3">Beat Types</h3>
        <div className="space-y-1 mb-4">
          {Object.entries(typeCounts).map(([type, count]) => {
            const config = BEAT_TYPE_CONFIG[type as BeatType];
            return (
              <div key={type} className="flex items-center gap-2 text-xs">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: config?.color || '#888' }}
                />
                <span className="text-gray-400">{config?.label || type}</span>
                <span className="text-gray-600 ml-auto">{count}</span>
              </div>
            );
          })}
        </div>

        <h3 className="text-sm font-medium text-gray-300 mb-3">Connections</h3>
        <div className="space-y-1">
          {Object.entries(connectionCounts).map(([type, count]) => {
            const config = CONNECTION_TYPE_CONFIG[type as BeatConnectionType];
            return (
              <div key={type} className="flex items-center gap-2 text-xs">
                <div
                  className="w-4 h-0.5"
                  style={{ backgroundColor: config?.color || '#666' }}
                />
                <span className="text-gray-400">{config?.label || type}</span>
                <span className="text-gray-600 ml-auto">{count}</span>
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-700">
          <p className="text-xs text-gray-500">
            Drag to rotate • Scroll to zoom • Click to select
          </p>
        </div>
      </div>
    </div>
  );
}

// ============ 2D Component (unchanged) ============

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