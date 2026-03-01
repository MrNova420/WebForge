/**
 * @module optimization
 * @fileoverview Occlusion culling system using hardware occlusion queries
 */

import { BoundingBox, BoundingSphere } from './FrustumCulling';
import { Camera } from '../rendering/Camera';
import { Logger } from '../core/Logger';
import { Vector3 } from '../math/Vector3';

/**
 * Occlusion query result
 */
export enum OcclusionResult {
  /** Query is still pending */
  PENDING,
  /** Object is visible */
  VISIBLE,
  /** Object is occluded */
  OCCLUDED
}

/**
 * Occlusion query object
 */
export interface OcclusionQuery {
  /** Query ID */
  id: string;
  /** WebGL query object */
  query: WebGLQuery | null;
  /** Last known result */
  result: OcclusionResult;
  /** Frame when query was issued */
  frame: number;
  /** Bounding volume being tested */
  bounds: BoundingBox | BoundingSphere;
}

/**
 * Occlusion culling configuration
 */
export interface OcclusionCullingConfig {
  /** Enable occlusion culling */
  enabled?: boolean;
  /** Frames to wait before requerying visible objects */
  visibleFrameSkip?: number;
  /** Frames to wait before requerying occluded objects */
  occludedFrameSkip?: number;
  /** Use conservative occlusion (test larger bounds) */
  conservative?: boolean;
}

/**
 * Occlusion culling system using hardware queries
 */
export class OcclusionCullingSystem {
  private gl: WebGL2RenderingContext;
  private logger: Logger;
  
  private enabled: boolean;
  private visibleFrameSkip: number;
  private occludedFrameSkip: number;
  private _conservative: boolean;
  
  private queries: Map<string, OcclusionQuery> = new Map();
  private queryPool: WebGLQuery[] = [];
  private currentFrame: number = 0;
  
  private occludedCount: number = 0;
  private totalCount: number = 0;

  /**
   * Creates a new occlusion culling system
   * @param gl - WebGL context
   * @param config - Occlusion culling configuration
   */
  constructor(gl: WebGL2RenderingContext, config: OcclusionCullingConfig = {}) {
    this.gl = gl;
    this.logger = new Logger('OcclusionCulling');
    
    this.enabled = config.enabled !== undefined ? config.enabled : true;
    this.visibleFrameSkip = config.visibleFrameSkip || 5;
    this.occludedFrameSkip = config.occludedFrameSkip || 30;
    this._conservative = config.conservative !== undefined ? config.conservative : true;
    
    // Check for occlusion query support
    if (!this.gl.getExtension('EXT_occlusion_query_boolean')) {
      this.logger.warn('Occlusion queries not supported, disabling occlusion culling');
      this.enabled = false;
    }
  }

  /**
   * Begins a new frame
   */
  beginFrame(): void {
    this.currentFrame++;
    this.occludedCount = 0;
    this.totalCount = 0;
  }

  /**
   * Tests if an object is visible (not occluded)
   * @param id - Object identifier
   * @param bounds - Bounding volume
   * @param camera - Active camera
   * @returns True if visible, false if occluded, undefined if unknown
   */
  isVisible(id: string, bounds: BoundingBox | BoundingSphere, _camera: Camera): boolean | undefined {
    if (!this.enabled) {
      return true; // Always visible if occlusion culling is disabled
    }
    
    this.totalCount++;
    
    let query = this.queries.get(id);
    
    // First time seeing this object
    if (!query) {
      query = {
        id,
        query: null,
        result: OcclusionResult.VISIBLE, // Assume visible initially
        frame: this.currentFrame,
        bounds
      };
      this.queries.set(id, query);
      this.issueQuery(query);
      return true;
    }
    
    // Update bounds
    query.bounds = bounds;
    
    // Check if we need to requery
    const framesSinceQuery = this.currentFrame - query.frame;
    const shouldRequery = 
      (query.result === OcclusionResult.VISIBLE && framesSinceQuery >= this.visibleFrameSkip) ||
      (query.result === OcclusionResult.OCCLUDED && framesSinceQuery >= this.occludedFrameSkip);
    
    if (shouldRequery) {
      this.issueQuery(query);
    }
    
    // Check query result
    if (query.query && query.result === OcclusionResult.PENDING) {
      const available = this.gl.getQueryParameter(query.query, this.gl.QUERY_RESULT_AVAILABLE);
      if (available) {
        const result = this.gl.getQueryParameter(query.query, this.gl.QUERY_RESULT);
        query.result = result > 0 ? OcclusionResult.VISIBLE : OcclusionResult.OCCLUDED;
        
        // Return query to pool
        this.queryPool.push(query.query);
        query.query = null;
      }
    }
    
    // Return visibility based on last known result
    const visible = query.result !== OcclusionResult.OCCLUDED;
    if (!visible) {
      this.occludedCount++;
    }
    
    return visible;
  }

