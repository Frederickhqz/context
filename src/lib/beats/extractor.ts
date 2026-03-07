// Beat Extraction Engine - AI-powered extraction of beats from text
// Uses edge-device WebLLM (Gemma 3) when available, falls back to cloud

import { ExtractedBeat, ExtractedConnection, BeatType, BeatConnectionType } from './types';

// Extraction prompt template
const EXTRACTION_PROMPT = `You are a literary analysis assistant. Extract "beats" from the given text.

A beat is an atomic unit of meaning - the smallest meaningful element in a narrative or text.

Beat types:
- CHARACTER: A person, being, or entity with agency
- PLACE: A location with significance
- OBJECT: A significant item
- CREATURE: A non-character being
- THEME: A recurring abstract concept
- MOTIF: A recurring symbol, image, or pattern
- IDEA: An abstract concept or notion
- QUESTION: An unresolved mystery or question
- INSIGHT: A key realization or understanding
- RELATIONSHIP: A dynamic between entities
- CONFLICT: A tension or opposition
- EVENT: An occurrence or happening (use for events not covered by other types)
- FEELING: An emotional beat
- MOOD: An atmospheric quality

For each beat, identify:
1. type: The beat type (from the list above)
2. name: A short, memorable identifier (2-5 words)
3. summary: A one-sentence description
4. intensity: Impact level (0.0-1.0, where 1.0 is maximum impact)
5. valence: Emotional tone (-1.0 to 1.0, where -1 is negative, 0 is neutral, 1 is positive)
6. connections: Related beats found in this or previous texts (optional)

Output ONLY valid JSON in this format:
{
  "beats": [
    {
      "type": "CHARACTER",
      "name": "The Mentor",
      "summary": "A guiding figure who knows more than they reveal",
      "intensity": 0.8,
      "valence": 0.2,
      "connections": [
        {
          "toBeatName": "Brother's Betrayal",
          "type": "MIRRORS",
          "strength": 0.85,
          "evidence": "Both involve betrayal by trusted figures"
        }
      ]
    }
  ]
}

Text to analyze:
---
{text}
---

Output ONLY the JSON, no other text.`;

const CONNECTION_PROMPT = `Analyze the relationship between these two beats and determine how they connect.

Beat 1:
Type: {type1}
Name: {name1}
Summary: {summary1}

Beat 2:
Type: {type2}
Name: {name2}
Summary: {summary2}

Connection types:
- RELATES_TO: General association
- MIRRORS: Parallel or echo (similar pattern)
- CAUSES: Beat 1 causes Beat 2
- RESULTS_FROM: Beat 1 results from Beat 2
- FORESHADOWS: Beat 1 foreshadows Beat 2
- CONTRADICTS: Beat 1 contradicts Beat 2
- SUPPORTS: Beat 1 supports/reinforces Beat 2
- UNDERMINES: Beat 1 undermines/weakens Beat 2
- EVOLVES_TO: Beat 1 evolves into Beat 2

Output ONLY valid JSON:
{
  "connectionType": "MIRRORS",
  "strength": 0.85,
  "evidence": "Both involve betrayal by trusted figures",
  "isContradiction": false
}`;

export interface ExtractionOptions {
  model?: 'edge' | 'cloud' | 'auto';
  onProgress?: (progress: number, status?: string) => void;
  existingBeats?: ExtractedBeat[];
}

export interface ExtractionResult {
  beats: ExtractedBeat[];
  model: string;
  processingTimeMs: number;
  fromEdge: boolean;
}

export class BeatExtractor {
  private preferredModel: 'edge' | 'cloud' | 'auto';
  private edgeAvailable: boolean | null = null;
  
  constructor(options: { model?: 'edge' | 'cloud' | 'auto' } = {}) {
    this.preferredModel = options.model || 'auto';
  }
  
