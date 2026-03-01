/**
 * Deep Integration Stress Tests for WebForge
 *
 * Tests COMPLETE USER WORKFLOWS end-to-end across all major subsystems.
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';

// Core
import { WebForge } from '../src/WebForge';
import { Engine, EngineState } from '../src/core/Engine';
import { EventSystem } from '../src/core/EventSystem';
import { Input } from '../src/core/Input';
import { Time } from '../src/core/Time';
import { InputActionMap, InputBindingType } from '../src/core/InputActionMap';

// Scene
import { Scene } from '../src/scene/Scene';
import { GameObject, IComponent } from '../src/scene/GameObject';
import { SceneSerializer, ComponentRegistry } from '../src/scene/SceneSerializer';

// Math
import { Vector3 } from '../src/math/Vector3';
import { Matrix4 } from '../src/math/Matrix4';
import { Quaternion } from '../src/math/Quaternion';
import { Transform } from '../src/math/Transform';

// Physics
import { PhysicsWorld } from '../src/physics/PhysicsWorld';
import { RigidBody, RigidBodyType } from '../src/physics/RigidBody';

// Animation
import { AnimationClip, AnimationTrack, TrackType, InterpolationMode } from '../src/animation/AnimationClip';
import { AnimationPlayer, PlaybackMode, PlaybackState } from '../src/animation/AnimationPlayer';

// Rendering
import { Camera } from '../src/rendering/Camera';

// ---------- helpers ----------

function createMockCanvas(width = 800, height = 600): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const noop = () => {};
    const ctx2d = {
        canvas,
        save: noop, restore: noop, beginPath: noop, closePath: noop,
        moveTo: noop, lineTo: noop, arc: noop, fill: noop, stroke: noop,
        fillRect: noop, clearRect: noop, strokeRect: noop,
        fillText: noop, measureText: () => ({ width: 10 }),
        setTransform: noop, translate: noop, rotate: noop, scale: noop,
        createLinearGradient: () => ({ addColorStop: noop }),
        createRadialGradient: () => ({ addColorStop: noop }),
        drawImage: noop, getImageData: () => ({ data: new Uint8ClampedArray(4) }),
        putImageData: noop, clip: noop, rect: noop, quadraticCurveTo: noop,
        bezierCurveTo: noop, arcTo: noop, isPointInPath: () => false,
        font: '', fillStyle: '', strokeStyle: '', lineWidth: 1,
        globalAlpha: 1, textAlign: 'left', textBaseline: 'top',
        shadowColor: '', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0,
        lineCap: 'butt', lineJoin: 'miter',
    };
    canvas.getContext = ((type: string) => (type === '2d' ? ctx2d : null)) as any;
    return canvas;
}

/** Create a class-based IComponent with a unique constructor name for getComponent lookups */
function createTrackedComponentClass(name: string) {
    // Each call creates a new class with a unique name
    const cls = { [name]: class implements IComponent {
        gameObject: GameObject | null = null;
        enabled = true;
        calls: string[] = [];
        updateCount = 0;
        lastDelta = 0;
        awake() { this.calls.push('awake'); }
        start() { this.calls.push('start'); }
        update(dt: number) { this.calls.push('update'); this.updateCount++; this.lastDelta = dt; }
        destroy() { this.calls.push('destroy'); }
    }}[name];
    return new cls();
}

/** Shorthand alias */
function createTrackedComponent(name: string) {
    return createTrackedComponentClass(name);
}

// ========================================================================
// 1. Full game setup workflow
// ========================================================================
describe('Workflow 1: Full game setup lifecycle', () => {
    it('should create → init → scene → objects → start → update 100 frames → stop → dispose', async () => {
        const wf = new WebForge({ headless: true, physics: false });
        await wf.initialize();
        expect(wf.isInitialized).toBe(true);

        const scene = wf.createScene('TestLevel');
        expect(scene).toBeDefined();
        expect(scene.name).toBe('TestLevel');

        // Add 10 objects with distinct transforms
        const objects: GameObject[] = [];
        for (let i = 0; i < 10; i++) {
            const go = wf.createGameObject(`Object_${i}`);
            go.transform.position.set(i * 2, i, -i);
            go.transform.rotation = Quaternion.fromEuler(0, i * 0.3, 0);
            go.transform.scale.set(1 + i * 0.1, 1 + i * 0.1, 1 + i * 0.1);
            objects.push(go);
        }
        // Flush pending additions (scene uses deferred add)
        scene.update(0);
        expect(scene.getObjectCount()).toBe(10);

        await wf.start();
        expect(wf.isRunning).toBe(true);

        // Simulate 100 update frames
        for (let f = 0; f < 100; f++) {
            scene.update(1 / 60);
        }

        // Verify objects still in scene
        for (let i = 0; i < 10; i++) {
            const found = scene.findByName(`Object_${i}`);
            expect(found).not.toBeNull();
            expect(objects[i].transform.position.x).toBeCloseTo(i * 2, 5);
        }

        wf.stop();
        expect(wf.isRunning).toBe(false);

        wf.dispose();
    });
});

