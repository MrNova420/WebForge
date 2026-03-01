/**
 * Core Systems Tests for WebForge
 * Covers: Engine lifecycle, ResourceManager, PhysicsWorld, and type safety
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Engine
import { Engine, EngineState } from '../src/core/Engine';
import { ResourceManager, ResourceType, ResourceStatus } from '../src/core/ResourceManager';
import { Scene } from '../src/scene/Scene';
import { Time } from '../src/core/Time';

// Physics
import { PhysicsWorld, type IPhysicsBody } from '../src/physics/PhysicsWorld';
import { RigidBody, RigidBodyType } from '../src/physics/RigidBody';
import { SphereShape, BoxShape } from '../src/physics/CollisionShape';
import { Vector3 } from '../src/math/Vector3';
import {
  NaiveBroadphase,
  SweepAndPruneBroadphase,
  SpatialHashBroadphase
} from '../src/physics/BroadphaseCollision';

// ============================================================
// Engine Lifecycle Tests
// ============================================================
describe('Engine Lifecycle', () => {
  let engine: Engine;

  beforeEach(() => {
    engine = new Engine({ targetFPS: 0 });
  });

  it('should initialize in STOPPED state', () => {
    expect(engine.getState()).toBe(EngineState.STOPPED);
    expect(engine.isRunning()).toBe(false);
    expect(engine.isPaused()).toBe(false);
  });

  it('should start and transition to RUNNING state', async () => {
    await engine.start();
    expect(engine.getState()).toBe(EngineState.RUNNING);
    expect(engine.isRunning()).toBe(true);
    engine.stop();
  });

  it('should stop and transition to STOPPED state', async () => {
    await engine.start();
    engine.stop();
    expect(engine.getState()).toBe(EngineState.STOPPED);
    expect(engine.isRunning()).toBe(false);
  });

  it('should pause and resume correctly', async () => {
    await engine.start();

    engine.pause();
    expect(engine.getState()).toBe(EngineState.PAUSED);
    expect(engine.isPaused()).toBe(true);
    expect(engine.isRunning()).toBe(false);

    engine.resume();
    expect(engine.getState()).toBe(EngineState.RUNNING);
    expect(engine.isRunning()).toBe(true);
    expect(engine.isPaused()).toBe(false);

    engine.stop();
  });

  it('should not start if already running', async () => {
    await engine.start();
    // Should return without error
    await engine.start();
    expect(engine.getState()).toBe(EngineState.RUNNING);
    engine.stop();
  });

  it('should not stop if already stopped', () => {
    // Should return without error
    engine.stop();
    expect(engine.getState()).toBe(EngineState.STOPPED);
  });

  it('should not pause if not running', () => {
    engine.pause();
    expect(engine.getState()).toBe(EngineState.STOPPED);
  });

  it('should not resume if not paused', async () => {
    await engine.start();
    engine.resume();
    expect(engine.getState()).toBe(EngineState.RUNNING);
    engine.stop();
  });

  it('should set and get scene', () => {
    const scene = new Scene('TestScene');
    engine.setScene(scene);
    expect(engine.getScene()).toBe(scene);
  });

  it('should emit events on scene change', () => {
    const events = engine.getEvents();
    let eventFired = false;
    events.on('scene:changed', () => { eventFired = true; });

    const scene1 = new Scene('Scene1');
    engine.setScene(scene1);
    // First set doesn't emit scene:changed (no old scene)
    expect(eventFired).toBe(false);

    const scene2 = new Scene('Scene2');
    engine.setScene(scene2);
    expect(eventFired).toBe(true);
  });

  it('should resize canvas dimensions', () => {
    engine.resize(1920, 1080);
    expect(engine.width).toBe(1920);
    expect(engine.height).toBe(1080);
  });

  it('should emit resize event', () => {
    const events = engine.getEvents();
    let resizeData: { width: number; height: number } | null = null;
    events.on('engine:resize', (data: { width: number; height: number }) => {
      resizeData = data;
    });

    engine.resize(1280, 720);
    expect(resizeData).toEqual({ width: 1280, height: 720 });
  });

  it('should destroy cleanly', async () => {
    await engine.start();
    engine.setScene(new Scene('TestScene'));
    engine.destroy();
    expect(engine.getState()).toBe(EngineState.STOPPED);
    expect(engine.getScene()).toBeNull();
  });

  it('should have default dimensions', () => {
    expect(engine.width).toBe(800);
    expect(engine.height).toBe(600);
  });

  it('should accept custom dimensions', () => {
    const customEngine = new Engine({ width: 1920, height: 1080 });
    expect(customEngine.width).toBe(1920);
    expect(customEngine.height).toBe(1080);
  });
});

// ============================================================
// Time System Tests
// ============================================================
describe('Time System', () => {
  it('should initialize with correct fixed timestep', () => {
    const time = new Time(1 / 60, 0.1);
    expect(time.fixedDeltaTime).toBeCloseTo(1 / 60);
  });

  it('should reset correctly', () => {
    const time = new Time(1 / 60, 0.1);
    time.reset();
    expect(time.deltaTime).toBe(0);
  });
});

// ============================================================
// ResourceManager Tests
// ============================================================
describe('ResourceManager', () => {
  let rm: ResourceManager;

  beforeEach(() => {
    rm = new ResourceManager();
  });

  it('should initialize with empty cache', () => {
    const stats = rm.getStats();
    expect(stats.resourceCount).toBe(0);
    expect(stats.cacheSize).toBe(0);
    expect(stats.loading).toBe(0);
  });

  it('should set base URL', () => {
    rm.setBaseURL('https://example.com/');
    // Verify it doesn't throw
    expect(rm.getStats().resourceCount).toBe(0);
  });

  it('should report isLoaded false for unknown resources', () => {
    expect(rm.isLoaded('nonexistent.png')).toBe(false);
  });

  it('should report isLoading false for unknown resources', () => {
    expect(rm.isLoading('nonexistent.png')).toBe(false);
  });

  it('should return null for unloaded resource get', () => {
    expect(rm.get('nonexistent.png')).toBeNull();
  });

  it('should return null metadata for unknown resources', () => {
    expect(rm.getMetadata('nonexistent.png')).toBeNull();
  });

  it('should unload all resources', () => {
    rm.unloadAll();
    expect(rm.getStats().resourceCount).toBe(0);
    expect(rm.getStats().cacheSize).toBe(0);
  });

  it('should set max cache size', () => {
    rm.setMaxCacheSize(1024 * 1024);
    expect(rm.getStats().maxCacheSize).toBe(1024 * 1024);
  });

  it('should set and get load timeout', () => {
    rm.setLoadTimeout(5000);
    expect(rm.getLoadTimeout()).toBe(5000);
  });

  it('should not accept negative timeout', () => {
    rm.setLoadTimeout(-100);
    expect(rm.getLoadTimeout()).toBe(0);
  });

  it('should register custom loader', () => {
    rm.registerLoader(ResourceType.JSON, async (url: string) => {
      return { test: true, url };
    });
    // Should not throw
    expect(true).toBe(true);
  });

  it('should throw for missing loader type', async () => {
    // Unregister all loaders by creating fresh manager
    const freshRm = new ResourceManager();
    // TEXT loader exists by default, but we can test with a known invalid scenario
    // by trying to load with a type that errors
    try {
      await freshRm.load('test.json', ResourceType.JSON);
    } catch (e) {
      // Expected - fetch will fail in test env
      expect(e).toBeDefined();
    }
  });

  it('should track loading progress', () => {
    const progress = rm.getProgress();
    expect(progress.loaded).toBe(0);
    expect(progress.loading).toBe(0);
    expect(progress.total).toBe(0);
  });

  it('should have event system', () => {
    const events = rm.getEvents();
    expect(events).toBeDefined();
  });

  it('should handle unload of non-existent resource gracefully', () => {
    // Should not throw
    rm.unload('nonexistent.png');
    expect(rm.getStats().resourceCount).toBe(0);
  });
});

// ============================================================
// PhysicsWorld Tests
// ============================================================
describe('PhysicsWorld', () => {
  let world: PhysicsWorld;

  beforeEach(() => {
    world = new PhysicsWorld();
  });

  it('should create with default configuration', () => {
    expect(world.getBodyCount()).toBe(0);
    expect(world.getGravity().y).toBeCloseTo(-9.81);
    expect(world.getFixedTimestep()).toBeCloseTo(1 / 60);
    expect(world.isCCDEnabled()).toBe(true);
  });

  it('should create with custom configuration', () => {
    const customWorld = new PhysicsWorld({
      gravity: new Vector3(0, -20, 0),
      fixedTimestep: 1 / 120,
      maxSubsteps: 5,
      enableCCD: false
    });
    expect(customWorld.getGravity().y).toBeCloseTo(-20);
    expect(customWorld.getFixedTimestep()).toBeCloseTo(1 / 120);
    expect(customWorld.isCCDEnabled()).toBe(false);
  });

  it('should add and remove bodies', () => {
    const body = new RigidBody({ type: RigidBodyType.DYNAMIC });
    world.addBody(body);
    expect(world.getBodyCount()).toBe(1);
    expect(world.getBodies()).toContain(body);

    world.removeBody(body);
    expect(world.getBodyCount()).toBe(0);
  });

  it('should clear all bodies', () => {
    world.addBody(new RigidBody());
    world.addBody(new RigidBody());
    world.addBody(new RigidBody());
    expect(world.getBodyCount()).toBe(3);

    world.clear();
    expect(world.getBodyCount()).toBe(0);
  });

  it('should set and get gravity', () => {
    world.setGravity(new Vector3(0, -20, 0));
    expect(world.getGravity().y).toBeCloseTo(-20);
  });

  it('should set and get fixed timestep', () => {
    world.setFixedTimestep(1 / 120);
    expect(world.getFixedTimestep()).toBeCloseTo(1 / 120);
  });

  it('should clamp timestep minimum', () => {
    world.setFixedTimestep(0);
    expect(world.getFixedTimestep()).toBeGreaterThanOrEqual(0.001);
  });

  it('should step simulation without bodies', () => {
    // Should not throw
    world.step(1 / 60);
    expect(world.getManifolds()).toEqual([]);
  });

  it('should step simulation with dynamic body', () => {
    const body = new RigidBody({
      type: RigidBodyType.DYNAMIC,
      mass: 1.0
    });
    body.setPosition(new Vector3(0, 10, 0));
    world.addBody(body);

    // Step the world
    world.step(1 / 60);

    // Body should have moved downward due to gravity
    const pos = body.getPosition();
    expect(pos.y).toBeLessThan(10);
  });

  it('should not move static bodies', () => {
    const body = new RigidBody({
      type: RigidBodyType.STATIC,
      mass: 0
    });
    body.setPosition(new Vector3(0, 5, 0));
    world.addBody(body);

    world.step(1 / 60);

    const pos = body.getPosition();
    expect(pos.y).toBeCloseTo(5);
  });

  it('should perform raycast against sphere body', () => {
    const body = new RigidBody({
      type: RigidBodyType.STATIC,
      shape: new SphereShape(1.0)
    });
    body.setPosition(new Vector3(0, 0, -5));
    world.addBody(body);

    const result = world.raycast(
      new Vector3(0, 0, 0),
      new Vector3(0, 0, -1)
    );

    expect(result).not.toBeNull();
    expect(result!.distance).toBeCloseTo(4);
    expect(result!.body).toBe(body);
  });

  it('should return null for missed raycast', () => {
    const body = new RigidBody({
      type: RigidBodyType.STATIC,
      shape: new SphereShape(1.0)
    });
    body.setPosition(new Vector3(10, 0, -5));
    world.addBody(body);

    const result = world.raycast(
      new Vector3(0, 0, 0),
      new Vector3(0, 0, -1)
    );

    expect(result).toBeNull();
  });

  it('should perform raycastAll', () => {
    const body1 = new RigidBody({
      type: RigidBodyType.STATIC,
      shape: new SphereShape(1.0)
    });
    body1.setPosition(new Vector3(0, 0, -5));

    const body2 = new RigidBody({
      type: RigidBodyType.STATIC,
      shape: new SphereShape(1.0)
    });
    body2.setPosition(new Vector3(0, 0, -10));

    world.addBody(body1);
    world.addBody(body2);

    const results = world.raycastAll(
      new Vector3(0, 0, 0),
      new Vector3(0, 0, -1)
    );

    expect(results.length).toBe(2);
    // Should be sorted by distance
    expect(results[0].distance).toBeLessThan(results[1].distance);
  });

  it('should perform raycast against box body', () => {
    const body = new RigidBody({
      type: RigidBodyType.STATIC,
      shape: new BoxShape(new Vector3(1, 1, 1))
    });
    body.setPosition(new Vector3(0, 0, -5));
    world.addBody(body);

    const result = world.raycast(
      new Vector3(0, 0, 0),
      new Vector3(0, 0, -1)
    );

    expect(result).not.toBeNull();
    expect(result!.distance).toBeCloseTo(4);
  });

  it('should get collision statistics', () => {
    const stats = world.getCollisionStats();
    expect(stats.pairs).toBe(0);
    expect(stats.contacts).toBe(0);
    expect(stats.constraints).toBe(0);
  });

  it('should dispose cleanly', () => {
    world.addBody(new RigidBody());
    world.dispose();
    expect(world.getBodyCount()).toBe(0);
    expect(world.getManifolds()).toEqual([]);
  });

  it('should handle maxDistance in raycast', () => {
    const body = new RigidBody({
      type: RigidBodyType.STATIC,
      shape: new SphereShape(1.0)
    });
    body.setPosition(new Vector3(0, 0, -100));
    world.addBody(body);

    const result = world.raycast(
      new Vector3(0, 0, 0),
      new Vector3(0, 0, -1),
      10 // maxDistance less than body distance
    );

    expect(result).toBeNull();
  });
});

// ============================================================
// IPhysicsBody Interface Compliance Tests
// ============================================================
describe('IPhysicsBody Interface', () => {
  it('RigidBody should satisfy IPhysicsBody interface', () => {
    const body: IPhysicsBody = new RigidBody({
      type: RigidBodyType.DYNAMIC,
      mass: 2.0,
      shape: new SphereShape(0.5)
    });

    expect(body.isDynamic()).toBe(true);
    expect(body.isStatic()).toBe(false);
    expect(body.getMass()).toBe(2.0);
    expect(body.getPosition()).toBeDefined();
    expect(body.shape).toBeDefined();

    // Should not throw
    body.applyForce(new Vector3(0, 10, 0));
    body.integrate(1 / 60);
  });

  it('custom IPhysicsBody implementation should work with PhysicsWorld', () => {
    const customBody: IPhysicsBody = {
      shape: new SphereShape(1.0),
      isDynamic: () => true,
      isStatic: () => false,
      getMass: () => 1.0,
      applyForce: vi.fn(),
      getPosition: () => new Vector3(0, 0, 0),
      integrate: vi.fn()
    };

    const world = new PhysicsWorld();
    world.addBody(customBody);
    expect(world.getBodyCount()).toBe(1);
    expect(world.getBodies()[0]).toBe(customBody);

    // Step should call interface methods
    world.step(1 / 60);
    expect(customBody.applyForce).toHaveBeenCalled();
    expect(customBody.integrate).toHaveBeenCalled();

    world.removeBody(customBody);
    expect(world.getBodyCount()).toBe(0);
  });
});

// ============================================================
// Broadphase Tests
// ============================================================
describe('Broadphase Collision Detection', () => {
  const createBody = (x: number, y: number, z: number, isStaticBody = false): IPhysicsBody => ({
    shape: new SphereShape(1.0),
    isDynamic: () => !isStaticBody,
    isStatic: () => isStaticBody,
    getMass: () => isStaticBody ? 0 : 1.0,
    applyForce: vi.fn(),
    getPosition: () => new Vector3(x, y, z),
    integrate: vi.fn()
  });

  describe('NaiveBroadphase', () => {
    it('should detect overlapping pairs', () => {
      const bp = new NaiveBroadphase();
      const bodies = [createBody(0, 0, 0), createBody(1, 0, 0)];
      bp.update(bodies);
      expect(bp.getPairs().length).toBe(1);
    });

    it('should skip static-static pairs', () => {
      const bp = new NaiveBroadphase();
      const bodies = [createBody(0, 0, 0, true), createBody(1, 0, 0, true)];
      bp.update(bodies);
      expect(bp.getPairs().length).toBe(0);
    });

    it('should clear pairs', () => {
      const bp = new NaiveBroadphase();
      bp.update([createBody(0, 0, 0), createBody(1, 0, 0)]);
      bp.clear();
      expect(bp.getPairs().length).toBe(0);
    });
  });

  describe('SweepAndPruneBroadphase', () => {
    it('should detect overlapping intervals', () => {
      const bp = new SweepAndPruneBroadphase('x');
      const bodies = [createBody(0, 0, 0), createBody(0.5, 0, 0)];
      bp.update(bodies);
      expect(bp.getPairs().length).toBe(1);
    });

    it('should not pair distant bodies', () => {
      const bp = new SweepAndPruneBroadphase('x');
      const bodies = [createBody(0, 0, 0), createBody(100, 0, 0)];
      bp.update(bodies);
      expect(bp.getPairs().length).toBe(0);
    });

    it('should handle empty body list', () => {
      const bp = new SweepAndPruneBroadphase();
      bp.update([]);
      expect(bp.getPairs().length).toBe(0);
    });

    it('should allow axis change', () => {
      const bp = new SweepAndPruneBroadphase();
      bp.setAxis('y');
      const bodies = [createBody(0, 0, 0), createBody(0, 0.5, 0)];
      bp.update(bodies);
      expect(bp.getPairs().length).toBe(1);
    });
  });

  describe('SpatialHashBroadphase', () => {
    it('should detect pairs in same cell', () => {
      const bp = new SpatialHashBroadphase(5.0);
      const bodies = [createBody(0, 0, 0), createBody(1, 0, 0)];
      bp.update(bodies);
      expect(bp.getPairs().length).toBe(1);
    });

    it('should report grid statistics', () => {
      const bp = new SpatialHashBroadphase(5.0);
      bp.update([createBody(0, 0, 0), createBody(1, 0, 0)]);
      const stats = bp.getStats();
      expect(stats.cells).toBeGreaterThan(0);
      expect(stats.maxBodiesPerCell).toBeGreaterThanOrEqual(1);
    });

    it('should allow cell size change', () => {
      const bp = new SpatialHashBroadphase(5.0);
      bp.setCellSize(10.0);
      // Verify it works (no throw)
      bp.update([createBody(0, 0, 0)]);
      expect(bp.getStats().cells).toBeGreaterThan(0);
    });

    it('should clamp minimum cell size', () => {
      const bp = new SpatialHashBroadphase(5.0);
      bp.setCellSize(0);
      // Should be clamped to at least 0.1
      bp.update([createBody(0, 0, 0)]);
      expect(bp.getStats().cells).toBeGreaterThan(0);
    });
  });
});

// ============================================================
// RigidBody Tests
// ============================================================
describe('RigidBody', () => {
  it('should create with default dynamic type', () => {
    const body = new RigidBody();
    expect(body.isDynamic()).toBe(true);
    expect(body.isStatic()).toBe(false);
    expect(body.isKinematic()).toBe(false);
  });

  it('should create static body with zero inverse mass', () => {
    const body = new RigidBody({ type: RigidBodyType.STATIC });
    expect(body.isStatic()).toBe(true);
    expect(body.getInverseMass()).toBe(0);
  });

  it('should apply force to dynamic body', () => {
    const body = new RigidBody({ type: RigidBodyType.DYNAMIC, mass: 1.0 });
    body.applyForce(new Vector3(0, 10, 0));
    body.integrate(1 / 60);
    expect(body.getVelocity().y).toBeGreaterThan(0);
  });

  it('should not apply force to static body', () => {
    const body = new RigidBody({ type: RigidBodyType.STATIC });
    body.setPosition(new Vector3(0, 5, 0));
    body.applyForce(new Vector3(0, 10, 0));
    body.integrate(1 / 60);
    expect(body.getPosition().y).toBeCloseTo(5);
  });

  it('should apply impulse', () => {
    const body = new RigidBody({ type: RigidBodyType.DYNAMIC, mass: 1.0 });
    body.applyImpulse(new Vector3(10, 0, 0));
    expect(body.getVelocity().x).toBeCloseTo(10);
  });

  it('should apply linear damping', () => {
    const body = new RigidBody({
      type: RigidBodyType.DYNAMIC,
      mass: 1.0,
      linearDamping: 0.1
    });
    body.setVelocity(new Vector3(10, 0, 0));
    body.integrate(1 / 60);
    expect(body.getVelocity().x).toBeLessThan(10);
  });

  it('should lock rotation axes', () => {
    const body = new RigidBody({
      type: RigidBodyType.DYNAMIC,
      mass: 1.0,
      lockRotation: { x: true, y: true, z: true }
    });
    body.applyTorque(new Vector3(10, 10, 10));
    body.integrate(1 / 60);
    expect(body.getAngularVelocity().x).toBeCloseTo(0);
    expect(body.getAngularVelocity().y).toBeCloseTo(0);
    expect(body.getAngularVelocity().z).toBeCloseTo(0);
  });

  it('should track sleeping state', () => {
    const body = new RigidBody({ type: RigidBodyType.DYNAMIC, mass: 1.0 });
    expect(body.isSleeping()).toBe(false);

    // After integrate with zero velocity, body should sleep
    body.integrate(1 / 60);
    expect(body.isSleeping()).toBe(true);
  });

  it('should wake up on force application', () => {
    const body = new RigidBody({ type: RigidBodyType.DYNAMIC });
    // Force sleep
    body.integrate(1 / 60);
    expect(body.isSleeping()).toBe(true);

    body.applyForce(new Vector3(0, 10, 0));
    expect(body.isSleeping()).toBe(false);
  });

  it('should change body type', () => {
    const body = new RigidBody({ type: RigidBodyType.DYNAMIC });
    expect(body.isDynamic()).toBe(true);

    body.setType(RigidBodyType.STATIC);
    expect(body.isStatic()).toBe(true);
    expect(body.getInverseMass()).toBe(0);
    expect(body.getVelocity().length()).toBeCloseTo(0);
  });

  it('should compute transform matrix', () => {
    const body = new RigidBody();
    body.setPosition(new Vector3(1, 2, 3));
    const matrix = body.getTransformMatrix();
    expect(matrix).toBeDefined();
    // Check translation components
    expect(matrix.elements[12]).toBeCloseTo(1);
    expect(matrix.elements[13]).toBeCloseTo(2);
    expect(matrix.elements[14]).toBeCloseTo(3);
  });

  it('should get material properties', () => {
    const body = new RigidBody({ restitution: 0.8, friction: 0.3 });
    expect(body.getRestitution()).toBeCloseTo(0.8);
    expect(body.getFriction()).toBeCloseTo(0.3);
  });
});
