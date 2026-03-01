/**
 * @module webforge
 * @fileoverview WebForge - The Ultimate Web Game Development Platform
 * 
 * @author MrNova420
 * @license MIT
 * @version 1.0.0
 */

// Main Engine API
export { WebForge, QualityPreset } from './WebForge';
export type { WebForgeConfig } from './WebForge';

// Math library
export * from './math';

// Core systems
export * from './core';

// Scene graph
export * from './scene';

// Rendering system
export * from './rendering';

// Optimization systems
export * from './optimization';

// Physics system
export * from './physics';

// Animation system
export * from './animation';

// Audio system
export * from './audio';

// Editor system
export * from './editor';

// Geometry system
export * from './geometry';

// Terrain system
export * from './terrain';

// Particle systems
export * from './particles';

// AI & Pathfinding
export * from './ai';

// Procedural Generation
export * from './procedural';

// Network & Multiplayer
export * from './network';

// Visual Scripting
export * from './scripting';

// Utilities
export * from './utils';

// Weather & VFX Systems
export * from './weather';
export * from './water';
export * from './vfx';

// Character Systems
export * from './character';

// Game UI System
export * from './ui';

// Production Tools
export * from './tools';

// Professional Debugger
export * from './debug';

// Development Tools
export * from './dev';

// Future Tech
export * from './future';

// Export Pipeline
export {
    ExportManager,
    ExportPlatform,
    type ExportConfig as ExportPipelineConfig,
    type ExportResult as ExportPipelineResult,
    type IconSet,
    type SplashScreenSet,
    type ExportArtifact
} from './export/ExportManager';

// Collaboration & Multiplayer
export * from './collaboration';

// Version Control
export * from './versioncontrol';

// Asset Marketplace
export * from './marketplace';

// Performance Profiling
export {
    PerformanceProfiler,
    type ProfilingSession,
    type FrameProfile,
    type MemorySnapshot as ProfilerMemorySnapshot,
    type GPUMetrics,
    type NetworkActivity,
    type PerformanceRecommendation as ProfilerRecommendation
} from './profiling/PerformanceProfiler';

// Documentation Generation
export {
    DocumentationGenerator,
    DocPageType,
    type DocPage,
    type APIDoc,
    type ParameterDoc,
    type ReturnDoc,
    type CodeExample,
    type SearchResult as DocSearchResult
} from './documentation/DocumentationGenerator';

// Default export for convenience
export { WebForge as default } from './WebForge';