// ========================================================================
// 2. Physics gameplay workflow
// ========================================================================
describe('Workflow 2: Physics gameplay simulation', () => {
    it('should simulate dynamic body falling while static body remains fixed over 500 steps', () => {
        const world = new PhysicsWorld({
            gravity: new Vector3(0, -9.81, 0),
            fixedTimestep: 1 / 60,
        });

        // Dynamic body at height 100
        const dynamic = new RigidBody({ type: RigidBodyType.DYNAMIC, mass: 1 });
        dynamic.setPosition(new Vector3(0, 100, 0));

        // Static body (floor)
        const floor = new RigidBody({ type: RigidBodyType.STATIC, mass: 0 });
        floor.setPosition(new Vector3(0, 0, 0));

        world.addBody(dynamic);
        world.addBody(floor);
        expect(world.getBodyCount()).toBe(2);

        const initialDynamicY = dynamic.getPosition().y;
        const initialFloorY = floor.getPosition().y;

        // Run 500 physics steps
        for (let s = 0; s < 500; s++) {
            world.step(1 / 60);
        }

        // Dynamic body should have fallen
        expect(dynamic.getPosition().y).toBeLessThan(initialDynamicY);

        // Static body should not have moved
        expect(floor.getPosition().y).toBeCloseTo(initialFloorY, 5);
        expect(floor.getPosition().x).toBeCloseTo(0, 5);
        expect(floor.getPosition().z).toBeCloseTo(0, 5);

        // Dynamic body still responds
        expect(dynamic.isDynamic()).toBe(true);
        expect(floor.isStatic()).toBe(true);

        world.dispose();
    });

    it('should apply force and impulse to bodies', () => {
        const world = new PhysicsWorld({ gravity: new Vector3(0, 0, 0) });
        const body = new RigidBody({ type: RigidBodyType.DYNAMIC, mass: 2 });
        body.setPosition(new Vector3(0, 0, 0));
        world.addBody(body);

        body.applyForce(new Vector3(100, 0, 0));
        for (let s = 0; s < 60; s++) {
            world.step(1 / 60);
        }
        // Body should have moved along x
        expect(body.getPosition().x).toBeGreaterThan(0);

        world.dispose();
    });
});

