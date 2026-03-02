/**
 * WebForge Stability & Lifecycle Tests
 * Simulates real-user workflows with the WebForge facade and Engine.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
    WebForge,
    Engine,
    EngineState,
    Scene,
    GameObject,
    Vector3,
    PhysicsWorld,
} from '../src/index';

// ============================================================
// 1. Full lifecycle: create → init → scene → objects → start → stop → dispose
// ============================================================
describe('Scenario 1: Full engine lifecycle', () => {
    it('should complete full lifecycle without crashes', async () => {
        const wf = new WebForge({ headless: true, physics: false });
        await wf.initialize();

        const scene = wf.createScene('TestScene');
        expect(scene).toBeDefined();
        expect(scene.name).toBe('TestScene');

        const obj1 = wf.createGameObject('Player');
        const obj2 = wf.createGameObject('Enemy');
        const obj3 = wf.createGameObject('Terrain');
        expect(obj1.name).toBe('Player');
        expect(obj2.name).toBe('Enemy');
        expect(obj3.name).toBe('Terrain');

        // Scene uses deferred addition — objects are queued until update() flushes them
        scene.update(0);
        expect(scene.getObjectCount()).toBe(3);

        await wf.start();
        expect(wf.isRunning).toBe(true);

        wf.stop();
        expect(wf.isRunning).toBe(false);

        wf.dispose();
        expect(wf.isInitialized).toBe(false);
    });
});

// ============================================================
// 2. Set positions with Vector3, verify persistence
// ============================================================
describe('Scenario 2: GameObject position persistence', () => {
    it('should persist positions set via Vector3', () => {
        const obj = new GameObject('Mover');
        obj.transform.position.set(10, 20, 30);

        expect(obj.transform.position.x).toBe(10);
        expect(obj.transform.position.y).toBe(20);
        expect(obj.transform.position.z).toBe(30);
    });

    it('should persist position set via constructor Vector3', () => {
        const obj = new GameObject('Mover2');
        obj.transform.position = new Vector3(5, -3, 7.5);

        expect(obj.transform.position.x).toBe(5);
        expect(obj.transform.position.y).toBe(-3);
        expect(obj.transform.position.z).toBe(7.5);
    });

    it('should retain position after adding to scene', () => {
        const scene = new Scene('PosScene');
        const obj = new GameObject('Placed');
        obj.transform.position.set(100, 200, 300);

        scene.add(obj);

        expect(obj.transform.position.x).toBe(100);
        expect(obj.transform.position.y).toBe(200);
        expect(obj.transform.position.z).toBe(300);

        scene.destroy();
    });
});

// ============================================================
// 3. Parent-child hierarchy
// ============================================================
describe('Scenario 3: Parent-child hierarchy', () => {
    it('should set parent when addChild is called', () => {
        const parent = new GameObject('Parent');
        const child = new GameObject('Child');

        parent.addChild(child);

        expect(child.getParent()).toBe(parent);
        expect(parent.getChildren()).toContain(child);
    });

    it('should support multi-level hierarchy', () => {
        const grandparent = new GameObject('Grandparent');
        const parentObj = new GameObject('Parent');
        const child = new GameObject('Child');

        grandparent.addChild(parentObj);
        parentObj.addChild(child);

        expect(parentObj.getParent()).toBe(grandparent);
        expect(child.getParent()).toBe(parentObj);
        expect(grandparent.getChildren()).toContain(parentObj);
        expect(parentObj.getChildren()).toContain(child);
    });

    it('should allow removing child from parent', () => {
        const parent = new GameObject('Parent');
        const child = new GameObject('Child');

        parent.addChild(child);
        expect(child.getParent()).toBe(parent);

        parent.removeChild(child);
        expect(child.getParent()).toBeNull();
    });
});

// ============================================================
// 4. Scene.update(deltaTime) with no crashes
// ============================================================
describe('Scenario 4: Scene update with objects', () => {
    it('should call scene.update(deltaTime) without crashing', () => {
        const scene = new Scene('UpdateScene');
        const obj1 = new GameObject('A');
        const obj2 = new GameObject('B');
        scene.add(obj1);
        scene.add(obj2);

        // Should not throw
        expect(() => scene.update(0.016)).not.toThrow();
        expect(() => scene.update(0.033)).not.toThrow();

        scene.destroy();
    });

    it('should update an empty scene without error', () => {
        const scene = new Scene('Empty');
        expect(() => scene.update(0.016)).not.toThrow();
        scene.destroy();
    });
});

// ============================================================
// 5. Auto-initialize when start() called without initialize()
// ============================================================
describe('Scenario 5: Auto-initialize on start()', () => {
    it('should auto-initialize when start() is called without initialize()', async () => {
        const wf = new WebForge({ headless: true, physics: false });
        expect(wf.isInitialized).toBe(false);

        await wf.start();
        expect(wf.isInitialized).toBe(true);
        expect(wf.isRunning).toBe(true);

        wf.stop();
        wf.dispose();
    });
});

// ============================================================
// 6. Create WebForge twice in succession, no collision
// ============================================================
describe('Scenario 6: Multiple WebForge instances', () => {
    it('should create two WebForge instances without collision', async () => {
        const wf1 = new WebForge({ headless: true, physics: false });
        await wf1.initialize();
        const scene1 = wf1.createScene('Scene1');

        const wf2 = new WebForge({ headless: true, physics: false });
        await wf2.initialize();
        const scene2 = wf2.createScene('Scene2');

        expect(scene1.name).toBe('Scene1');
        expect(scene2.name).toBe('Scene2');

        // They should be independent instances
        expect(wf1.scene).not.toBe(wf2.scene);

        wf1.dispose();
        wf2.dispose();
    });
});

// ============================================================
// 7. Pause/resume cycle
// ============================================================
describe('Scenario 7: Pause/resume cycle', () => {
    it('should correctly pause and resume the engine', async () => {
        const wf = new WebForge({ headless: true, physics: false });
        await wf.start();
        expect(wf.isRunning).toBe(true);
        expect(wf.isPaused).toBe(false);

        wf.pause();
        expect(wf.isPaused).toBe(true);
        expect(wf.isRunning).toBe(false);

        wf.resume();
        expect(wf.isRunning).toBe(true);
        expect(wf.isPaused).toBe(false);

        wf.stop();
        wf.dispose();
    });

    it('should support multiple pause/resume cycles', async () => {
        const wf = new WebForge({ headless: true, physics: false });
        await wf.start();

        for (let i = 0; i < 5; i++) {
            wf.pause();
            expect(wf.isPaused).toBe(true);
            wf.resume();
            expect(wf.isRunning).toBe(true);
        }

        wf.stop();
        wf.dispose();
    });
});

// ============================================================
// 8. Scene switching
// ============================================================
describe('Scenario 8: Scene switching', () => {
    it('should switch between two scenes', async () => {
        const wf = new WebForge({ headless: true, physics: false });
        await wf.initialize();

        const sceneA = wf.createScene('SceneA');
        expect(wf.scene!.name).toBe('SceneA');

        const objA = wf.createGameObject('ObjInA');
        sceneA.update(0); // flush deferred additions
        expect(sceneA.getObjectCount()).toBe(1);

        // Create a second scene and switch to it
        const sceneB = wf.createScene('SceneB');
        expect(wf.scene!.name).toBe('SceneB');

        const objB = wf.createGameObject('ObjInB');
        sceneB.update(0); // flush deferred additions
        expect(sceneB.getObjectCount()).toBe(1);

        // Verify SceneA still has its object
        expect(sceneA.getObjectCount()).toBe(1);
        expect(sceneA.findByName('ObjInA')).toBeTruthy();

        // Verify SceneB has its object
        expect(sceneB.findByName('ObjInB')).toBeTruthy();

        wf.dispose();
    });

    it('should allow switching back via engine.setScene', async () => {
        const wf = new WebForge({ headless: true, physics: false });
        await wf.initialize();

        const sceneA = new Scene('Alpha');
        const sceneB = new Scene('Beta');

        wf.engine.setScene(sceneA);
        expect(wf.engine.getScene()!.name).toBe('Alpha');

        wf.engine.setScene(sceneB);
        expect(wf.engine.getScene()!.name).toBe('Beta');

        // Switch back to A
        wf.engine.setScene(sceneA);
        expect(wf.engine.getScene()!.name).toBe('Alpha');

        wf.dispose();
    });
});

// ============================================================
// 9. Resize engine
// ============================================================
describe('Scenario 9: Engine resize', () => {
    it('should resize engine dimensions', async () => {
        const wf = new WebForge({ headless: true, physics: false, width: 800, height: 600 });
        await wf.initialize();

        expect(wf.engine.width).toBe(800);
        expect(wf.engine.height).toBe(600);

        wf.resize(1920, 1080);

        expect(wf.engine.width).toBe(1920);
        expect(wf.engine.height).toBe(1080);

        wf.dispose();
    });

    it('should resize via engine directly', () => {
        const engine = new Engine({ width: 640, height: 480 });

        expect(engine.width).toBe(640);
        expect(engine.height).toBe(480);

        engine.resize(1280, 720);
        expect(engine.width).toBe(1280);
        expect(engine.height).toBe(720);

        engine.destroy();
    });
});

// ============================================================
// 10. Physics world created when config.physics=true
// ============================================================
describe('Scenario 10: Physics world creation', () => {
    it('should create physics world when physics=true', async () => {
        const wf = new WebForge({ headless: true, physics: true });
        await wf.initialize();

        expect(wf.physics).toBeDefined();
        expect(wf.physics).toBeInstanceOf(PhysicsWorld);

        wf.dispose();
    });

    it('should NOT create physics world when physics=false', async () => {
        const wf = new WebForge({ headless: true, physics: false });
        await wf.initialize();

        expect(wf.physics).toBeNull();

        wf.dispose();
    });

    it('should create physics world by default (physics defaults to true)', async () => {
        const wf = new WebForge({ headless: true });
        await wf.initialize();

        expect(wf.physics).toBeDefined();
        expect(wf.physics).toBeInstanceOf(PhysicsWorld);

        wf.dispose();
    });
});
