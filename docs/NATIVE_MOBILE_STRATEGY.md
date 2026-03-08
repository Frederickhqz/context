# Native Mobile Strategy 2026

Based on research into current (2025-2026) best practices for on-device LLM inference on iOS and Android.

## Executive Summary

**Recommended Stack:**

| Platform | Framework | Model | Why |
|----------|-----------|-------|-----|
| **iOS** | MLX Swift | Gemma 3n E2B (MLX format) | Native Apple Silicon optimization |
| **Android** | LiteRT-LM | Gemma 3n E2B (LiteRT format) | Google's official on-device LLM framework |
| **Cross-Platform** | llama.rn | Gemma 3 1B (GGUF) | React Native wrapper for shared code |

## Platform-Specific Approaches

### iOS: Apple MLX + MLX Swift

**What it is:**
- Apple's open-source ML framework purpose-built for Apple Silicon
- Takes advantage of unified memory architecture (CPU + GPU share memory)
- MLX Swift provides native Swift API
- No bridging overhead - direct Swift to Metal

**Benefits:**
- Best performance on Apple Silicon (M-series chips)
- Native Swift integration (no React Native bridge overhead)
- Supports Gemma models via `mlx-community` on Hugging Face
- Privacy-first: all inference happens on-device
- Offline capability built-in

**Model Recommendations:**
```
Gemma 3n E2B (2B parameters, multimodal)
├── Size: ~1.5GB quantized
├── RAM: 4GB minimum
├── Performance: Real-time on M-series, acceptable on A16+
└── Format: .mlx (converted from safetensors)

Gemma 3 1B (1B parameters, text-only)
├── Size: ~529MB quantized
├── RAM: 2GB minimum
├── Performance: Fast on all iPhones (A14+)
└── Format: .mlx
```

**Implementation:**

```swift
// Package.swift
dependencies: [
    .package(url: "https://github.com/ml-explore/mlx-swift", from: "0.20.0")
]

// LLMService.swift
import MLX
import MLXNN
import MLXLM

class LLMService {
    private var model: LLMModel?
    
    func loadModel() async throws {
        // Download from Hugging Face mlx-community
        let modelPath = try await downloadModel(
            from: "mlx-community/gemma-3n-1.0-2b-quantized"
        )
        model = try await LLMModel.load(path: modelPath)
    }
    
    func generate(prompt: String) async throws -> String {
        guard let model = model else {
            throw LLMError.modelNotLoaded
        }
        
        let tokens = try await model.generate(
            prompt: prompt,
            maxTokens: 2048,
            temperature: 0.3
        )
        return tokens
    }
}
```

**Memory Management:**
- iOS kills apps that use too much memory silently
- Use `os_proc_available_memory()` to check available RAM
- Set memory budget at 60% of available
- Implement graceful degradation (smaller context window)

### Android: Google LiteRT-LM

**What it is:**
- Google's new (2025) on-device LLM inference framework
- Successor to TensorFlow Lite for AI era
- Kotlin/Java-friendly API on top of optimized C++ backend
- GPU acceleration via ML Drift, NPU support for Qualcomm/MediaTek

**Benefits:**
- Official Google framework (first-party support)
- Optimized for Android hardware
- Supports Gemma, Llama, Phi, Qwen
- LoRA customization support
- Multi-modality (vision + audio)

**Model Recommendations:**
```
Gemma 3n E2B (2B parameters, multimodal)
├── Size: ~1.5GB quantized
├── RAM: 4GB minimum (6GB recommended)
├── Performance: Real-time on Snapdragon 8 Gen 2+
└── Format: .litert (converted from safetensors)

Gemma 3 1B (1B parameters, text-only)
├── Size: ~529MB quantized
├── RAM: 2GB minimum
├── Performance: Fast on all modern Android devices
└── Format: .litert
```

**Implementation:**