// ========================================================================
// 3. Animation workflow
// ========================================================================
describe('Workflow 3: Animation clip creation and playback', () => {
    it('should create clip with multiple tracks, play, and interpolate correctly', () => {
        // Build a clip with position and scale tracks
        const clip = new AnimationClip('WalkCycle', 2.0);

        const posTrack = new AnimationTrack('root', TrackType.POSITION, InterpolationMode.LINEAR);
        posTrack.addKeyframe(0, new Vector3(0, 0, 0));
        posTrack.addKeyframe(1, new Vector3(5, 0, 0));
        posTrack.addKeyframe(2, new Vector3(10, 0, 0));
        clip.addTrack(posTrack);

        const scaleTrack = new AnimationTrack('root', TrackType.SCALE, InterpolationMode.LINEAR);
        scaleTrack.addKeyframe(0, new Vector3(1, 1, 1));
        scaleTrack.addKeyframe(2, new Vector3(2, 2, 2));
        clip.addTrack(scaleTrack);

        expect(clip.tracks.length).toBe(2);
        expect(clip.getDuration()).toBeCloseTo(2.0, 5);

        // Create player and play
        const player = new AnimationPlayer();
        player.setClip(clip);
        player.play(PlaybackMode.ONCE);
        expect(player.getState()).toBe(PlaybackState.PLAYING);
        expect(player.isPlaying()).toBe(true);

        // Advance to t=0.5 (25% of 2s clip)
        player.update(0.5);
        expect(player.getTime()).toBeCloseTo(0.5, 3);

        // Evaluate the clip at t=0.5 → position should be interpolated to (2.5, 0, 0)
        const result05 = clip.evaluate(0.5);
        const posVal = result05.get('root');
        expect(posVal).toBeDefined();
        const posAtHalf = posVal!.get(TrackType.POSITION);
        expect(posAtHalf).toBeDefined();
        // Between (0,0,0) and (5,0,0) at t=0.5 → linear interp = (2.5,0,0)
        expect(posAtHalf.x).toBeCloseTo(2.5, 2);

        // Advance 60 total frames (1 second each at 1/60)
        for (let f = 0; f < 60; f++) {
            player.update(1 / 60);
        }

        // Time should be around 0.5 + 1.0 = 1.5
        expect(player.getTime()).toBeCloseTo(1.5, 1);

        // Evaluate at t=1.5 → position between (5,0,0) and (10,0,0) → (7.5,0,0)
        const result15 = clip.evaluate(1.5);
        const posVal15 = result15.get('root')!.get(TrackType.POSITION);
        expect(posVal15.x).toBeCloseTo(7.5, 2);

        // Scale at t=1.5 → between (1,1,1) and (2,2,2) = (1.75, 1.75, 1.75)
        const scaleVal15 = result15.get('root')!.get(TrackType.SCALE);
        expect(scaleVal15.x).toBeCloseTo(1.75, 2);
    });

    it('should support animation events', () => {
        const clip = new AnimationClip('Attack', 1.0);
        const track = new AnimationTrack('weapon', TrackType.POSITION, InterpolationMode.LINEAR);
        track.addKeyframe(0, new Vector3(0, 0, 0));
        track.addKeyframe(1, new Vector3(0, 0, 5));
        clip.addTrack(track);

        const player = new AnimationPlayer();
        player.setClip(clip);

        // Add events at specific times
        player.addEvent(0.5, 'hit', { damage: 10 });
        player.addEvent(0.8, 'sound', { clip: 'swing.wav' });
        expect(player.getAnimationEvents().length).toBe(2);

        const firedEvents: { name: string; data: any }[] = [];
        player.getEvents().on('animationEvent', (e: any) => {
            firedEvents.push({ name: e.name, data: e.data });
        });

        player.play(PlaybackMode.ONCE);
        // Advance past both events
        for (let f = 0; f < 60; f++) {
            player.update(1 / 60);
        }

        expect(firedEvents.length).toBeGreaterThanOrEqual(2);
        expect(firedEvents.some(e => e.name === 'hit')).toBe(true);
        expect(firedEvents.some(e => e.name === 'sound')).toBe(true);
    });

    it('should support looping playback', () => {
        const clip = new AnimationClip('Idle', 0.5);
        const track = new AnimationTrack('body', TrackType.POSITION, InterpolationMode.LINEAR);
        track.addKeyframe(0, new Vector3(0, 0, 0));
        track.addKeyframe(0.5, new Vector3(0, 1, 0));
        clip.addTrack(track);

        const player = new AnimationPlayer();
        player.setClip(clip);
        player.play(PlaybackMode.LOOP);

        // Play for 3 full loops (1.5 seconds)
        for (let f = 0; f < 90; f++) {
            player.update(1 / 60);
        }
        // Should still be playing (looping)
        expect(player.isPlaying()).toBe(true);
    });
});

