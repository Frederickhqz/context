// Beat Types - Core type definitions for the multidimensional mesh

export type BeatType = 
  // Narrative
  | 'STORY'
  | 'SCENE'
  | 'CHAPTER'
  // Entities
  | 'CHARACTER'
  | 'PLACE'
  | 'OBJECT'
  | 'CREATURE'
  // Concepts
  | 'THEME'
  | 'MOTIF'
  | 'IDEA'
  | 'QUESTION'
  | 'INSIGHT'
  // Dynamics
  | 'RELATIONSHIP'
  | 'CONFLICT'
  | 'RESOLUTION'
  // Meta
  | 'WORLD'
  | 'DIMENSION'
  | 'TIMELINE'
  // Emotional
  | 'FEELING'
  | 'MOOD'
  // Custom
  | 'CUSTOM';

export type BeatConnectionType =
  // Relational
  | 'RELATES_TO'
  | 'PART_OF'
  | 'CONTAINS'
  | 'REFERENCES'
  // Narrative
  | 'CAUSES'
  | 'RESULTS_FROM'
  | 'FORESHADOWS'
  | 'MIRRORS'
  | 'CONTRADICTS'
  | 'RESOLVES'
  // Temporal
  | 'PRECEDES'
  | 'FOLLOWS'
  | 'CONCURRENT'
  // Transformative
  | 'EVOLVES_TO'
  | 'EVOLVES_FROM'
  | 'REPLACES'
  // Dimensional
  | 'ALTERNATE_OF'
  | 'PARALLEL_TO'
  // Emotional
  | 'SUPPORTS'
  | 'UNDERMINES'
  | 'TENSIONS_WITH';

export type BeatSource = 'AUTO' | 'MANUAL' | 'HYBRID' | 'IMPORTED';

export type AnalysisStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

// Runtime constants (for use in code)
export const BeatSource = {
  AUTO: 'AUTO',
  MANUAL: 'MANUAL',
  HYBRID: 'HYBRID',
  IMPORTED: 'IMPORTED',
} as const;

export const AnalysisStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;

export interface Beat {
  id: string;
  userId: string;
  beatType: BeatType;
  name: string;
  summary?: string;
  content?: string;
  aliases: string[];
  embedding?: number[];
  metadata?: Record<string, unknown>;
  intensity: number; // 0-1
  valence?: number; // -1 to 1
  source: BeatSource;
  confidence: number; // 0-1
  frequency: number;
  
  // Temporal
  timelineId?: string;
  startTime?: string;
  endTime?: string;
  