  /**
   * Issues an occlusion query for an object
   * @param query - Occlusion query object
   */
  private issueQuery(query: OcclusionQuery): void {
    // Get or create WebGL query
    if (!query.query) {
      query.query = this.queryPool.pop() || this.gl.createQuery();
    }
    
    if (!query.query) {
      return;
    }
    
    // Begin query
    this.gl.beginQuery(this.gl.ANY_SAMPLES_PASSED, query.query);
    
    // Render bounding volume (simplified - would render actual geometry)
    this.renderBoundingVolume(query.bounds);
    
    // End query
    this.gl.endQuery(this.gl.ANY_SAMPLES_PASSED);
    
    query.result = OcclusionResult.PENDING;
    query.frame = this.currentFrame;
  }

  /**
   * Renders a bounding volume for occlusion testing
   * Uses minimal vertex/index buffers to draw a simple box or sphere proxy
   * @param bounds - Bounding volume to render
   */
  private renderBoundingVolume(bounds: BoundingBox | BoundingSphere): void {
    const gl = this.gl;
    
    // Disable color writes - we only need depth/stencil for occlusion
    gl.colorMask(false, false, false, false);
    gl.depthMask(false);
    
    if (bounds instanceof BoundingBox) {
      this.renderBoundingBox(bounds);
    } else {
      // BoundingSphere - approximate as cube for simplicity in occlusion testing
      const radius = bounds.radius;
      const center = bounds.center;
      const boxBounds = new BoundingBox(
        new Vector3(center.x - radius, center.y - radius, center.z - radius),
        new Vector3(center.x + radius, center.y + radius, center.z + radius)
      );
      this.renderBoundingBox(boxBounds);
    }
    
    // Restore color and depth writes
    gl.colorMask(true, true, true, true);
    gl.depthMask(true);
  }
  
  /**
   * Renders a bounding box using a simple 8-vertex cube
   */
  private renderBoundingBox(bounds: BoundingBox): void {
    const gl = this.gl;
    const min = bounds.min;
    const max = bounds.max;
    
    // 8 vertices of the bounding box
    const vertices = new Float32Array([
      min.x, min.y, min.z,
      max.x, min.y, min.z,
      max.x, max.y, min.z,
      min.x, max.y, min.z,
      min.x, min.y, max.z,
      max.x, min.y, max.z,
      max.x, max.y, max.z,
      min.x, max.y, max.z
    ]);
    
    // 12 triangles (6 faces × 2 triangles)
    const indices = new Uint16Array([
      0, 1, 2,  0, 2, 3,  // Front
      4, 6, 5,  4, 7, 6,  // Back
      0, 4, 5,  0, 5, 1,  // Bottom
      2, 6, 7,  2, 7, 3,  // Top
      0, 3, 7,  0, 7, 4,  // Left
      1, 5, 6,  1, 6, 2   // Right
    ]);
    
    // Create and bind vertex buffer
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STREAM_DRAW);
    
    // Enable position attribute (location 0)
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    
    // Create and bind index buffer
    const ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STREAM_DRAW);
    
    // Draw
    gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);
    
    // Cleanup
    gl.disableVertexAttribArray(0);
    gl.deleteBuffer(vbo);
    gl.deleteBuffer(ibo);
  }

  /**
   * Gets occlusion culling statistics
   */
  getStatistics(): { occluded: number; total: number; ratio: number } {
    return {
      occluded: this.occludedCount,
      total: this.totalCount,
      ratio: this.totalCount > 0 ? this.occludedCount / this.totalCount : 0
    };
  }

  /**
   * Enables occlusion culling
   */
  enable(): void {
    this.enabled = true;
  }

  /**
   * Disables occlusion culling
   */
  disable(): void {
    this.enabled = false;
  }

  /**
   * Checks if occlusion culling is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Sets the visible frame skip count
   * @param frames - Frames to skip
   */
  setVisibleFrameSkip(frames: number): void {
    this.visibleFrameSkip = Math.max(0, frames);
  }

  /**
   * Sets the occluded frame skip count
   * @param frames - Frames to skip
   */
  setOccludedFrameSkip(frames: number): void {
    this.occludedFrameSkip = Math.max(0, frames);
  }

  /**
   * Gets whether conservative occlusion is enabled
   */
  isConservative(): boolean {
    return this._conservative;
  }

  /**
   * Clears all queries
   */
  clear(): void {
    // Return all active queries to pool
    for (const query of this.queries.values()) {
      if (query.query) {
        this.queryPool.push(query.query);
      }
    }
    this.queries.clear();
  }

  /**
   * Disposes all resources
   */
  dispose(): void {
    this.clear();
    
    // Delete all queries in pool
    for (const query of this.queryPool) {
      this.gl.deleteQuery(query);
    }
    this.queryPool = [];
    
    this.logger.info('Disposed occlusion culling system');
  }
}
