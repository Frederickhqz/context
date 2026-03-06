// Beat Extraction Prompts - LLM prompt templates for extraction
// Optimized for different use cases and model sizes

export const EXTRACTION_PROMPTS = {
  // Main extraction prompt for full analysis
  full: `You are a literary analysis assistant. Extract "beats" from the given text.

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
- EVENT: An occurrence or happening
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

Output ONLY the JSON, no other text.`,

  // Fast extraction for quick analysis (smaller models)
  fast: `Extract beats from this text. A beat is an atomic unit of meaning.

Types: CHARACTER, PLACE, OBJECT, THEME, MOTIF, IDEA, QUESTION, INSIGHT, RELATIONSHIP, CONFLICT, EVENT

Output JSON:
{
  "beats": [
    {"type": "CHARACTER", "name": "Name", "summary": "One sentence", "intensity": 0.8, "valence": 0.0}
  ]
}

Text: {text}`,

  // Character-focused extraction
  characters: `Extract character beats from this text. Focus on characters, their traits, relationships, and development.

For each character:
- name: Character name or identifier
- traits: Array of personality traits
- relationships: Relationships with other characters
- arc: Brief description of character arc (if present)

Output JSON:
{
  "beats": [
    {"type": "CHARACTER", "name": "...", "summary": "...", "traits": [...], "relationships": [...]}
  ]
}

Text: {text}`,

  // Theme-focused extraction
  themes: `Extract theme beats from this text. Focus on recurring themes, motifs, and symbolic elements.

For each theme:
- name: Theme name
- examples: Specific examples from the text
- variations: Different manifestations of the theme

Output JSON:
{
  "beats": [
    {"type": "THEME", "name": "...", "summary": "...", "examples": [...]}
  ]
}

Text: {text}`,

  // Connection analysis prompt
  connections: `Analyze the relationship between these two beats and determine how they connect.

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

Output JSON:
{
  "connectionType": "MIRRORS",
  "strength": 0.85,
  "evidence": "Both involve betrayal by trusted figures",
  "isContradiction": false
}`,

  // Contradiction detection prompt
  contradictions: `Analyze this text for contradictions or inconsistencies.

Look for:
1. Temporal contradictions (events in wrong order)
2. Factual contradictions (conflicting facts)
3. Character inconsistencies (out-of-character behavior)
4. World rule violations (broken world rules)

Output JSON:
{
  "contradictions": [
    {
      "beat1": "Name of first beat",
      "beat2": "Name of second beat",
      "type": "temporal|factual|character|world",
      "severity": "low|medium|high|critical",
      "description": "What contradicts what",
      "evidence": "Supporting text",
      "suggestion": "How to resolve"
    }
  ]
}

Text: {text}`,

  // Batch extraction for imports
  batch: `Analyze this text section by section. Extract beats from each section.

For each section:
1. Identify the section boundary
2. Extract all beats within
3. Note which section each beat belongs to

Output JSON:
{
  "sections": [
    {
      "title": "Section title",
      "beats": [...]
    }
  ]
}

Text: {text}`
};

/**
 * Get extraction prompt with text injected
 */
export function getExtractionPrompt(
  type: keyof typeof EXTRACTION_PROMPTS,
  text: string,
  options?: Record<string, string>
): string {
  let prompt = EXTRACTION_PROMPTS[type];
  
  // Replace text placeholder
  prompt = prompt.replace('{text}', text);
  
  // Replace other placeholders
  if (options) {
    for (const [key, value] of Object.entries(options)) {
      prompt = prompt.replace(new RegExp(`{${key}}`, 'g'), value);
    }
  }
  
  return prompt;
}

/**
 * Parse extraction result from LLM response
 */
export function parseExtractionResult(response: string): {
  beats: Array<{
    type: string;
    name: string;
    summary: string;
    intensity: number;
    valence: number;
    connections?: Array<{
      toBeatName: string;
      type: string;
      strength: number;
      evidence?: string;
    }>;
  }>;
  sections?: Array<{
    title: string;
    beats: Array<{
      type: string;
      name: string;
      summary: string;
      intensity: number;
      valence: number;
    }>;
  }>;
} {
  try {
    // Find JSON in response
    const jsonMatch = response.match(/\{[\s\S]*"beats"[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON found in response');
      return { beats: [] };
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    // Validate structure
    if (!Array.isArray(parsed.beats)) {
      return { beats: [] };
    }
    
    // Normalize each beat
    const beats = parsed.beats.map((beat: Record<string, unknown>) => ({
      type: validateBeatType(beat.type),
      name: String(beat.name || 'Unnamed Beat'),
      summary: String(beat.summary || ''),
      intensity: clamp(Number(beat.intensity) || 0.5, 0, 1),
      valence: clamp(Number(beat.valence) || 0, -1, 1),
      connections: Array.isArray(beat.connections) ? beat.connections.map(normalizeConnection) : []
    }));
    
    // Include sections if present
    if (parsed.sections && Array.isArray(parsed.sections)) {
      return {
        beats,
        sections: parsed.sections.map((section: Record<string, unknown>) => ({
          title: String(section.title || 'Untitled'),
          beats: Array.isArray(section.beats) ? section.beats.map((b: Record<string, unknown>) => ({
            type: validateBeatType(b.type),
            name: String(b.name || 'Unnamed'),
            summary: String(b.summary || ''),
            intensity: clamp(Number(b.intensity) || 0.5, 0, 1),
            valence: clamp(Number(b.valence) || 0, -1, 1)
          })) : []
        }))
      };
    }
    
    return { beats };
    
  } catch (error) {
    console.error('Failed to parse extraction result:', error);
    return { beats: [] };
  }
}

function validateBeatType(type: unknown): string {
  const validTypes = [
    'CHARACTER', 'PLACE', 'OBJECT', 'CREATURE', 'THEME', 'MOTIF',
    'IDEA', 'QUESTION', 'INSIGHT', 'RELATIONSHIP', 'CONFLICT',
    'EVENT', 'FEELING', 'MOOD', 'STORY', 'SCENE', 'CHAPTER',
    'WORLD', 'DIMENSION', 'TIMELINE', 'RESOLUTION', 'CUSTOM'
  ];
  
  if (typeof type === 'string' && validTypes.includes(type)) {
    return type;
  }
  return 'IDEA';
}

function normalizeConnection(conn: Record<string, unknown>) {
  return {
    toBeatName: String(conn.toBeatName || ''),
    type: String(conn.type || 'RELATES_TO'),
    strength: clamp(Number(conn.strength) || 0.5, 0, 1),
    evidence: conn.evidence ? String(conn.evidence) : undefined
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}