  /**
   * Check if edge extraction (WebLLM) is available
   */
  async checkEdgeAvailable(): Promise<boolean> {
    if (this.edgeAvailable !== null) {
      return this.edgeAvailable;
    }

    try {
      // Dynamic import to avoid SSR issues
      const { EdgeExtractionService } = await import('../extraction/edge-service');
      const result = await EdgeExtractionService.isAvailable();
      this.edgeAvailable = result.available;
      return this.edgeAvailable;
    } catch {
      this.edgeAvailable = false;
      return false;
    }
  }
  
  /**
   * Extract beats from text
   * Priority: edge (device) > cloud (Ollama)
   */
  async extract(text: string, options: ExtractionOptions = {}): Promise<ExtractedBeat[]> {
    const model = options.model || this.preferredModel;
    
    // Determine which model to use
    if (model === 'auto') {
      const edgeAvailable = await this.checkEdgeAvailable();
      if (edgeAvailable) {
        return this.extractFromEdge(text, options);
      }
      return this.extractFromCloud(text, options);
    }
    
    if (model === 'edge') {
      return this.extractFromEdge(text, options);
    }
    
    return this.extractFromCloud(text, options);
  }
  
  /**
   * Extract using edge-device WebLLM (Gemma 3)
   */
  private async extractFromEdge(text: string, options: ExtractionOptions): Promise<ExtractedBeat[]> {
    try {
      const { getEdgeExtractionService } = await import('../extraction/edge-service');
      const service = getEdgeExtractionService('gemma-3-1b');
      
      const result = await service.extract(text, (progress) => {
        options.onProgress?.(progress.progress || 0, progress.status);
      });
      
      options.onProgress?.(100, 'complete');
      return result.beats;
    } catch (error) {
      console.error('Edge extraction failed, falling back to cloud:', error);
      // Fallback to cloud on edge failure
      return this.extractFromCloud(text, options);
    }
  }
  