```kotlin
// build.gradle
dependencies {
    implementation("com.google.ai.edge:litert-lm:0.2.0")
}

// LLMService.kt
class LLMService(private val context: Context) {
    private var llm: LlmInference? = null
    
    suspend fun loadModel() {
        // Copy model from assets or download
        val modelPath = copyModelFromAssets("gemma-3n-2b.litert")
        
        val options = LlmInference.Options.Builder()
            .setModelPath(modelPath)
            .setMaxTokens(2048)
            .setTemperature(0.3f)
            .build()
        
        llm = LlmInference(options)
    }
    
    suspend fun generate(prompt: String): String {
        return llm?.generate(prompt) ?: throw LLMError.ModelNotLoaded
    }
}
```

**Hardware Acceleration:**
```kotlin
// GPU acceleration (ML Drift)
.setAccelerator(Accelerator.GPU)

// NPU acceleration (Qualcomm Hexagon)
.setAccelerator(Accelerator.NPU)
// Requires: <uses-native-library android:name="libcdsprpc.so" />
```

### Cross-Platform: llama.rn (React Native)

**What it is:**
- React Native bindings for llama.cpp
- Works on iOS and Android from single codebase
- Uses GGUF quantized models
- Requires React Native New Architecture (Turbo Modules + JSI)

**Benefits:**
- Single codebase for both platforms
- GPU acceleration: Metal (iOS), OpenCL/Hexagon NPU (Android)
- Supports all llama.cpp features (grammar, JSON mode, tool calling)
- Active community and updates

**Model Recommendations:**
```
Gemma 3 1B (Q4_K_M quantization)
├── Size: ~600MB
├── RAM: 2GB minimum
├── Performance: Real-time on modern devices
└── Format: .gguf

Gemma 2 2B (Q4_K_M quantization)
├── Size: ~1.4GB
├── RAM: 3GB minimum
├── Performance: Good on flagship devices
└── Format: .gguf
```

**Implementation:**

```typescript
// Install
npm install llama.rn

// LLMService.ts
import { Llama } from 'llama.rn';
import RNFS from 'react-native-fs';

class LLMService {
  private context: LlamaContext | null = null;
  
  async loadModel(): Promise<void> {
    const modelPath = `${RNFS.DocumentDirectoryPath}/gemma-3-1b-q4_k_m.gguf`;
    
    // Download if not exists
    if (!(await RNFS.exists(modelPath))) {
      await RNFS.downloadFile({
        fromUrl: 'https://huggingface.co/.../gemma-3-1b-q4_k_m.gguf',
        toFile: modelPath,
      }).promise;
    }
    
    this.context = await Llama.init({
      model: modelPath,
      n_ctx: 2048,
      n_gpu_layers: 20, // Offload to GPU
    });
  }
  
  async generate(prompt: string): Promise<string> {
    if (!this.context) throw new Error('Model not loaded');
    
    const result = await this.context.completion({
      prompt,
      n_predict: 512,
      temperature: 0.3,
      // JSON mode for structured output
      grammar: this.context.getGrammar('json'),
    });
    
    return result.text;
  }
}
```

## Architecture Decision

### Option A: Native iOS + Native Android (Recommended for Production)

```
Context App
├── iOS App (Swift + MLX)
│   ├── Shared: Core business logic (TypeScript)
│   ├── Native: MLX inference
│   └── Native: Swift UI
│
└── Android App (Kotlin + LiteRT)
    ├── Shared: Core business logic (TypeScript)
    ├── Native: LiteRT inference
    └── Native: Jetpack Compose UI
```

**Pros:**
- Best performance on each platform
- First-party frameworks (Apple MLX, Google LiteRT)
- Native UI experiences
- Full hardware acceleration

**Cons:**
- Two codebases to maintain
- Platform-specific expertise needed
- More development time

**Shared Code Strategy:**
- Business logic in TypeScript (shared)
- Generate Swift/Kotlin bindings via code generation
- Or use shared Rust core with FFI bindings

### Option B: React Native + llama.rn (Faster MVP)

