/**
 * @module utils
 * @fileoverview ObjectPool class - Object pooling for memory management and performance
 */

/**
 * Factory function type for creating new objects.
 * @template T - Object type
 */
export type ObjectFactory<T> = () => T;

/**
 * Reset function type for preparing objects for reuse.
 * @template T - Object type
 */
export type ObjectReset<T> = (obj: T) => void;

/**
 * Object pool configuration options.
 */
export interface ObjectPoolConfig<T> {
  /** Factory function to create new objects */
  factory: ObjectFactory<T>;
  /** Reset function to prepare objects for reuse */
  reset?: ObjectReset<T>;
  /** Initial pool size */
  initialSize?: number;
  /** Maximum pool size (0 = unlimited) */
  maxSize?: number;
  /** Auto-expand pool when empty */
  autoExpand?: boolean;
  /** Expansion size when auto-expanding */
  expandSize?: number;
}

/**
 * Object pool for memory management and performance optimization.
 * Reduces garbage collection pressure by reusing objects.
 * 
 * @example
 * ```typescript
 * // Create a pool for Vector3 objects
 * const vectorPool = new ObjectPool({
 *   factory: () => new Vector3(),
 *   reset: (v) => v.set(0, 0, 0),
 *   initialSize: 100
 * });
 * 
 * // Acquire an object from the pool
 * const v = vectorPool.acquire();
 * v.set(1, 2, 3);
 * 
 * // Release it back to the pool
 * vectorPool.release(v);
 * ```
 */
export class ObjectPool<T> {
  /** Factory function to create new objects */
  private factory: ObjectFactory<T>;
  
  /** Reset function to prepare objects for reuse */
  private reset?: ObjectReset<T>;
  
  /** Available objects */
  private available: T[];
  
  /** Objects currently in use */
  private inUse: Set<T>;
  
  /** Maximum pool size */
  private maxSize: number;
  
  /** Auto-expand when empty */
  private autoExpand: boolean;
  
  /** Expansion size */
  private expandSize: number;
  
  /** Total objects created */
  private totalCreated: number;
  
  /** Peak usage count */
  private peakUsage: number;

  /**
   * Creates a new ObjectPool.
   * @param config - Pool configuration
   */
  constructor(config: ObjectPoolConfig<T>) {
    this.factory = config.factory;
    this.reset = config.reset;
    this.available = [];
    this.inUse = new Set();
    this.maxSize = config.maxSize ?? 0;
    this.autoExpand = config.autoExpand ?? true;
    this.expandSize = config.expandSize ?? 10;
    this.totalCreated = 0;
    this.peakUsage = 0;

    // Pre-allocate initial objects
    const initialSize = config.initialSize ?? 0;
    for (let i = 0; i < initialSize; i++) {
      this.available.push(this.createObject());
    }
  }

  /**
   * Creates a new object using the factory.
   * @returns New object
   */
  private createObject(): T {
    this.totalCreated++;
    return this.factory();
  }

  /**
   * Acquires an object from the pool.
   * @returns Object from pool
   */
  acquire(): T {
    let obj: T;

    if (this.available.length > 0) {
      // Get from available pool
      obj = this.available.pop()!;
    } else if (this.autoExpand && (this.maxSize === 0 || this.totalCreated < this.maxSize)) {
      // Expand pool if empty
      const expandCount = Math.min(
        this.expandSize,
        this.maxSize > 0 ? this.maxSize - this.totalCreated : this.expandSize
      );
      for (let i = 0; i < expandCount; i++) {
        this.available.push(this.createObject());
      }
      obj = this.available.pop()!;
    } else {
      // Pool is exhausted
      throw new Error('ObjectPool exhausted and auto-expand is disabled or max size reached');
    }

    this.inUse.add(obj);
    
    // Track peak usage
    if (this.inUse.size > this.peakUsage) {
      this.peakUsage = this.inUse.size;
    }

    return obj;
  }

  /**
   * Releases an object back to the pool.
   * @param obj - Object to release
   */
  release(obj: T): void {
    if (!this.inUse.has(obj)) {
      console.warn('ObjectPool.release: Object not acquired from this pool');
      return;
    }

    // Reset the object if reset function provided
    if (this.reset) {
      this.reset(obj);
    }

    this.inUse.delete(obj);
    
    // Only add back if under max size
    if (this.maxSize === 0 || this.available.length < this.maxSize) {
      this.available.push(obj);
    }
  }

