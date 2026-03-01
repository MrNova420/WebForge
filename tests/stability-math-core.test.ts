/**
 * Stability tests for WebForge math and core systems.
 * Covers edge cases, immutability contracts, and graceful degradation.
 */
import { describe, it, expect, vi } from 'vitest';
import { Vector3 } from '../src/math/Vector3';
import { Matrix4 } from '../src/math/Matrix4';
import { Quaternion } from '../src/math/Quaternion';
import { EventSystem } from '../src/core/EventSystem';
import { GameStateManager } from '../src/core/GameStateManager';
import { ResourceManager, ResourceType, ResourceStatus } from '../src/core/ResourceManager';
import { Time } from '../src/core/Time';

// ─── Vector3 ────────────────────────────────────────────────────────────────

describe('Vector3 stability', () => {
  it('add() returns a new vector, original unchanged', () => {
    const a = new Vector3(1, 2, 3);
    const b = new Vector3(4, 5, 6);
    const result = a.add(b);

    expect(result.x).toBe(5);
    expect(result.y).toBe(7);
    expect(result.z).toBe(9);
    // Original must be untouched
    expect(a.x).toBe(1);
    expect(a.y).toBe(2);
    expect(a.z).toBe(3);
    // Result must be a different instance
    expect(result).not.toBe(a);
  });

  it('addSelf() modifies the vector in place', () => {
    const a = new Vector3(1, 2, 3);
    const b = new Vector3(4, 5, 6);
    const returned = a.addSelf(b);

    expect(a.x).toBe(5);
    expect(a.y).toBe(7);
    expect(a.z).toBe(9);
    // Returns the same instance for chaining
    expect(returned).toBe(a);
  });

  it('normalize() of zero vector does not produce NaN', () => {
    const zero = new Vector3(0, 0, 0);
    const normalized = zero.normalize();

    expect(Number.isNaN(normalized.x)).toBe(false);
    expect(Number.isNaN(normalized.y)).toBe(false);
    expect(Number.isNaN(normalized.z)).toBe(false);
    expect(normalized.equals(Vector3.zero())).toBe(true);
  });

  it('normalizeSelf() of zero vector does not produce NaN', () => {
    const zero = new Vector3(0, 0, 0);
    zero.normalizeSelf();

    expect(Number.isNaN(zero.x)).toBe(false);
    expect(Number.isNaN(zero.y)).toBe(false);
    expect(Number.isNaN(zero.z)).toBe(false);
  });

  it('cross product of parallel vectors returns zero vector', () => {
    const a = new Vector3(1, 0, 0);
    const b = new Vector3(3, 0, 0); // same direction, different magnitude
    const cross = a.cross(b);

    expect(cross.x).toBe(0);
    expect(cross.y).toBe(0);
    expect(cross.z).toBe(0);
  });

  it('cross product of anti-parallel vectors returns zero vector', () => {
    const a = new Vector3(0, 2, 0);
    const b = new Vector3(0, -5, 0);
    const cross = a.cross(b);

    expect(cross.equals(Vector3.zero())).toBe(true);
  });

  it('distanceTo(self) equals 0', () => {
    const v = new Vector3(7, -3, 12.5);
    expect(v.distanceTo(v)).toBe(0);
  });

  it('distanceTo(clone) equals 0', () => {
    const v = new Vector3(7, -3, 12.5);
    expect(v.distanceTo(v.clone())).toBe(0);
  });

  it('subtract is immutable, subtractSelf is mutable', () => {
    const a = new Vector3(10, 20, 30);
    const b = new Vector3(1, 2, 3);
    const diff = a.subtract(b);

    expect(diff.equals(new Vector3(9, 18, 27))).toBe(true);
    expect(a.x).toBe(10); // unchanged

    a.subtractSelf(b);
    expect(a.x).toBe(9);
  });

  it('multiplyScalar is immutable, multiplyScalarSelf is mutable', () => {
    const v = new Vector3(2, 4, 6);
    const scaled = v.multiplyScalar(3);

    expect(scaled.equals(new Vector3(6, 12, 18))).toBe(true);
    expect(v.x).toBe(2); // unchanged

    v.multiplyScalarSelf(3);
    expect(v.x).toBe(6);
  });

  it('divideScalar by zero returns zero vector without NaN', () => {
    const v = new Vector3(5, 10, 15);
    const result = v.divideScalar(0);

    expect(Number.isNaN(result.x)).toBe(false);
    expect(result.equals(Vector3.zero())).toBe(true);
  });
});

