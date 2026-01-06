/**
 * @module utils
 * @fileoverview Profiler class - Performance monitoring and profiling
 */

/**
 * Performance measurement entry.
 */
export interface PerformanceEntry {
  name: string;
  startTime: number;
  endTime: number;
  duration: number;
  count: number;
}

/**
 * Performance statistics.
 */
export interface PerformanceStats {
  name: string;
  count: number;
  totalTime: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  lastTime: number;
}

/**
 * Frame timing information.
 */
export interface FrameInfo {
  frameNumber: number;
  deltaTime: number;
  fps: number;
  timestamp: number;
}

/**
 * Performance monitoring and profiling system.
 * Tracks timing of operations, frame rates, and memory usage.
 * 
 * @example
 * ```typescript
 * const profiler = new Profiler();
 * 
 * // Measure a function
 * profiler.start('physics-update');
 * updatePhysics();
 * profiler.end('physics-update');
 * 
 * // Get statistics
 * const stats = profiler.getStats('physics-update');
 * console.log(`Avg time: ${stats.avgTime}ms`);
 * 
 * // Frame tracking
 * profiler.beginFrame();
 * // ... render frame
 * profiler.endFrame();
 * console.log(`FPS: ${profiler.getFPS()}`);
 * ```
 */
export class Profiler {
  /** Active measurements */
  private active: Map<string, number>;
  
  /** Completed measurements */
  private measurements: Map<string, PerformanceEntry[]>;
  
  /** Maximum measurements to keep per name */
  private maxMeasurements: number;
  
  /** Frame information */
  private frames: FrameInfo[];
  
  /** Maximum frames to keep */
  private maxFrames: number;
  
  /** Current frame number */
  private frameNumber: number;
  
  /** Last frame timestamp */
  private lastFrameTime: number;
  
  /** Enable/disable profiling */
  private enabled: boolean;

  /**
   * Creates a new Profiler.
   * @param maxMeasurements - Maximum measurements to keep per name (default: 100)
   * @param maxFrames - Maximum frames to keep (default: 60)
   */
  constructor(maxMeasurements: number = 100, maxFrames: number = 60) {
    this.active = new Map();
    this.measurements = new Map();
    this.maxMeasurements = maxMeasurements;
    this.frames = [];
    this.maxFrames = maxFrames;
    this.frameNumber = 0;
    this.lastFrameTime = performance.now();
    this.enabled = true;
  }

  /**
   * Enables or disables profiling.
   * @param enabled - True to enable profiling
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Checks if profiling is enabled.
   * @returns True if enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Starts measuring an operation.
   * @param name - Measurement name
   */
  start(name: string): void {
    if (!this.enabled) return;

    if (this.active.has(name)) {
      console.warn(`Profiler: Measurement "${name}" already started`);
      return;
    }

    this.active.set(name, performance.now());
  }

  /**
   * Ends measuring an operation.
   * @param name - Measurement name
   */
  end(name: string): void {
    if (!this.enabled) return;

    const endTime = performance.now();
    const startTime = this.active.get(name);

    if (startTime === undefined) {
      console.warn(`Profiler: Measurement "${name}" not started`);
      return;
    }

    this.active.delete(name);

    const duration = endTime - startTime;
    this.recordMeasurement(name, startTime, endTime, duration);
  }

  /**
   * Records a measurement.
   * @param name - Measurement name
   * @param startTime - Start time
   * @param endTime - End time
   * @param duration - Duration
   */
  private recordMeasurement(
    name: string,
    startTime: number,
    endTime: number,
    duration: number
  ): void {
    if (!this.measurements.has(name)) {
      this.measurements.set(name, []);
    }

    const entries = this.measurements.get(name)!;
    entries.push({
      name,
      startTime,
      endTime,
      duration,
      count: 1
    });

    // Keep only recent measurements
    if (entries.length > this.maxMeasurements) {
      entries.shift();
    }
  }

  /**
   * Measures a synchronous function.
   * @param name - Measurement name
   * @param fn - Function to measure
   * @returns Function result
   */
  measure<T>(name: string, fn: () => T): T {
    this.start(name);
    try {
      return fn();
    } finally {
      this.end(name);
    }
  }

