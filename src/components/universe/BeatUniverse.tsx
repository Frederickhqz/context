// Beat Universe - Gravitational Visualization
// Inspired by solar systems: suns (major concepts) → planets (connected beats) → moons (details) → asteroids (orphans)

'use client';

import { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
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

// ============ Beat Type Colors ============

const BEAT_COLORS: Record<string, string> = {
  CHARACTER: '#FF6B6B',   // Red - living entities
  PLACE: '#4ECDC4',       // Teal - locations
  OBJECT: '#95E1D3',      // Mint - items
  CREATURE: '#F38181',    // Coral - non-humans
  THEME: '#AA96DA',       // Purple - concepts
  MOTIF: '#FCBAD3',       // Pink - recurring patterns
  IDEA: '#A8D8EA',        // Light blue - abstract
  QUESTION: '#FFEAA7',    // Yellow - mysteries
  INSIGHT: '#55E6C1',     // Green - realizations
  RELATIONSHIP: '#FF9F43', // Orange - connections
  CONFLICT: '#EE5A24',     // Dark orange - tensions
  EVENT: '#F8B500',        // Gold - happenings
  FEELING: '#D63384',      // Magenta - emotions
  MOOD: '#6C5B7B',         // Violet - atmosphere
  WORLD: '#2C3E50',        // Dark blue - universes
  DIMENSION: '#34495E',    // Gray - parallels
  TIMELINE: '#1ABC9C',     // Turquoise - time
  STORY: '#9B59B6',        // Purple - narrative
  SCENE: '#27AE60',        // Green - moments
  CHAPTER: '#16A085',      // Teal - sections
  RESOLUTION: '#2980B9',   // Blue - endings
  CUSTOM: '#7F8C8D',       // Gray - user defined
};

// ============ Physics Constants ============

const G = 0.5; // Gravitational constant
const CENTER_MASS = 1000; // Mass of universe center
const SUN_MASS_MULTIPLIER = 50; // How much connections affect mass
const MIN_ORBIT_RADIUS = 3;
const MAX_ORBIT_RADIUS = 30;
const ASTEROID_BELT_RADIUS = 40;

// ============ Helper Functions ============

function getBeatColor(type: string, intensity: number, valence: number, colorMode: string): THREE.Color {
  if (colorMode === 'intensity') {
    // Intensity: low = dim, high = bright
    const h = 0.6; // Blue
    const s = 0.8;
    const l = 0.3 + intensity * 0.5;
    return new THREE.Color().setHSL(h, s, l);
  }
  
  if (colorMode === 'valence') {
    // Valence: negative = red, neutral = white, positive = green
    const h = (valence + 1) * 0.15; // -1 -> 0 (red), 0 -> 0.15 (orange/yellow), 1 -> 0.3 (green)
    const s = Math.abs(valence) * 0.5 + 0.5;
    const l = 0.5;
    return new THREE.Color().setHSL(h, s, l);
  }
  
  // Default: by type
  const hex = BEAT_COLORS[type] || BEAT_COLORS.CUSTOM;
  return new THREE.Color(hex);
}

function classifyBeat(node: BeatNode, edges: BeatEdge[]): 'sun' | 'planet' | 'moon' | 'asteroid' {
  // Count connections
  const connections = edges.filter(e => e.from === node.id || e.to === node.id);
  
  // High-frequency, highly connected = sun (major concept)
  if (connections.length >= 5 || node.frequency >= 5) {
    return 'sun';
  }
  
  // Moderately connected = planet
  if (connections.length >= 2) {
    return 'planet';
  }
  
  // Connected but isolated = moon
  if (connections.length === 1) {
    return 'moon';
  }
  
  // No connections = asteroid (floating debris)
  return 'asteroid';
}

function calculateMass(node: BeatNode, edges: BeatEdge[]): number {
  const connections = edges.filter(e => e.from === node.id || e.to === node.id);
  const baseMass = node.intensity * 10;
  const connectionMass = connections.length * SUN_MASS_MULTIPLIER;
  const frequencyMass = node.frequency * 5;
  
  return baseMass + connectionMass + frequencyMass;
}

// ============ Celestial Body Component ============

interface CelestialBodyMeshProps {
  body: CelestialBody;
  onHover?: (body: CelestialBody | null) => void;
  onClick?: (body: CelestialBody) => void;
  showLabel?: boolean;
  isSelected?: boolean;
  isHighlighted?: boolean;
}

function CelestialBodyMesh({ 
  body, 
  onHover, 
  onClick, 
  showLabel,
  isSelected,
  isHighlighted 
}: CelestialBodyMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  
  // Animation
  useFrame((state, delta) => {
    if (!meshRef.current) return;
    
    // Orbital motion for planets/moons
    if (body.type === 'planet' || body.type === 'moon') {
      const angle = state.clock.elapsedTime * (body.orbitSpeed || 0.1);
      if (body.orbitCenter) {
        meshRef.current.position.x = body.orbitCenter.x + Math.cos(angle) * (body.orbitRadius || 5);
        meshRef.current.position.z = body.orbitCenter.z + Math.sin(angle) * (body.orbitRadius || 5);
      }
    }
    
    // Gentle rotation for suns
    if (body.type === 'sun') {
      meshRef.current.rotation.y += delta * 0.1;
    }
    
    // Glow pulse for suns
    if (glowRef.current && body.type === 'sun') {
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.1;
      glowRef.current.scale.setScalar(pulse);
    }
  });
  
  // Size based on type
  const radius = useMemo(() => {
    switch (body.type) {
      case 'sun': return body.radius * 1.5;
      case 'planet': return body.radius;
      case 'moon': return body.radius * 0.5;
      case 'asteroid': return 0.2 + Math.random() * 0.3;
      default: return 1;
    }
  }, [body.type, body.radius]);
  
  // Emissive intensity for suns
  const emissiveIntensity = body.type === 'sun' ? 0.8 : 0.1;
  
  return (
    <group>
      {/* Main body */}
      <mesh
        ref={meshRef}
        position={body.position}
        onClick={() => onClick?.(body)}
        onPointerOver={(e) => { e.stopPropagation(); onHover?.(body); }}
        onPointerOut={() => onHover?.(null)}
      >
        {body.type === 'sun' ? (
          // Sun: glowing sphere
          <sphereGeometry args={[radius, 32, 32]} />
        ) : body.type === 'asteroid' ? (
          // Asteroid: irregular shape
          <icosahedronGeometry args={[radius, 0]} />
        ) : (
          // Planet/moon: smooth sphere
          <sphereGeometry args={[radius, 32, 32]} />
        )}
        
        <meshStandardMaterial
          color={body.color}
          emissive={body.type === 'sun' ? body.color : undefined}
          emissiveIntensity={emissiveIntensity}
          roughness={body.type === 'sun' ? 0.3 : 0.7}
          metalness={body.type === 'sun' ? 0 : 0.3}
        />
      </mesh>
      
      {/* Glow effect for suns */}
      {body.type === 'sun' && (
        <mesh ref={glowRef} position={body.position}>
          <sphereGeometry args={[radius * 1.2, 16, 16]} />
          <meshBasicMaterial
            color={body.color}
            transparent
            opacity={0.2}
          />
        </mesh>
      )}
      
      {/* Label */}
      {showLabel && (
        <Text
          position={[body.position.x, body.position.y + radius + 0.5, body.position.z]}
          fontSize={body.type === 'sun' ? 0.5 : 0.3}
          color="white"
          anchorX="center"
          anchorY="bottom"
        >
          {body.node.name}
        </Text>
      )}
      
      {/* Selection ring */}
      {isSelected && (
        <mesh position={body.position}>
          <torusGeometry args={[radius * 1.5, 0.05, 8, 32]} />
          <meshBasicMaterial color="#00FFFF" />
        </mesh>
      )}
      
      {/* Highlight ring */}
      {isHighlighted && (
        <mesh position={body.position}>
          <torusGeometry args={[radius * 1.3, 0.03, 8, 32]} />
          <meshBasicMaterial color="#FFFF00" transparent opacity={0.7} />
        </mesh>
      )}
    </group>
  );
}

// ============ Orbit Lines ============

interface OrbitLineProps {
  center: THREE.Vector3;
  radius: number;
  color?: string;
}

function OrbitLine({ center, radius, color = '#333333' }: OrbitLineProps) {
  const points = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 64; i++) {
      const angle = (i / 64) * Math.PI * 2;
      pts.push(new THREE.Vector3(
        center.x + Math.cos(angle) * radius,
        center.y,
        center.z + Math.sin(angle) * radius
      ));
    }
    return pts;
  }, [center, radius]);
  
  return (
    <Line
      points={points}
      color={color}
      lineWidth={0.5}
      opacity={0.3}
      transparent
    />
  );
}