// ─── Matrix4 ────────────────────────────────────────────────────────────────

describe('Matrix4 stability', () => {
  it('Identity * any matrix = same matrix', () => {
    const identity = Matrix4.identity();
    const m = new Matrix4().set(
      2, 3, 5, 7,
      11, 13, 17, 19,
      23, 29, 31, 37,
      41, 43, 47, 53
    );

    const result = identity.multiply(m);
    expect(result.equals(m)).toBe(true);
  });

  it('any matrix * Identity = same matrix', () => {
    const identity = Matrix4.identity();
    const m = new Matrix4().set(
      2, 3, 5, 7,
      11, 13, 17, 19,
      23, 29, 31, 37,
      41, 43, 47, 53
    );

    const result = m.multiply(identity);
    expect(result.equals(m)).toBe(true);
  });

  it('inverse of identity = identity', () => {
    const identity = Matrix4.identity();
    const inv = identity.invert();

    expect(inv.equals(identity)).toBe(true);
  });

  it('matrix * inverse = identity', () => {
    const m = Matrix4.identity();
    m.translate(new Vector3(5, -3, 8));
    m.rotateY(Math.PI / 4);
    m.scale(new Vector3(2, 2, 2));

    const inv = m.invert();
    const product = m.multiply(inv);

    expect(product.equals(Matrix4.identity(), 1e-5)).toBe(true);
  });

  it('translation matrix moves point correctly', () => {
    const t = Matrix4.translation(new Vector3(10, 20, 30));
    const point = new Vector3(1, 2, 3);
    const moved = t.multiplyVector3(point);

    expect(moved.x).toBeCloseTo(11);
    expect(moved.y).toBeCloseTo(22);
    expect(moved.z).toBeCloseTo(33);
  });

  it('translation matrix moves origin to translation vector', () => {
    const t = Matrix4.translation(new Vector3(5, -7, 13));
    const origin = new Vector3(0, 0, 0);
    const result = t.multiplyVector3(origin);

    expect(result.equals(new Vector3(5, -7, 13))).toBe(true);
  });

  it('determinant of identity is 1', () => {
    expect(Matrix4.identity().determinant()).toBeCloseTo(1);
  });
});

// ─── Quaternion ─────────────────────────────────────────────────────────────