  /**
   * Extract using cloud API (Ollama)
   */
  private async extractFromCloud(text: string, options: ExtractionOptions): Promise<ExtractedBeat[]> {
    const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
    const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen3.5:397b-cloud';
    
    options.onProgress?.(10, 'connecting to cloud');
    
    try {
      const response = await fetch(`${OLLAMA_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          prompt: EXTRACTION_PROMPT.replace('{text}', text),
          stream: false,
          options: {
            temperature: 0.3,
            num_predict: 4096,
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }
      
      options.onProgress?.(80, 'parsing response');
      
      const data = await response.json();
      const result = this.parseExtractionResult(data.response);
      
      options.onProgress?.(100, 'complete');
      
      return result;
    } catch (error) {
      console.error('Cloud extraction failed:', error);
      return [];
    }
  }
  
  /**
   * Parse extraction result from LLM
   */
  private parseExtractionResult(response: string): ExtractedBeat[] {
    try {
      const jsonMatch = response.match(/\{[\s\S]*"beats"[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('No JSON found in response');
        return [];
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      if (!Array.isArray(parsed.beats)) {
        return [];
      }
      
      return parsed.beats.map((beat: Record<string, unknown>) => ({
        type: this.validateBeatType(beat.type),
        name: String(beat.name || 'Unnamed Beat'),
        summary: String(beat.summary || ''),
        intensity: this.clamp(Number(beat.intensity) || 0.5, 0, 1),
        valence: this.clamp(Number(beat.valence) || 0, -1, 1),
        confidence: Number(beat.confidence) || 0.8,
        connections: this.validateConnections(beat.connections),
      }));
    } catch (error) {
      console.error('Failed to parse extraction result:', error);
      return [];
    }
  }
  
  /**
   * Validate beat type
   */
  private validateBeatType(type: unknown): BeatType {
    const validTypes: BeatType[] = [
      'CHARACTER', 'PLACE', 'OBJECT', 'CREATURE', 'THEME', 'MOTIF',
      'IDEA', 'QUESTION', 'INSIGHT', 'RELATIONSHIP', 'CONFLICT',
      'FEELING', 'MOOD', 'STORY', 'SCENE', 'CHAPTER',
      'WORLD', 'DIMENSION', 'TIMELINE', 'RESOLUTION', 'CUSTOM', 'EVENT'
    ];
    
    if (typeof type === 'string' && validTypes.includes(type as BeatType)) {
      return type as BeatType;
    }
    
    return 'IDEA';
  }
  
  /**
   * Validate connections array
   */
  private validateConnections(connections: unknown): ExtractedConnection[] {
    if (!Array.isArray(connections)) return [];
    
    return connections.map((conn: Record<string, unknown>) => ({
      toBeatName: String(conn.toBeatName || ''),
      type: this.validateConnectionType(conn.type),
      strength: this.clamp(Number(conn.strength) || 0.5, 0, 1),
      evidence: String(conn.evidence || ''),
    })).filter(conn => conn.toBeatName);
  }
  
  /**
   * Validate connection type
   */
  private validateConnectionType(type: unknown): BeatConnectionType {
    const validTypes: BeatConnectionType[] = [
      'RELATES_TO', 'PART_OF', 'CONTAINS', 'REFERENCES',
      'CAUSES', 'RESULTS_FROM', 'FORESHADOWS', 'MIRRORS', 'CONTRADICTS', 'RESOLVES',
      'PRECEDES', 'FOLLOWS', 'CONCURRENT',
      'EVOLVES_TO', 'EVOLVES_FROM', 'REPLACES',
      'ALTERNATE_OF', 'PARALLEL_TO',
      'SUPPORTS', 'UNDERMINES', 'TENSIONS_WITH'
    ];
    
    if (typeof type === 'string' && validTypes.includes(type as BeatConnectionType)) {
      return type as BeatConnectionType;
    }
    
    return 'RELATES_TO';
  }
  
  /**
   * Clamp a number between min and max
   */
  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }
  
  /**
   * Analyze connection between two existing beats
   */
  async analyzeConnection(
    beat1: { type: BeatType; name: string; summary?: string },
    beat2: { type: BeatType; name: string; summary?: string }
  ): Promise<{ connectionType: BeatConnectionType; strength: number; evidence: string; isContradiction: boolean } | null> {
    // Try edge first
    const edgeAvailable = await this.checkEdgeAvailable();
    
    if (edgeAvailable) {
      try {
        const { getEdgeExtractionService } = await import('../extraction/edge-service');
        const service = getEdgeExtractionService('gemma-3-1b');
        await service.load();
        return service.analyzeConnection(beat1, beat2);
      } catch {
        // Fall through to cloud
      }
    }
    
    // Fallback to cloud
    const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
    const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen3.5:397b-cloud';
    
    try {
      const prompt = CONNECTION_PROMPT
        .replace('{type1}', beat1.type)
        .replace('{name1}', beat1.name)
        .replace('{summary1}', beat1.summary || '')
        .replace('{type2}', beat2.type)
        .replace('{name2}', beat2.name)
        .replace('{summary2}', beat2.summary || '');
      
      const response = await fetch(`${OLLAMA_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          prompt,
          stream: false,
          options: { temperature: 0.3 }
        })
      });
      
      if (!response.ok) return null;
      
      const data = await response.json();
      const jsonMatch = data.response.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) return null;
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        connectionType: this.validateConnectionType(parsed.connectionType),
        strength: this.clamp(Number(parsed.strength) || 0.5, 0, 1),
        evidence: String(parsed.evidence || ''),
        isContradiction: Boolean(parsed.isContradiction),
      };
    } catch {
      return null;
    }
  }
}

// Singleton instance
let extractorInstance: BeatExtractor | null = null;

export function getBeatExtractor(): BeatExtractor {
  if (!extractorInstance) {
    extractorInstance = new BeatExtractor();
  }
  return extractorInstance;
}