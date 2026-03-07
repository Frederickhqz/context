// Contradiction Detector - Find conflicts and inconsistencies between beats
// Analyzes semantic meaning and logical relationships

import type { BeatType } from '../beats/types';

// ============ Types ============

interface Beat {
  id: string;
  type: BeatType;
  name: string;
  summary?: string;
  content?: string;
  valence?: number;
  intensity?: number;
}

interface Contradiction {
  beat1Id: string;
  beat2Id: string;
  type: ContradictionType;
  severity: number;
  evidence: string;
  resolution?: string;
}

type ContradictionType = 
  | 'DIRECT_CONFLICT'
  | 'TEMPORAL_CONFLICT'
  | 'CHARACTER_CONFLICT'
  | 'FACTUAL_ERROR'
  | 'LOGICAL_IMPOSSIBILITY'
  | 'EMOTIONAL_CONFLICT'
  | 'THEMATIC_TENSION'
  | 'AMBIGUITY';

// ============ Contradiction Patterns ============

interface ContradictionPattern {
  type: ContradictionType;
  severity: number;
  indicators: RegExp[];
  description: string;
}

const CONTRADICTION_PATTERNS: ContradictionPattern[] = [
  {
    type: 'DIRECT_CONFLICT',
    severity: 0.9,
    indicators: [
      /\b(?:contradicts?|conflicts?\s+with|opposes?|negates?)\b/gi,
      /\b(?:impossible|cannot\s+be|never|happens?)\b/gi,
      /\b(?:but|however|yet|although)\s+(?:this|it|that|the)\b/gi,
    ],
    description: 'Direct contradiction between two statements'
  },
  {
    type: 'TEMPORAL_CONFLICT',
    severity: 0.85,
    indicators: [
      /\b(?:before|after|then|next|later|earlier)\b.*\b(?:happened|occurred|took\s+place)\b/gi,
      /\b(?:years?\s+ago|months?\s+ago|days?\s+ago)\b.*\b(?:later|after|before)\b/gi,
      /\b(?:yesterday|today|tomorrow)\b.*\b(?:yesterday|today|tomorrow)\b/gi,
    ],
    description: 'Timeline inconsistency between events'
  },
  {
    type: 'CHARACTER_CONFLICT',
    severity: 0.8,
    indicators: [
      /\b(?:character|person|he|she|they)\s+(?:would|could|should)\s+not\b/gi,
      /\b(?:out\s+of\s+character|unlike|different\s+from)\b/gi,
      /\b(?:suddenly|unexpectedly)\s+(?:changed|acted|behaved)\b/gi,
    ],
    description: 'Inconsistent character behavior or traits'
  },
  {
    type: 'FACTUAL_ERROR',
    severity: 0.75,
    indicators: [
      /\b(?:wrong|incorrect|mistake|error)\b/gi,
      /\b(?:not\s+true|false|untrue)\b/gi,
      /\b(?:actually|in\s+fact|really)\s+(?:is|was|were)\b/gi,
    ],
    description: 'Factually incorrect information'
  },
  {
    type: 'LOGICAL_IMPOSSIBILITY',
    severity: 0.95,
    indicators: [
      /\b(?:impossible|cannot|could\s+not|would\s+not)\s+(?:happen|occur|exist)\b/gi,
      /\b(?:paradox|contradiction|inconsistency)\b/gi,
      /\b(?:both|simultaneously)\s+(?:and|but)\s+(?:not|never)\b/gi,
    ],
    description: 'Logically impossible situation'
  },
  {
    type: 'EMOTIONAL_CONFLICT',
    severity: 0.6,
    indicators: [
      /\b(?:felt|feeling|emotion)\s+(?:then|but|however)\b/gi,
      /\b(?:sad|happy|angry|scared)\s+but\s+(?:happy|sad|calm|brave)\b/gi,
      /\b(?:simultaneously|at\s+once|same\s+time)\s+(?:loved|hated)\b/gi,
    ],
    description: 'Conflicting emotional states'
  },
  {
    type: 'THEMATIC_TENSION',
    severity: 0.5,
    indicators: [
      /\b(?:theme|concept|idea)\s+(?:conflicts?|tensions?|opposes?)\b/gi,
      /\b(?:contrasting|opposing|conflicting)\s+(?:themes|ideas)\b/gi,
    ],
    description: 'Tension between thematic elements'
  },
  {
    type: 'AMBIGUITY',
    severity: 0.3,
    indicators: [
      /\b(?:might|may|could|possibly|perhaps)\b/gi,
      /\b(?:unclear|ambiguous|vague|uncertain)\b/gi,
      /\b(?:seems?|appears?|looks?\s+like)\s+(?:but|however)\b/gi,
    ],
    description: 'Potentially conflicting information due to ambiguity'
  }
];