// ============ Connection Lines (Gravity Wells) ============

interface ConnectionLinesProps {
  bodies: Map<string, CelestialBody>;
  edges: BeatEdge[];
  showLines?: boolean;
}

function ConnectionLines({ bodies, edges, showLines }: ConnectionLinesProps) {
  const lines = useMemo(() => {
    if (!showLines) return [];
    
    return edges
      .map(edge => {
        const fromBody = bodies.get(edge.from);
        const toBody = bodies.get(edge.to);
        
        if (!fromBody || !toBody) return null;
        
        // Color based on connection type
        let color = '#666666';
        if (edge.isContradiction) color = '#FF4444';
        else if (edge.type === 'CAUSES') color = '#44FF44';
        else if (edge.type === 'MIRRORS') color = '#4444FF';
        else if (edge.type === 'FORESHADOWS') color = '#FFFF44';
        
        // Opacity based on strength
        const opacity = edge.strength * 0.5;
        
        return {
          from: fromBody.position,
          to: toBody.position,
          color,
          opacity
        };
      })
      .filter(Boolean) as Array<{ from: THREE.Vector3; to: THREE.Vector3; color: string; opacity: number }>;
  }, [bodies, edges, showLines]);
  
  return (
    <group>
      {lines.map((line, i) => (
        <Line
          key={i}
          points={[line.from, line.to]}
          color={line.color}
          lineWidth={1}
          opacity={line.opacity}
          transparent
        />
      ))}
    </group>
  );
}

