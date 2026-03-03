// Entity Extraction Service
// Automatically extracts people, places, projects, concepts, and events from text

export type EntityType = 'person' | 'place' | 'project' | 'concept' | 'event';

export interface ExtractedEntity {
  name: string;
  type: EntityType;
  aliases?: string[];
  context?: string;
  confidence: number;
}

// Common patterns for entity extraction
const patterns = {
  person: [
    // Names with capital letters
    /\b([A-Z][a-z]+ [A-Z][a-z]+)\b/g,
    // Names in quotes
    /"([^"]+)"\s*(?:said|asked|replied|mentioned)/gi,
    // @mentions
    /@(\w+)/g,
  ],
  place: [
    // Cities, countries
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?(?:\s+(?:City|State|Country|Mountain|River|Lake|Ocean)))\b/g,
    // Locations with "in", "at", "to"
    /\b(?:in|at|to|from)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g,
    // Addresses
    /\d+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd)/gi,
  ],
  project: [
    // Project names
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+Project)\b/g,
    // Apps/tools
    /\b([A-Z][a-z]+(?:App|Tool|Service|Platform|System))\b/g,
    # hashtags
    /#(\w+)/g,
  ],
  concept: [
    // Quoted concepts
    /"([^"]+)"\s*(?:concept|idea|theory|principle)/gi,
    // Technical terms
    /\b([A-Z]{2,}|[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Pattern|Principle|Law|Rule))\b/g,
  ],
  event: [
    // Dates
    /\b(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2})\b/g,
    // Named events
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Conference|Summit|Meeting|Workshop|Event))\b/g,
    // Relative dates
    /\b(?:tomorrow|today|yesterday|next week|last week|this weekend)\b/gi,
  ],
};

// Stopwords to filter out false positives
const stopwords = new Set([
  // Common false positives
  'The', 'This', 'That', 'These', 'Those', 'Today', 'Tomorrow', 'Yesterday',
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
  'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December',
  'Note', 'Notes', 'Project', 'Place', 'Person', 'Event', 'Concept',
  'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth',
  'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
]);

/**
 * Extract entities from text
 */
export function extractEntities(text: string): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];
  const seen = new Set<string>();

  // Extract each type
  for (const [type, typePatterns] of Object.entries(patterns)) {
    for (const pattern of typePatterns) {
      const matches = text.matchAll(pattern);
      
      for (const match of matches) {
        const name = match[1] || match[0];
        
        // Skip if already seen or is a stopword
        const normalizedName = name.trim();
        if (seen.has(normalizedName.toLowerCase()) || stopwords.has(normalizedName)) {
          continue;
        }
        
        // Skip single character or empty
        if (normalizedName.length <= 1) {
          continue;
        }
        
        // Get context (surrounding text)
        const start = Math.max(0, match.index! - 50);
        const end = Math.min(text.length, match.index! + match[0].length + 50);
        const context = text.slice(start, end);
        
        entities.push({
          name: normalizedName,
          type: type as EntityType,
          context: context.trim(),
          confidence: calculateConfidence(normalizedName, type as EntityType, context),
        });
        
        seen.add(normalizedName.toLowerCase());
      }
    }
  }

  // Sort by confidence
  entities.sort((a, b) => b.confidence - a.confidence);
  
  return entities;
}

/**
 * Calculate confidence score for an extracted entity
 */
function calculateConfidence(name: string, type: EntityType, context: string): number {
  let confidence = 0.5; // Base confidence
  
  // Increase confidence for multiple words
  if (name.split(' ').length > 1) {
    confidence += 0.1;
  }
  
  // Increase confidence for specific indicators in context
  const indicators: Record<EntityType, string[]> = {
    person: ['said', 'asked', 'replied', 'mentioned', 'told', 'wrote', 'called', 'met'],
    place: ['in', 'at', 'to', 'from', 'visited', 'traveled', 'located', 'based'],
    project: ['working on', 'building', 'developing', 'project', 'app', 'tool', 'platform'],
    concept: ['concept', 'idea', 'theory', 'principle', 'pattern', 'approach', 'method'],
    event: ['on', 'at', 'during', 'conference', 'meeting', 'workshop', 'event', 'happened'],
  };
  
  const contextLower = context.toLowerCase();
  for (const indicator of indicators[type]) {
    if (contextLower.includes(indicator)) {
      confidence += 0.1;
    }
  }
  
  // Cap at 1.0
  return Math.min(confidence, 1.0);
}

/**
 * Link entities to existing ones in the database
 */
export async function linkEntities(
  entities: ExtractedEntity[],
  existingEntities: Array<{ id: string; name: string; entityType: string; aliases: string[] }>
): Array<ExtractedEntity & { existingId?: string }> {
  return entities.map(entity => {
    // Try exact match
    const exactMatch = existingEntities.find(
      e => e.name.toLowerCase() === entity.name.toLowerCase() && e.entityType === entity.type
    );
    
    if (exactMatch) {
      return { ...entity, existingId: exactMatch.id };
    }
    
    // Try alias match
    const aliasMatch = existingEntities.find(
      e => e.entityType === entity.type && e.aliases.some(a => a.toLowerCase() === entity.name.toLowerCase())
    );
    
    if (aliasMatch) {
      return { ...entity, existingId: aliasMatch.id };
    }
    
    // Fuzzy match (Levenshtein distance)
    // For simplicity, we'll skip this for now
    
    return entity;
  });
}