// ============ Opposing Concepts ============

const OPPOSING_PAIRS: Array<[string[], string[]]> = [
  // Emotional
  [['love', 'adore', 'cherish'], ['hate', 'despise', 'loathe']],
  [['happy', 'joyful', 'glad'], ['sad', 'sorrowful', 'grieving']],
  [['brave', 'courageous', 'bold'], ['cowardly', 'fearful', 'timid']],
  [['calm', 'peaceful', 'serene'], ['chaotic', 'turbulent', 'stormy']],
  
  // Physical
  [['alive', 'living', 'breathing'], ['dead', 'deceased', 'lifeless']],
  [['present', 'here', 'arrived'], ['absent', 'gone', 'missing']],
  [['young', 'youthful', 'child'], ['old', 'elderly', 'aged']],
  [['strong', 'powerful', 'mighty'], ['weak', 'feeble', 'frail']],
  
  // Moral
  [['good', 'virtuous', 'righteous'], ['evil', 'wicked', 'sinful']],
  [['honest', 'truthful', 'sincere'], ['dishonest', 'deceitful', 'lying']],
  [['loyal', 'faithful', 'devoted'], ['traitorous', 'disloyal', 'betrayer']],
  
  // Temporal
  [['before', 'earlier', 'prior'], ['after', 'later', 'subsequent']],
  [['first', 'initial', 'beginning'], ['last', 'final', 'ending']],
  [['always', 'forever', 'eternal'], ['never', 'temporary', 'fleeting']],
  
  // Action
  [['create', 'make', 'build'], ['destroy', 'demolish', 'ruin']],
  [['give', 'offer', 'donate'], ['take', 'steal', 'seize']],
  [['help', 'assist', 'aid'], ['harm', 'injure', 'damage']],
];

// ============ Detection Functions ============

/**
 * Check if two values are opposing
 */
