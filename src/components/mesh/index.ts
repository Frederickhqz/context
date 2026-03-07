// Mesh visualization components

// BeatMesh3D - Desktop-focused (full effects, animations)
export { BeatMesh3D } from './BeatMesh3D';

// BeatMesh3DMobile - Mobile-optimized (reduced effects, touch-friendly)
export { BeatMesh3DMobile } from './BeatMeshMobile';

// BeatMesh2D - List view fallback
export { BeatMesh2D } from './BeatMesh3D';

// Dynamic import helpers
// For SSR-safe import:
// const BeatMesh3D = dynamic(() => import('./BeatMesh3D').then(m => ({ default: m.BeatMesh3D })), { ssr: false });
// const BeatMesh3DMobile = dynamic(() => import('./BeatMeshMobile').then(m => ({ default: m.BeatMesh3DMobile })), { ssr: false });