// ============ Universe Scene ============

interface UniverseSceneProps extends BeatUniverseProps {
  bodies: CelestialBody[];
  bodyMap: Map<string, CelestialBody>;
}

function UniverseScene({ 
  mesh, 
  bodies, 
  bodyMap, 
  onBeatSelect, 
  onBeatHover,
  highlightId,
  showLabels,
  showConnections,
  colorMode
}: UniverseSceneProps & { bodies: CelestialBody[]; bodyMap: Map<string, CelestialBody> }) {
  const [hoveredBody, setHoveredBody] = useState<CelestialBody | null>(null);
  const [selectedBody, setSelectedBody] = useState<CelestialBody | null>(null);
  
  return (
    <>
      {/* Ambient lighting */}
      <ambientLight intensity={0.2} />
      
      {/* Point lights from suns */}
      {bodies
        .filter(b => b.type === 'sun')
        .map(sun => (
          <pointLight
            key={sun.id}
            position={sun.position}
            color={sun.color}
            intensity={2}
            distance={20}
          />
        ))
      }
      
      {/* Stars background */}
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
      
      {/* Asteroid belt (isolated beats) */}
      {bodies
        .filter(b => b.type === 'asteroid')
        .map((body, i) => (
          <Float key={body.id} speed={0.5} rotationIntensity={0.2} floatIntensity={0.5}>
            <CelestialBodyMesh
              body={body}
              onHover={setHoveredBody}
              onClick={(b) => {
                setSelectedBody(b);
                onBeatSelect?.(b.node);
              }}
              showLabel={showLabels}
              isHighlighted={highlightId === body.id}
            />
          </Float>
        ))
      }
      
      {/* Orbital systems (suns, planets, moons) */}
      {bodies
        .filter(b => b.type !== 'asteroid')
        .map((body) => {
          const isSelected = selectedBody?.id === body.id;
          const isHighlighted = highlightId === body.id;
          
          return (
            <group key={body.id}>
              {/* Orbit line for planets/moons */}
              {(body.type === 'planet' || body.type === 'moon') && body.orbitCenter && body.orbitRadius && (
                <OrbitLine center={body.orbitCenter} radius={body.orbitRadius} />
              )}
              
              <CelestialBodyMesh
                body={body}
                onHover={setHoveredBody}
                onClick={(b) => {
                  setSelectedBody(b);
                  onBeatSelect?.(b.node);
                }}
                showLabel={showLabels}
                isSelected={isSelected}
                isHighlighted={isHighlighted}
              />
            </group>
          );
        })
      }
      
      {/* Connection lines */}
      <ConnectionLines 
        bodies={bodyMap} 
        edges={mesh.edges} 
        showLines={showConnections} 
      />
      
      {/* Controls */}
      <OrbitControls 
        enablePan={true}
        enableZoom={true}
        minDistance={5}
        maxDistance={100}
      />
    </>
  );
}

// ============ Main Component ============