// ========================================================================
// 4. Scene hierarchy stress
// ========================================================================
describe('Workflow 4: Scene hierarchy stress (5-level deep)', () => {
    it('should propagate transforms correctly through 5-level parent-child hierarchy', () => {
        const scene = new Scene('HierarchyTest');

        // Build chain: root → level1 → level2 → level3 → level4
        const root = new GameObject('root');
        root.transform.position.set(10, 0, 0);
        scene.add(root);

        let parent = root;
        const chain: GameObject[] = [root];
        for (let level = 1; level <= 4; level++) {
            const child = new GameObject(`level${level}`);
            child.transform.position.set(5, 0, 0); // each adds 5 in local x
            parent.addChild(child);
            chain.push(child);
            parent = child;
        }

        // World position of level4 should be 10 + 4*5 = 30
        const worldPos = chain[4].transform.getWorldPosition();
        expect(worldPos.x).toBeCloseTo(30, 3);
        expect(worldPos.y).toBeCloseTo(0, 3);

        // Apply rotation at root (must mark dirty since rotation is a public property)
        root.transform.rotation = Quaternion.fromEuler(0, Math.PI / 2, 0);
        root.transform.markLocalDirty();

        // After root rotation 90° around Y, local x becomes world z
        const rotWorldPos = chain[1].transform.getWorldPosition();
        // root at (10,0,0), level1 has local (5,0,0) rotated 90° → world = (10, 0, -5) or (10, 0, 5)
        // depending on convention; just verify it changed from (15,0,0)
        expect(Math.abs(rotWorldPos.x - 15)).toBeGreaterThan(0.1);
    });

    it('should maintain hierarchy integrity during add/remove operations', () => {
        const scene = new Scene('MutationTest');
        const parent = new GameObject('Parent');
        scene.add(parent);

        const children: GameObject[] = [];
        for (let i = 0; i < 5; i++) {
            const child = new GameObject(`Child_${i}`);
            parent.addChild(child);
            children.push(child);
        }
        expect(parent.getChildren().length).toBe(5);

        // Remove middle child
        parent.removeChild(children[2]);
        expect(parent.getChildren().length).toBe(4);
        expect(children[2].getParent()).toBeNull();

        // Re-parent child to another child
        children[0].addChild(children[4]);
        expect(children[4].getParent()).toBe(children[0]);
        expect(parent.getChildren().length).toBe(3); // lost child4
    });
});

// ========================================================================
// 5. Component system
// ========================================================================
describe('Workflow 5: Component system lifecycle', () => {
    it('should deliver awake/start/update to all components', () => {
        const go = new GameObject('Player');

        // Use Object.create trick for unique constructor names
        const compA = createTrackedComponent('CompA');
        const compB = createTrackedComponent('CompB');
        const compC = createTrackedComponent('CompC');

        go.addComponent(compA);
        go.addComponent(compB);
        go.addComponent(compC);

        expect(go.getAllComponents().length).toBe(3);

        // First update triggers awake + start + update
        go.update(1 / 60);

        for (const comp of [compA, compB, compC]) {
            expect(comp.calls).toContain('awake');
            expect(comp.calls).toContain('start');
            expect(comp.calls).toContain('update');
            expect(comp.updateCount).toBe(1);
        }

        // Subsequent updates don't re-call awake/start
        go.update(1 / 60);
        expect(compA.updateCount).toBe(2);
        expect(compA.calls.filter(c => c === 'awake').length).toBe(1);

        // Disable component stops updates
        compB.enabled = false;
        go.update(1 / 60);
        expect(compB.updateCount).toBe(2); // no increment
        expect(compA.updateCount).toBe(3); // still incrementing
    });

    it('should allow getComponent by type name', () => {
        const go = new GameObject('Test');
        const comp = createTrackedComponent('HealthComp');
        go.addComponent(comp);

        const found = go.getComponent('HealthComp');
        expect(found).toBe(comp);
        expect(go.hasComponent('HealthComp')).toBe(true);
        expect(go.hasComponent('NonExistent')).toBe(false);
    });

    it('should destroy components when GameObject is destroyed', () => {
        const go = new GameObject('Destructible');
        const comp = createTrackedComponent('DestructComp');
        go.addComponent(comp);
        go.update(1 / 60); // start lifecycle

        go.destroy();
        expect(comp.calls).toContain('destroy');
        expect(comp.gameObject).toBeNull();
    });
});

// ========================================================================
// 6. Camera + rendering setup
// ========================================================================
describe('Workflow 6: Camera setup and switching', () => {
    it('should produce different matrices for perspective vs orthographic cameras', () => {
        const camA = new Camera();
        camA.setPerspective(Math.PI / 4, 16 / 9, 0.1, 1000);
        camA.setPosition(new Vector3(0, 5, 10));
        camA.lookAt(new Vector3(0, 0, 0));

        const camB = new Camera();
        camB.setOrthographic(-10, 10, -10, 10, 0.1, 100);
        camB.setPosition(new Vector3(0, 20, 0));
        camB.lookAt(new Vector3(0, 0, 0));

        const projA = camA.getProjectionMatrix();
        const projB = camB.getProjectionMatrix();
        const viewA = camA.getViewMatrix();
        const viewB = camB.getViewMatrix();

        // Projection matrices should differ (perspective vs ortho)
        expect(projA.equals(projB)).toBe(false);

        // View matrices should differ (different positions/orientations)
        expect(viewA.equals(viewB)).toBe(false);

        // Projection types
        expect(camA.getProjectionType()).toBe('perspective');
        expect(camB.getProjectionType()).toBe('orthographic');
    });

    it('should update fov and aspect independently', () => {
        const cam = new Camera();
        cam.setPerspective(Math.PI / 3, 4 / 3, 0.1, 500);
        const proj1 = cam.getProjectionMatrix().clone();

        cam.setFov(Math.PI / 6);
        const proj2 = cam.getProjectionMatrix();
        expect(proj1.equals(proj2)).toBe(false);

        cam.setAspect(21 / 9);
        const proj3 = cam.getProjectionMatrix();
        expect(proj2.equals(proj3)).toBe(false);
    });

    it('should clone cameras with independent state', () => {
        const cam = new Camera();
        cam.setPerspective(Math.PI / 4, 16 / 9, 0.1, 1000);
        cam.setPosition(new Vector3(1, 2, 3));

        const clone = cam.clone();
        clone.setPosition(new Vector3(99, 99, 99));

        // Original unchanged
        expect(cam.getPosition().x).toBeCloseTo(1, 5);
        expect(clone.getPosition().x).toBeCloseTo(99, 5);
    });
});