  // World/dimension
  worldId?: string;
  dimensionId?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface BeatConnection {
  id: string;
  userId: string;
  fromBeatId: string;
  toBeatId: string;
  connectionType: BeatConnectionType;
  strength: number; // 0-1
  description?: string;
  evidence?: string;
  isContradiction: boolean;
  contradictionNote?: string;
  isSuggested: boolean;
  suggestedBy?: string;
  contextTime?: string;
  createdAt: Date;
}

export interface NoteBeat {
  noteId: string;
  beatId: string;
  relevance: number; // 0-1
  mentions: number;
  context?: string;
}

// Extraction result from AI
export interface ExtractedBeat {
  type: BeatType;
  name: string;
  summary: string;
  intensity: number;
  valence: number;
  confidence: number;
  connections?: ExtractedConnection[];
}

export interface ExtractedConnection {
  toBeatName: string;
  type: BeatConnectionType;
  strength: number;
  evidence: string;
}

// API Types
export interface CreateBeatInput {
  beatType: BeatType;
  name: string;
  summary?: string;
  content?: string;
  aliases?: string[];
  intensity?: number;
  valence?: number;
  timelineId?: string;
  worldId?: string;
  dimensionId?: string;
}

export interface CreateBeatConnectionInput {
  fromBeatId: string;
  toBeatId: string;
  connectionType: BeatConnectionType;
  strength?: number;
  description?: string;
  evidence?: string;
}

// 3D Visualization Types
export interface BeatNode {
  id: string;
  type: BeatType;
  name: string;
  summary?: string;
  intensity: number;
  valence?: number;
  frequency: number;
  position?: [number, number, number];
}

export interface BeatEdge {
  id: string;
  from: string;
  to: string;
  type: BeatConnectionType;
  strength: number;
  isContradiction: boolean;
}

export interface BeatMesh {
  nodes: BeatNode[];
  edges: BeatEdge[];
}

// Import Types
export interface ImportProgress {
  id: string;
  status: 'UPLOADING' | 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  totalChunks: number;
  processedChunks: number;
  notesCreated: number;
  beatsExtracted: number;
  connectionsFound: number;
  errors?: string[];
  startedAt: Date;
  completedAt?: Date;
}

// Beat Type Metadata (for UI)
export const BEAT_TYPE_CONFIG: Record<BeatType, {
  label: string;
  color: string;
  shape: 'sphere' | 'octahedron' | 'torus' | 'icosahedron' | 'cube' | 'cone' | 'dodecahedron' | 'sphere-large';
  description: string;
}> = {
  // Narrative
  STORY: { label: 'Story', color: '#9B59B6', shape: 'sphere-large', description: 'Main story arc' },
  SCENE: { label: 'Scene', color: '#3498DB', shape: 'octahedron', description: 'A scene or moment' },
  CHAPTER: { label: 'Chapter', color: '#2ECC71', shape: 'cube', description: 'Chapter marker' },
  // Entities
  CHARACTER: { label: 'Character', color: '#FF6B6B', shape: 'sphere', description: 'Person or being' },
  PLACE: { label: 'Place', color: '#1ABC9C', shape: 'cube', description: 'Location' },
  OBJECT: { label: 'Object', color: '#F39C12', shape: 'icosahedron', description: 'Significant item' },
  CREATURE: { label: 'Creature', color: '#E74C3C', shape: 'sphere', description: 'Non-character being' },
  // Concepts
  THEME: { label: 'Theme', color: '#9B59B6', shape: 'torus', description: 'Recurring theme' },
  MOTIF: { label: 'Motif', color: '#F39C12', shape: 'icosahedron', description: 'Recurring symbol/pattern' },
  IDEA: { label: 'Idea', color: '#3498DB', shape: 'octahedron', description: 'Abstract concept' },
  QUESTION: { label: 'Question', color: '#E74C3C', shape: 'cone', description: 'Unresolved mystery' },
  INSIGHT: { label: 'Insight', color: '#2ECC71', shape: 'dodecahedron', description: 'Key realization' },
  // Dynamics
  RELATIONSHIP: { label: 'Relationship', color: '#E91E63', shape: 'torus', description: 'Dynamic between entities' },
  CONFLICT: { label: 'Conflict', color: '#E74C3C', shape: 'octahedron', description: 'Tension or opposition' },
  RESOLUTION: { label: 'Resolution', color: '#2ECC71', shape: 'dodecahedron', description: 'Resolution point' },
  // Meta
  WORLD: { label: 'World', color: '#1ABC9C', shape: 'sphere-large', description: 'World or universe' },
  DIMENSION: { label: 'Dimension', color: '#9B59B6', shape: 'sphere', description: 'Parallel dimension/timeline' },
  TIMELINE: { label: 'Timeline', color: '#3498DB', shape: 'cube', description: 'Temporal sequence' },
  // Emotional
  FEELING: { label: 'Feeling', color: '#FF6B6B', shape: 'sphere', description: 'Emotional beat' },
  MOOD: { label: 'Mood', color: '#F39C12', shape: 'torus', description: 'Atmospheric quality' },
  // Custom
  CUSTOM: { label: 'Custom', color: '#6B7280', shape: 'sphere', description: 'User-defined type' },
};

// Connection Type Metadata (for UI)
export const CONNECTION_TYPE_CONFIG: Record<BeatConnectionType, {
  label: string;
  color: string;
  style: 'solid' | 'dashed' | 'dotted' | 'arrow';
  description: string;
}> = {
  // Relational
  RELATES_TO: { label: 'Relates to', color: '#888888', style: 'solid', description: 'General connection' },
  PART_OF: { label: 'Part of', color: '#3498DB', style: 'solid', description: 'Hierarchy' },
  CONTAINS: { label: 'Contains', color: '#3498DB', style: 'solid', description: 'Inverse hierarchy' },
  REFERENCES: { label: 'References', color: '#888888', style: 'dotted', description: 'Explicit reference' },
  // Narrative
  CAUSES: { label: 'Causes', color: '#2ECC71', style: 'arrow', description: 'Causal chain' },
  RESULTS_FROM: { label: 'Results from', color: '#2ECC71', style: 'solid', description: 'Inverse causal' },
  FORESHADOWS: { label: 'Foreshadows', color: '#F39C12', style: 'dotted', description: 'Narrative setup' },
  MIRRORS: { label: 'Mirrors', color: '#9B59B6', style: 'dashed', description: 'Parallel or echo' },
  CONTRADICTS: { label: 'Contradicts', color: '#E74C3C', style: 'solid', description: 'Conflict/tension' },
  RESOLVES: { label: 'Resolves', color: '#2ECC71', style: 'solid', description: 'Resolution' },
  // Temporal
  PRECEDES: { label: 'Precedes', color: '#3498DB', style: 'solid', description: 'Time order' },
  FOLLOWS: { label: 'Follows', color: '#3498DB', style: 'solid', description: 'Inverse time order' },
  CONCURRENT: { label: 'Concurrent', color: '#1ABC9C', style: 'dashed', description: 'Same time' },
  // Transformative
  EVOLVES_TO: { label: 'Evolves to', color: '#F39C12', style: 'arrow', description: 'Transformation' },
  EVOLVES_FROM: { label: 'Evolves from', color: '#F39C12', style: 'solid', description: 'Inverse transformation' },
  REPLACES: { label: 'Replaces', color: '#E74C3C', style: 'solid', description: 'Supersedes' },
  // Dimensional
  ALTERNATE_OF: { label: 'Alternate of', color: '#9B59B6', style: 'dashed', description: 'Alternate timeline/version' },
  PARALLEL_TO: { label: 'Parallel to', color: '#9B59B6', style: 'dashed', description: 'Parallel dimension' },
  // Emotional
  SUPPORTS: { label: 'Supports', color: '#2ECC71', style: 'solid', description: 'Reinforces' },
  UNDERMINES: { label: 'Undermines', color: '#E74C3C', style: 'solid', description: 'Weakens' },
  TENSIONS_WITH: { label: 'Tensions with', color: '#F39C12', style: 'dashed', description: 'Creates tension' },
};