function areOpposing(value1: string, value2: string): boolean {
  const v1 = value1.toLowerCase();
  const v2 = value2.toLowerCase();
  
  for (const [posGroup, negGroup] of OPPOSING_PAIRS) {
    const inPos1 = posGroup.some(w => v1.includes(w));
    const inPos2 = posGroup.some(w => v2.includes(w));
    const inNeg1 = negGroup.some(w => v1.includes(w));
    const inNeg2 = negGroup.some(w => v2.includes(w));
    
    // If one is in positive group and other in negative, they're opposing
    if ((inPos1 && inNeg2) || (inNeg1 && inPos2)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Detect contradictions between two beats
 */
export function detectContradiction(
  beat1: Beat,
  beat2: Beat,
  context?: string
): Contradiction | null {
  // Check for direct opposing values
  const text1 = `${beat1.name} ${beat1.summary || ''}`.toLowerCase();
  const text2 = `${beat2.name} ${beat2.summary || ''}`.toLowerCase();
  
  if (areOpposing(text1, text2)) {
    return {
      beat1Id: beat1.id,
      beat2Id: beat2.id,
      type: 'DIRECT_CONFLICT',
      severity: 0.85,
      evidence: `"${beat1.name}" and "${beat2.name}" represent opposing concepts`,
    };
  }
  
  // Check valence opposition
  if (beat1.valence !== undefined && beat2.valence !== undefined) {
    const valenceDiff = Math.abs(beat1.valence - beat2.valence);
    if (valenceDiff > 1.5) {
      return {
        beat1Id: beat1.id,
        beat2Id: beat2.id,
        type: 'EMOTIONAL_CONFLICT',
        severity: 0.7,
        evidence: `Strongly contrasting emotional valence (${beat1.valence.toFixed(2)} vs ${beat2.valence.toFixed(2)})`,
      };
    }
  }
  
  // Check for pattern matches in context
  if (context) {
    for (const pattern of CONTRADICTION_PATTERNS) {
      for (const regex of pattern.indicators) {
        if (regex.test(context)) {
          return {
            beat1Id: beat1.id,
            beat2Id: beat2.id,
            type: pattern.type,
            severity: pattern.severity,
            evidence: `Context contains contradiction indicators: ${pattern.description}`,
          };
        }
      }
    }
  }
  
  // Check for type-based contradictions
  const typeContradiction = checkTypeContradiction(beat1, beat2);
  if (typeContradiction) {
    return typeContradiction;
  }
  
  return null;
}

/**
 * Check for contradictions based on beat types
 */
function checkTypeContradiction(beat1: Beat, beat2: Beat): Contradiction | null {
  // Question that resolves itself
  if (beat1.type === 'QUESTION' && beat2.type === 'QUESTION') {
    // Check if they're asking the same thing differently
    if (areSemanticallySimilar(beat1.name, beat2.name)) {
      return {
        beat1Id: beat1.id,
        beat2Id: beat2.id,
        type: 'AMBIGUITY',
        severity: 0.4,
        evidence: 'Similar questions may have different implied answers',
      };
    }
  }
  
  // Character acting out of type
  if (beat1.type === 'CHARACTER' && beat2.type === 'CHARACTER') {
    // Check for opposing traits
    if (areOpposing(beat1.summary || '', beat2.summary || '')) {
      return {
        beat1Id: beat1.id,
        beat2Id: beat2.id,
        type: 'CHARACTER_CONFLICT',
        severity: 0.75,
        evidence: `Characters have opposing traits: "${beat1.summary}" vs "${beat2.summary}"`,
      };
    }
  }
  
  // Event temporal conflict
  if (beat1.type === 'EVENT' && beat2.type === 'EVENT') {
    // Would need temporal markers to detect this properly
    // For now, flag events with opposing outcomes
    const outcome1 = beat1.summary?.toLowerCase() || '';
    const outcome2 = beat2.summary?.toLowerCase() || '';
    
    if (areOpposing(outcome1, outcome2)) {
      return {
        beat1Id: beat1.id,
        beat2Id: beat2.id,
        type: 'TEMPORAL_CONFLICT',
        severity: 0.7,
        evidence: 'Events have opposing outcomes',
      };
    }
  }
  
  return null;
}

/**
 * Simple semantic similarity check
 */
function areSemanticallySimilar(text1: string, text2: string): boolean {
  const tokens1 = new Set(text1.toLowerCase().split(/\s+/).filter(t => t.length > 3));
  const tokens2 = new Set(text2.toLowerCase().split(/\s+/).filter(t => t.length > 3));
  
  if (tokens1.size === 0 || tokens2.size === 0) return false;
  
  const intersection = new Set([...tokens1].filter(t => tokens2.has(t)));
  const union = new Set([...tokens1, ...tokens2]);
  
  return intersection.size / union.size > 0.5;
}

/**
 * Find all contradictions among a set of beats
 */
export function findAllContradictions(
  beats: Beat[],
  context?: string
): Contradiction[] {
  const contradictions: Contradiction[] = [];
  
  // Check all pairs
  for (let i = 0; i < beats.length; i++) {
    for (let j = i + 1; j < beats.length; j++) {
      const contradiction = detectContradiction(beats[i], beats[j], context);
      if (contradiction) {
        contradictions.push(contradiction);
      }
    }
  }
  
  // Sort by severity
  contradictions.sort((a, b) => b.severity - a.severity);
  
  return contradictions;
}

/**
 * Suggest resolution for a contradiction
 */
export function suggestResolution(contradiction: Contradiction): string | undefined {
  switch (contradiction.type) {
    case 'DIRECT_CONFLICT':
      return 'Review both beats and determine which one is accurate, or clarify if both can coexist';
    
    case 'TEMPORAL_CONFLICT':
      return 'Establish a clear timeline and update event ordering';
    
    case 'CHARACTER_CONFLICT':
      return 'Clarify character motivation or split into different character versions';
    
    case 'FACTUAL_ERROR':
      return 'Verify facts and correct the inaccurate beat';
    
    case 'LOGICAL_IMPOSSIBILITY':
      return 'Reconsider the scenario or introduce a resolution mechanism';
    
    case 'EMOTIONAL_CONFLICT':
      return 'Explore the emotional journey or acknowledge the complexity';
    
    case 'THEMATIC_TENSION':
      return 'Embrace the tension as intentional conflict, or align themes';
    
    case 'AMBIGUITY':
      return 'Add clarifying details to resolve uncertainty';
    
    default:
      return 'Review and clarify the relationship between these beats';
  }
}

/**
 * Get contradiction pattern by type
 */
export function getContradictionPattern(type: ContradictionType): ContradictionPattern | undefined {
  return CONTRADICTION_PATTERNS.find(p => p.type === type);
}

/**
 * Get all contradiction types
 */
export function getAllContradictionTypes(): Array<{ type: ContradictionType; description: string }> {
  return CONTRADICTION_PATTERNS.map(p => ({
    type: p.type,
    description: p.description
  }));
}

export default findAllContradictions;