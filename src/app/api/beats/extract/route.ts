// Beat Extraction API - Cloud-based extraction via Ollama
import { NextRequest, NextResponse } from 'next/server';
import { CLOUD_CONFIG } from '@/lib/beats/config';
import type { BeatType, BeatConnectionType } from '@/lib/beats/types';

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
- EVENT: An occurrence or happening
- FEELING: An emotional beat
- MOOD: An atmospheric quality

For each beat, identify:
1. type: The beat type (from the list above)
2. name: A short, memorable identifier (2-5 words)
3. summary: A one-sentence description
4. intensity: Impact level (0.0-1.0, where 1.0 is maximum impact)
5. valence: Emotional tone (-1.0 to 1.0, where -1 is negative, 0 is neutral, 1 is positive)

Output ONLY valid JSON in this format:
{
  "beats": [
    {
      "type": "CHARACTER",
      "name": "The Mentor",
      "summary": "A guiding figure who knows more than they reveal",
      "intensity": 0.8,
      "valence": 0.2
    }
  ]
}

Text to analyze:
---
{text}
---

Output ONLY the JSON, no other text.`;

interface ExtractedBeatRaw {
  type: string;
  name: string;
  summary?: string;
  intensity?: number;
  valence?: number;
  confidence?: number;
  connections?: Array<{
    toBeatName: string;
    type: string;
    strength?: number;
    evidence?: string;
  }>;
}

interface ExtractedBeat {
  type: BeatType;
  name: string;
  summary: string;
  intensity: number;
  valence: number;
  confidence: number;
  connections: Array<{
    toBeatName: string;
    type: BeatConnectionType;
    strength: number;
    evidence: string;
  }>;
}

// Valid beat types
const VALID_BEAT_TYPES: BeatType[] = [
  'CHARACTER', 'PLACE', 'OBJECT', 'CREATURE', 'THEME', 'MOTIF',
  'IDEA', 'QUESTION', 'INSIGHT', 'RELATIONSHIP', 'CONFLICT',
  'FEELING', 'MOOD', 'STORY', 'SCENE', 'CHAPTER',
  'WORLD', 'DIMENSION', 'TIMELINE', 'RESOLUTION', 'CUSTOM', 'EVENT'
];

// Valid connection types
const VALID_CONNECTION_TYPES: BeatConnectionType[] = [
  'RELATES_TO', 'PART_OF', 'CONTAINS', 'REFERENCES',
  'CAUSES', 'RESULTS_FROM', 'FORESHADOWS', 'MIRRORS', 'CONTRADICTS', 'RESOLVES',
  'PRECEDES', 'FOLLOWS', 'CONCURRENT',
  'EVOLVES_TO', 'EVOLVES_FROM', 'REPLACES',
  'ALTERNATE_OF', 'PARALLEL_TO',
  'SUPPORTS', 'UNDERMINES', 'TENSIONS_WITH'
];

function validateBeatType(type: unknown): BeatType {
  if (typeof type === 'string' && VALID_BEAT_TYPES.includes(type as BeatType)) {
    return type as BeatType;
  }
  return 'IDEA';
}

function validateConnectionType(type: unknown): BeatConnectionType {
  if (typeof type === 'string' && VALID_CONNECTION_TYPES.includes(type as BeatConnectionType)) {
    return type as BeatConnectionType;
  }
  return 'RELATES_TO';
}

function parseBeats(response: string): ExtractedBeat[] {
  try {
    // Find JSON in response
    const jsonMatch = response.match(/\{[\s\S]*"beats"[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON found in response');
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(parsed.beats)) {
      return [];
    }

    return parsed.beats.map((beat: ExtractedBeatRaw) => ({
      type: validateBeatType(beat.type),
      name: String(beat.name || 'Unnamed Beat'),
      summary: String(beat.summary || ''),
      intensity: Math.max(0, Math.min(1, Number(beat.intensity) || 0.5)),
      valence: Math.max(-1, Math.min(1, Number(beat.valence) || 0)),
      confidence: Math.max(0, Math.min(1, Number(beat.confidence) || 0.8)),
      connections: (beat.connections || []).map(conn => ({
        toBeatName: String(conn.toBeatName || ''),
        type: validateConnectionType(conn.type),
        strength: Math.max(0, Math.min(1, Number(conn.strength) || 0.5)),
        evidence: String(conn.evidence || ''),
      })).filter(conn => conn.toBeatName),
    }));
  } catch (error) {
    console.error('Failed to parse extraction result:', error);
    return [];
  }
}

// POST /api/beats/extract - Extract beats from text using cloud LLM
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, model } = body;

    if (!text) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    const { ollamaUrl, ollamaModel } = CLOUD_CONFIG;

    // Truncate text if too long
    const maxLength = 32000 - 1000; // Leave room for prompt and response
    const truncatedText = text.length > maxLength
      ? text.slice(0, maxLength) + '\n...[truncated]'
      : text;

    const prompt = EXTRACTION_PROMPT.replace('{text}', truncatedText);

    // Call Ollama API
    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ollamaModel,
        prompt,
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: 4096,
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Ollama API error:', response.status, errorText);
      return NextResponse.json(
        { error: 'Cloud extraction failed', details: errorText },
        { status: 500 }
      );
    }

    const data = await response.json();
    const beats = parseBeats(data.response);

    return NextResponse.json({
      beats,
      count: beats.length,
      model: 'cloud',
      processingTimeMs: data.total_duration ? data.total_duration / 1000000 : 0,
    });
  } catch (error) {
    console.error('Error in beat extraction:', error);
    return NextResponse.json(
      { error: 'Extraction failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}