```
Context App (React Native)
├── Shared: TypeScript logic
├── Shared: React Native UI
└── Native Module: llama.rn (llama.cpp)
```

**Pros:**
- Single codebase
- Faster development
- Easier to maintain
- Can still share TypeScript logic with Option A

**Cons:**
- Bridge overhead (minor with New Architecture)
- Less optimized than native frameworks
- GPU acceleration varies by platform

### Option C: PWA + Native Modules (Hybrid)

```
Context App (Capacitor)
├── Shared: Web app (Next.js)
├── Native: Capacitor plugins
│   ├── iOS: MLX via plugin
│   └── Android: LiteRT via plugin
└── Native: Service Worker for offline
```

**Pros:**
- Reuse existing web code
- Add native capabilities incrementally
- Easier than full React Native rewrite

**Cons:**
- Performance overhead
- Plugin maintenance burden

## Model Strategy

### Quantization Levels

| Format | Size Reduction | Quality Loss | Recommended For |
|--------|----------------|--------------|-----------------|
| F16 | 50% | None | Development |
| Q8_0 | 75% | Minimal | High quality |
| Q5_K_M | 80% | Minor | Production |
| Q4_K_M | 83% | Noticeable | Mobile |
| Q3_K_M | 87% | Significant | Low-memory devices |

**Recommendation:** Q4_K_M for mobile (good balance of size/quality)

### Model Download Strategy

```typescript
// Progressive model download
const MODEL_VERSIONS = {
  'gemma-3-1b': {
    url: 'https://cdn.context.app/models/gemma-3-1b-q4_k_m.gguf',
    size: 529_000_000,
    sha256: '...',
  },
  'gemma-3n-2b': {
    url: 'https://cdn.context.app/models/gemma-3n-2b-q4_k_m.gguf',
    size: 1_400_000_000,
    sha256: '...',
  },
};

async function downloadModel(modelId: string): Promise<string> {
  const model = MODEL_VERSIONS[modelId];
  const localPath = getLocalPath(modelId);
  
  // Resume partial downloads
  const existingSize = await getLocalFileSize(localPath);
  
  // Download with progress
  await downloadWithResume(
    model.url,
    localPath,
    { startByte: existingSize }
  );
  
  // Verify checksum
  const hash = await sha256File(localPath);
  if (hash !== model.sha256) {
    throw new Error('Model corrupted');
  }
  
  return localPath;
}
```

### Memory Budget Management

```typescript
// Device memory check
function getRecommendedModel(): string {
  const totalRAM = getDeviceMemory();
  
  if (totalRAM >= 8_000_000_000) {
    return 'gemma-3n-2b'; // 4GB+ devices
  } else if (totalRAM >= 4_000_000_000) {
    return 'gemma-3-1b'; // 2GB+ devices
  } else {
    return 'cloud'; // Fallback to cloud API
  }
}
```

## Embedding Strategy for Mobile

### Critical: Consistency Requirement

**You MUST use the same embedding model across all platforms.**

If you change models, you must re-embed ALL data.

### Mobile-Friendly Embedding Models

| Model | Dimensions | Size | Mobile RAM | Quality |
|-------|-----------|------|------------|---------|
| all-MiniLM-L6-v2 | 384 | 23MB | ~100MB | Good |
| nomic-embed-text | 768 | 274MB | ~350MB | Better |
| embeddinggemma | 768 | ~200MB | ~300MB | Best |

**Recommendation:**
- For **new projects:** `all-MiniLM-L6-v2` (smallest, fastest)
- For **existing projects:** Keep `embeddinggemma` (requires server sync)

### Mobile Embedding Implementation

