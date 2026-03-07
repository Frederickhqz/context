// Mesh visualization components
// BeatMesh3D is dynamically imported to avoid SSR issues with three.js

export { BeatMesh3D, BeatMesh2D } from './BeatMesh3D';

// Dynamic import helper for BeatMesh3D
// Use this in your pages to avoid SSR issues:
// const BeatMesh3D = dynamic(() => import('./BeatMesh3D').then(m => m.BeatMesh3D), { ssr: false });