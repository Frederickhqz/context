// Beat Extraction Configuration - Gemma 3 Family
// Centralized config for embedding and extraction models

// ============================================================
// EMBEDDING MODELS (EmbeddingGemma - specialized for embeddings)
// ============================================================

export const EMBEDDING_MODELS = {
  // Primary: EmbeddingGemma 308M (Google DeepMind, March 2025)
  'embeddinggemma-300m': {
    name: 'google/embeddinggemma-300m',
    displayName: 'EmbeddingGemma 308M',
    dimensions: 768,
    size: '~200MB',
    local: true,
    recommended: true,
    description: 'Matryoshka embeddings (768 → 128 dimensions)',
    matryoshka: [768, 512, 256, 128], // Can truncate to smaller dims
  },
  
  // Fallback: Multilingual E5 Small (proven, smaller)
  'multilingual-e5-small': {
    name: 'intfloat/multilingual-e5-small',
    displayName: 'Multilingual E5 Small',
    dimensions: 384,
    size: '~120MB',
    local: true,
    recommended: false,
    description: 'Multilingual, proven quality',
  },
  
  // Alternative: BGE Small (Chinese/English)
  'bge-small': {
    name: 'BAAI/bge-small-en-v1.5',
    displayName: 'BGE Small',
    dimensions: 384,
    size: '~130MB',
    local: true,
    recommended: false,
    description: 'Good for English, fast',
  },
  
  // Cloud: Ollama embedding
  'cloud-ollama': {
    name: 'qwen3-embedding:4b',
    displayName: 'Qwen3 Embedding 4B (Cloud)',
    dimensions: 768,
    local: false,
    recommended: false,
    description: 'Cloud embedding via Ollama',
  },
} as const;

export type EmbeddingModelId = keyof typeof EMBEDDING_MODELS;

// ============================================================
// EXTRACTION MODELS (Gemma 3 Family - March 2025)
// ============================================================

export const EXTRACTION_MODELS = {
  // Smallest: Gemma 3 270M (fast, low memory)
  'gemma-3-270m': {
    name: 'google/gemma-3-270m',
    displayName: 'Gemma 3 270M',
    size: '~300MB',
    contextLength: 32000,
    recommended: false,
    capabilities: ['extraction', 'classification'],
    description: 'Smallest Gemma 3, fastest inference',
    webllmId: 'gemma-3-270m-q4f16_1-MLC',
  },
  
  // Recommended: Gemma 3 1B (best balance)
  'gemma-3-1b': {
    name: 'google/gemma-3-1b',
    displayName: 'Gemma 3 1B',
    size: '~1.4GB',
    contextLength: 32000,
    recommended: true,
    capabilities: ['extraction', 'classification', 'reasoning'],
    description: 'Best balance of speed and quality',
    webllmId: 'gemma-3-1b-it-q4f16_1-MLC',
  },
  
  // Multimodal: Gemma 3n E2B (vision + text)
  'gemma-3n-e2b': {
    name: 'google/gemma-3n-e2b',
    displayName: 'Gemma 3n E2B',
    size: '~2.5GB',
    contextLength: 32000,
    recommended: false,
    capabilities: ['extraction', 'classification', 'reasoning', 'vision'],
    description: 'Multimodal (text + images), mobile-optimized',
    webllmId: 'gemma-3n-e2b-q4f16_1-MLC',
  },
  
  // Legacy fallbacks (older models)
  'qwen2.5-1.5b': {
    name: 'Qwen/Qwen2.5-1.5B-Instruct',
    displayName: 'Qwen 2.5 1.5B',
    size: '~1GB',
    contextLength: 32768,
    recommended: false,
    capabilities: ['extraction', 'classification'],
    description: 'Legacy fallback',
    webllmId: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
  },
  
  'phi-3-mini': {
    name: 'microsoft/Phi-3-mini-4k-instruct',
    displayName: 'Phi-3 Mini',
    size: '~2GB',
    contextLength: 4096,
    recommended: false,
    capabilities: ['extraction', 'reasoning'],
    description: 'Legacy fallback',
    webllmId: 'Phi-3-mini-4k-instruct-q4f16_1-MLC',
  },
} as const;

export type ExtractionModelId = keyof typeof EXTRACTION_MODELS;

// ============================================================
// RECOMMENDED DEFAULTS
// ============================================================

export const RECOMMENDED_EMBEDDING_MODEL: EmbeddingModelId = 'embeddinggemma-300m';
export const RECOMMENDED_EXTRACTION_MODEL: ExtractionModelId = 'gemma-3-1b';

// ============================================================
// CLOUD FALLBACK (Ollama)
// ============================================================

export const CLOUD_CONFIG = {
  ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
  ollamaModel: process.env.OLLAMA_MODEL || 'qwen3.5:397b-cloud',
  ollamaEmbedModel: process.env.OLLAMA_EMBED_MODEL || 'qwen3-embedding:4b',
};