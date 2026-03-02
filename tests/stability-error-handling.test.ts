/**
 * Stability & Error Handling Tests
 *
 * Tests edge cases and error conditions that real users might trigger,
 * verifying the engine handles them gracefully without crashes.
 */
import { describe, it, expect, vi } from 'vitest';

import { Engine, EngineState } from '../src/core/Engine';
import { Scene, ISceneObject } from '../src/scene/Scene';
import { GameObject, IComponent } from '../src/scene/GameObject';
import { PhysicsWorld } from '../src/physics/PhysicsWorld';
import { Camera } from '../src/rendering/Camera';
import { Vector3 } from '../src/math/Vector3';
import { Matrix4 } from '../src/math/Matrix4';
import { Quaternion } from '../src/math/Quaternion';
import { AnimationClip, AnimationTrack, TrackType, InterpolationMode } from '../src/animation/AnimationClip';
import { AnimationPlayer, PlaybackMode, PlaybackState } from '../src/animation/AnimationPlayer';
import { EventSystem } from '../src/core/EventSystem';

// ---------------------------------------------------------------------------
// 1. Engine lifecycle edge cases
// ---------------------------------------------------------------------------
describe('Engine lifecycle error handling', () => {
    it('stop() before start() should not crash', () => {
        const engine = new Engine();
        expect(() => engine.stop()).not.toThrow();
        expect(engine.getState()).toBe(EngineState.STOPPED);
    });

    it('start() twice should handle gracefully', async () => {
        const engine = new Engine();
        await engine.start();
        // Second start should warn and return without error
        await expect(engine.start()).resolves.toBeUndefined();
        expect(engine.getState()).toBe(EngineState.RUNNING);
        engine.stop();
    });

    it('destroy() then calling methods should not crash', () => {
        const engine = new Engine();
        engine.destroy();
        expect(engine.getState()).toBe(EngineState.STOPPED);
        // Using the engine after destroy should not throw
        expect(() => engine.stop()).not.toThrow();
        expect(() => engine.pause()).not.toThrow();
        expect(() => engine.resume()).not.toThrow();
        expect(() => engine.resize(100, 100)).not.toThrow();
        expect(engine.isRunning()).toBe(false);
        expect(engine.getScene()).toBeNull();
    });

    it('stop() called multiple times should not crash', () => {
        const engine = new Engine();
        expect(() => {
            engine.stop();
            engine.stop();
            engine.stop();
        }).not.toThrow();
    });

    it('pause() when not running should not crash', () => {
        const engine = new Engine();
        expect(() => engine.pause()).not.toThrow();
    });

    it('resume() when not paused should not crash', () => {
        const engine = new Engine();
        expect(() => engine.resume()).not.toThrow();
    });
});

// ---------------------------------------------------------------------------
// 2. Scene add / remove / find edge cases
// ---------------------------------------------------------------------------
describe('Scene error handling', () => {
    it('add null/undefined object should handle gracefully', () => {
        const scene = new Scene('Test');
        expect(() => scene.add(null as unknown as ISceneObject)).not.toThrow();
        expect(() => scene.add(undefined as unknown as ISceneObject)).not.toThrow();
        // Pending additions of invalid objects should not crash on update
        expect(() => scene.update(0.016)).not.toThrow();
    });

    it('remove object that was never added should not crash', () => {
        const scene = new Scene('Test');
        const obj = new GameObject('NotAdded');
        expect(() => scene.remove(obj)).not.toThrow();
    });

    it('remove null/undefined object should not crash', () => {
        const scene = new Scene('Test');
        expect(() => scene.remove(null as unknown as ISceneObject)).not.toThrow();
        expect(() => scene.remove(undefined as unknown as ISceneObject)).not.toThrow();
    });

    it('findByName with nonexistent name returns null', () => {
        const scene = new Scene('Test');
        expect(scene.findByName('DoesNotExist')).toBeNull();
    });

    it('findByTag with nonexistent tag returns empty array', () => {
        const scene = new Scene('Test');
        expect(scene.findByTag('nope')).toEqual([]);
    });

    it('clear on empty scene should not crash', () => {
        const scene = new Scene('Test');
        expect(() => scene.clear()).not.toThrow();
    });

    it('destroy on empty scene should not crash', () => {
        const scene = new Scene('Test');
        expect(() => scene.destroy()).not.toThrow();
    });

    it('update with negative deltaTime should not crash', () => {
        const scene = new Scene('Test');
        const obj = new GameObject('Obj');
        scene.add(obj);
        scene.update(0.016); // process add
        expect(() => scene.update(-1)).not.toThrow();
    });
});

