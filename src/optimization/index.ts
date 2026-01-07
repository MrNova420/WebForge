/**
 * @module optimization
 * @fileoverview WebForge Optimization - Performance optimization systems
 */

export { LODSystem, LODGroup } from './LODSystem';
export type { LODLevel, LODConfig, LODStatistics } from './LODSystem';

export { 
  FrustumCullingSystem, 
  Frustum, 
  Plane, 
  BoundingBox, 
  BoundingSphere 
} from './FrustumCulling';

export { InstancingSystem, InstanceBatch } from './InstancingSystem';
export type { InstanceData, InstanceBatchConfig, InstancingStatistics } from './InstancingSystem';

export { OcclusionCullingSystem, OcclusionResult } from './OcclusionCulling';
export type { OcclusionQuery, OcclusionCullingConfig } from './OcclusionCulling';