// ========================================================================
// 7. Input action mapping
// ========================================================================
describe('Workflow 7: Input action mapping', () => {
    let canvas: HTMLCanvasElement;
    let input: Input;

    beforeEach(() => {
        canvas = createMockCanvas();
        input = new Input(canvas);
    });

    afterEach(() => {
        input.detach();
    });

    it('should register actions and query them', () => {
        const actionMap = new InputActionMap(input);
        actionMap.registerAction('Jump', 'button', [
            { type: InputBindingType.Keyboard, key: 'Space' },
        ]);
        actionMap.registerAction('MoveX', 'axis', [
            { type: InputBindingType.Keyboard, key: 'KeyD', scale: 1 },
            { type: InputBindingType.Keyboard, key: 'KeyA', scale: -1 },
        ]);

        expect(actionMap.getAllActions()).toContain('Jump');
        expect(actionMap.getAllActions()).toContain('MoveX');
        expect(actionMap.getActionCount()).toBe(2);

        // Without any keys pressed, action values should be 0
        expect(actionMap.getActionValue('Jump')).toBe(0);
        expect(actionMap.getActionValue('MoveX')).toBe(0);
        expect(actionMap.isActionDown('Jump')).toBe(false);
    });

    it('should support default FPS actions', () => {
        const actionMap = new InputActionMap(input);
        actionMap.createDefaultFPSActions();

        const actions = actionMap.getAllActions();
        expect(actions.length).toBeGreaterThan(0);
        // FPS defaults typically include movement and look actions
        expect(actions.some(a => a.toLowerCase().includes('forward') || a.toLowerCase().includes('move'))).toBe(true);
    });

    it('should serialize and deserialize bindings', () => {
        const actionMap = new InputActionMap(input);
        actionMap.registerAction('Fire', 'button', [
            { type: InputBindingType.MouseButton, mouseButton: 0 },
        ]);
        actionMap.registerAction('Zoom', 'axis', [
            { type: InputBindingType.MouseAxis, mouseAxis: 'wheel' },
        ]);

        const json = actionMap.exportBindings();
        expect(json).toBeDefined();
        expect(typeof json).toBe('string');

        // Import into fresh map
        const actionMap2 = new InputActionMap(input);
        actionMap2.importBindings(json);
        expect(actionMap2.getAllActions()).toContain('Fire');
        expect(actionMap2.getAllActions()).toContain('Zoom');
    });

    it('should support rebinding actions', () => {
        const actionMap = new InputActionMap(input);
        actionMap.registerAction('Jump', 'button', [
            { type: InputBindingType.Keyboard, key: 'Space' },
        ]);

        const originalBindings = actionMap.getBindings('Jump');
        expect(originalBindings[0].key).toBe('Space');

        actionMap.rebindAction('Jump', 0, { type: InputBindingType.Keyboard, key: 'KeyJ' });
        const newBindings = actionMap.getBindings('Jump');
        expect(newBindings[0].key).toBe('KeyJ');
    });
});

