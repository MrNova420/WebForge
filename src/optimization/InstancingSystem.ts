/**
 * @module optimization
 * @fileoverview GPU instancing system for rendering many similar objects efficiently
 */

import { Matrix4 } from '../math/Matrix4';
import { Mesh } from '../rendering/Mesh';
import { Material } from '../rendering/Material';
import { Logger } from '../core/Logger';

/**
 * Instance data for a single object
 */
export interface InstanceData {
  /** Transform matrix */
  transform: Matrix4;
  /** Optional color tint */
  color?: Float32Array;
  /** Custom data (e.g., texture atlas index) */
  customData?: Float32Array;
}

/**
 * Instanced batch configuration
 */
export interface InstanceBatchConfig {
  /** Maximum instances per batch */
  maxInstances?: number;
  /** Enable automatic batching */
  autoBatch?: boolean;
  /** Update frequency hint (static, dynamic, stream) */
  updateFrequency?: 'static' | 'dynamic' | 'stream';
}

/**
 * Instance batch for rendering multiple objects with same mesh/material
 */
export class InstanceBatch {
  private mesh: Mesh;
  private material: Material;
  private instances: InstanceData[] = [];
  private maxInstances: number;
  private updateFrequency: 'static' | 'dynamic' | 'stream';
  
  private instanceBuffer: WebGLBuffer | null = null;
  private instanceMatrixBuffer: Float32Array;
  private _instanceColorBuffer: Float32Array | null = null;
  private dirty: boolean = true;
  
  private gl: WebGL2RenderingContext;

  /**
   * Creates a new instance batch
   * @param gl - WebGL context
   * @param mesh - Shared mesh
   * @param material - Shared material
   * @param config - Batch configuration
   */
  constructor(
    gl: WebGL2RenderingContext,
    mesh: Mesh,
    material: Material,
    config: InstanceBatchConfig = {}
  ) {
    this.gl = gl;
    this.mesh = mesh;
    this.material = material;
    this.maxInstances = config.maxInstances || 1000;
    this.updateFrequency = config.updateFrequency || 'dynamic';
    
    // Pre-allocate buffers
    this.instanceMatrixBuffer = new Float32Array(this.maxInstances * 16); // 4x4 matrix per instance
    
    this.initializeBuffers();
  }

  /**
   * Initializes WebGL buffers for instancing
   */
  private initializeBuffers(): void {
    this.instanceBuffer = this.gl.createBuffer();
  }

  /**
   * Adds an instance to the batch
   * @param data - Instance data
   * @returns Instance index
   */
  addInstance(data: InstanceData): number {
    if (this.instances.length >= this.maxInstances) {
      throw new Error(`Instance batch full (max: ${this.maxInstances})`);
    }
    
    const index = this.instances.length;
    this.instances.push(data);
    this.dirty = true;
    
    return index;
  }

  /**
   * Updates an instance
   * @param index - Instance index
   * @param data - New instance data
   */
  updateInstance(index: number, data: InstanceData): void {
    if (index < 0 || index >= this.instances.length) {
      throw new Error(`Invalid instance index: ${index}`);
    }
    
    this.instances[index] = data;
    this.dirty = true;
  }

  /**
   * Removes an instance
   * @param index - Instance index
   */
  removeInstance(index: number): void {
    if (index < 0 || index >= this.instances.length) {
      throw new Error(`Invalid instance index: ${index}`);
    }
    
    this.instances.splice(index, 1);
    this.dirty = true;
  }

  /**
   * Clears all instances
   */
  clear(): void {
    this.instances = [];
    this.dirty = true;
  }

  /**
   * Updates GPU buffers if dirty
   */
  updateBuffers(): void {
    if (!this.dirty || this.instances.length === 0) {
      return;
    }
    
    // Update matrix buffer
    for (let i = 0; i < this.instances.length; i++) {
      const matrix = this.instances[i].transform.elements;
      this.instanceMatrixBuffer.set(matrix, i * 16);
    }
    
    // Upload to GPU
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.instanceBuffer);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      this.instanceMatrixBuffer.subarray(0, this.instances.length * 16),
      this.getUsageHint()
    );
    
    this.dirty = false;
  }

  /**
   * Gets WebGL usage hint based on update frequency
   */
  private getUsageHint(): number {
    switch (this.updateFrequency) {
      case 'static': return this.gl.STATIC_DRAW;
      case 'stream': return this.gl.STREAM_DRAW;
      default: return this.gl.DYNAMIC_DRAW;
    }
  }

  /**
   * Renders all instances
   */
  render(): void {
    if (this.instances.length === 0) {
      return;
    }
    
    this.updateBuffers();
    
    // TODO: Actual instanced rendering would be done by the renderer
    // This is a placeholder for the rendering logic
  }

  /**
   * Gets the mesh
   */
  getMesh(): Mesh {
    return this.mesh;
  }

  /**
   * Gets the material
   */
  getMaterial(): Material {
    return this.material;
  }

  /**
   * Gets the number of instances
   */
  getInstanceCount(): number {
    return this.instances.length;
  }

  /**
   * Gets all instances
   */
  getInstances(): InstanceData[] {
    return [...this.instances];
  }

  /**
   * Checks if the batch is dirty
   */
  isDirty(): boolean {
    return this.dirty;
  }

  /**
   * Gets the instance color buffer
   */
  getInstanceColorBuffer(): Float32Array | null {
    return this._instanceColorBuffer;
  }

  /**
   * Disposes GPU resources
   */
  dispose(): void {
    if (this.instanceBuffer) {
      this.gl.deleteBuffer(this.instanceBuffer);
      this.instanceBuffer = null;
    }
  }
}