// ---------------------------------------------------------------------------
// 3. GameObject hierarchy & component edge cases
// ---------------------------------------------------------------------------
describe('GameObject error handling', () => {
    it('setParent to self should handle gracefully (no infinite loop)', () => {
        const obj = new GameObject('Self');
        expect(() => obj.setParent(obj)).not.toThrow();
        // update should not loop forever (timeout will catch if it does)
        expect(() => obj.update(0.016)).not.toThrow();
    });

    it('removeComponent that does not exist should not crash', () => {
        const obj = new GameObject('Obj');
        const fakeComponent: IComponent = {
            gameObject: null,
            enabled: true,
            awake() {},
            start() {},
            update() {},
            destroy() {}
        };
        expect(() => obj.removeComponent(fakeComponent)).not.toThrow();
    });

    it('getComponent for missing type returns null', () => {
        const obj = new GameObject('Obj');
        expect(obj.getComponent('NonExistentComponent')).toBeNull();
    });

    it('destroy a parent should not crash when children reference it', () => {
        const parent = new GameObject('Parent');
        const child = new GameObject('Child');
        child.setParent(parent);
        expect(() => parent.destroy()).not.toThrow();
    });

    it('addChild then remove by setParent(null) should be clean', () => {
        const parent = new GameObject('Parent');
        const child = new GameObject('Child');
        parent.addChild(child);
        expect(parent.getChildren().length).toBe(1);
        child.setParent(null);
        expect(parent.getChildren().length).toBe(0);
    });

    it('findChild on object with no children returns null', () => {
        const obj = new GameObject('Solo');
        expect(obj.findChild('anything')).toBeNull();
    });

    it('clone should not share mutable state with original', () => {
        const original = new GameObject('Orig');
        original.transform.position.set(1, 2, 3);
        const cloned = original.clone();
        cloned.transform.position.set(99, 99, 99);
        expect(original.transform.position.x).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// 4. PhysicsWorld edge cases
// ---------------------------------------------------------------------------
describe('PhysicsWorld error handling', () => {
    it('raycast with zero direction vector should not crash', () => {
        const world = new PhysicsWorld();
        const origin = new Vector3(0, 0, 0);
        const zeroDir = new Vector3(0, 0, 0);
        expect(() => world.raycast(origin, zeroDir)).not.toThrow();
    });

    it('raycast on empty world returns null', () => {
        const world = new PhysicsWorld();
        const result = world.raycast(new Vector3(), new Vector3(0, 0, 1));
        expect(result).toBeNull();
    });

    it('raycastAll on empty world returns empty array', () => {
        const world = new PhysicsWorld();
        const results = world.raycastAll(new Vector3(), new Vector3(0, 0, 1));
        expect(results).toEqual([]);
    });

    it('step with negative deltaTime should not crash', () => {
        const world = new PhysicsWorld();
        expect(() => world.step(-1)).not.toThrow();
    });

    it('step with zero deltaTime should not crash', () => {
        const world = new PhysicsWorld();
        expect(() => world.step(0)).not.toThrow();
    });

    it('step with very large deltaTime should not crash (spiral of death protection)', () => {
        const world = new PhysicsWorld();
        expect(() => world.step(1000)).not.toThrow();
    });

    it('removeBody that was never added should not crash', () => {
        const world = new PhysicsWorld();
        const fakeBody = {
            shape: undefined,
            isDynamic: () => false,
            isStatic: () => true,
            getMass: () => 0,
            applyForce: () => {},
            getPosition: () => new Vector3(),
            integrate: () => {}
        };
        expect(() => world.removeBody(fakeBody)).not.toThrow();
    });

    it('clear then step should not crash', () => {
        const world = new PhysicsWorld();
        world.clear();
        expect(() => world.step(0.016)).not.toThrow();
    });

    it('dispose then calling methods should not crash', () => {
        const world = new PhysicsWorld();
        world.dispose();
        expect(world.getBodyCount()).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// 5. AnimationClip edge cases
// ---------------------------------------------------------------------------
describe('AnimationClip error handling', () => {
    it('evaluate at negative time should not crash', () => {
        const clip = new AnimationClip('Test', 2);
        const track = new AnimationTrack('target', TrackType.POSITION, InterpolationMode.LINEAR);
        track.addKeyframe(0, new Vector3(0, 0, 0));
        track.addKeyframe(2, new Vector3(10, 0, 0));
        clip.addTrack(track);

        expect(() => clip.evaluate(-1)).not.toThrow();
        const result = clip.evaluate(-1);
        expect(result).toBeDefined();
    });

    it('evaluate empty clip returns empty map', () => {
        const clip = new AnimationClip('Empty');
        const result = clip.evaluate(0);
        expect(result.size).toBe(0);
    });

    it('evaluate track with no keyframes returns null', () => {
        const track = new AnimationTrack('target', TrackType.POSITION, InterpolationMode.LINEAR);
        expect(track.evaluate(0)).toBeNull();
    });

    it('evaluate track with single keyframe at any time returns that value', () => {
        const track = new AnimationTrack('target', TrackType.POSITION, InterpolationMode.LINEAR);
        track.addKeyframe(1, new Vector3(5, 5, 5));
        const val = track.evaluate(999);
        expect(val).toBeInstanceOf(Vector3);
    });

    it('evaluate with time beyond duration should not crash', () => {
        const clip = new AnimationClip('Test', 1);
        const track = new AnimationTrack('target', TrackType.POSITION, InterpolationMode.LINEAR);
        track.addKeyframe(0, new Vector3(0, 0, 0));
        track.addKeyframe(1, new Vector3(10, 0, 0));
        clip.addTrack(track);

        expect(() => clip.evaluate(100)).not.toThrow();
    });

    it('evaluate with step interpolation at exact keyframe time', () => {
        const track = new AnimationTrack('target', TrackType.POSITION, InterpolationMode.STEP);
        track.addKeyframe(0, new Vector3(0, 0, 0));
        track.addKeyframe(1, new Vector3(10, 0, 0));
        const val = track.evaluate(1);
        expect(val).toBeInstanceOf(Vector3);
    });
});

// ---------------------------------------------------------------------------
// 6. AnimationPlayer edge cases
// ---------------------------------------------------------------------------
describe('AnimationPlayer error handling', () => {
    it('play without clip should not crash', () => {
        const player = new AnimationPlayer();
        expect(() => player.play()).not.toThrow();
        expect(player.getState()).toBe(PlaybackState.STOPPED);
    });

    it('update without clip should not crash', () => {
        const player = new AnimationPlayer();
        expect(() => player.update(0.016)).not.toThrow();
    });

    it('stop when already stopped should not crash', () => {
        const player = new AnimationPlayer();
        expect(() => player.stop()).not.toThrow();
    });

    it('seek without clip should not crash', () => {
        const player = new AnimationPlayer();
        expect(() => player.seek(5)).not.toThrow();
    });

    it('getNormalizedTime without clip returns 0', () => {
        const player = new AnimationPlayer();
        expect(player.getNormalizedTime()).toBe(0);
    });

    it('getNormalizedTime with zero-duration clip returns 0', () => {
        const player = new AnimationPlayer();
        player.setClip(new AnimationClip('ZeroDuration', 0));
        expect(player.getNormalizedTime()).toBe(0);
    });

    it('crossFadeTo with valid clip should not crash', () => {
        const player = new AnimationPlayer();
        const clip1 = new AnimationClip('A', 1);
        const clip2 = new AnimationClip('B', 1);
        player.setClip(clip1);
        player.play(PlaybackMode.LOOP);
        expect(() => player.crossFadeTo(clip2, 0.5)).not.toThrow();
        expect(() => player.update(0.016)).not.toThrow();
    });

    it('setSpeed with negative value is clamped to 0', () => {
        const player = new AnimationPlayer();
        player.setSpeed(-5);
        expect(player.getSpeed()).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// 7. EventSystem edge cases
// ---------------------------------------------------------------------------
describe('EventSystem error handling', () => {
    it('emit with no listeners should not crash', () => {
        const events = new EventSystem();
        expect(() => events.emit('nonexistent', { data: 1 })).not.toThrow();
    });

    it('off for listener that was never added should not crash', () => {
        const events = new EventSystem();
        const handler = () => {};
        expect(() => events.off('someEvent', handler)).not.toThrow();
    });

    it('offAll for event that has no listeners should not crash', () => {
        const events = new EventSystem();
        expect(() => events.offAll('noListeners')).not.toThrow();
    });

    it('clear on empty event system should not crash', () => {
        const events = new EventSystem();
        expect(() => events.clear()).not.toThrow();
    });

    it('hasListeners returns false for unknown events', () => {
        const events = new EventSystem();
        expect(events.hasListeners('nope')).toBe(false);
    });

    it('listenerCount returns 0 for unknown events', () => {
        const events = new EventSystem();
        expect(events.listenerCount('nope')).toBe(0);
    });

    it('handler that throws should not break other handlers', () => {
        const events = new EventSystem();
        const results: number[] = [];
        events.on('test', () => { throw new Error('handler error'); });
        events.on('test', () => { results.push(2); });
        expect(() => events.emit('test')).not.toThrow();
        expect(results).toContain(2);
    });

    it('once handler that throws should still be cleaned up', () => {
        const events = new EventSystem();
        events.once('test', () => { throw new Error('once error'); });
        expect(() => events.emit('test')).not.toThrow();
        expect(events.hasListeners('test')).toBe(false);
    });

    it('removing handler inside emit should not crash', () => {
        const events = new EventSystem();
        let sub: any;
        sub = events.on('test', () => { sub.unsubscribe(); });
        expect(() => events.emit('test')).not.toThrow();
    });
});

// ---------------------------------------------------------------------------
// 8. Vector3 operations with NaN / Infinity
// ---------------------------------------------------------------------------
describe('Vector3 NaN/Infinity handling', () => {
    it('operations with NaN should not throw', () => {
        const v = new Vector3(NaN, NaN, NaN);
        expect(() => v.add(new Vector3(1, 2, 3))).not.toThrow();
        expect(() => v.subtract(new Vector3(1, 2, 3))).not.toThrow();
        expect(() => v.multiplyScalar(NaN)).not.toThrow();
        expect(() => v.dot(new Vector3(1, 2, 3))).not.toThrow();
        expect(() => v.cross(new Vector3(1, 2, 3))).not.toThrow();
        expect(() => v.length()).not.toThrow();
        expect(() => v.normalize()).not.toThrow();
    });

    it('operations with Infinity should not throw', () => {
        const v = new Vector3(Infinity, -Infinity, 0);
        expect(() => v.add(new Vector3(1, 2, 3))).not.toThrow();
        expect(() => v.length()).not.toThrow();
        expect(() => v.normalize()).not.toThrow();
        expect(() => v.distanceTo(new Vector3())).not.toThrow();
    });

    it('lerp with t outside 0-1 should not crash', () => {
        const a = new Vector3(0, 0, 0);
        const b = new Vector3(10, 10, 10);
        expect(() => a.lerp(b, -1)).not.toThrow();
        expect(() => a.lerp(b, 2)).not.toThrow();
    });

    it('normalize zero vector should not crash', () => {
        const v = new Vector3(0, 0, 0);
        expect(() => v.normalize()).not.toThrow();
        const n = v.normalize();
        expect(n.x).toBe(0);
        expect(n.y).toBe(0);
        expect(n.z).toBe(0);
    });

    it('divideScalar by zero should not crash', () => {
        const v = new Vector3(1, 2, 3);
        expect(() => v.divideScalar(0)).not.toThrow();
    });
});

// ---------------------------------------------------------------------------
// 9. Matrix4 edge cases
// ---------------------------------------------------------------------------
describe('Matrix4 error handling', () => {
    it('invert singular (all zeros) matrix returns identity', () => {
        const m = new Matrix4(new Array(16).fill(0));
        const inv = m.invert();
        expect(inv).toBeDefined();
        // Should return identity since matrix is not invertible
        const identity = Matrix4.identity();
        expect(inv.equals(identity, 1e-6)).toBe(true);
    });

    it('determinant of zero matrix is 0', () => {
        const m = new Matrix4(new Array(16).fill(0));
        expect(m.determinant()).toBe(0);
    });

    it('perspective with zero aspect should not crash', () => {
        expect(() => Matrix4.perspective(Math.PI / 4, 0, 0.1, 1000)).not.toThrow();
    });

    it('perspective with near == far should not crash', () => {
        expect(() => Matrix4.perspective(Math.PI / 4, 1.5, 1, 1)).not.toThrow();
    });

    it('orthographic with degenerate dimensions should not crash', () => {
        expect(() => Matrix4.orthographic(0, 0, 0, 0, 0, 0)).not.toThrow();
    });

    it('lookAt with eye == target should not crash', () => {
        const pos = new Vector3(0, 0, 0);
        expect(() => Matrix4.lookAt(pos, pos, Vector3.up())).not.toThrow();
    });

    it('multiply with identity should return same matrix', () => {
        const m = Matrix4.rotationY(Math.PI / 4);
        const result = m.multiply(Matrix4.identity());
        expect(result.equals(m, 1e-6)).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// 10. Camera edge cases
// ---------------------------------------------------------------------------
describe('Camera error handling', () => {
    it('aspect ratio 0 should not crash', () => {
        const camera = new Camera();
        expect(() => camera.setPerspective(Math.PI / 4, 0, 0.1, 1000)).not.toThrow();
        expect(() => camera.getProjectionMatrix()).not.toThrow();
    });

    it('negative FOV should not crash', () => {
        const camera = new Camera();
        expect(() => camera.setPerspective(-1, 1.5, 0.1, 1000)).not.toThrow();
        expect(() => camera.getProjectionMatrix()).not.toThrow();
    });

    it('near == far should not crash', () => {
        const camera = new Camera();
        expect(() => camera.setPerspective(Math.PI / 4, 1.5, 1, 1)).not.toThrow();
        expect(() => camera.getProjectionMatrix()).not.toThrow();
    });

    it('getViewProjectionMatrix should not crash on default camera', () => {
        const camera = new Camera();
        expect(() => camera.getViewProjectionMatrix()).not.toThrow();
    });

    it('screenToWorldRay should not crash', () => {
        const camera = new Camera();
        expect(() => camera.screenToWorldRay(0.5, 0.5)).not.toThrow();
    });

    it('clone should produce independent camera', () => {
        const camera = new Camera();
        camera.setPosition(new Vector3(1, 2, 3));
        const cloned = camera.clone();
        cloned.setPosition(new Vector3(99, 99, 99));
        expect(camera.getPosition().x).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// 11. Quaternion edge cases
// ---------------------------------------------------------------------------
describe('Quaternion error handling', () => {
    it('normalize zero quaternion should not crash', () => {
        const q = new Quaternion(0, 0, 0, 0);
        expect(() => q.normalize()).not.toThrow();
    });

    it('invert zero quaternion should not crash', () => {
        const q = new Quaternion(0, 0, 0, 0);
        expect(() => q.invert()).not.toThrow();
    });

    it('slerp at t=0 and t=1 returns endpoints', () => {
        const a = Quaternion.identity();
        const b = Quaternion.fromEuler(0, Math.PI / 2, 0);
        const atZero = a.slerp(b, 0);
        const atOne = a.slerp(b, 1);
        expect(atZero.equals(a, 1e-6)).toBe(true);
        expect(atOne.equals(b, 1e-6)).toBe(true);
    });

    it('fromAxisAngle with zero vector should not crash', () => {
        expect(() => Quaternion.fromAxisAngle(new Vector3(0, 0, 0), Math.PI)).not.toThrow();
    });

    it('toEuler and back should be consistent', () => {
        const original = Quaternion.fromEuler(0.1, 0.2, 0.3);
        const euler = original.toEuler();
        const roundTrip = Quaternion.fromEuler(euler.x, euler.y, euler.z);
        expect(Math.abs(original.dot(roundTrip))).toBeCloseTo(1, 4);
    });
});

// ---------------------------------------------------------------------------
// 12. Multiple rapid scene changes (stress test)
// ---------------------------------------------------------------------------
describe('Rapid scene changes', () => {
    it('adding and removing many objects rapidly should not crash', () => {
        const scene = new Scene('Stress');
        const objects: GameObject[] = [];

        // Add 100 objects
        for (let i = 0; i < 100; i++) {
            const obj = new GameObject(`Obj${i}`);
            scene.add(obj);
            objects.push(obj);
        }

        // Process additions
        scene.update(0.016);
        expect(scene.getObjectCount()).toBe(100);

        // Remove half
        for (let i = 0; i < 50; i++) {
            scene.remove(objects[i]);
        }

        // Add more while removals are pending
        for (let i = 0; i < 20; i++) {
            scene.add(new GameObject(`New${i}`));
        }

        // Process everything
        scene.update(0.016);
        expect(scene.getObjectCount()).toBe(70);
    });

    it('repeatedly setting scene on engine should not crash', () => {
        const engine = new Engine();
        for (let i = 0; i < 10; i++) {
            const scene = new Scene(`Scene${i}`);
            expect(() => engine.setScene(scene)).not.toThrow();
        }
        engine.destroy();
    });

    it('deeply nested hierarchy should not crash on update', () => {
        const root = new GameObject('Root');
        let current = root;
        for (let i = 0; i < 50; i++) {
            const child = new GameObject(`Depth${i}`);
            child.setParent(current);
            current = child;
        }
        expect(() => root.update(0.016)).not.toThrow();
    });

    it('destroy deeply nested hierarchy should not crash', () => {
        const root = new GameObject('Root');
        let current = root;
        for (let i = 0; i < 50; i++) {
            const child = new GameObject(`Depth${i}`);
            child.setParent(current);
            current = child;
        }
        expect(() => root.destroy()).not.toThrow();
    });
});
