// Demo mode - uses localStorage when no database is configured OR no user logged in
// When a user logs in with real auth, use the API instead

const DEMO_USER_ID = "demo-user";

// Types
export interface DemoNote {
  id: string;
  userId: string;
  title: string | null;
  content: string;
  contentPlain: string | null;
  noteType: string;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown> | null;
}

export interface DemoEntity {
  id: string;
  userId: string;
  name: string;
  entityType: string;
  aliases: string[];
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface DemoCollection {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  createdAt: string;
}

export interface DemoBeat {
  id: string;
  userId: string;
  noteId: string;
  beatType: string;
  startedAt: string | null;
  endedAt: string | null;
  intensity: number;
  createdAt: string;
}

// Storage keys
const KEYS = {
  notes: "context_demo_notes",
  entities: "context_demo_entities",
  collections: "context_demo_collections",
  beats: "context_demo_beats",
  connections: "context_demo_connections",
};

// Helper to generate IDs
function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

// Helper to get plain text from content
function getPlainText(content: string): string {
  return content
    .replace(/#{1,6}\s/g, "")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/`/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\n+/g, " ")
    .trim()
    .slice(0, 500);
}

/**
 * Check if demo mode is active.
 * Demo mode is ACTIVE when:
 * - No valid auth token exists in localStorage
 * 
 * Demo mode is INACTIVE when:
 * - User has logged in with real Supabase auth (sb_token exists and is valid)
 */
export function isDemoMode(): boolean {
  if (typeof window === "undefined") return true;
  
  // Check for Supabase auth token
  const token = localStorage.getItem("sb_token");
  const userStr = localStorage.getItem("sb_user");
  
  // If no token or user, use demo mode
  if (!token || !userStr) {
    return true;
  }
  
  try {
    const user = JSON.parse(userStr);
    // If we have a real user (not demo), use API mode
    if (user && user.id && user.id !== DEMO_USER_ID) {
      return false;
    }
  } catch {
    // Invalid user data, use demo mode
    return true;
  }
  
  return true;
}

/**
 * Check if user is logged in with real auth
 */
export function isLoggedIn(): boolean {
  return !isDemoMode();
}

/**
 * Get auth token for API requests
 */
export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("sb_token");
}

/**
 * Get current user info
 */
export function getCurrentUser(): { id: string; email?: string; name?: string } | null {
  if (typeof window === "undefined") return null;
  
  const userStr = localStorage.getItem("sb_user");
  if (!userStr) return null;
  
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

/**
 * Logout - clear auth tokens
 */
export function logout(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("sb_token");
  localStorage.removeItem("sb_user");
}

// Notes
export function getDemoNotes(): DemoNote[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(KEYS.notes);
  return data ? JSON.parse(data) : [];
}

export function createDemoNote(data: {
  title?: string;
  content: string;
  noteType?: string;
  metadata?: Record<string, unknown>;
}): DemoNote {
  const note: DemoNote = {
    id: generateId(),
    userId: DEMO_USER_ID,
    title: data.title || null,
    content: data.content,
    contentPlain: getPlainText(data.content),
    noteType: data.noteType || "note",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: data.metadata || null,
  };

  const notes = getDemoNotes();
  notes.unshift(note);
  localStorage.setItem(KEYS.notes, JSON.stringify(notes));

  return note;
}

export function updateDemoNote(id: string, data: Partial<DemoNote>): DemoNote | null {
  const notes = getDemoNotes();
  const index = notes.findIndex(n => n.id === id);
  if (index === -1) return null;

  notes[index] = {
    ...notes[index],
    ...data,
    contentPlain: data.content ? getPlainText(data.content) : notes[index].contentPlain,
    updatedAt: new Date().toISOString(),
  };

  localStorage.setItem(KEYS.notes, JSON.stringify(notes));
  return notes[index];
}

export function deleteDemoNote(id: string): boolean {
  const notes = getDemoNotes();
  const filtered = notes.filter(n => n.id !== id);
  localStorage.setItem(KEYS.notes, JSON.stringify(filtered));
  return filtered.length !== notes.length;
}

// Entities
export function getDemoEntities(): DemoEntity[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(KEYS.entities);
  return data ? JSON.parse(data) : [];
}

export function createDemoEntity(data: {
  name: string;
  entityType: string;
  aliases?: string[];
  metadata?: Record<string, unknown>;
}): DemoEntity {
  const entity: DemoEntity = {
    id: generateId(),
    userId: DEMO_USER_ID,
    name: data.name,
    entityType: data.entityType,
    aliases: data.aliases || [],
    metadata: data.metadata || null,
    createdAt: new Date().toISOString(),
  };

  const entities = getDemoEntities();
  entities.unshift(entity);
  localStorage.setItem(KEYS.entities, JSON.stringify(entities));

  return entity;
}

// Collections
export function getDemoCollections(): DemoCollection[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(KEYS.collections);
  return data ? JSON.parse(data) : [];
}

export function createDemoCollection(data: {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}): DemoCollection {
  const collection: DemoCollection = {
    id: generateId(),
    userId: DEMO_USER_ID,
    name: data.name,
    description: data.description || null,
    color: data.color || "#6366F1",
    icon: data.icon || null,
    createdAt: new Date().toISOString(),
  };

  const collections = getDemoCollections();
  collections.unshift(collection);
  localStorage.setItem(KEYS.collections, JSON.stringify(collections));

  return collection;
}

// Beats
export function getDemoBeats(): DemoBeat[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(KEYS.beats);
  return data ? JSON.parse(data) : [];
}

export function createDemoBeat(data: {
  noteId?: string;
  beatType: string;
  startedAt?: string;
  endedAt?: string;
  intensity?: number;
}): DemoBeat {
  const beat: DemoBeat = {
    id: generateId(),
    userId: DEMO_USER_ID,
    noteId: data.noteId || "",
    beatType: data.beatType,
    startedAt: data.startedAt || null,
    endedAt: data.endedAt || null,
    intensity: data.intensity || 3,
    createdAt: new Date().toISOString(),
  };

  const beats = getDemoBeats();
  beats.unshift(beat);
  localStorage.setItem(KEYS.beats, JSON.stringify(beats));

  return beat;
}

export interface DemoConnection {
  id: string;
  userId: string;
  fromNoteId: string;
  toNoteId: string;
  connectionType: string;
  strength: number;
  createdAt: string;
}

export function getDemoConnections(): DemoConnection[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(KEYS.connections);
  return data ? JSON.parse(data) : [];
}

export function createDemoConnection(data: {
  fromNoteId: string;
  toNoteId: string;
  connectionType?: string;
  strength?: number;
}): DemoConnection {
  const connection: DemoConnection = {
    id: generateId(),
    userId: DEMO_USER_ID,
    fromNoteId: data.fromNoteId,
    toNoteId: data.toNoteId,
    connectionType: data.connectionType || "reference",
    strength: data.strength || 1.0,
    createdAt: new Date().toISOString(),
  };

  const connections = getDemoConnections();
  connections.unshift(connection);
  localStorage.setItem(KEYS.connections, JSON.stringify(connections));

  return connection;
}

// Search (simple text search for demo)
export function searchDemoNotes(query: string): DemoNote[] {
  const notes = getDemoNotes();
  const lowerQuery = query.toLowerCase();
  
  return notes.filter(note => {
    const title = note.title?.toLowerCase() || "";
    const content = note.content.toLowerCase();
    const plain = note.contentPlain?.toLowerCase() || "";
    
    return title.includes(lowerQuery) || content.includes(lowerQuery) || plain.includes(lowerQuery);
  });
}

// Clear all demo data
export function clearDemoData(): void {
  if (typeof window === "undefined") return;
  Object.values(KEYS).forEach(key => localStorage.removeItem(key));
}