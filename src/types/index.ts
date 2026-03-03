// Core Note types
export interface Note {
  id: string;
  userId: string;
  title: string | null;
  content: string;
  contentPlain: string | null;
  noteType: NoteType;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown> | null;
  
  // Relations
  connectionsFrom?: Connection[];
  connectionsTo?: Connection[];
  entityMentions?: EntityMention[];
  beats?: Beat[];
  collections?: CollectionNote[];
  tags?: NoteTag[];
}

export type NoteType = 'note' | 'journal' | 'beat';

export interface CreateNoteInput {
  title?: string;
  content: string;
  noteType?: NoteType;
  metadata?: Record<string, unknown>;
  entityIds?: string[];
  collectionIds?: string[];
  tagIds?: string[];
}

export interface UpdateNoteInput {
  title?: string;
  content?: string;
  noteType?: NoteType;
  metadata?: Record<string, unknown>;
}

// Connection types
export interface Connection {
  id: string;
  userId: string;
  fromNoteId: string;
  toNoteId: string;
  connectionType: ConnectionType;
  strength: number;
  createdAt: Date;
  
  // Relations
  fromNote?: Note;
  toNote?: Note;
}

export type ConnectionType = 'reference' | 'semantic' | 'temporal';

// Entity types
export interface Entity {
  id: string;
  userId: string;
  name: string;
  entityType: EntityType;
  aliases: string[];
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  
  // Relations
  mentions?: EntityMention[];
}

export type EntityType = 'person' | 'place' | 'project' | 'concept' | 'event';

export interface EntityMention {
  id: string;
  entityId: string;
  noteId: string;
  context: string | null;
  confidence: number;
  createdAt: Date;
  
  // Relations
  entity?: Entity;
  note?: Note;
}

// Beat types
export interface Beat {
  id: string;
  userId: string;
  noteId: string;
  beatType: BeatType;
  startedAt: Date | null;
  endedAt: Date | null;
  intensity: number;
  createdAt: Date;
  
  // Relations
  note?: Note;
}

export type BeatType = 'event' | 'milestone' | 'feeling' | 'insight';

// Collection types
export interface Collection {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  createdAt: Date;
  
  // Relations
  notes?: CollectionNote[];
}

export interface CollectionNote {
  collectionId: string;
  noteId: string;
  addedAt: Date;
  
  // Relations
  collection?: Collection;
  note?: Note;
}

// Tag types
export interface Tag {
  id: string;
  userId: string;
  name: string;
  color: string;
  createdAt: Date;
  
  // Relations
  notes?: NoteTag[];
}

export interface NoteTag {
  noteId: string;
  tagId: string;
  
  // Relations
  note?: Note;
  tag?: Tag;
}

// Timeline types
export interface TimelineItem {
  id: string;
  title: string;
  content: string;
  date: Date;
  type: NoteType | BeatType;
  metadata?: {
    entities?: Entity[];
    connections?: Connection[];
  };
}

export type TimelineView = 'horizontal' | 'vertical' | 'calendar' | 'tree';
export type TimelineZoom = 'day' | 'week' | 'month' | 'year';

// Search types
export interface SearchResult {
  note: Note;
  score: number;
  highlights?: string[];
}

export interface SearchFilters {
  dateRange?: {
    start: Date;
    end: Date;
  };
  entities?: string[];
  types?: (NoteType | BeatType)[];
  collections?: string[];
  tags?: string[];
}

export interface SearchOptions {
  query: string;
  type?: 'semantic' | 'keyword' | 'hybrid';
  filters?: SearchFilters;
  limit?: number;
  offset?: number;
}

// MCP types
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface MCPToolResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}