// ========================================================================
// 8. Full serialization roundtrip
// ========================================================================
describe('Workflow 8: Scene serialization roundtrip', () => {
    beforeEach(() => {
        ComponentRegistry.clear();
    });

    it('should serialize and deserialize a complex scene with hierarchy and tags', () => {
        const scene = new Scene('GameWorld');

        // Root object with transform
        const player = new GameObject('Player');
        player.transform.position.set(10, 0, 5);
        player.transform.rotation = Quaternion.fromEuler(0, Math.PI, 0);
        player.transform.scale.set(1, 2, 1);
        player.addTag('player');
        player.addTag('team-red');
        scene.add(player);

        // Child hierarchy
        const weapon = new GameObject('Weapon');
        weapon.transform.position.set(0.5, 1.2, 0);
        player.addChild(weapon);

        const scope = new GameObject('Scope');
        scope.transform.position.set(0, 0.1, -0.3);
        weapon.addChild(scope);

        // Another root object
        const enemy = new GameObject('Enemy');
        enemy.transform.position.set(-20, 0, 10);
        enemy.addTag('enemy');
        scene.add(enemy);

        // Flush deferred additions so objects are queryable
        scene.update(0);

        // Serialize
        const serialized = SceneSerializer.serialize(scene);
        expect(serialized.name).toBe('GameWorld');
        expect(serialized.version).toBeDefined();

        // Convert to JSON string and back
        const jsonStr = SceneSerializer.toJSON(scene);
        expect(typeof jsonStr).toBe('string');

        const restored = SceneSerializer.fromJSON(jsonStr);
        // Flush deferred additions
        restored.update(0);
        expect(restored.name).toBe('GameWorld');

        // Verify objects are restored
        const restoredPlayer = restored.findByName('Player') as GameObject;
        expect(restoredPlayer).not.toBeNull();
        expect(restoredPlayer.transform.position.x).toBeCloseTo(10, 3);
        expect(restoredPlayer.transform.position.z).toBeCloseTo(5, 3);
        expect(restoredPlayer.transform.scale.y).toBeCloseTo(2, 3);

        const restoredEnemy = restored.findByName('Enemy') as GameObject;
        expect(restoredEnemy).not.toBeNull();
        expect(restoredEnemy.transform.position.x).toBeCloseTo(-20, 3);

        // Verify hierarchy was restored
        const restoredWeapon = (restoredPlayer as GameObject).findChild('Weapon');
        expect(restoredWeapon).not.toBeNull();

        const restoredScope = restoredWeapon!.findChild('Scope');
        expect(restoredScope).not.toBeNull();
        expect(restoredScope!.transform.position.z).toBeCloseTo(-0.3, 3);
    });

    it('should clone scene via serialization', () => {
        const scene = new Scene('Original');
        const obj = new GameObject('Box');
        obj.transform.position.set(1, 2, 3);
        scene.add(obj);
        scene.update(0); // flush deferred add

        const cloned = SceneSerializer.clone(scene);
        cloned.update(0); // flush deferred add
        expect(cloned.name).toBe('Original');

        // Modify original, clone should be independent
        obj.transform.position.set(99, 99, 99);
        const clonedObj = cloned.findByName('Box') as GameObject;
        expect(clonedObj.transform.position.x).toBeCloseTo(1, 3);
    });

    it('should diff two scenes', () => {
        const sceneA = new Scene('A');
        sceneA.add(new GameObject('Shared'));
        sceneA.add(new GameObject('OnlyInA'));
        sceneA.update(0); // flush

        const sceneB = new Scene('B');
        const shared = new GameObject('Shared');
        shared.transform.position.set(99, 0, 0); // modified position
        sceneB.add(shared);
        sceneB.add(new GameObject('OnlyInB'));
        sceneB.update(0); // flush

        const diff = SceneSerializer.diff(sceneA, sceneB);
        expect(diff.added.length).toBeGreaterThanOrEqual(1);  // OnlyInB
        expect(diff.removed.length).toBeGreaterThanOrEqual(1); // OnlyInA
    });

    it('should support custom component serialization', () => {
        ComponentRegistry.register('StatsComponent', {
            serialize: (comp: any) => ({ hp: comp.hp, mp: comp.mp }),
            deserialize: (data: any) => {
                const c = createTrackedComponent('StatsComponent');
                (c as any).hp = data.hp;
                (c as any).mp = data.mp;
                return c;
            },
        });

        expect(ComponentRegistry.getRegisteredTypes()).toContain('StatsComponent');
        const serializer = ComponentRegistry.getSerializer('StatsComponent');
        expect(serializer).not.toBeNull();

        const testData = serializer!.serialize({ hp: 100, mp: 50 });
        expect(testData.hp).toBe(100);
    });
});