/**
 * GPU instancing system for efficient rendering of many similar objects
 */
export class InstancingSystem {
  private gl: WebGL2RenderingContext;
  private logger: Logger;
  
  private batches: Map<string, InstanceBatch> = new Map();
  private batchKeyMap: WeakMap<Mesh, WeakMap<Material, string>> = new WeakMap();
  
  private nextBatchId: number = 0;

  /**
   * Creates a new instancing system
   * @param gl - WebGL context
   */
  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.logger = new Logger('InstancingSystem');
  }

  /**
   * Gets or creates a batch for a mesh/material combination
   * @param mesh - Mesh to instance
   * @param material - Material to use
   * @param config - Batch configuration
   * @returns Instance batch
   */
  getBatch(mesh: Mesh, material: Material, config?: InstanceBatchConfig): InstanceBatch {
    let materialMap = this.batchKeyMap.get(mesh);
    if (!materialMap) {
      materialMap = new WeakMap();
      this.batchKeyMap.set(mesh, materialMap);
    }
    
    let key = materialMap.get(material);
    if (!key) {
      key = `batch_${this.nextBatchId++}`;
      materialMap.set(material, key);
      
      const batch = new InstanceBatch(this.gl, mesh, material, config);
      this.batches.set(key, batch);
      
      this.logger.info(`Created instance batch '${key}'`);
    }
    
    return this.batches.get(key)!;
  }

  /**
   * Adds an instance to the appropriate batch
   * @param mesh - Mesh to instance
   * @param material - Material to use
   * @param data - Instance data
   * @returns Batch key and instance index
   */
  addInstance(mesh: Mesh, material: Material, data: InstanceData): { batchKey: string; index: number } {
    const batch = this.getBatch(mesh, material);
    const index = batch.addInstance(data);
    
    // Get the batch key
    const materialMap = this.batchKeyMap.get(mesh);
    const batchKey = materialMap!.get(material)!;
    
    return { batchKey, index };
  }

  /**
   * Updates all batches
   */
  updateAll(): void {
    for (const batch of this.batches.values()) {
      batch.updateBuffers();
    }
  }

  /**
   * Renders all batches
   */
  renderAll(): void {
    for (const batch of this.batches.values()) {
      batch.render();
    }
  }

  /**
   * Gets all batches
   */
  getAllBatches(): InstanceBatch[] {
    return Array.from(this.batches.values());
  }

  /**
   * Gets instancing statistics
   */
  getStatistics(): InstancingStatistics {
    let totalBatches = this.batches.size;
    let totalInstances = 0;
    let totalDrawCalls = 0;
    
    for (const batch of this.batches.values()) {
      const count = batch.getInstanceCount();
      totalInstances += count;
      if (count > 0) {
        totalDrawCalls++; // One draw call per non-empty batch
      }
    }
    
    return {
      totalBatches,
      totalInstances,
      totalDrawCalls,
      instancesPerBatch: totalBatches > 0 ? totalInstances / totalBatches : 0
    };
  }

  /**
   * Clears all batches
   */
  clearAll(): void {
    for (const batch of this.batches.values()) {
      batch.clear();
    }
  }

  /**
   * Disposes all batches
   */
  dispose(): void {
    for (const batch of this.batches.values()) {
      batch.dispose();
    }
    this.batches.clear();
    this.logger.info('Disposed all instance batches');
  }
}

/**
 * Instancing statistics
 */
export interface InstancingStatistics {
  /** Total number of batches */
  totalBatches: number;
  /** Total number of instances */
  totalInstances: number;
  /** Total draw calls */
  totalDrawCalls: number;
  /** Average instances per batch */
  instancesPerBatch: number;
}