```typescript
// iOS: Use Core ML for embeddings
// Android: Use TensorFlow Lite for embeddings

class EmbeddingService {
  private model: EmbeddingModel;
  
  async loadModel(): Promise<void> {
    // iOS: Use Core ML .mlmodel format
    // Android: Use TFLite .tflite format
    
    // For MiniLM-L6-v2:
    // - iOS: all-MiniLM-L6-v2.mlmodel (Core ML)
    // - Android: all-MiniLM-L6-v2.tflite
    
    this.model = await loadEmbeddingModel('all-MiniLM-L6-v2');
  }
  
  async embed(text: string): Promise<number[]> {
    return this.model.embed(text);
  }
  
  async embedBatch(texts: string[]): Promise<number[][]> {
    // Batch embedding for efficiency
    return this.model.embedBatch(texts);
  }
}
```

## Sync Strategy

### Architecture

```
Mobile App
├── Local SQLite (offline storage)
├── Local Embeddings (MiniLM or server-sync)
├── Local LLM (Gemma 3n)
└── Sync Layer
    ├── Embedding Sync: Download new embeddings from server
    ├── Beat Sync: Download beats to device
    └── Extraction Sync: Upload extracted beats when online
```

### Conflict Resolution

```typescript
// Last-write-wins with server authority
async function syncBeat(localBeat: Beat, serverBeat: Beat): Promise<Beat> {
  if (localBeat.updatedAt > serverBeat.updatedAt) {
    // Local is newer - upload to server
    await uploadBeat(localBeat);
    return localBeat;
  } else {
    // Server is newer - update local
    await saveBeatLocally(serverBeat);
    return serverBeat;
  }
}
```

## Implementation Roadmap

### Phase 1: PWA + Cloud (Now)
- PWA manifest and service worker
- Cloud API for all AI operations
- Offline queue for notes
- Ship immediately

### Phase 2: React Native + llama.rn (Q2 2026)
- React Native app with shared TypeScript
- llama.rn for on-device LLM
- Cloud fallback when device can't run model

### Phase 3: Native Apps (Q3 2026)
- iOS app with MLX Swift
- Android app with LiteRT
- Share business logic from Phase 2
- Best performance

## File Structure

```
context/
├── apps/
│   ├── web/                    # Next.js (current)
│   ├── mobile/                 # React Native (future)
│   ├── ios/                    # Native iOS (future)
│   └── android/                # Native Android (future)
│
├── packages/
│   ├── core/                   # Shared TypeScript logic
│   ├── ai/                     # AI abstractions
│   │   ├── src/
│   │   │   ├── extraction/
│   │   │   ├── embeddings/
│   │   │   └── providers/
│   │   │       ├── cloud.ts    # Ollama/OpenAI
│   │   │       ├── webllm.ts   # Browser
│   │   │       ├── mlx.ts      # iOS native
│   │   │       └── litert.ts   # Android native
│   │   └── index.ts
│   │
│   └── sync/                   # Offline sync
│
└── models/
    ├── gemma-3-1b-q4_k_m.gguf
    ├── all-MiniLM-L6-v2.mlmodel    # iOS
    └── all-MiniLM-L6-v2.tflite     # Android
```

## Resources

### Documentation
- [MLX Framework](https://mlx-framework.org/)
- [MLX Swift](https://github.com/ml-explore/mlx-swift)
- [LiteRT-LM](https://ai.google.dev/edge/litert-lm/overview)
- [llama.rn](https://github.com/mybigday/llama.rn)
- [Gemma Models](https://ai.google.dev/gemma)

### Models
- [mlx-community](https://huggingface.co/mlx-community) - MLX format models
- [Google LiteRT Models](https://ai.google.dev/edge/litert-lm/models)
- [GGUF Models](https://huggingface.co/models?search=gguf%20gemma)

### Tutorials
- [Running LLMs on iOS with MLX](https://medium.com/@ale058791/build-an-on-device-ai-text-generator-for-ios-with-mlx-fdd2bea1f410)
- [Gemma on Android with LiteRT](https://medium.com/google-developer-experts/from-zero-to-hero-running-googles-gemma-3n-on-android-with-litert-qualcomm-qnn-4eaa38bbadd4)
- [llama.rn React Native Guide](https://github.com/mybigday/llama.rn#usage)