// ========================================================================
// 9. Event-driven game
// ========================================================================
describe('Workflow 9: Event-driven game communication', () => {
    it('should deliver events to multiple listeners in registration order', () => {
        const events = new EventSystem();
        const order: number[] = [];

        events.on('game:start', () => order.push(1));
        events.on('game:start', () => order.push(2));
        events.on('game:start', () => order.push(3));

        events.emit('game:start');

        expect(order).toEqual([1, 2, 3]);
    });

    it('should pass correct data payloads through events', () => {
        const events = new EventSystem();
        const received: any[] = [];

        events.on('damage', (data: any) => received.push(data));
        events.on('heal', (data: any) => received.push(data));

        events.emit('damage', { target: 'Player', amount: 25 });
        events.emit('heal', { target: 'Player', amount: 10 });
        events.emit('damage', { target: 'Enemy', amount: 50 });

        expect(received.length).toBe(3);
        expect(received[0]).toEqual({ target: 'Player', amount: 25 });
        expect(received[1]).toEqual({ target: 'Player', amount: 10 });
        expect(received[2]).toEqual({ target: 'Enemy', amount: 50 });
    });

    it('should support once-only listeners', () => {
        const events = new EventSystem();
        let count = 0;

        events.once('signal', () => count++);
        events.emit('signal');
        events.emit('signal');
        events.emit('signal');

        expect(count).toBe(1);
    });

    it('should support unsubscription', () => {
        const events = new EventSystem();
        let count = 0;
        const handler = () => count++;

        events.on('tick', handler);
        events.emit('tick');
        expect(count).toBe(1);

        events.off('tick', handler);
        events.emit('tick');
        expect(count).toBe(1); // didn't increment
    });

    it('should support namespaced events', () => {
        const events = new EventSystem();
        const ns = events.namespace('physics');

        const results: string[] = [];
        ns.on('collision', (data: any) => results.push(data.pair));

        ns.emit('collision', { pair: 'A-B' });
        expect(results).toContain('A-B');

        // Verify it's isolated via namespace prefix
        expect(ns.listenerCount('collision')).toBe(1);
    });

    it('should handle complex multi-event game scenario', () => {
        const events = new EventSystem();
        let playerHP = 100;
        let score = 0;
        let gameOver = false;

        events.on('enemy:killed', (data: any) => {
            score += data.points;
            events.emit('score:updated', { score });
        });

        events.on('player:damaged', (data: any) => {
            playerHP -= data.damage;
            if (playerHP <= 0) {
                events.emit('game:over', { score });
            }
        });

        events.on('game:over', () => { gameOver = true; });

        // Simulate gameplay
        events.emit('enemy:killed', { points: 100 });
        events.emit('enemy:killed', { points: 200 });
        expect(score).toBe(300);
        expect(gameOver).toBe(false);

        events.emit('player:damaged', { damage: 150 });
        expect(playerHP).toBe(-50);
        expect(gameOver).toBe(true);
    });
});