  /**
   * Measures an asynchronous function.
   * @param name - Measurement name
   * @param fn - Async function to measure
   * @returns Promise with function result
   */
  async measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    this.start(name);
    try {
      return await fn();
    } finally {
      this.end(name);
    }
  }

  /**
   * Begins a new frame.
   */
  beginFrame(): void {
    if (!this.enabled) return;
    // Frame tracking is handled in endFrame()
  }

  /**
   * Ends the current frame.
   */
  endFrame(): void {
    if (!this.enabled) return;

    const now = performance.now();
    const deltaTime = now - this.lastFrameTime;
    const fps = deltaTime > 0 ? 1000 / deltaTime : 0;

    this.frames.push({
      frameNumber: this.frameNumber++,
      deltaTime,
      fps,
      timestamp: now
    });

    // Keep only recent frames
    if (this.frames.length > this.maxFrames) {
      this.frames.shift();
    }

    this.lastFrameTime = now;
  }

  /**
   * Gets statistics for a measurement.
   * @param name - Measurement name
   * @returns Performance statistics or null
   */
  getStats(name: string): PerformanceStats | null {
    const entries = this.measurements.get(name);
    if (!entries || entries.length === 0) {
      return null;
    }

    const count = entries.length;
    const totalTime = entries.reduce((sum, e) => sum + e.duration, 0);
    const avgTime = totalTime / count;
    const minTime = Math.min(...entries.map(e => e.duration));
    const maxTime = Math.max(...entries.map(e => e.duration));
    const lastTime = entries[entries.length - 1].duration;

    return {
      name,
      count,
      totalTime,
      avgTime,
      minTime,
      maxTime,
      lastTime
    };
  }

  /**
   * Gets all measurement statistics.
   * @returns Map of measurement names to statistics
   */
  getAllStats(): Map<string, PerformanceStats> {
    const stats = new Map<string, PerformanceStats>();
    
    this.measurements.forEach((_, name) => {
      const stat = this.getStats(name);
      if (stat) {
        stats.set(name, stat);
      }
    });

    return stats;
  }

  /**
   * Gets current FPS (frames per second).
   * @returns Current FPS
   */
  getFPS(): number {
    if (this.frames.length === 0) return 0;
    return this.frames[this.frames.length - 1].fps;
  }

  /**
   * Gets average FPS over recent frames.
   * @param frameCount - Number of frames to average (default: all)
   * @returns Average FPS
   */
  getAverageFPS(frameCount?: number): number {
    if (this.frames.length === 0) return 0;

    const count = frameCount
      ? Math.min(frameCount, this.frames.length)
      : this.frames.length;
    
    const recentFrames = this.frames.slice(-count);
    const totalFPS = recentFrames.reduce((sum, f) => sum + f.fps, 0);
    
    return totalFPS / recentFrames.length;
  }

  /**
   * Gets frame time statistics.
   * @returns Frame timing statistics
   */
  getFrameStats(): {
    avgFPS: number;
    minFPS: number;
    maxFPS: number;
    avgDeltaTime: number;
    minDeltaTime: number;
    maxDeltaTime: number;
  } | null {
    if (this.frames.length === 0) {
      return null;
    }

    const fpsList = this.frames.map(f => f.fps);
    const deltaList = this.frames.map(f => f.deltaTime);

    return {
      avgFPS: fpsList.reduce((a, b) => a + b) / fpsList.length,
      minFPS: Math.min(...fpsList),
      maxFPS: Math.max(...fpsList),
      avgDeltaTime: deltaList.reduce((a, b) => a + b) / deltaList.length,
      minDeltaTime: Math.min(...deltaList),
      maxDeltaTime: Math.max(...deltaList)
    };
  }

  /**
   * Gets memory usage information (if available).
   * @returns Memory usage in MB or null
   */
  getMemoryUsage(): {
    used: number;
    total: number;
    limit: number;
  } | null {
    // @ts-ignore - performance.memory is not in all browsers
    if (performance.memory) {
      // @ts-ignore
      const mem = performance.memory;
      return {
        used: mem.usedJSHeapSize / (1024 * 1024),
        total: mem.totalJSHeapSize / (1024 * 1024),
        limit: mem.jsHeapSizeLimit / (1024 * 1024)
      };
    }
    return null;
  }

  /**
   * Clears all measurements.
   * @param name - Optional name to clear, or all if not specified
   */
  clear(name?: string): void {
    if (name) {
      this.measurements.delete(name);
    } else {
      this.measurements.clear();
    }
  }

  /**
   * Clears frame history.
   */
  clearFrames(): void {
    this.frames = [];
    this.frameNumber = 0;
  }

  /**
   * Clears everything.
   */
  clearAll(): void {
    this.clear();
    this.clearFrames();
    this.active.clear();
  }

  /**
   * Gets a summary report of all profiling data.
   * @returns Formatted report string
   */
  getReport(): string {
    const lines: string[] = [];
    lines.push('=== Performance Report ===\n');

    // Frame stats
    const frameStats = this.getFrameStats();
    if (frameStats) {
      lines.push('Frame Statistics:');
      lines.push(`  FPS: ${frameStats.avgFPS.toFixed(1)} (min: ${frameStats.minFPS.toFixed(1)}, max: ${frameStats.maxFPS.toFixed(1)})`);
      lines.push(`  Frame Time: ${frameStats.avgDeltaTime.toFixed(2)}ms (min: ${frameStats.minDeltaTime.toFixed(2)}ms, max: ${frameStats.maxDeltaTime.toFixed(2)}ms)\n`);
    }

    // Memory stats
    const memory = this.getMemoryUsage();
    if (memory) {
      lines.push('Memory Usage:');
      lines.push(`  Used: ${memory.used.toFixed(2)} MB`);
      lines.push(`  Total: ${memory.total.toFixed(2)} MB`);
      lines.push(`  Limit: ${memory.limit.toFixed(2)} MB\n`);
    }

    // Measurement stats
    const stats = this.getAllStats();
    if (stats.size > 0) {
      lines.push('Measurements:');
      stats.forEach((stat, name) => {
        lines.push(`  ${name}:`);
        lines.push(`    Count: ${stat.count}`);
        lines.push(`    Avg: ${stat.avgTime.toFixed(3)}ms`);
        lines.push(`    Min: ${stat.minTime.toFixed(3)}ms`);
        lines.push(`    Max: ${stat.maxTime.toFixed(3)}ms`);
        lines.push(`    Last: ${stat.lastTime.toFixed(3)}ms`);
      });
    }

    return lines.join('\n');
  }

  /**
   * Prints the report to console.
   */
  printReport(): void {
    console.log(this.getReport());
  }
}

/**
 * Global profiler instance.
 */
export const profiler = new Profiler();
