/**
 * Stability tests for Debug, Profiling, and Optimization systems
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Debug imports
import { LiveDebugger } from '../src/debug/LiveDebugger';
import { DebugDraw } from '../src/debug/DebugDraw';
import { DebugConsole } from '../src/debug/DebugConsole';

// Profiling imports
import { PerformanceProfiler } from '../src/profiling/PerformanceProfiler';

// Optimization imports
import {
  Plane,
  BoundingBox,
  BoundingSphere,
  Frustum,
  FrustumCullingSystem
} from '../src/optimization/FrustumCulling';
import { LODSystem, LODGroup } from '../src/optimization/LODSystem';

// Utils imports
import { Profiler } from '../src/utils/Profiler';
import { ObjectPool, PoolManager } from '../src/utils/ObjectPool';

// Math imports
import { Vector3 } from '../src/math/Vector3';
import { Matrix4 } from '../src/math/Matrix4';

// ============================================================================
// 1. LiveDebugger
// ============================================================================
describe('LiveDebugger', () => {
  it('should create a singleton instance without crashing', () => {
    const debugger1 = LiveDebugger.getInstance({ enabled: false });
    expect(debugger1).toBeDefined();
    expect(debugger1).toBeInstanceOf(LiveDebugger);
  });

  it('should return the same instance on repeated calls', () => {
    const d1 = LiveDebugger.getInstance({ enabled: false });
    const d2 = LiveDebugger.getInstance();
    expect(d1).toBe(d2);
  });

  it('should capture and retrieve issues', () => {
    const debugger1 = LiveDebugger.getInstance({ enabled: false });
    debugger1.captureIssue({
      severity: 'error',
      category: 'runtime',
      title: 'Test Error',
      message: 'Something went wrong'
    });

    const issues = debugger1.getIssues();
    expect(issues.length).toBeGreaterThanOrEqual(1);
    const found = issues.find(i => i.title === 'Test Error');
    expect(found).toBeDefined();
    expect(found!.severity).toBe('error');
    expect(found!.message).toBe('Something went wrong');
    expect(found!.count).toBeGreaterThanOrEqual(1);
  });

  it('should return config without crashing', () => {
    const debugger1 = LiveDebugger.getInstance({ enabled: false });
    const config = debugger1.getConfig();
    expect(config).toBeDefined();
    expect(typeof config.enabled).toBe('boolean');
    expect(typeof config.fpsWarningThreshold).toBe('number');
  });

  it('should count errors and warnings', () => {
    const debugger1 = LiveDebugger.getInstance({ enabled: false });
    const errorCount = debugger1.getErrorCount();
    const warningCount = debugger1.getWarningCount();
    expect(typeof errorCount).toBe('number');
    expect(typeof warningCount).toBe('number');
  });

  it('should register and fire issue listener', () => {
    const debugger1 = LiveDebugger.getInstance({ enabled: false });
    const captured: any[] = [];
    const unsub = debugger1.onIssue((issue) => {
      captured.push(issue);
    });

    debugger1.captureIssue({
      severity: 'warning',
      category: 'performance',
      title: 'Listener Test',
      message: 'Testing listener'
    });

    expect(captured.length).toBeGreaterThanOrEqual(1);

    // Cleanup
    unsub();
  });
});

// ============================================================================
// 2. DebugDraw
// ============================================================================
describe('DebugDraw', () => {
  let draw: DebugDraw;

  beforeEach(() => {
    draw = new DebugDraw();
  });

  it('should create with default config', () => {
    expect(draw).toBeDefined();
    expect(draw.isEnabled()).toBe(true);
    const config = draw.getConfig();
    expect(config.lineWidth).toBe(1);
    expect(config.opacity).toBe(0.8);
  });

  it('should draw a line and retrieve it', () => {
    const start = new Vector3(0, 0, 0);
    const end = new Vector3(1, 1, 1);
    const id = draw.line(start, end, '#ff0000');

    expect(id).toBeDefined();
    expect(typeof id).toBe('string');

    const elements = draw.getElements();
    expect(elements.lines.length).toBe(1);
    expect(elements.lines[0].color).toBe('#ff0000');
  });

  it('should draw a sphere and retrieve it', () => {
    const center = new Vector3(5, 5, 5);
    const id = draw.sphere(center, 2.0, '#00ff00');

    expect(id).toBeDefined();
    const elements = draw.getElements();
    expect(elements.spheres.length).toBe(1);
    expect(elements.spheres[0].radius).toBe(2.0);
    expect(elements.spheres[0].color).toBe('#00ff00');
  });

  it('should draw a box and retrieve it', () => {
    const min = new Vector3(-1, -1, -1);
    const max = new Vector3(1, 1, 1);
    const id = draw.box(min, max, '#0000ff');

    expect(id).toBeDefined();
    const elements = draw.getElements();
    expect(elements.boxes.length).toBe(1);
  });

  it('should draw a point and text without crashing', () => {
    const pos = new Vector3(0, 0, 0);
    const pointId = draw.point(pos, '#ffffff', 3);
    const textId = draw.text(pos, 'Hello World', '#ffffff');

    expect(pointId).toBeDefined();
    expect(textId).toBeDefined();

    const elements = draw.getElements();
    expect(elements.points.length).toBe(1);
    expect(elements.texts.length).toBe(1);
  });

  it('should remove elements by id', () => {
    const id = draw.line(new Vector3(), new Vector3(1, 0, 0));
    expect(draw.getElements().lines.length).toBe(1);

    draw.remove(id);
    expect(draw.getElements().lines.length).toBe(0);
  });

  it('should clear all elements', () => {
    draw.line(new Vector3(), new Vector3(1, 0, 0));
    draw.sphere(new Vector3(), 1);
    draw.box(new Vector3(-1, -1, -1), new Vector3(1, 1, 1));
    draw.point(new Vector3(), '#fff');
    draw.text(new Vector3(), 'test');

    draw.clear();
    const elements = draw.getElements();
    expect(elements.lines.length).toBe(0);
    expect(elements.spheres.length).toBe(0);
    expect(elements.boxes.length).toBe(0);
    expect(elements.points.length).toBe(0);
    expect(elements.texts.length).toBe(0);
  });

  it('should enable and disable', () => {
    draw.setEnabled(false);
    expect(draw.isEnabled()).toBe(false);
    draw.setEnabled(true);
    expect(draw.isEnabled()).toBe(true);
  });

  it('should draw an arrow (compound shape) without crashing', () => {
    const ids = draw.arrow(new Vector3(0, 0, 0), new Vector3(5, 0, 0), '#ff0000');
    expect(ids.length).toBeGreaterThan(0);
  });

  it('should draw axes without crashing', () => {
    const ids = draw.axes(new Vector3(0, 0, 0), 2);
    expect(ids.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// 3. Profiler (utils)
// ============================================================================
describe('Profiler', () => {
  let profiler: Profiler;

  beforeEach(() => {
    profiler = new Profiler();
  });

  it('should start and end measurement', () => {
    profiler.start('test-section');
    // Simulate work
    let sum = 0;
    for (let i = 0; i < 10000; i++) sum += i;
    profiler.end('test-section');

    const stats = profiler.getStats('test-section');
    expect(stats).not.toBeNull();
    expect(stats!.name).toBe('test-section');
    expect(stats!.count).toBe(1);
    expect(stats!.totalTime).toBeGreaterThanOrEqual(0);
    expect(stats!.avgTime).toBeGreaterThanOrEqual(0);
    expect(stats!.minTime).toBeGreaterThanOrEqual(0);
    expect(stats!.maxTime).toBeGreaterThanOrEqual(0);
  });

  it('should accumulate multiple measurements', () => {
    for (let i = 0; i < 5; i++) {
      profiler.start('multi');
      profiler.end('multi');
    }

    const stats = profiler.getStats('multi');
    expect(stats).not.toBeNull();
    expect(stats!.count).toBe(5);
    expect(stats!.totalTime).toBeGreaterThanOrEqual(0);
  });

  it('should return null for unknown measurement', () => {
    expect(profiler.getStats('nonexistent')).toBeNull();
  });

  it('should measure synchronous function', () => {
    const result = profiler.measure('fn-test', () => {
      let sum = 0;
      for (let i = 0; i < 100; i++) sum += i;
      return sum;
    });

    expect(result).toBe(4950);
    const stats = profiler.getStats('fn-test');
    expect(stats).not.toBeNull();
    expect(stats!.count).toBe(1);
  });

  it('should measure async function', async () => {
    const result = await profiler.measureAsync('async-test', async () => {
      return 42;
    });

    expect(result).toBe(42);
    const stats = profiler.getStats('async-test');
    expect(stats).not.toBeNull();
  });

  it('should track frame timing and compute FPS', () => {
    // Simulate some frames
    profiler.beginFrame();
    profiler.endFrame();

    profiler.beginFrame();
    profiler.endFrame();

    const fps = profiler.getFPS();
    expect(typeof fps).toBe('number');
    expect(fps).toBeGreaterThanOrEqual(0);

    const avgFps = profiler.getAverageFPS();
    expect(typeof avgFps).toBe('number');
  });

  it('should return frame stats after recording frames', () => {
    profiler.beginFrame();
    profiler.endFrame();

    const frameStats = profiler.getFrameStats();
    expect(frameStats).not.toBeNull();
    expect(frameStats!.avgFPS).toBeGreaterThanOrEqual(0);
    expect(frameStats!.avgDeltaTime).toBeGreaterThanOrEqual(0);
  });

  it('should return null frame stats when no frames recorded', () => {
    expect(profiler.getFrameStats()).toBeNull();
  });

  it('should get all stats as a map', () => {
    profiler.start('a');
    profiler.end('a');
    profiler.start('b');
    profiler.end('b');

    const allStats = profiler.getAllStats();
    expect(allStats.size).toBe(2);
    expect(allStats.has('a')).toBe(true);
    expect(allStats.has('b')).toBe(true);
  });

  it('should generate a report string', () => {
    profiler.start('report-section');
    profiler.end('report-section');
    profiler.beginFrame();
    profiler.endFrame();

    const report = profiler.getReport();
    expect(typeof report).toBe('string');
    expect(report).toContain('Performance Report');
    expect(report).toContain('report-section');
  });

  it('should clear measurements', () => {
    profiler.start('to-clear');
    profiler.end('to-clear');
    expect(profiler.getStats('to-clear')).not.toBeNull();

    profiler.clear('to-clear');
    expect(profiler.getStats('to-clear')).toBeNull();
  });

  it('should enable and disable profiling', () => {
    profiler.setEnabled(false);
    expect(profiler.isEnabled()).toBe(false);

    profiler.start('disabled');
    profiler.end('disabled');
    expect(profiler.getStats('disabled')).toBeNull();

    profiler.setEnabled(true);
    expect(profiler.isEnabled()).toBe(true);
  });
});

// ============================================================================
// 4 & 5. ObjectPool
// ============================================================================
describe('ObjectPool', () => {
  it('should create a pool with initial size', () => {
    const pool = new ObjectPool({
      factory: () => ({ x: 0, y: 0 }),
      initialSize: 5
    });

    expect(pool.getAvailableCount()).toBe(5);
    expect(pool.getInUseCount()).toBe(0);
    expect(pool.getTotalCreated()).toBe(5);
  });

  it('should acquire and release objects', () => {
    const pool = new ObjectPool({
      factory: () => ({ value: 0 }),
      initialSize: 3
    });

    const obj1 = pool.acquire();
    expect(obj1).toBeDefined();
    expect(pool.getInUseCount()).toBe(1);
    expect(pool.getAvailableCount()).toBe(2);

    pool.release(obj1);
    expect(pool.getInUseCount()).toBe(0);
    expect(pool.getAvailableCount()).toBe(3);
  });

  it('should reuse released objects', () => {
    const pool = new ObjectPool({
      factory: () => ({ id: Math.random() }),
      initialSize: 1
    });

    const obj1 = pool.acquire();
    const id1 = obj1.id;
    pool.release(obj1);

    const obj2 = pool.acquire();
    // Should be the same object reference
    expect(obj2).toBe(obj1);
    expect(obj2.id).toBe(id1);
  });

  it('should call reset function on release', () => {
    const pool = new ObjectPool({
      factory: () => ({ value: 0 }),
      reset: (obj) => { obj.value = 0; },
      initialSize: 2
    });

    const obj = pool.acquire();
    obj.value = 42;
    pool.release(obj);

    const reused = pool.acquire();
    expect(reused.value).toBe(0);
  });

  it('should auto-grow when pool is empty (exceed initial capacity)', () => {
    const pool = new ObjectPool({
      factory: () => ({ value: 0 }),
      initialSize: 2,
      autoExpand: true,
      expandSize: 5
    });

    expect(pool.getTotalCreated()).toBe(2);

    // Acquire all initial objects
    pool.acquire();
    pool.acquire();
    expect(pool.getAvailableCount()).toBe(0);

    // Acquire one more - should auto-grow
    const obj3 = pool.acquire();
    expect(obj3).toBeDefined();
    expect(pool.getTotalCreated()).toBeGreaterThan(2);
    expect(pool.getInUseCount()).toBe(3);
  });

  it('should throw when pool is exhausted with autoExpand disabled', () => {
    const pool = new ObjectPool({
      factory: () => ({ value: 0 }),
      initialSize: 1,
      autoExpand: false
    });

    pool.acquire();

    expect(() => pool.acquire()).toThrow('ObjectPool exhausted');
  });

  it('should throw when max size is reached', () => {
    const pool = new ObjectPool({
      factory: () => ({ value: 0 }),
      initialSize: 1,
      autoExpand: true,
      maxSize: 2,
      expandSize: 1
    });

    pool.acquire();
    pool.acquire(); // auto-expand to max

    expect(() => pool.acquire()).toThrow();
  });

  it('should track peak usage', () => {
    const pool = new ObjectPool({
      factory: () => ({ value: 0 }),
      initialSize: 5
    });

    const objs = [pool.acquire(), pool.acquire(), pool.acquire()];
    expect(pool.getPeakUsage()).toBe(3);

    objs.forEach(o => pool.release(o));
    expect(pool.getPeakUsage()).toBe(3); // Peak should remain
  });

  it('should provide accurate stats', () => {
    const pool = new ObjectPool({
      factory: () => ({ value: 0 }),
      initialSize: 10
    });

    pool.acquire();
    pool.acquire();

    const stats = pool.getStats();
    expect(stats.available).toBe(8);
    expect(stats.inUse).toBe(2);
    expect(stats.total).toBe(10);
    expect(stats.peakUsage).toBe(2);
    expect(stats.utilization).toBeCloseTo(20, 0);
  });

  it('should support withObject for scoped usage', () => {
    const pool = new ObjectPool({
      factory: () => ({ value: 0 }),
      reset: (obj) => { obj.value = 0; },
      initialSize: 1
    });

    const result = pool.withObject((obj) => {
      obj.value = 99;
      return obj.value;
    });

    expect(result).toBe(99);
    expect(pool.getInUseCount()).toBe(0);
    expect(pool.getAvailableCount()).toBe(1);
  });

  it('should clear the pool', () => {
    const pool = new ObjectPool({
      factory: () => ({ value: 0 }),
      initialSize: 5
    });

    pool.acquire();
    pool.clear();

    expect(pool.getAvailableCount()).toBe(0);
    expect(pool.getInUseCount()).toBe(0);
    expect(pool.getTotalCreated()).toBe(0);
  });
});

describe('PoolManager', () => {
  it('should register and retrieve pools', () => {
    const manager = new PoolManager();
    const pool = new ObjectPool({
      factory: () => ({ value: 0 }),
      initialSize: 5
    });

    manager.register('test-pool', pool);
    expect(manager.get('test-pool')).toBe(pool);
  });

  it('should get stats for all registered pools', () => {
    const manager = new PoolManager();
    const pool1 = new ObjectPool({ factory: () => ({}), initialSize: 3 });
    const pool2 = new ObjectPool({ factory: () => ({}), initialSize: 7 });

    manager.register('pool1', pool1);
    manager.register('pool2', pool2);

    const allStats = manager.getAllStats();
    expect(allStats.size).toBe(2);
    expect(allStats.get('pool1')!.total).toBe(3);
    expect(allStats.get('pool2')!.total).toBe(7);
  });
});

// ============================================================================
// 6. LOD System
// ============================================================================
describe('LODSystem', () => {
  // Create mock meshes since Mesh requires WebGL context
  const createMockMesh = (name: string) => ({ name } as any);

  it('should create an LOD system with default config', () => {
    const lod = new LODSystem();
    expect(lod).toBeDefined();
    expect(lod.getBias()).toBe(1.0);
    expect(lod.getFadeDuration()).toBe(0.0);
  });

  it('should create LOD groups with levels', () => {
    const lod = new LODSystem();
    const group = lod.createLODGroup('tree', new Vector3(0, 0, 0), [
      { distance: 10, mesh: createMockMesh('high') },
      { distance: 50, mesh: createMockMesh('medium') },
      { distance: 100, mesh: createMockMesh('low') }
    ]);

    expect(group).toBeInstanceOf(LODGroup);
    expect(group.getId()).toBe('tree');
    expect(group.getLevels().length).toBe(3);
    expect(lod.getAllGroups().length).toBe(1);
  });

  it('should switch LOD levels based on distance', () => {
    const lod = new LODSystem({ hysteresis: 0 }); // disable hysteresis for predictable test
    const highMesh = createMockMesh('high');
    const medMesh = createMockMesh('medium');
    const lowMesh = createMockMesh('low');

    const group = lod.createLODGroup('obj', new Vector3(0, 0, 0), [
      { distance: 10, mesh: highMesh },
      { distance: 50, mesh: medMesh },
      { distance: 100, mesh: lowMesh }
    ]);

    // Camera very close - should be level 0 (high detail)
    group.update(new Vector3(0, 0, 5), 1.0);
    expect(group.getCurrentLevel()).toBe(0);
    expect(group.getCurrentMesh()).toBe(highMesh);

    // Camera at medium distance - should be level 1
    group.update(new Vector3(0, 0, 30), 1.0);
    expect(group.getCurrentLevel()).toBe(1);
    expect(group.getCurrentMesh()).toBe(medMesh);

    // Camera far away - should be level 2 (low detail)
    group.update(new Vector3(0, 0, 200), 1.0);
    expect(group.getCurrentLevel()).toBe(2);
    expect(group.getCurrentMesh()).toBe(lowMesh);
  });

  it('should remove LOD groups', () => {
    const lod = new LODSystem();
    lod.createLODGroup('a', new Vector3(), [
      { distance: 10, mesh: createMockMesh('m') }
    ]);
    expect(lod.getAllGroups().length).toBe(1);

    lod.removeLODGroup('a');
    expect(lod.getAllGroups().length).toBe(0);
  });

  it('should provide statistics', () => {
    const lod = new LODSystem({ hysteresis: 0 });
    lod.createLODGroup('g1', new Vector3(0, 0, 0), [
      { distance: 10, mesh: createMockMesh('h') },
      { distance: 50, mesh: createMockMesh('l') }
    ]);
    lod.createLODGroup('g2', new Vector3(100, 0, 0), [
      { distance: 10, mesh: createMockMesh('h') },
      { distance: 50, mesh: createMockMesh('l') }
    ]);

    const stats = lod.getStatistics();
    expect(stats.totalGroups).toBe(2);
    expect(stats.levelCounts).toBeDefined();
  });

  it('should set and get LOD bias', () => {
    const lod = new LODSystem();
    lod.setBias(2.0);
    expect(lod.getBias()).toBe(2.0);

    // Bias has a minimum of 0.1
    lod.setBias(0.05);
    expect(lod.getBias()).toBe(0.1);
  });

  it('should clear all groups', () => {
    const lod = new LODSystem();
    lod.createLODGroup('a', new Vector3(), [{ distance: 10, mesh: createMockMesh('m') }]);
    lod.createLODGroup('b', new Vector3(), [{ distance: 10, mesh: createMockMesh('m') }]);
    expect(lod.getAllGroups().length).toBe(2);

    lod.clear();
    expect(lod.getAllGroups().length).toBe(0);
  });
});

// ============================================================================
// 7. FrustumCulling
// ============================================================================
describe('FrustumCulling', () => {
  describe('Plane', () => {
    it('should compute signed distance to point', () => {
      const plane = new Plane(new Vector3(0, 1, 0), 0); // y=0 plane pointing up
      expect(plane.distanceToPoint(new Vector3(0, 5, 0))).toBe(5);
      expect(plane.distanceToPoint(new Vector3(0, -3, 0))).toBe(-3);
      expect(plane.distanceToPoint(new Vector3(0, 0, 0))).toBe(0);
    });

    it('should normalize the plane', () => {
      const plane = new Plane(new Vector3(0, 2, 0), 4);
      plane.normalize();
      expect(plane.normal.y).toBeCloseTo(1, 5);
      expect(plane.distance).toBeCloseTo(2, 5);
    });
  });

  describe('BoundingBox', () => {
    it('should create with min/max', () => {
      const box = new BoundingBox(new Vector3(-1, -1, -1), new Vector3(1, 1, 1));
      expect(box.min.x).toBe(-1);
      expect(box.max.x).toBe(1);
    });

    it('should compute center and size', () => {
      const box = new BoundingBox(new Vector3(0, 0, 0), new Vector3(4, 6, 8));
      const center = box.getCenter();
      const size = box.getSize();

      expect(center.x).toBe(2);
      expect(center.y).toBe(3);
      expect(center.z).toBe(4);
      expect(size.x).toBe(4);
      expect(size.y).toBe(6);
      expect(size.z).toBe(8);
    });

    it('should expand by point', () => {
      const box = new BoundingBox(new Vector3(0, 0, 0), new Vector3(1, 1, 1));
      box.expandByPoint(new Vector3(5, 5, 5));
      expect(box.max.x).toBe(5);
      expect(box.max.y).toBe(5);
    });

    it('should detect empty box', () => {
      const box = new BoundingBox(); // default is empty (Infinity, -Infinity)
      expect(box.isEmpty()).toBe(true);

      const box2 = new BoundingBox(new Vector3(0, 0, 0), new Vector3(1, 1, 1));
      expect(box2.isEmpty()).toBe(false);
    });
  });

  describe('BoundingSphere', () => {
    it('should create from center and radius', () => {
      const sphere = new BoundingSphere(new Vector3(1, 2, 3), 5);
      expect(sphere.center.x).toBe(1);
      expect(sphere.radius).toBe(5);
    });

    it('should create from bounding box', () => {
      const box = new BoundingBox(new Vector3(0, 0, 0), new Vector3(2, 2, 2));
      const sphere = new BoundingSphere();
      sphere.setFromBox(box);

      expect(sphere.center.x).toBeCloseTo(1, 5);
      expect(sphere.center.y).toBeCloseTo(1, 5);
      expect(sphere.radius).toBeGreaterThan(0);
    });
  });

  describe('Frustum', () => {
    it('should have 6 planes', () => {
      const frustum = new Frustum();
      expect(frustum.planes.length).toBe(6);
    });

    it('should set from projection matrix and test containment', () => {
      const frustum = new Frustum();
      // Use an identity-like projection matrix for simple containment testing
      // A standard perspective projection matrix
      const projView = Matrix4.identity();
      frustum.setFromProjectionMatrix(projView);

      // Origin should be inside a frustum set from identity
      expect(frustum.containsPoint(new Vector3(0, 0, 0))).toBe(true);
    });

    it('should test sphere intersection', () => {
      const frustum = new Frustum();
      frustum.setFromProjectionMatrix(Matrix4.identity());

      const sphereInside = new BoundingSphere(new Vector3(0, 0, 0), 0.5);
      expect(frustum.intersectsSphere(sphereInside)).toBe(true);
    });

    it('should test box intersection', () => {
      const frustum = new Frustum();
      frustum.setFromProjectionMatrix(Matrix4.identity());

      const boxInside = new BoundingBox(new Vector3(-0.5, -0.5, -0.5), new Vector3(0.5, 0.5, 0.5));
      expect(frustum.intersectsBox(boxInside)).toBe(true);
    });
  });

  describe('FrustumCullingSystem', () => {
    it('should initialize with zero stats', () => {
      const system = new FrustumCullingSystem();
      const stats = system.getStatistics();
      expect(stats.culled).toBe(0);
      expect(stats.total).toBe(0);
      expect(stats.ratio).toBe(0);
    });

    it('should test sphere visibility against frustum', () => {
      const system = new FrustumCullingSystem();
      // Set up a frustum from identity matrix
      system.getFrustum().setFromProjectionMatrix(Matrix4.identity());

      const sphereInside = new BoundingSphere(new Vector3(0, 0, 0), 0.5);
      expect(system.isSphereVisible(sphereInside)).toBe(true);

      // A sphere far outside
      const sphereOutside = new BoundingSphere(new Vector3(100, 100, 100), 0.1);
      expect(system.isSphereVisible(sphereOutside)).toBe(false);

      const stats = system.getStatistics();
      expect(stats.total).toBe(2);
      expect(stats.culled).toBe(1);
    });

    it('should test box visibility against frustum', () => {
      const system = new FrustumCullingSystem();
      system.getFrustum().setFromProjectionMatrix(Matrix4.identity());

      const boxInside = new BoundingBox(new Vector3(-0.3, -0.3, -0.3), new Vector3(0.3, 0.3, 0.3));
      expect(system.isBoxVisible(boxInside)).toBe(true);

      const boxOutside = new BoundingBox(new Vector3(50, 50, 50), new Vector3(51, 51, 51));
      expect(system.isBoxVisible(boxOutside)).toBe(false);
    });

    it('should test point visibility', () => {
      const system = new FrustumCullingSystem();
      system.getFrustum().setFromProjectionMatrix(Matrix4.identity());

      expect(system.isPointVisible(new Vector3(0, 0, 0))).toBe(true);
      expect(system.isPointVisible(new Vector3(1000, 1000, 1000))).toBe(false);
    });

    it('should reset statistics', () => {
      const system = new FrustumCullingSystem();
      system.getFrustum().setFromProjectionMatrix(Matrix4.identity());
      system.isSphereVisible(new BoundingSphere(new Vector3(), 1));

      system.resetStatistics();
      const stats = system.getStatistics();
      expect(stats.total).toBe(0);
      expect(stats.culled).toBe(0);
    });
  });
});

// ============================================================================
// 8. InstancingSystem (InstanceBatch without WebGL)
// ============================================================================
describe('InstancingSystem', () => {
  // We cannot create a real WebGL2RenderingContext in happy-dom,
  // so we test the InstanceBatch with a mock GL context.
  it('should create InstanceBatch with mock GL context', async () => {
    const { InstanceBatch } = await import('../src/optimization/InstancingSystem');

    const mockGL = {
      createBuffer: vi.fn(() => ({})),
      bindBuffer: vi.fn(),
      bufferData: vi.fn(),
      bufferSubData: vi.fn(),
      enableVertexAttribArray: vi.fn(),
      vertexAttribPointer: vi.fn(),
      vertexAttribDivisor: vi.fn(),
      drawArraysInstanced: vi.fn(),
      drawElementsInstanced: vi.fn(),
      ARRAY_BUFFER: 0x8892,
      DYNAMIC_DRAW: 0x88E8,
      FLOAT: 0x1406,
    } as any;

    const mockMesh = {} as any;
    const mockMaterial = {} as any;

    const batch = new InstanceBatch(mockGL, mockMesh, mockMaterial, {
      maxInstances: 100,
      dynamicGrowth: true
    });

    expect(batch).toBeDefined();
    expect(batch.getInstanceCount()).toBe(0);
    expect(batch.getMaxInstances()).toBe(100);
  });

  it('should add instances to a batch', async () => {
    const { InstanceBatch } = await import('../src/optimization/InstancingSystem');

    const mockGL = {
      createBuffer: vi.fn(() => ({})),
      bindBuffer: vi.fn(),
      bufferData: vi.fn(),
      bufferSubData: vi.fn(),
      ARRAY_BUFFER: 0x8892,
      DYNAMIC_DRAW: 0x88E8,
    } as any;

    const batch = new InstanceBatch(mockGL, {} as any, {} as any, {
      maxInstances: 1000,
      dynamicGrowth: true
    });

    const transform = Matrix4.identity();
    const index = batch.addInstance({ transform });
    expect(index).toBe(0);
    expect(batch.getInstanceCount()).toBe(1);

    const index2 = batch.addInstance({ transform });
    expect(index2).toBe(1);
    expect(batch.getInstanceCount()).toBe(2);
  });

  it('should add multiple instances in bulk', async () => {
    const { InstanceBatch } = await import('../src/optimization/InstancingSystem');

    const mockGL = {
      createBuffer: vi.fn(() => ({})),
      bindBuffer: vi.fn(),
      bufferData: vi.fn(),
      bufferSubData: vi.fn(),
      ARRAY_BUFFER: 0x8892,
      DYNAMIC_DRAW: 0x88E8,
    } as any;

    const batch = new InstanceBatch(mockGL, {} as any, {} as any, {
      maxInstances: 1000,
      dynamicGrowth: true
    });

    const instances = Array.from({ length: 50 }, () => ({
      transform: Matrix4.identity()
    }));

    const startIndex = batch.addInstances(instances);
    expect(startIndex).toBe(0);
    expect(batch.getInstanceCount()).toBe(50);
  });

  it('should throw when exceeding max instances', async () => {
    const { InstanceBatch } = await import('../src/optimization/InstancingSystem');

    const mockGL = {
      createBuffer: vi.fn(() => ({})),
      bindBuffer: vi.fn(),
      bufferData: vi.fn(),
      bufferSubData: vi.fn(),
      ARRAY_BUFFER: 0x8892,
      DYNAMIC_DRAW: 0x88E8,
    } as any;

    const batch = new InstanceBatch(mockGL, {} as any, {} as any, {
      maxInstances: 5,
      dynamicGrowth: true
    });

    for (let i = 0; i < 5; i++) {
      batch.addInstance({ transform: Matrix4.identity() });
    }

    expect(() => batch.addInstance({ transform: Matrix4.identity() })).toThrow('Instance batch full');
  });
});

// ============================================================================
// 9. Debug Console
// ============================================================================
describe('DebugConsole', () => {
  let debugConsole: DebugConsole;

  beforeEach(() => {
    debugConsole = new DebugConsole();
  });

  it('should create with built-in commands', () => {
    const commands = debugConsole.getCommands();
    expect(commands.length).toBeGreaterThan(0);
    const names = commands.map(c => c.name);
    expect(names).toContain('help');
    expect(names).toContain('clear');
    expect(names).toContain('exit');
    expect(names).toContain('echo');
  });

  it('should execute echo command', async () => {
    const result = await debugConsole.execute('echo hello world');
    expect(result.success).toBe(true);
    expect(result.output).toBe('hello world');
  });

  it('should track command history', async () => {
    await debugConsole.execute('echo first');
    await debugConsole.execute('echo second');

    const history = debugConsole.getHistory();
    expect(history.length).toBe(2);
    expect(history[0]).toBe('echo first');
    expect(history[1]).toBe('echo second');
  });

  it('should register custom commands', async () => {
    debugConsole.registerCommand({
      name: 'greet',
      description: 'Greet someone',
      execute: (args) => ({
        success: true,
        output: `Hello, ${args[0] || 'World'}!`
      })
    });

    const result = await debugConsole.execute('greet Alice');
    expect(result.success).toBe(true);
    expect(result.output).toBe('Hello, Alice!');
  });

  it('should unregister commands', () => {
    debugConsole.registerCommand({
      name: 'temp',
      description: 'Temporary',
      execute: () => ({ success: true })
    });

    const hasBefore = debugConsole.getCommands().some(c => c.name === 'temp');
    expect(hasBefore).toBe(true);

    debugConsole.unregisterCommand('temp');
    const hasAfter = debugConsole.getCommands().some(c => c.name === 'temp');
    expect(hasAfter).toBe(false);
  });

  it('should set and get variables', () => {
    debugConsole.setVariable('x', 42);
    debugConsole.setVariable('name', 'WebForge');

    const vars = debugConsole.getVariables();
    expect(vars.get('x')).toBe(42);
    expect(vars.get('name')).toBe('WebForge');
  });

  it('should provide autocomplete suggestions', () => {
    const suggestions = debugConsole.getSuggestions('he');
    expect(suggestions).toContain('help');
  });

  it('should toggle visibility state', () => {
    expect(debugConsole.isVisible()).toBe(false);
    // Note: show() creates DOM, but in happy-dom this should work
    debugConsole.toggle();
    expect(debugConsole.isVisible()).toBe(true);
    debugConsole.toggle();
    expect(debugConsole.isVisible()).toBe(false);
  });

  it('should handle empty input gracefully', async () => {
    const result = await debugConsole.execute('');
    expect(result.success).toBe(true);
  });

  it('should handle unknown commands as expression evaluation', async () => {
    const result = await debugConsole.execute('2 + 2');
    expect(result.success).toBe(true);
    expect(result.output).toContain('4');
  });
});

// ============================================================================
// 10. Performance Monitoring (PerformanceProfiler)
// ============================================================================
describe('PerformanceProfiler', () => {
  let profiler: PerformanceProfiler;

  beforeEach(() => {
    profiler = new PerformanceProfiler();
  });

  it('should start and stop a profiling session', () => {
    expect(profiler.isProfilingActive()).toBe(false);

    const sessionId = profiler.startProfiling();
    expect(sessionId).toBeDefined();
    expect(typeof sessionId).toBe('string');
    expect(profiler.isProfilingActive()).toBe(true);

    const session = profiler.stopProfiling();
    expect(session).toBeDefined();
    expect(session.id).toBe(sessionId);
    expect(session.duration).toBeGreaterThanOrEqual(0);
    expect(profiler.isProfilingActive()).toBe(false);
  });

  it('should throw when starting a second session', () => {
    profiler.startProfiling();
    expect(() => profiler.startProfiling()).toThrow('already active');
  });

  it('should throw when stopping without active session', () => {
    expect(() => profiler.stopProfiling()).toThrow('No active');
  });

  it('should record frames and compute FPS', () => {
    profiler.startProfiling();

    // Record some frames
    for (let i = 0; i < 10; i++) {
      profiler.recordFrame({
        duration: 16.67,
        fps: 60,
        updateTime: 2,
        renderTime: 10,
        physicsTime: 3,
        scriptTime: 1,
        drawCalls: 100,
        triangles: 50000,
        textures: 5
      });
    }

    const session = profiler.stopProfiling();
    expect(session.frameProfiles.length).toBe(10);
    expect(session.frameProfiles[0].fps).toBe(60);
    expect(session.frameProfiles[0].drawCalls).toBe(100);
  });

  it('should generate recommendations for low FPS', () => {
    profiler.startProfiling();

    for (let i = 0; i < 5; i++) {
      profiler.recordFrame({
        duration: 50,
        fps: 20,
        drawCalls: 500,
        triangles: 100000
      });
    }

    const session = profiler.stopProfiling();
    expect(session.recommendations.length).toBeGreaterThan(0);
    const fpsRec = session.recommendations.find(r => r.title.includes('Frame Rate'));
    expect(fpsRec).toBeDefined();
    expect(fpsRec!.severity).toBe('critical');
  });

  it('should keep session history', () => {
    const id1 = profiler.startProfiling();
    profiler.stopProfiling();

    const id2 = profiler.startProfiling();
    profiler.stopProfiling();

    const history = profiler.getSessionHistory();
    expect(history.length).toBe(2);
    expect(history[0].id).toBe(id1);
    expect(history[1].id).toBe(id2);
  });

  it('should emit events on start/stop', () => {
    const events: any[] = [];
    profiler.on('profiling_started', (data) => events.push({ type: 'start', data }));
    profiler.on('profiling_stopped', (data) => events.push({ type: 'stop', data }));

    profiler.startProfiling();
    profiler.stopProfiling();

    expect(events.length).toBe(2);
    expect(events[0].type).toBe('start');
    expect(events[1].type).toBe('stop');
  });

  it('should set sampling interval', () => {
    profiler.setSamplingInterval(200);
    // Verify no crash - internal state validated indirectly
    expect(profiler).toBeDefined();
  });

  it('should return null for current session when not active', () => {
    expect(profiler.getCurrentSession()).toBeNull();
  });

  it('should not record frames when not profiling', () => {
    // Should not throw or record
    profiler.recordFrame({ fps: 60 });
    expect(profiler.getCurrentSession()).toBeNull();
  });

  it('should capture memory snapshots during sampling', async () => {
    // setSamplingInterval clamps to minimum 10ms, so we need a real delay
    profiler.setSamplingInterval(10);
    profiler.startProfiling();

    // Wait enough for the sampling interval to elapse
    await new Promise(resolve => setTimeout(resolve, 20));

    profiler.recordFrame({ fps: 60 });

    const session = profiler.stopProfiling();
    expect(session.memorySnapshots.length).toBeGreaterThanOrEqual(1);
    expect(session.memorySnapshots[0].totalMemory).toBeGreaterThan(0);
  });
});