// ========================================================================
// 10. Multi-system integration
// ========================================================================
describe('Workflow 10: Multi-system integration', () => {
    it('should run physics + animation + scene together without interference', () => {
        // Set up scene
        const scene = new Scene('IntegrationLevel');

        // Physics world
        const world = new PhysicsWorld({ gravity: new Vector3(0, -9.81, 0) });

        // Create a physics-driven game object
        const physicsObj = new GameObject('PhysicsBox');
        physicsObj.transform.position.set(0, 50, 0);
        scene.add(physicsObj);

        const body = new RigidBody({ type: RigidBodyType.DYNAMIC, mass: 5 });
        body.setPosition(new Vector3(0, 50, 0));
        world.addBody(body);

        // Create animation
        const clip = new AnimationClip('Spin', 1.0);
        const rotTrack = new AnimationTrack('AnimObj', TrackType.ROTATION, InterpolationMode.LINEAR);
        rotTrack.addKeyframe(0, new Quaternion(0, 0, 0, 1));
        rotTrack.addKeyframe(1, Quaternion.fromAxisAngle(new Vector3(0, 1, 0), Math.PI));
        clip.addTrack(rotTrack);

        const animPlayer = new AnimationPlayer();
        animPlayer.setClip(clip);
        animPlayer.play(PlaybackMode.LOOP);

        // Create a static scene object
        const staticObj = new GameObject('Ground');
        staticObj.transform.position.set(0, 0, 0);
        scene.add(staticObj);

        // Simulate 200 frames with all systems running
        const dt = 1 / 60;
        for (let f = 0; f < 200; f++) {
            world.step(dt);
            animPlayer.update(dt);
            scene.update(dt);

            // Sync physics position to game object
            const pos = body.getPosition();
            physicsObj.transform.position.set(pos.x, pos.y, pos.z);
        }

        // Physics body should have fallen
        expect(body.getPosition().y).toBeLessThan(50);

        // Animation player should still be playing
        expect(animPlayer.isPlaying()).toBe(true);

        // Static object untouched
        expect(staticObj.transform.position.y).toBeCloseTo(0, 5);

        // Scene should still have both objects
        expect(scene.getObjectCount()).toBe(2);

        world.dispose();
        scene.destroy();
    });

    it('should handle events across systems during updates', () => {
        const events = new EventSystem();
        const scene = new Scene('EventScene');
        const world = new PhysicsWorld({ gravity: new Vector3(0, -1, 0) });

        const collisions: string[] = [];
        events.on('physics:stepped', () => collisions.push('step'));

        const body = new RigidBody({ type: RigidBodyType.DYNAMIC, mass: 1 });
        body.setPosition(new Vector3(0, 10, 0));
        world.addBody(body);

        for (let f = 0; f < 30; f++) {
            world.step(1 / 60);
            events.emit('physics:stepped');
            scene.update(1 / 60);
        }

        expect(collisions.length).toBe(30);
        expect(body.getPosition().y).toBeLessThan(10);

        world.dispose();
        scene.destroy();
    });

    it('should support full WebForge lifecycle with physics enabled', async () => {
        const wf = new WebForge({ headless: true, physics: true });
        await wf.initialize();

        const scene = wf.createScene('FullTest');
        for (let i = 0; i < 5; i++) {
            const go = wf.createGameObject(`Obj_${i}`);
            go.transform.position.set(i, i * 2, 0);
        }

        await wf.start();
        expect(wf.isRunning).toBe(true);

        // Run a few scene updates
        for (let f = 0; f < 50; f++) {
            scene.update(1 / 60);
        }

        expect(scene.getObjectCount()).toBe(5);

        wf.stop();
        wf.dispose();
    });

    it('should handle Time tracking correctly', () => {
        const time = new Time();

        // Simulate a sequence of frames (first call initializes, doesn't count as frame)
        let timestamp = 0;
        for (let f = 0; f < 121; f++) {
            timestamp += 16.67; // ~60fps in ms
            time.update(timestamp);
        }

        expect(time.frameCount).toBe(120);
        expect(time.deltaTime).toBeGreaterThan(0);
        expect(time.time).toBeGreaterThan(0);

        // Time scale
        time.timeScale = 0.5;
        const prevTime = time.time;
        time.update(timestamp + 16.67);
        expect(time.deltaTime).toBeLessThan(time.unscaledDeltaTime + 0.001);
    });

    it('should handle Transform math stress test', () => {
        const transforms: Transform[] = [];
        for (let i = 0; i < 100; i++) {
            const t = new Transform(
                new Vector3(Math.random() * 100, Math.random() * 100, Math.random() * 100),
                Quaternion.fromEuler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI),
                new Vector3(1, 1, 1)
            );
            transforms.push(t);
        }

        // Chain parent-child
        for (let i = 1; i < transforms.length; i++) {
            transforms[i].setParent(transforms[i - 1]);
        }

        // Getting world matrix of deep child should not crash
        const deepWorldMatrix = transforms[99].getWorldMatrix();
        expect(deepWorldMatrix).toBeDefined();
        expect(deepWorldMatrix.elements.length).toBe(16);

        // World position should be computable
        const worldPos = transforms[99].getWorldPosition();
        expect(typeof worldPos.x).toBe('number');
        expect(isFinite(worldPos.x)).toBe(true);
    });

    it('should handle rapid create/destroy cycles', () => {
        const scene = new Scene('StressScene');

        for (let cycle = 0; cycle < 50; cycle++) {
            const objects: GameObject[] = [];
            for (let i = 0; i < 20; i++) {
                const go = new GameObject(`Cycle${cycle}_Obj${i}`);
                scene.add(go);
                objects.push(go);
            }
            scene.update(1 / 60); // flush additions and run update

            for (const obj of objects) {
                scene.remove(obj);
            }
            scene.update(1 / 60); // flush removals

            for (const obj of objects) {
                obj.destroy();
            }
        }

        expect(scene.getObjectCount()).toBe(0);
        scene.destroy();
    });
});
