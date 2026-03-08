/**
 * Shared Native AI Specification v1.0
 * 
 * This file defines the constants and types used by all extraction engines
 * (WebLLM, Apple Intelligence, and Android AICore) to ensure consistency.
 */

export const SHARED_SPEC_VERSION = "1.0";

// ⚠️ THE LOCKED EMBEDDING MODEL
// Every vector in the database MUST use this encoder.
export const LOCKED_EMBEDDING_MODEL = {
  id: "nomic-embed-text-v1.5",
  dimensions: 768,
  provider: "locked_shared"
};

export type BeatType = 
  | "CHARACTER" 
  | "PLACE" 
  | "THEME" 
  | "CONFLICT" 
  | "EVENT" 
  | "FEELING" 
  | "IDEA";

export type ConnectionType = 
  | "MIRRORS" 
  | "CAUSES" 
  | "CONTRADICTS" 
  | "SUPPORTS" 
  | "EVOLVES_TO";

export interface SharedExtractionResult {
  version: string;
  beats: Array<{
    type: BeatType;
    name: string;
    summary: string;
    intensity: number; // 0.0 - 1.0
    valence: number;   // -1.0 - 1.0
  }>;
  connections: Array<{
    from: string;
    to: string;
    type: ConnectionType;
    strength: number;
  }>;
}

export const EXTRACTION_SYSTEM_PROMPT = `
You are an atomic meaning extractor for the Context app.
Extract "Beats" (atomic units of meaning) and their "Connections".

RULES:
1. One single concept per beat.
2. Follow the specified types strictly.
3. Output ONLY valid JSON matching the SharedExtractionResult schema.
`.trim();
