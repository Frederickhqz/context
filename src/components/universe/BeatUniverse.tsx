// Beat Universe - Gravitational Visualization
// Inspired by solar systems: suns (major concepts) → planets (connected beats) → moons (details) → asteroids (orphans)
// Standardized on Shared Native AI Bridge Spec 1.0 (2026)

'use client';

import { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Text, Float, Line } from '@react-three/drei';
import * as THREE from 'three';
import type { BeatNode, BeatEdge, BeatMesh } from '@/lib/beats/types';

// ============ Types ============

interface BeatUniverseProps {
  mesh: BeatMesh;
  onBeatSelect?: (beat: BeatNode) => void;
  onBeatHover?: (beat: BeatNode | null) => void;
  highlightId?: string;
  showLabels?: boolean;
  showConnections?: boolean;
  colorMode?: 'type' | 'intensity' | 'valence';
}

interface CelestialBody {
  id: string;
  type: 'sun' | 'planet' | 'moon' | 'asteroid';
  node: BeatNode;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  mass: number;
  radius: number;
  color: THREE.Color;
  orbitCenter?: THREE.Vector3;
  orbitRadius?: number;
  orbitSpeed?: number;
  parent?: CelestialBody;
  children: CelestialBody[];
}

// ============ Beat Type Colors (Shared Spec 1.0) ============

const BEAT_COLORS: Record<string, string> = {
  CHARACTER: '#FF6B6B',   // Red - living entities
  PLACE: '#4ECDC4',       // Teal - locations
  THEME: '#AA96DA',       // Purple - concepts
  CONFLICT: '#EE5A24',     // Dark orange - tensions
  EVENT: '#F8B500',        // Gold - happenings
  FEELING: '#D63384',      // Magenta - emotions
  IDEA: '#A8D8EA',        // Light blue - abstract
  CUSTOM: '#7F8C8D',       // Gray - fallback
};

// ============ Physics Constants ============

const G = 0.5; 
const SUN_MASS_MULTIPLIER = 50; 
const MIN_ORBIT_RADIUS = 4;
const MAX_ORBIT_RADIUS = 25;
const ASTEROID_BELT_RADIUS = 35;

// ============ Helper Functions ============

function getBeatColor(type: string, intensity: number, valence: number, colorMode: string): THREE.Color {
  if (colorMode === 'intensity') {
    const h = 0.6; // Blue base
    const s = 0.8;
    const l = 0.2 + intensity * 0.7; // Brighter = more intense
    return new THREE.Color().setHSL(h, s, l);
  }
  
  if (colorMode === 'valence') {
    // -1.0 (Red/Angry) -> 0.0 (Gray/Neutral) -> 1.0 (Green/Happy)
    const color = new THREE.Color();
    if (valence < 0) {
      color.lerpColors(new THREE.Color('#888888'), new THREE.Color('#ff0000'), Math.abs(valence));
    } else {
      color.lerpColors(new THREE.Color('#888888'), new THREE.Color('#00ff44'), valence);
    }
    return color;
  }
  
  const hex = BEAT_COLORS[type] || BEAT_COLORS.CUSTOM;
  return new THREE.Color(hex);
}

function classifyBeat(node: BeatNode, edges: BeatEdge[]): 'sun' | 'planet' | 'moon' | 'asteroid' {
  const connections = edges.filter(e => e.from === node.id || e.to === node.id);
  
  if (connections.length >= 4 || node.frequency >= 5) return 'sun';
  if (connections.length >= 2) return 'planet';
  if (connections.length === 1) return 'moon';
  return 'asteroid';
}

function calculateMass(node: BeatNode, edges: BeatEdge[]): number {
  const connections = edges.filter(e => e.from === node.id || e.to === node.id);
  const baseMass = (node.intensity || 0.5) * 10;
  const connectionMass = connections.length * SUN_MASS_MULTIPLIER;
  return baseMass + connectionMass;
}

// ============ Sub-Components ============

