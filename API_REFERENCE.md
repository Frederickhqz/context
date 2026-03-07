# Context Beats - API Reference

## Base URL

```
Production: https://context-rho-drab.vercel.app/api
Development: http://localhost:3000/api
```

## Authentication

All endpoints require authentication. Include the session cookie or API key.

---

## Beats

### List Beats

```http
GET /api/beats
```

Query parameters:
- `type` - Filter by beat type (CHARACTER, THEME, EVENT, etc.)
- `worldId` - Filter by world
- `timelineId` - Filter by timeline
- `dimensionId` - Filter by dimension
- `search` - Search in name and summary
- `limit` - Max results (default: 50, max: 100)
- `offset` - Pagination offset

Response:
```json
{
  "beats": [
    {
      "id": "beat_abc123",
      "beatType": "CHARACTER",
      "name": "The Mentor",
      "summary": "A guiding figure who knows more than they reveal",
      "intensity": 0.8,
      "valence": 0.2,
      "frequency": 5
    }
  ],
  "pagination": {
    "total": 100,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

### Create Beat

```http
POST /api/beats
```

Body:
```json
{
  "beatType": "CHARACTER",
  "name": "The Mentor",
  "summary": "A guiding figure",
  "intensity": 0.8,
  "valence": 0.2,
  "noteId": "note_xyz"  // Optional: link to note
}
```

Response:
```json
{
  "beat": {
    "id": "beat_abc123",
    "beatType": "CHARACTER",
    "name": "The Mentor"
  }
}
```

### Get Beat

```http
GET /api/beats/:id
```

Response:
```json
{
  "beat": {
    "id": "beat_abc123",
    "beatType": "CHARACTER",
    "name": "The Mentor",
    "summary": "...",
    "intensity": 0.8,
    "valence": 0.2,
    "notes": [...],
    "outgoingConnections": [...],
    "incomingConnections": [...]
  }
}
```

### Update Beat

```http
PATCH /api/beats/:id
```

Body:
```json
{
  "name": "Updated Name",
  "intensity": 0.9
}
```

### Delete Beat

```http
DELETE /api/beats/:id
```

### Analyze Beat for Connections

```http
POST /api/beats/:id
```

Body:
```json
{
  "action": "analyze"
}
```

Response:
```json
{
  "suggestions": [
    {
      "beatId": "beat_xyz",
      "beatName": "Brother's Betrayal",
      "similarity": 0.92,
      "suggestedConnection": "MIRRORS"
    }
  ]
}
```

---

## Beat Mesh

### Get Mesh Data

```http
GET /api/beats/mesh
```

Query parameters:
- `worldId` - Filter by world
- `timelineId` - Filter by timeline
- `types` - Comma-separated beat types
- `connectionTypes` - Comma-separated connection types
- `minIntensity` - Minimum intensity (0-1)
- `maxIntensity` - Maximum intensity (0-1)
- `showContradictions` - Include contradictions (true/false)

Response:
```json
{
  "mesh": {
    "nodes": [
      {
        "id": "beat_abc",
        "type": "CHARACTER",
        "name": "The Mentor",
        "position": [1.2, 3.4, 5.6],
        "color": "#FF6B6B",
        "shape": "sphere"
      }
    ],
    "edges": [
      {
        "id": "conn_123",
        "from": "beat_abc",
        "to": "beat_xyz",
        "type": "MIRRORS",
        "strength": 0.85,
        "isContradiction": false
      }
    ]
  },
  "stats": {
    "totalBeats": 50,
    "totalConnections": 120,
    "byType": {...},
    "contradictions": 3
  }
}
```

---

## Notes

### Extract Beats from Note

```http
POST /api/notes/:id/beats
```

Body:
```json
{
  "model": "cloud",  // "local" or "cloud"
  "createConnectedBeats": true
}
```

Response:
```json
{
  "beats": [
    {
      "type": "CHARACTER",
      "name": "The Mentor",
      "summary": "...",
      "intensity": 0.8
    }
  ],
  "count": 5,
  "noteId": "note_xyz"
}
```

### Get Note Beats

```http
GET /api/notes/:id/beats
```

---

## Contradictions

### Find Contradictions

```http
GET /api/contradictions
```

Query parameters:
- `worldId` - Filter by world
- `severity` - Filter by severity (low, medium, high, critical)

Response:
```json
{
  "contradictions": [
    {
      "id": "contradiction_1",
      "type": "temporal",
      "severity": "high",
      "description": "Event A occurs before B, but also after B",
      "beats": [
        { "id": "beat_1", "name": "Event A" },
        { "id": "beat_2", "name": "Event B" }
      ]
    }
  ],
  "total": 3,
  "byType": { "temporal": 1, "factual": 2 },
  "bySeverity": { "high": 1, "medium": 2 }
}
```

### Suggest Resolution

```http
POST /api/contradictions
```

Body:
```json
{
  "action": "suggest",
  "beat1Id": "beat_1",
  "beat2Id": "beat_2"
}
```

Response:
```json
{
  "contradiction": {...},
  "suggestion": "Consider revising the timeline..."
}
```

---

## Beat Connections

### Create Connection

```http
POST /api/beats/:id
```

Body:
```json
{
  "action": "connect",
  "toBeatId": "beat_xyz",
  "connectionType": "MIRRORS",
  "strength": 0.85,
  "evidence": "Both involve betrayal"
}
```

### Auto-Detect Connections (suggested)

```http
POST /api/beats/detect-connections
```

Body (either `noteId` or `beatIds` required):
```json
{
  "noteId": "note_123",
  "maxPairs": 30,
  "minStrength": 0.65,
  "allowContradictions": true,
  "preferCheapSimilarity": true,
  "cheapSimilarityThreshold": 0.72
}
```

Notes:
- When `preferCheapSimilarity=true`, the API will create `RELATES_TO` suggestions using a cheap lexical similarity heuristic (name+summary) before spending LLM calls.
- If the cheap similarity doesn't meet threshold, it falls back to LLM-based relationship inference.

### Get Connection Suggestions

```http
GET /api/beats/suggestions/:id
```

Query params:
- `limit` - Max suggestions (default: 10, max: 50)
- `minConfidence` - Minimum confidence level: high, medium, low (default: medium)
- `useLLM` - Use LLM to refine suggestions (default: true)

Response:
```json
{
  "beatId": "beat_1",
  "beatName": "The Mentor",
  "suggestions": [
    {
      "fromBeatId": "beat_1",
      "toBeatId": "beat_2",
      "toBeatName": "Brother's Betrayal",
      "toBeatType": "EVENT",
      "suggestedType": "MIRRORS",
      "strength": 0.85,
      "confidence": "high",
      "evidence": "Both involve betrayal by trusted figures",
      "source": "llm"
    }
  ],
  "generatedAt": "2026-03-07T18:00:00Z",
  "stats": {
    "embeddingCandidates": 20,
    "lexicalCandidates": 5,
    "llmAnalyzed": 3,
    "totalSuggestions": 10
  }
}
```

Sources:
- `embedding` - Found via vector similarity
- `lexical` - Found via text overlap
- `llm` - Refined by LLM analysis

---

## MCP Integration

Context Beats exposes an MCP server for AI assistant integration.

### Available Tools

- `list_beats` - List all beats
- `get_beat` - Get beat details
- `create_beat` - Create a beat
- `search_beats` - Semantic search
- `extract_beats` - Extract from text
- `connect_beats` - Create connection
- `find_contradictions` - Find conflicts
- `get_mesh_stats` - Get statistics

### Usage with AI Assistants

```json
{
  "tool": "extract_beats",
  "arguments": {
    "text": "The mentor reveals he knew about the betrayal..."
  }
}
```

Response:
```json
{
  "extracted": 3,
  "beats": [
    { "type": "CHARACTER", "name": "The Mentor", ... },
    { "type": "EVENT", "name": "Mentor's Revelation", ... },
    { "type": "MOTIF", "name": "Mirror of Betrayal", ... }
  ]
}
```