  /**
   * Releases multiple objects back to the pool.
   * @param objects - Objects to release
   */
  releaseAll(objects: T[]): void {
    objects.forEach(obj => this.release(obj));
  }

  /**
   * Pre-allocates additional objects.
   * @param count - Number of objects to allocate
   */
  preallocate(count: number): void {
    for (let i = 0; i < count; i++) {
      if (this.maxSize > 0 && this.totalCreated >= this.maxSize) {
        console.warn('ObjectPool.preallocate: Max size reached');
        break;
      }
      this.available.push(this.createObject());
    }
  }

  /**
   * Clears the pool, releasing all objects.
   */
  clear(): void {
    this.available = [];
    this.inUse.clear();
    this.totalCreated = 0;
    this.peakUsage = 0;
  }

  /**
   * Gets the number of available objects in the pool.
   * @returns Available count
   */
  getAvailableCount(): number {
    return this.available.length;
  }

  /**
   * Gets the number of objects currently in use.
   * @returns In-use count
   */
  getInUseCount(): number {
    return this.inUse.size;
  }

  /**
   * Gets the total number of objects created.
   * @returns Total created count
   */
  getTotalCreated(): number {
    return this.totalCreated;
  }

  /**
   * Gets the peak usage count.
   * @returns Peak usage
   */
  getPeakUsage(): number {
    return this.peakUsage;
  }

  /**
   * Gets pool statistics.
   * @returns Pool statistics object
   */
  getStats(): {
    available: number;
    inUse: number;
    total: number;
    peakUsage: number;
    utilization: number;
  } {
    const total = this.totalCreated;
    const inUse = this.inUse.size;
    const utilization = total > 0 ? (inUse / total) * 100 : 0;

    return {
      available: this.available.length,
      inUse,
      total,
      peakUsage: this.peakUsage,
      utilization
    };
  }

  /**
   * Resets peak usage counter.
   */
  resetPeakUsage(): void {
    this.peakUsage = this.inUse.size;
  }

  /**
   * Creates a scoped acquisition that automatically releases on completion.
   * @param callback - Function to execute with acquired object
   * @returns Result of callback
   */
  withObject<R>(callback: (obj: T) => R): R {
    const obj = this.acquire();
    try {
      return callback(obj);
    } finally {
      this.release(obj);
    }
  }

  /**
   * Creates a scoped acquisition for async operations.
   * @param callback - Async function to execute with acquired object
   * @returns Promise with result of callback
   */
  async withObjectAsync<R>(callback: (obj: T) => Promise<R>): Promise<R> {
    const obj = this.acquire();
    try {
      return await callback(obj);
    } finally {
      this.release(obj);
    }
  }
}

/**
 * Global pool manager for managing multiple object pools.
 */
export class PoolManager {
  private pools: Map<string, ObjectPool<any>>;

  constructor() {
    this.pools = new Map();
  }

  /**
   * Registers a named pool.
   * @param name - Pool name
   * @param pool - Object pool
   */
  register<T>(name: string, pool: ObjectPool<T>): void {
    if (this.pools.has(name)) {
      console.warn(`PoolManager: Pool "${name}" already registered`);
    }
    this.pools.set(name, pool);
  }

  /**
   * Gets a registered pool by name.
   * @param name - Pool name
   * @returns Object pool or undefined
   */
  get<T>(name: string): ObjectPool<T> | undefined {
    return this.pools.get(name);
  }

  /**
   * Unregisters a pool.
   * @param name - Pool name
   */
  unregister(name: string): void {
    this.pools.delete(name);
  }

  /**
   * Gets statistics for all pools.
   * @returns Map of pool names to statistics
   */
  getAllStats(): Map<string, any> {
    const stats = new Map();
    this.pools.forEach((pool, name) => {
      stats.set(name, pool.getStats());
    });
    return stats;
  }

  /**
   * Clears all registered pools.
   */
  clearAll(): void {
    this.pools.forEach(pool => pool.clear());
  }

  /**
   * Resets peak usage for all pools.
   */
  resetAllPeakUsage(): void {
    this.pools.forEach(pool => pool.resetPeakUsage());
  }
}

/**
 * Global pool manager instance.
 */
export const poolManager = new PoolManager();
