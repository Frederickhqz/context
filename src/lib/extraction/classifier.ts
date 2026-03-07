// Beat Type Classifier - Determines the most appropriate beat type for text
// Uses pattern matching and semantic analysis

import type { BeatType } from '../beats/types';

// Beat type patterns and indicators
const BEAT_PATTERNS: Record<BeatType, {
  keywords: string[];
  patterns: RegExp[];
  priority: number;
  description: string;
}> = {
  CHARACTER: {
    keywords: ['he', 'she', 'they', 'character', 'person', 'man', 'woman', 'boy', 'girl', 'protagonist', 'antagonist', 'hero', 'villain', 'friend', 'enemy', 'family', 'mother', 'father', 'sister', 'brother', 'mentor'],
    patterns: [
      /\b(?:he|she|they)\s+(?:said|did|felt|thought|went|came|looked)/gi,
      /\b(?:called|named|known as)\s+['"]?\w+['"]?/gi,
      /\b(?:character|person|man|woman)\s+(?:who|that|which)/gi,
    ],
    priority: 1,
    description: 'Named entities with agency and personality'
  },
  
  PLACE: {
    keywords: ['place', 'location', 'city', 'country', 'house', 'home', 'room', 'building', 'forest', 'mountain', 'river', 'ocean', 'world', 'land', 'kingdom', 'village', 'town', 'castle', 'palace'],
    patterns: [
      /\b(?:in|at|to|from)\s+(?:the\s+)?(?:city|village|kingdom|land|place|house|room)/gi,
      /\b(?:located|situated|found)\s+(?:in|at|on)/gi,
      /\b(?:world|realm|kingdom)\s+(?:of|where)/gi,
    ],
    priority: 2,
    description: 'Locations with narrative significance'
  },
  
  OBJECT: {
    keywords: ['object', 'item', 'weapon', 'artifact', 'treasure', 'sword', 'ring', 'book', 'key', 'door', 'chest', 'crown', 'throne', 'stone', 'gem', 'map'],
    patterns: [
      /\b(?:the|a|an)\s+\w+\s+(?:was|is|had been)\s+(?:found|hidden|lost|stolen|created)/gi,
      /\b(?:artifact|object|item|treasure)\s+(?:of|that|which)/gi,
      /\b(?:sword|ring|staff|wand|amulet|crown)\s+(?:of|with)/gi,
    ],
    priority: 3,
    description: 'Significant items with meaning'
  },
  
  CREATURE: {
    keywords: ['creature', 'beast', 'monster', 'dragon', 'animal', 'demon', 'angel', 'spirit', 'fairy', 'elf', 'dwarf', 'orc', 'goblin', 'werewolf', 'vampire'],
    patterns: [
      /\b(?:creature|beast|monster|animal)\s+(?:that|which|who)/gi,
      /\b(?:dragon|phoenix|unicorn|griffin)\s+(?:flew|roared|appeared)/gi,
    ],
    priority: 2,
    description: 'Non-human beings with narrative presence'
  },
  
  THEME: {
    keywords: ['theme', 'concept', 'idea', 'truth', 'belief', 'power', 'love', 'death', 'sacrifice', 'redemption', 'betrayal', 'honor', 'duty', 'freedom', 'justice'],
    patterns: [
      /\b(?:theme|concept)\s+(?:of|that)/gi,
      /\b(?:explores|examines|questions)\s+(?:the|the nature of)\s+\w+/gi,
      /\b(?:throughout|through)\s+(?:the|this)\s+(?:story|narrative)/gi,
    ],
    priority: 4,
    description: 'Abstract recurring concepts'
  },
  
  MOTIF: {
    keywords: ['motif', 'symbol', 'pattern', 'recurring', 'repeated', 'image', 'metaphor', 'imagery', 'light', 'dark', 'water', 'fire', 'blood', 'eyes'],
    patterns: [
      /\b(?:recurring|repeated|ongoing)\s+(?:symbol|image|motif|pattern)/gi,
      /\b(?:symbolizes|represents|signifies)\s+(?:the|a)/gi,
      /\b(?:motif|symbol)\s+(?:of|throughout)/gi,
    ],
    priority: 4,
    description: 'Recurring symbols and patterns'
  },
  
  IDEA: {
    keywords: ['idea', 'thought', 'concept', 'theory', 'hypothesis', 'philosophy', 'principle', 'belief', 'notion', 'theory'],
    patterns: [
      /\b(?:idea|concept|theory)\s+(?:that|of|about)/gi,
      /\b(?:believes|thinks|considers|theorizes)\s+(?:that)/gi,
    ],
    priority: 5,
    description: 'Abstract concepts and notions'
  },
  
  QUESTION: {
    keywords: ['question', 'mystery', 'wonder', 'unknown', 'unsolved', 'puzzle', 'riddle', 'enigma', 'secret', 'mystery'],
    patterns: [
      /\b(?:who|what|when|where|why|how)\s+(?:is|are|was|were|did|does|could|would|should|might)/gi,
      /\b(?:question|mystery|puzzle|riddle)\s+(?:of|about|regarding)/gi,
      /\b(?:remains|left)\s+(?:unanswered|unsolved|unknown)/gi,
    ],
    priority: 3,
    description: 'Unresolved mysteries and questions'
  },
  
  INSIGHT: {
    keywords: ['insight', 'realization', 'discovery', 'epiphany', 'revelation', 'understanding', 'truth', 'lesson', 'learning'],
    patterns: [
      /\b(?:realizes?|discovers?|understands?|learns?|recognizes?)\s+(?:that|the)/gi,
      /\b(?:sudden|profound|key)\s+(?:insight|realization|discovery)/gi,
      /\b(?:comes?\s+to\s+(?:understand|realize|know))/gi,
    ],
    priority: 3,
    description: 'Key realizations and understandings'
  },
  
  RELATIONSHIP: {
    keywords: ['relationship', 'bond', 'connection', 'friendship', 'love', 'marriage', 'partnership', 'alliance', 'rivalry', 'enemy', 'family', 'parent', 'child', 'sibling'],
    patterns: [
      /\b(?:relationship|bond|connection)\s+(?:between|with)/gi,
      /\b(?:friends?|enemies?|allies?|partners?|lovers?)\s+(?:with|since|for)/gi,
      /\b(?:father|mother|brother|sister|son|daughter)\s+(?:and|of|to)/gi,
    ],
    priority: 2,
    description: 'Dynamics between characters or entities'
  },
  
  CONFLICT: {
    keywords: ['conflict', 'tension', 'struggle', 'fight', 'battle', 'war', 'argument', 'dispute', 'confrontation', 'opposition', 'clash'],
    patterns: [
      /\b(?:conflict|tension|struggle)\s+(?:between|with|against)/gi,
      /\b(?:fights?|battles?|struggles?|clashes?)\s+(?:with|against)/gi,
      /\b(?:opposes?|confronts?|challenges?)/gi,
    ],
    priority: 2,
    description: 'Tensions and oppositions'
  },
  
  EVENT: {
    keywords: ['event', 'happening', 'occurrence', 'incident', 'accident', 'battle', 'ceremony', 'wedding', 'funeral', 'birth', 'death', 'arrival', 'departure'],
    patterns: [
      /\b(?:happened|occurred|took place)\s+(?:when|after|before)/gi,
      /\b(?:event|incident|occurrence)\s+(?:that|where|when)/gi,
      /\b(?:during|at)\s+(?:the\s+)?(?:battle|wedding|funeral|ceremony)/gi,
    ],
    priority: 2,
    description: 'Occurrences and happenings'
  },
  
  FEELING: {
    keywords: ['feeling', 'emotion', 'sadness', 'joy', 'anger', 'fear', 'love', 'hate', 'hope', 'despair', 'grief', 'happiness', 'anxiety', 'excitement'],
    patterns: [
      /\b(?:feels?|felt|experiences?)\s+(?:sad|happy|angry|afraid|hopeful|despair)/gi,
      /\b(?:emotion|feeling)\s+(?:of|that)/gi,
      /\b(?:sadness|joy|anger|fear|love|hate)\s+(?:fills?|washes?|sweeps?)/gi,
    ],
    priority: 3,
    description: 'Emotional beats and states'
  },
  
  MOOD: {
    keywords: ['mood', 'atmosphere', 'tone', 'feeling', 'ambiance', 'aura', 'vibe', 'air', 'environment'],
    patterns: [
      /\b(?:mood|atmosphere|tone)\s+(?:of|is|was)/gi,
      /\b(?:dark|light|ominous|peaceful|tense|calm|chaotic)\s+(?:atmosphere|mood|tone)/gi,
      /\b(?:the\s+air|the\s+room)\s+(?:was|felt|seemed)/gi,
    ],
    priority: 4,
    description: 'Atmospheric qualities'
  },
  
  STORY: {
    keywords: ['story', 'narrative', 'tale', 'legend', 'myth', 'fable', 'chronicle', 'account', 'history'],
    patterns: [
      /\b(?:story|narrative|tale)\s+(?:of|about|tells?)/gi,
      /\b(?:legend|myth)\s+(?:says?|tells?|of)/gi,
    ],
    priority: 5,
    description: 'Narrative units'
  },
  
  SCENE: {
    keywords: ['scene', 'moment', 'sequence', 'episode', 'chapter'],
    patterns: [
      /\b(?:scene|moment)\s+(?:where|when|in which)/gi,
      /\b(?:in\s+this\s+scene|during\s+this\s+moment)/gi,
    ],
    priority: 5,
    description: 'Dramatic units within a story'
  },
  
  CHAPTER: {
    keywords: ['chapter', 'section', 'part', 'act', 'phase', 'stage'],
    patterns: [
      /\b(?:chapter|section|part)\s+\d+/gi,
      /\b(?:in\s+chapter|this\s+chapter)/gi,
    ],
    priority: 6,
    description: 'Structural divisions'
  },
  
  WORLD: {
    keywords: ['world', 'universe', 'realm', 'dimension', 'reality', 'cosmos', 'setting'],
    patterns: [
      /\b(?:world|universe|realm)\s+(?:of|where|in which)/gi,
      /\b(?:set\s+in|takes\s+place\s+in)\s+(?:a|the)\s+(?:world|realm|universe)/gi,
    ],
    priority: 4,
    description: 'Narrative universes'
  },
  
  DIMENSION: {
    keywords: ['dimension', 'timeline', 'alternate', 'parallel', 'version', 'variant'],
    patterns: [
      /\b(?:alternate|parallel)\s+(?:world|universe|dimension|timeline)/gi,
      /\b(?:another|other)\s+(?:version|dimension|timeline)/gi,
    ],
    priority: 4,
    description: 'Alternate realities'
  },
  
  TIMELINE: {
    keywords: ['timeline', 'chronology', 'sequence', 'order', 'history', 'past', 'future'],
    patterns: [
      /\b(?:timeline|chronology)\s+(?:of|shows?)/gi,
      /\b(?:in\s+the\s+(?:past|future)|years?\s+(?:ago|later))/gi,
    ],
    priority: 5,
    description: 'Temporal sequences'
  },
  
  RESOLUTION: {
    keywords: ['resolution', 'ending', 'conclusion', 'outcome', 'result', 'resolution', 'finale'],
    patterns: [
      /\b(?:resolution|ending|conclusion)\s+(?:of|to|where)/gi,
      /\b(?:in\s+the\s+end|finally|at\s+last)/gi,
    ],
    priority: 5,
    description: 'Story endings'
  },
  
  CUSTOM: {
    keywords: [],
    patterns: [],
    priority: 99,
    description: 'User-defined beat types'
  },
};

/**
 * Classify beat type from text
 */
export function classifyBeatType(
  text: string,
  context?: { title?: string; previousType?: BeatType }
): {
  type: BeatType;
  confidence: number;
  alternatives: Array<{ type: BeatType; score: number }>;
} {
  const lowerText = text.toLowerCase();
  const scores: Array<{ type: BeatType; score: number }> = [];
  
  // Calculate scores for each beat type
  for (const [type, config] of Object.entries(BEAT_PATTERNS)) {
    if (type === 'CUSTOM') continue;
    
    let score = 0;
    
    // Keyword matching
    const keywordMatches = config.keywords.filter(kw => lowerText.includes(kw.toLowerCase()));
    score += keywordMatches.length * 2;
    
    // Pattern matching
    for (const pattern of config.patterns) {
      const matches = text.match(pattern);
      if (matches) {
        score += matches.length * 3;
      }
    }
    
    // Boost for title context
    if (context?.title) {
      const lowerTitle = context.title.toLowerCase();
      for (const kw of config.keywords) {
        if (lowerTitle.includes(kw.toLowerCase())) {
          score += 2;
        }
      }
    }
    
    // Slight boost for type continuity
    if (context?.previousType === type) {
      score += 1;
    }
    
    // Apply priority weighting (lower priority = more specific = more weight)
    const priorityWeight = 10 - Math.min(config.priority, 9);
    score = score * (1 + priorityWeight * 0.1);
    
    scores.push({ type: type as BeatType, score });
  }
  
  // Sort by score
  scores.sort((a, b) => b.score - a.score);
  
  // Calculate confidence
  const topScore = scores[0]?.score || 0;
  const secondScore = scores[1]?.score || 0;
  const totalScore = scores.reduce((sum, s) => sum + s.score, 0);
  
  let confidence = 0.5;
  if (totalScore > 0) {
    // Higher confidence if top score is much higher than second
    const margin = topScore - secondScore;
    const relativeScore = topScore / totalScore;
    confidence = Math.min(0.95, 0.3 + relativeScore * 0.5 + margin * 0.02);
  }
  
  // Default to IDEA if no strong signal
  if (topScore < 3) {
    return {
      type: 'IDEA',
      confidence: 0.3,
      alternatives: scores.slice(0, 3)
    };
  }
  
  return {
    type: scores[0].type,
    confidence,
    alternatives: scores.slice(0, 3)
  };
}

/**
 * Get beat type configuration
 */
export function getBeatTypeConfig(type: BeatType) {
  return BEAT_PATTERNS[type] || BEAT_PATTERNS.CUSTOM;
}

/**
 * Get all beat types with their configurations
 */
export function getAllBeatTypes() {
  return Object.entries(BEAT_PATTERNS)
    .filter(([type]) => type !== 'CUSTOM')
    .map(([type, config]) => ({
      type: type as BeatType,
      description: config.description,
      priority: config.priority,
      keywordCount: config.keywords.length,
      patternCount: config.patterns.length
    }))
    .sort((a, b) => a.priority - b.priority);
}

export default classifyBeatType;