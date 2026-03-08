# Mobile Strategy

Context currently uses WebLLM for on-device AI, which requires WebGPU. This works on desktop browsers but has limited mobile support.

## Current State

### Browser Support
| Platform | WebGPU | Status |
|----------|--------|--------|
| Chrome Desktop | ✅ | Full support |
| Safari Desktop | ✅ | Experimental |
| Firefox Desktop | ✅ | Full support |
| Chrome Android | ⚠️ | In progress (flags) |
| Safari iOS | ❌ | Not supported |
| Firefox Mobile | ❌ | Not supported |

### Fallback Strategy
When WebGPU unavailable:
1. Try cloud API (Ollama)
2. Show "AI features require desktop or cloud" message
3. Queue extraction for later sync

## Mobile App Options

### Option 1: PWA with Cloud-First (Recommended for MVP)

**Architecture:**
```
Mobile PWA
├── Offline-first UI (works without AI)
├── Cloud API for all AI operations
├── Service Worker for caching
├── IndexedDB for local storage
└── Sync when online
```

**Pros:**
- Works on all platforms immediately
- No app store approval
- Smaller app size
- Easier to maintain

**Cons:**
- Requires internet for AI features
- Server costs for cloud inference

**Implementation:**
1. Add `manifest.json` for PWA
2. Implement service worker for offline
3. Add sync queue for offline edits
4. Use cloud API for all extractions

### Option 2: React Native with Native Modules

**Architecture:**
```
React Native App
├── Shared TypeScript logic
├── Native Module: Gemma.cpp (iOS/Android)
├── Native Module: ML Kit (Android) / Core ML (iOS)
├── Fallback: Cloud API
└── SQLite for offline storage
```

**Native AI Options:**

#### iOS
- **MLX** - Apple's ML framework (best for Apple Silicon)
- **Core ML** - Apple's ML framework (good GPU support)
- **Gemma.cpp** - Compile as static library

#### Android
- **ML Kit** - Google's on-device ML
- **TensorFlow Lite** - Google's mobile ML
- **Gemma.cpp** - Compile with NDK

**Pros:**
- Full offline capability
- Native performance
- Can use device-specific optimizations

**Cons:**
- Separate codebase maintenance
- App store requirements
- Large app size (1-2GB for models)
- Battery drain from inference

### Option 3: Capacitor + Native AI Plugin

**Architecture:**
```
Capacitor App (from current Next.js)
├── Same web codebase
├── Capacitor plugins:
│   ├── capacitor-gemma (iOS/Android native)
│   └── capacitor-mlkit (Android only)
├── Fallback: Cloud API
└── SQLite for storage
```

**Pros:**
- Reuse existing web code
- Add native capabilities incrementally
- Simpler than full React Native

**Cons:**
- Performance overhead
- Plugin maintenance burden

## Recommended Path

### Phase 1: PWA + Cloud (Now)
- Implement full PWA support
- Use cloud API for all AI
- Add offline queue for sync
- Ship to mobile browsers immediately

### Phase 2: Native Modules (Post-MVP)
- Create native Gemma.cpp module for iOS (MLX)
- Create native Gemma.cpp module for Android (NDK)
- Package smaller model (Gemma 2B quantized)
- Fall back to cloud on low-memory devices

### Phase 3: App Store Release
- React Native rewrite with shared TypeScript
- Native AI modules as separate packages
- Full offline support
- Background processing

## Embedding Model Strategy

### ⚠️ Critical: Model Consistency

**MUST use the same embedding model for all vectors.**

If you change models:
1. All existing embeddings become invalid
2. Semantic search will fail
3. Must re-embed ALL data

**Current Model:** `embeddinggemma` (768 dimensions, local)

### Mobile Embedding Options

| Model | Dimensions | Size | Mobile Friendly |
|-------|-----------|------|----------------|
| all-MiniLM-L6-v2 | 384 | 23MB | ✅ Best choice |
| nomic-embed-text | 768 | 274MB | ⚠️ Large |
| embeddinggemma | 768 | ~200MB | ⚠️ Large |

**Recommendation:** For mobile, consider `all-MiniLM-L6-v2`:
- Small enough to bundle
- Fast on mobile CPU
- 384 dimensions (smaller vectors)
- Still good quality

**But:** Cannot mix with existing `embeddinggemma` data. Need migration strategy.

## Implementation Files

### Current
- `src/lib/extraction/edge-service.ts` - WebLLM inference
- `src/lib/extraction/use-beat-extraction.ts` - React hook
- `src/lib/embeddings/local.ts` - Local embedding (QMD/Ollama)

### Needed for Mobile
- `src/lib/native/gemma-ios.ts` - iOS native module interface
- `src/lib/native/gemma-android.ts` - Android native module interface
- `src/lib/native/embedding-mobile.ts` - Mobile embedding (MiniLM)
- `capacitor.config.json` - Capacitor config
- `ios/` - Xcode project
- `android/` - Android Studio project

## Testing Checklist

- [ ] PWA installs on iOS/Android
- [ ] Offline mode works without AI
- [ ] Sync queue persists across restarts
- [ ] Cloud API works from mobile
- [ ] Performance acceptable on 4G
- [ ] Battery drain is reasonable