describe('Quaternion stability', () => {
  it('fromEuler + toEuler roundtrip preserves single-axis angles', () => {
    // Single-axis rotations have unique Euler decompositions
    const angles = [
      [0, 0, 0],
      [Math.PI / 4, 0, 0],
      [0, Math.PI / 6, 0],
      [0, 0, Math.PI / 3],
    ];

    for (const [x, y, z] of angles) {
      const q = Quaternion.fromEuler(x, y, z);
      const euler = q.toEuler();

      expect(euler.x).toBeCloseTo(x, 5);
      expect(euler.y).toBeCloseTo(y, 5);
      expect(euler.z).toBeCloseTo(z, 5);
    }
  });

  it('fromEuler + toEuler roundtrip preserves rotation for combined axes', () => {
    // BUG: fromEuler uses extrinsic XYZ (q=qx*qy*qz) while toEuler decomposes
    // as extrinsic ZYX. This test documents the convention mismatch — it WILL fail.
    const x = 0.3, y = 0.5, z = 0.7;
    const q1 = Quaternion.fromEuler(x, y, z);
    const euler = q1.toEuler();
    const q2 = Quaternion.fromEuler(euler.x, euler.y, euler.z);

    // The two quaternions must represent the same rotation
    const testVec = new Vector3(1, 2, 3);
    const r1 = q1.multiplyVector(testVec);
    const r2 = q2.multiplyVector(testVec);

    expect(r1.x).toBeCloseTo(r2.x, 5);
    expect(r1.y).toBeCloseTo(r2.y, 5);
    expect(r1.z).toBeCloseTo(r2.z, 5);
  });

  it('multiply by identity = same quaternion', () => {
    const q = Quaternion.fromEuler(0.5, 1.0, 1.5);
    const identity = Quaternion.identity();
    const result = q.multiply(identity);

    expect(result.equals(q, 1e-10)).toBe(true);
  });

  it('identity * quaternion = same quaternion', () => {
    const q = Quaternion.fromEuler(0.5, 1.0, 1.5);
    const identity = Quaternion.identity();
    const result = identity.multiply(q);

    expect(result.equals(q, 1e-10)).toBe(true);
  });

  it('normalize of zero quaternion handles gracefully (no NaN)', () => {
    const zero = new Quaternion(0, 0, 0, 0);
    const normalized = zero.normalize();

    expect(Number.isNaN(normalized.x)).toBe(false);
    expect(Number.isNaN(normalized.y)).toBe(false);
    expect(Number.isNaN(normalized.z)).toBe(false);
    expect(Number.isNaN(normalized.w)).toBe(false);
    // Should return identity
    expect(normalized.equals(Quaternion.identity())).toBe(true);
  });

  it('normalizeSelf of zero quaternion handles gracefully', () => {
    const zero = new Quaternion(0, 0, 0, 0);
    zero.normalizeSelf();

    expect(Number.isNaN(zero.x)).toBe(false);
    expect(Number.isNaN(zero.w)).toBe(false);
  });

  it('conjugate reverses rotation', () => {
    const q = Quaternion.fromAxisAngle(Vector3.up(), Math.PI / 2);
    const v = new Vector3(1, 0, 0);
    const rotated = q.multiplyVector(v);
    const back = q.conjugate().multiplyVector(rotated);

    expect(back.x).toBeCloseTo(v.x, 5);
    expect(back.y).toBeCloseTo(v.y, 5);
    expect(back.z).toBeCloseTo(v.z, 5);
  });

  it('normalized quaternion has length 1', () => {
    const q = new Quaternion(3, 4, 5, 6);
    const n = q.normalize();
    expect(n.length()).toBeCloseTo(1, 10);
  });
});

// ─── EventSystem ────────────────────────────────────────────────────────────

describe('EventSystem stability', () => {
  it('on/emit/off lifecycle works', () => {
    const events = new EventSystem();
    const results: number[] = [];
    const handler = (data: number) => results.push(data);

    events.on('test', handler);
    events.emit('test', 1);
    events.emit('test', 2);
    events.off('test', handler);
    events.emit('test', 3); // should not fire

    expect(results).toEqual([1, 2]);
  });

  it('once handler fires exactly once', () => {
    const events = new EventSystem();
    let count = 0;
    events.once('ping', () => count++);

    events.emit('ping');
    events.emit('ping');
    events.emit('ping');

    expect(count).toBe(1);
  });

  it('removing listener during emit does not crash', () => {
    const events = new EventSystem();
    const results: string[] = [];

    const handlerA = () => {
      results.push('A');
      events.off('evt', handlerB);
    };
    const handlerB = () => results.push('B');
    const handlerC = () => results.push('C');

    events.on('evt', handlerA);
    events.on('evt', handlerB);
    events.on('evt', handlerC);

    // Should not throw
    expect(() => events.emit('evt')).not.toThrow();
    // A should have fired; C should have fired; B might or might not depending on Set iteration
    expect(results).toContain('A');
    expect(results).toContain('C');
  });

  it('emitting event with no listeners does not throw', () => {
    const events = new EventSystem();
    expect(() => events.emit('nonexistent', { data: 42 })).not.toThrow();
  });

  it('handler error does not break other handlers', () => {
    const events = new EventSystem();
    const results: string[] = [];

    events.on('err', () => { throw new Error('boom'); });
    events.on('err', () => results.push('survived'));

    expect(() => events.emit('err')).not.toThrow();
    expect(results).toEqual(['survived']);
  });

  it('listenerCount and hasListeners are accurate', () => {
    const events = new EventSystem();
    expect(events.hasListeners('x')).toBe(false);
    expect(events.listenerCount('x')).toBe(0);

    const h = () => {};
    events.on('x', h);
    expect(events.hasListeners('x')).toBe(true);
    expect(events.listenerCount('x')).toBe(1);

    events.off('x', h);
    expect(events.hasListeners('x')).toBe(false);
  });

  it('subscription.unsubscribe works', () => {
    const events = new EventSystem();
    let called = false;
    const sub = events.on('unsub', () => { called = true; });

    sub.unsubscribe();
    events.emit('unsub');

    expect(called).toBe(false);
  });

  it('clear removes all handlers', () => {
    const events = new EventSystem();
    events.on('a', () => {});
    events.on('b', () => {});
    events.once('c', () => {});

    events.clear();

    expect(events.eventNames().length).toBe(0);
  });
});