function CelestialBodyMesh({ 
  body, 
  onHover, 
  onClick, 
  showLabel,
  isSelected,
  isHighlighted 
}: {
  body: CelestialBody;
  onHover?: (body: CelestialBody | null) => void;
  onClick?: (body: CelestialBody) => void;
  showLabel?: boolean;
  isSelected?: boolean;
  isHighlighted?: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const labelRef = useRef<any>(null);
  
  useFrame((state, delta) => {
    if (!meshRef.current) return;
    
    // 1. Orbital motion
    if ((body.type === 'planet' || body.type === 'moon') && body.orbitCenter) {
      const angle = state.clock.elapsedTime * (body.orbitSpeed || 0.1) + (parseInt(body.id.slice(0, 4), 16) % 100);
      const x = body.orbitCenter.x + Math.cos(angle) * (body.orbitRadius || 5);
      const z = body.orbitCenter.z + Math.sin(angle) * (body.orbitRadius || 5);
      
      meshRef.current.position.set(x, body.orbitCenter.y + Math.sin(angle * 0.5) * 1, z);
      
      if (glowRef.current) glowRef.current.position.copy(meshRef.current.position);
      if (labelRef.current) labelRef.current.position.set(x, meshRef.current.position.y + body.radius + 0.6, z);
    }
    
    // 2. Pulse for suns
    if (body.type === 'sun' && glowRef.current) {
      const pulse = 1.2 + Math.sin(state.clock.elapsedTime * 2) * 0.1;
      glowRef.current.scale.setScalar(pulse);
      meshRef.current.rotation.y += delta * 0.2;
    }

    // 3. Float for asteroids
    if (body.type === 'asteroid') {
      meshRef.current.rotation.x += delta * 0.1;
      meshRef.current.rotation.z += delta * 0.15;
    }
  });
  
  const radius = body.type === 'sun' ? body.radius * 1.2 : body.radius;
  
  return (
    <group>
      <mesh
        ref={meshRef}
        position={body.position}
        onClick={(e) => { e.stopPropagation(); onClick?.(body); }}
        onPointerOver={(e) => { e.stopPropagation(); onHover?.(body); }}
        onPointerOut={() => onHover?.(null)}
      >
        {body.type === 'sun' ? (
          <sphereGeometry args={[radius, 32, 32]} />
        ) : body.type === 'asteroid' ? (
          <icosahedronGeometry args={[radius * 0.8, 0]} />
        ) : (
          <sphereGeometry args={[radius, 24, 24]} />
        )}
        
        <meshStandardMaterial
          color={body.color}
          emissive={body.color}
          emissiveIntensity={body.type === 'sun' ? 1.5 : (isSelected || isHighlighted ? 1 : 0.2)}
          roughness={0.4}
          metalness={0.6}
        />
      </mesh>
      
      {body.type === 'sun' && (
        <mesh ref={glowRef} position={body.position}>
          <sphereGeometry args={[radius * 1.5, 16, 16]} />
          <meshBasicMaterial color={body.color} transparent opacity={0.15} />
        </mesh>
      )}
      
      {showLabel && (
        <Text
          ref={labelRef}
          position={[body.position.x, body.position.y + radius + 0.6, body.position.z]}
          fontSize={body.type === 'sun' ? 0.6 : 0.4}
          color="white"
          anchorX="center"
          anchorY="bottom"
          font="/fonts/inter-bold.woff" // Fallback to system if not found
        >
          {body.node.name}
        </Text>
      )}

      {(isSelected || isHighlighted) && (
        <mesh position={meshRef.current?.position || body.position}>
          <torusGeometry args={[radius * 1.6, 0.04, 16, 32]} />
          <meshBasicMaterial color={isSelected ? "#00ffff" : "#ffff00"} />
        </mesh>
      )}
    </group>
  );
}

// ============ Scene Layout & Logic ============

export function BeatUniverse({
  mesh,
  onBeatSelect,
  onBeatHover,
  highlightId,
  showLabels = true,
  showConnections = true,
  colorMode = 'type'
}: BeatUniverseProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { bodies, bodyMap } = useMemo(() => {
    const bList: CelestialBody[] = [];
    const bMap = new Map<string, CelestialBody>();
    
    // Pass 1: Creation & Basic Properties
    mesh.nodes.forEach(node => {
      const classification = classifyBeat(node, mesh.edges);
      const mass = calculateMass(node, mesh.edges);
      const radius = Math.max(0.3, Math.sqrt(mass) * 0.08);
      const color = getBeatColor(node.type, node.intensity || 0.5, node.valence || 0, colorMode);
      
      let pos = new THREE.Vector3();
      if (classification === 'sun') {
        pos.set((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 30);
      } else if (classification === 'asteroid') {
        const angle = Math.random() * Math.PI * 2;
        const dist = ASTEROID_BELT_RADIUS + Math.random() * 15;
        pos.set(Math.cos(angle) * dist, (Math.random() - 0.5) * 20, Math.sin(angle) * dist);
      }

      const body: CelestialBody = {
        id: node.id,
        type: classification,
        node,
        position: pos,
        velocity: new THREE.Vector3(),
        mass,
        radius,
        color,
        children: []
      };
      bList.push(body);
      bMap.set(node.id, body);
    });

    // Pass 2: Gravitational Hierarchies (System Formation)
    bList.forEach(body => {
      if (body.type === 'planet' || body.type === 'moon') {
        const connections = mesh.edges.filter(e => e.from === body.id || e.to === body.id);
        let parent: CelestialBody | null = null;
        let maxStrength = -1;

        connections.forEach(e => {
          const other = bMap.get(e.from === body.id ? e.to : e.from);
          if (other && (other.type === 'sun' || (body.type === 'moon' && other.type === 'planet'))) {
            if (e.strength > maxStrength) {
              maxStrength = e.strength;
              parent = other;
            }
          }
        });

        if (parent) {
          const p = parent as CelestialBody;
          body.parent = p;
          body.orbitCenter = p.position;
          body.orbitRadius = body.type === 'moon' ? 2 + Math.random() : MIN_ORBIT_RADIUS + Math.random() * 15;
          body.orbitSpeed = 0.05 + Math.random() * 0.15;
          p.children.push(body);
        } else {
          body.type = 'asteroid'; // No parent concept found
        }
      }
    });

    return { bodies: bList, bodyMap: bMap };
  }, [mesh, colorMode]);

  const connectionLines = useMemo(() => {
    if (!showConnections) return [];
    return mesh.edges.map(edge => {
      const from = bodyMap.get(edge.from);
      const to = bodyMap.get(edge.to);
      if (!from || !to) return null;
      
      let color = '#444444';
      if (edge.isContradiction) color = '#ff3333';
      else if (edge.type === 'CAUSES') color = '#00ff88';
      else if (edge.type === 'MIRRORS') color = '#0088ff';
      
      return { start: from.position, end: to.position, color, opacity: 0.2 + edge.strength * 0.4 };
    }).filter(Boolean);
  }, [mesh.edges, bodyMap, showConnections]);

  return (
    <div className="w-full h-full bg-[#050505] relative overflow-hidden">
      <Canvas camera={{ position: [0, 25, 50], fov: 50 }}>
        <color attach="background" args={['#050505']} />
        <ambientLight intensity={0.4} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <Stars radius={150} depth={50} count={7000} factor={4} saturation={0.5} fade speed={1.5} />
        
        {bodies.map(body => (
          <CelestialBodyMesh 
            key={body.id} 
            body={body} 
            showLabel={showLabels}
            isSelected={selectedId === body.id}
            isHighlighted={highlightId === body.id}
            onClick={(b) => {
              setSelectedId(b.id);
              onBeatSelect?.(b.node);
            }}
            onHover={(b) => onBeatHover?.(b?.node || null)}
          />
        ))}

        {connectionLines.map((line: any, i) => (
          <Line 
            key={i} 
            points={[line.start, line.end]} 
            color={line.color} 
            lineWidth={1.5} 
            transparent 
            opacity={line.opacity} 
          />
        ))}

        <OrbitControls 
          makeDefault 
          minDistance={10} 
          maxDistance={200}
          // Mobile-optimized touch controls
          touches={{ ONE: 1, TWO: 2 }} // 1-finger rotate, 2-finger zoom
          enableDamping
          dampingFactor={0.05}
          rotateSpeed={0.5} // Slower on touch devices
          zoomSpeed={0.8}
          panSpeed={0.5}
          maxPolarAngle={Math.PI * 0.85}
          minPolarAngle={Math.PI * 0.15}
        />
      </Canvas>

      <div className="absolute bottom-6 left-6 p-4 rounded-xl bg-black/60 border border-white/10 backdrop-blur-md text-[11px] text-white/80 space-y-2 pointer-events-none">
        <div className="font-bold tracking-widest uppercase text-white/40 mb-3">Gravitational Legend</div>
        <div className="flex items-center gap-3">
          <span className="w-4 h-4 rounded-full bg-red-500 shadow-[0_0_10px_red]" /> 
          <span><strong>Core Concept (Sun):</strong> 4+ Connections</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-full bg-cyan-400" /> 
          <span><strong>Connected Beat (Planet):</strong> Orbiting Core</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-400" /> 
          <span><strong>Detail (Moon):</strong> Orbiting Planet</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 bg-white/20 rotate-45" /> 
          <span><strong>Orphan (Asteroid):</strong> Isolated Idea</span>
        </div>
      </div>
    </div>
  );
}

export default BeatUniverse;