export function BeatUniverse({
  mesh,
  onBeatSelect,
  onBeatHover,
  highlightId,
  showLabels = true,
  showConnections = true,
  colorMode = 'type'
}: BeatUniverseProps) {
  // Build celestial bodies from beat mesh
  const { bodies, bodyMap } = useMemo(() => {
    const bodyList: CelestialBody[] = [];
    const bodyMap = new Map<string, CelestialBody>();
    
    // First pass: classify and create bodies
    for (const node of mesh.nodes) {
      const classification = classifyBeat(node, mesh.edges);
      const mass = calculateMass(node, mesh.edges);
      const radius = Math.sqrt(mass) * 0.3;
      const color = getBeatColor(node.type, node.intensity, node.valence || 0, colorMode);
      
      let position: THREE.Vector3;
      let orbitCenter: THREE.Vector3 | undefined;
      let orbitRadius: number | undefined;
      let orbitSpeed: number | undefined;
      
      if (classification === 'sun') {
        // Suns get placed based on their mass (gravitational center)
        position = new THREE.Vector3(
          (Math.random() - 0.5) * 20,
          (Math.random() - 0.5) * 5,
          (Math.random() - 0.5) * 20
        );
      } else if (classification === 'asteroid') {
        // Asteroids in the outer belt
        const angle = Math.random() * Math.PI * 2;
        const r = ASTEROID_BELT_RADIUS + Math.random() * 20;
        position = new THREE.Vector3(
          Math.cos(angle) * r,
          (Math.random() - 0.5) * 10,
          Math.sin(angle) * r
        );
      } else {
        // Planets/moons get temporary position (will be updated based on parent)
        position = new THREE.Vector3(0, 0, 0);
      }
      
      const body: CelestialBody = {
        id: node.id,
        type: classification,
        node,
        position,
        velocity: new THREE.Vector3(0, 0, 0),
        mass,
        radius,
        color,
        orbitCenter,
        orbitRadius,
        orbitSpeed,
        children: []
      };
      
      bodyList.push(body);
      bodyMap.set(node.id, body);
    }
    
    // Second pass: establish orbital relationships
    const suns = bodyList.filter(b => b.type === 'sun');
    
    for (const body of bodyList) {
      if (body.type === 'planet' || body.type === 'moon') {
        // Find the nearest sun (by connection strength)
        const connections = mesh.edges.filter(e => 
          e.from === body.id || e.to === body.id
        );
        
        let bestSun: CelestialBody | null = null;
        let bestStrength = 0;
        
        for (const edge of connections) {
          const otherId = edge.from === body.id ? edge.to : edge.from;
          const other = bodyMap.get(otherId);
          
          if (other?.type === 'sun' && edge.strength > bestStrength) {
            bestSun = other;
            bestStrength = edge.strength;
          }
        }
        
        if (bestSun) {
          // Orbit around this sun
          body.orbitCenter = bestSun.position.clone();
          body.orbitRadius = MIN_ORBIT_RADIUS + Math.random() * (MAX_ORBIT_RADIUS - MIN_ORBIT_RADIUS);
          body.orbitSpeed = 0.05 + Math.random() * 0.1;
          
          // Initial position in orbit
          const angle = Math.random() * Math.PI * 2;
          body.position.set(
            body.orbitCenter.x + Math.cos(angle) * body.orbitRadius,
            body.orbitCenter.y + (Math.random() - 0.5) * 2,
            body.orbitCenter.z + Math.sin(angle) * body.orbitRadius
          );
          
          bestSun.children.push(body);
        } else {
          // No sun found, become asteroid
          body.type = 'asteroid';
        }
      }
    }
    
    // Moons orbit around their parent planet
    for (const body of bodyList) {
      if (body.type === 'moon') {
        const connections = mesh.edges.filter(e => 
          e.from === body.id || e.to === body.id
        );
        
        for (const edge of connections) {
          const otherId = edge.from === body.id ? edge.to : edge.from;
          const other = bodyMap.get(otherId);
          
          if (other?.type === 'planet') {
            body.orbitCenter = other.position.clone();
            body.orbitRadius = 1 + Math.random() * 2;
            body.orbitSpeed = 0.2 + Math.random() * 0.3;
            other.children.push(body);
            break;
          }
        }
      }
    }
    
    return { bodies: bodyList, bodyMap };
  }, [mesh, colorMode]);
  
  return (
    <div className="w-full h-full bg-black">
      <Canvas
        camera={{ position: [0, 20, 40], fov: 60 }}
        gl={{ antialias: true, alpha: false }}
      >
        <color attach="background" args={['#0a0a0a']} />
        <UniverseScene
          mesh={mesh}
          bodies={bodies}
          bodyMap={bodyMap}
          onBeatSelect={onBeatSelect}
          onBeatHover={onBeatHover}
          highlightId={highlightId}
          showLabels={showLabels}
          showConnections={showConnections}
          colorMode={colorMode}
        />
      </Canvas>
      
      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-black/70 p-3 rounded text-xs text-white">
        <div className="font-bold mb-2">Beat Universe</div>
        <div className="flex flex-wrap gap-2">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-yellow-400" /> Sun (core concept)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-400" /> Planet
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" /> Moon
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1 h-1 bg-gray-600" /> Asteroid (isolated)
          </span>
        </div>
      </div>
    </div>
  );
}

export default BeatUniverse;