// ─── GameStateManager ───────────────────────────────────────────────────────

describe('GameStateManager stability', () => {
  it('push/pop state transitions with lifecycle hooks', () => {
    const gsm = new GameStateManager();
    const log: string[] = [];

    gsm.addState({
      name: 'Gameplay',
      onEnter: () => log.push('gameplay:enter'),
      onExit: () => log.push('gameplay:exit'),
      onPause: () => log.push('gameplay:pause'),
      onResume: () => log.push('gameplay:resume'),
    });
    gsm.addState({
      name: 'Pause',
      onEnter: () => log.push('pause:enter'),
      onExit: () => log.push('pause:exit'),
    });

    gsm.setState('Gameplay');
    expect(gsm.getCurrentState()).toBe('Gameplay');

    gsm.pushState('Pause');
    expect(gsm.getCurrentState()).toBe('Pause');
    expect(gsm.getStackDepth()).toBe(1);

    const popped = gsm.popState();
    expect(popped).toBe('Pause');
    expect(gsm.getCurrentState()).toBe('Gameplay');
    expect(gsm.getStackDepth()).toBe(0);

    expect(log).toEqual([
      'gameplay:enter',
      'gameplay:pause',
      'pause:enter',
      'pause:exit',
      'gameplay:resume',
    ]);
  });

  it('popState with empty stack returns null', () => {
    const gsm = new GameStateManager();
    gsm.addState({ name: 'Main' });
    gsm.setState('Main');

    expect(gsm.popState()).toBeNull();
  });

  it('setState to unknown state returns false', () => {
    const gsm = new GameStateManager();
    expect(gsm.setState('NonExistent')).toBe(false);
  });

  it('transitionTo validates allowed transitions', () => {
    const gsm = GameStateManager.createDefaultGameFlow();
    gsm.setState('MainMenu');

    // MainMenu -> Loading is valid
    expect(gsm.transitionTo('Loading')).toBe(true);
    expect(gsm.getCurrentState()).toBe('Loading');

    // Loading -> MainMenu has no transition defined
    expect(gsm.transitionTo('MainMenu')).toBe(false);
    expect(gsm.getCurrentState()).toBe('Loading');
  });

  it('transition with guard condition', () => {
    const gsm = new GameStateManager();
    let canTransition = false;

    gsm.addState({ name: 'A' });
    gsm.addState({ name: 'B' });
    gsm.addTransition({ from: 'A', to: 'B', condition: () => canTransition });
    gsm.setState('A');

    expect(gsm.transitionTo('B')).toBe(false);

    canTransition = true;
    expect(gsm.transitionTo('B')).toBe(true);
    expect(gsm.getCurrentState()).toBe('B');
  });

  it('state history is tracked', () => {
    const gsm = new GameStateManager();
    gsm.addState({ name: 'A' });
    gsm.addState({ name: 'B' });

    gsm.setState('A');
    gsm.setState('B');
    gsm.setState('A');

    expect(gsm.getStateHistory()).toEqual(['A', 'B', 'A']);
  });
});

// ─── ResourceManager ────────────────────────────────────────────────────────

