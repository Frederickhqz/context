import { BeatType, ConnectionType, SharedExtractionResult } from '../ai/shared-spec';

// Standardized contradiction types for the UI
export type ContradictionType = 
  | 'identity'      // X is Y vs X is NOT Y
  | 'location'      // X is in London vs X is in Paris
  | 'status'        // X is alive vs X is dead
  | 'relationship'  // X loves Y vs X hates Y
  | 'timeline'      // Event happened in 1920 vs 1930
  | 'property';     // X is blue vs X is red

export interface Contradiction {
  id: string;
  type: ContradictionType;
  description: string;
  severity: number; // 0.0 - 1.0
  beats: [string, string]; // IDs of the two conflicting beats
  evidence: {
    beatA: string; // Excerpt/Summary from A
    beatB: string; // Excerpt/Summary from B
  };
}

/**
 * Logic to detect contradictions based on semantic opposition
 * This runs after extraction to maintain narrative coherence.
 */
export function detectContradictions(result: SharedExtractionResult): Contradiction[] {
  const contradictions: Contradiction[] = [];
  const { beats } = result;

  // O(n^2) check for small sets of beats per note
  for (let i = 0; i < beats.length; i++) {
    for (let j = i + 1; j < beats.length; j++) {
      const beatA = beats[i];
      const beatB = beats[j];

      // Logic: Same name but opposing valence/status
      if (beatA.name.toLowerCase() === beatB.name.toLowerCase()) {
        const valenceDiff = Math.abs(beatA.valence - beatB.valence);
        
        // High valence difference for same named entity is a contradiction (e.g. Love vs Hate)
        if (valenceDiff > 1.5) {
          contradictions.push({
            id: `contra_${i}_${j}`,
            type: beatA.type === 'CHARACTER' ? 'status' : 'property',
            description: `Conflicting emotional state for "${beatA.name}"`,
            severity: valenceDiff / 2,
            beats: [beatA.name, beatB.name],
            evidence: {
              beatA: beatA.summary,
              beatB: beatB.summary
            }
          });
        }
      }
    }
  }

  return contradictions;
}
