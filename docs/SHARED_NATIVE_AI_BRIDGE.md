# Shared Native AI Bridge Specification v1.0 (2026)

## Purpose
To ensure that "Beats" and "Connections" are extracted with 100% consistency across Web (current), iOS (Apple Intelligence), and Android (AICore/Gemini Nano), regardless of the underlying LLM.

## 1. Unified Extraction Schema (JSON)
All native implementations MUST output the following JSON structure. This ensures the database and the "Beat Universe" visualization can consume data from any device.

```json
{
  "version": "1.0",
  "beats": [
    {
      "id": "uuid",
      "type": "CHARACTER | PLACE | THEME | CONFLICT | EVENT | FEELING | IDEA",
      "name": "Short identifier (2-5 words)",
      "summary": "One sentence description",
      "intensity": 0.0-1.0,
      "valence": -1.0-1.0,
      "metadata": {
        "source": "native_ios | native_android | web_llm",
        "model": "apple_slm | gemini_nano | gemma_3"
      }
    }
  ],
  "inferred_connections": [
    {
      "from_beat_name": "string",
      "to_beat_name": "string",
      "type": "MIRRORS | CAUSES | CONTRADICTS | SUPPORTS | EVOLVES_TO",
      "strength": 0.0-1.0
    }
  ]
}
```

## 2. System Prompt Standardization
To maintain consistency, we use a "Base Prompt" that is injected into the native system prompts for Apple Intelligence and Gemini Nano.

**Prompt Key:** `context_extraction_v1`
> "You are an atomic meaning extractor for the Context app. Your goal is to identify 'Beats'. 
> Rules: 
> 1. Beats must be atomic (one single idea per beat). 
> 2. Classify based on the standard schema. 
> 3. Identify relationships only if explicitly evidenced in text."

## 3. The Embedding Lock (The "Same Encoder" Rule)
As identified, we cannot mix embedding models. We are locking the ecosystem to:
- **Model:** `nomic-embed-text-v1.5` (or `all-MiniLM-L6-v2` for maximum speed)
- **Dimensions:** 768 (Nomic) or 384 (MiniLM)
- **Implementation:**
  - **Server (Ollama/Python):** `nomic-embed-text`
  - **iOS (Swift):** ExecuTorch / Accelerate (running Nomic weights)
  - **Android (Kotlin):** LiteRT / NNAPI (running Nomic weights)

## 4. Platform Implementation Bridges

### iOS Native Bridge (Swift)
```swift
protocol ContextAIBridge {
    func extractBeats(from text: String) async throws -> ExtractionResult
    func generateEmbedding(for text: String) async throws -> [Float]
}

// Uses Apple Intelligence FoundationModels
class AppleIntelligenceBridge: ContextAIBridge { ... }
```

### Android Native Bridge (Kotlin)
```kotlin
interface ContextAIBridge {
    suspend fun extractBeats(text: String): ExtractionResult
    suspend fun generateEmbedding(text: String): FloatArray
}

// Uses Android AICore Gemini Nano
class AndroidAICoreBridge: ContextAIBridge { ... }
```

## 5. Deployment Workflow
1. **Validation:** Before any beat is saved to Supabase, the backend validates it against the `Shared Spec`.
2. **Re-Embedding:** If a user switches from Web to Native, the app checks if the `embedding_model_id` matches. If not, it requests a re-embed of that specific note using the "Locked" model.

## 6. Next Steps for Implementation
1. [ ] Create `src/lib/ai/shared-spec.ts` in the current repo to hold these constants.
2. [ ] Update the `extractor.ts` to strictly follow this JSON output format.
3. [ ] Finalize the decision on Nomic vs MiniLM for the "Locked" embedding model.