describe('ResourceManager stability', () => {
  it('load timeout can be configured', () => {
    const rm = new ResourceManager();
    expect(rm.getLoadTimeout()).toBe(30000); // default

    rm.setLoadTimeout(5000);
    expect(rm.getLoadTimeout()).toBe(5000);

    rm.setLoadTimeout(0);
    expect(rm.getLoadTimeout()).toBe(0); // unlimited
  });

  it('negative timeout is clamped to 0', () => {
    const rm = new ResourceManager();
    rm.setLoadTimeout(-100);
    expect(rm.getLoadTimeout()).toBe(0);
  });

  it('loading a resource with unknown type rejects', async () => {
    const rm = new ResourceManager();
    await expect(
      rm.load('test.xyz', 'unknown' as ResourceType)
    ).rejects.toThrow('No loader registered for type');
  });

  it('get returns null for unloaded resource', () => {
    const rm = new ResourceManager();
    expect(rm.get('nonexistent.png')).toBeNull();
  });

  it('unloadAll clears all resources', () => {
    const rm = new ResourceManager();
    rm.unloadAll();

    const stats = rm.getStats();
    expect(stats.resourceCount).toBe(0);
    expect(stats.cacheSize).toBe(0);
  });

  it('custom loader is used for registered type', async () => {
    const rm = new ResourceManager();
    rm.registerLoader(ResourceType.JSON, async (url: string) => {
      return { mock: true, url };
    });

    const data = await rm.load('test.json', ResourceType.JSON);
    expect(data.mock).toBe(true);
    expect(rm.isLoaded('test.json')).toBe(true);
  });

  it('loading same resource twice returns cached version', async () => {
    const rm = new ResourceManager();
    let loadCount = 0;
    rm.registerLoader(ResourceType.TEXT, async () => {
      loadCount++;
      return 'hello';
    });

    await rm.load('file.txt', ResourceType.TEXT);
    await rm.load('file.txt', ResourceType.TEXT);

    expect(loadCount).toBe(1);
  });

  it('timed-out wait on in-progress load rejects', async () => {
    const rm = new ResourceManager();
    rm.setLoadTimeout(50); // 50ms

    // Register a loader that never resolves
    rm.registerLoader(ResourceType.TEXT, () => new Promise(() => {}));

    // Start the load (it will hang)
    const firstLoad = rm.load('hang.txt', ResourceType.TEXT);

    // Second load should wait and then timeout
    await expect(
      rm.load('hang.txt', ResourceType.TEXT)
    ).rejects.toThrow('Timed out');

    // Clean up - ignore the first hanging promise
    firstLoad.catch(() => {});
  });
});

// ─── Time ───────────────────────────────────────────────────────────────────

describe('Time stability', () => {
  it('delta time is calculated correctly', () => {
    const time = new Time();

    // First call initialises, no delta
    time.update(0);
    expect(time.deltaTime).toBe(0);

    // 16.67ms later (60fps)
    time.update(16.667);
    expect(time.deltaTime).toBeCloseTo(0.016667, 4);
  });

  it('delta time is clamped to maxDeltaTime', () => {
    const time = new Time(1 / 60, 0.1);

    time.update(0);
    time.update(500); // 500ms gap — way too large

    expect(time.deltaTime).toBeLessThanOrEqual(0.1);
  });

  it('timeScale affects deltaTime', () => {
    const time = new Time();
    time.update(0);
    time.timeScale = 2.0;
    time.update(16.667);

    // unscaled ~0.01667, scaled should be ~0.03333
    expect(time.deltaTime).toBeCloseTo(0.016667 * 2, 4);
    expect(time.unscaledDeltaTime).toBeCloseTo(0.016667, 4);
  });

  it('pause sets timeScale to 0', () => {
    const time = new Time();
    time.pause();
    expect(time.isPaused()).toBe(true);
    expect(time.timeScale).toBe(0);

    time.resume();
    expect(time.isPaused()).toBe(false);
    expect(time.timeScale).toBe(1.0);
  });

  it('frame count increments each update (after start)', () => {
    const time = new Time();
    time.update(0);   // initialization frame
    expect(time.frameCount).toBe(0);

    time.update(16);
    expect(time.frameCount).toBe(1);

    time.update(32);
    expect(time.frameCount).toBe(2);
  });

  it('consumeFixedUpdate drains accumulator correctly', () => {
    const time = new Time(1 / 60);
    time.update(0);
    time.update(50); // 50ms = 0.05s, ~3 fixed steps at 1/60

    let fixedSteps = 0;
    while (time.consumeFixedUpdate()) {
      fixedSteps++;
    }

    expect(fixedSteps).toBe(3);
  });

  it('reset clears all state', () => {
    const time = new Time();
    time.update(0);
    time.update(100);

    time.reset();
    expect(time.time).toBe(0);
    expect(time.deltaTime).toBe(0);
    expect(time.frameCount).toBe(0);
  });
});
