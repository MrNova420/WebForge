/**
 * Comprehensive Integration Tests for WebForge
 * Tests all major systems working together
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Core imports
import { Vector3 } from '../src/math/Vector3';
import { Matrix4 } from '../src/math/Matrix4';
import { Quaternion } from '../src/math/Quaternion';
import { EventSystem } from '../src/core/EventSystem';
import { Logger } from '../src/core/Logger';
import { Time } from '../src/core/Time';

// Debug imports
import {
    DebugManager,
    BreakpointManager,
    WatchSystem,
    CallStackTracker,
    StateInspector,
    TimelineProfiler,
    ErrorTracker,
    DebugConsole,
    DebugDraw
} from '../src/debug';

describe('Integration Tests', () => {
    describe('Math System Integration', () => {
        it('should perform vector transformations with matrix', () => {
            // Create transformation matrix - translation takes Vector3
            const matrix = Matrix4.translation(new Vector3(10, 5, -3));

            // Transform a point using multiplyVector3
            const point = new Vector3(1, 0, 0);
            const transformed = matrix.multiplyVector3(point);

            // Verify translation happened
            expect(transformed.x).toBeCloseTo(11);
            expect(transformed.y).toBeCloseTo(5);
            expect(transformed.z).toBeCloseTo(-3);
        });

        it('should handle quaternion rotations', () => {
            const q = Quaternion.fromEuler(Math.PI / 2, 0, 0); // 90 degree X rotation
            const v = new Vector3(0, 1, 0); // Up vector

            // Rotate up vector by 90 degrees around X using multiplyVector
            const rotated = q.multiplyVector(v);

            // Should now point roughly in Z direction
            expect(Math.abs(rotated.y)).toBeLessThan(0.01);
            expect(Math.abs(rotated.z)).toBeCloseTo(1, 1);
        });

        it('should multiply matrices correctly', () => {
            const translation = Matrix4.translation(new Vector3(5, 0, 0));
            const scaling = Matrix4.scaling(new Vector3(2, 2, 2));

            // Combine transformations
            const combined = translation.clone().multiplySelf(scaling);

            // Apply to a point using multiplyVector3
            const point = new Vector3(1, 0, 0);
            const result = combined.multiplyVector3(point);

            // Should be scaled then translated
            expect(result.length()).toBeGreaterThan(1);
        });

        it('should invert matrices', () => {
            const matrix = Matrix4.translation(new Vector3(10, 20, 30));
            const inverse = matrix.clone().invert();

            // Verify inversion by applying both transforms to a point
            const point = new Vector3(0, 0, 0);
            const transformed = matrix.multiplyVector3(point);
            const back = inverse.multiplyVector3(transformed);

            // Should get back to original
            expect(back.x).toBeCloseTo(0, 5);
            expect(back.y).toBeCloseTo(0, 5);
            expect(back.z).toBeCloseTo(0, 5);
        });
    });

    describe('Event System Integration', () => {
        let events: EventSystem;

        beforeEach(() => {
            events = new EventSystem();
        });

        it('should handle event chains', () => {
            const order: string[] = [];

            events.on('start', () => {
                order.push('start');
                events.emit('process');
            });

            events.on('process', () => {
                order.push('process');
                events.emit('complete');
            });

            events.on('complete', () => {
                order.push('complete');
            });

            events.emit('start');

            expect(order).toEqual(['start', 'process', 'complete']);
        });

        it('should handle typed events with data', () => {
            interface GameEvent {
                player: string;
                score: number;
            }

            let receivedData: GameEvent | null = null;

            events.on('score', (data: GameEvent) => {
                receivedData = data;
            });

            events.emit('score', { player: 'Player1', score: 100 });

            expect(receivedData).not.toBeNull();
            expect(receivedData!.player).toBe('Player1');
            expect(receivedData!.score).toBe(100);
        });
    });

    describe('Debug System Full Integration', () => {
        let debugManager: DebugManager;

        beforeEach(() => {
            debugManager = new DebugManager({
                enabled: true,
                enableBreakpoints: true,
                enableWatches: true,
                enableCallStack: true,
                enableTimeline: true,
                enableErrorTracking: true,
                keyboardShortcuts: false // Disable for testing
            });
        });

        afterEach(() => {
            debugManager.shutdown();
        });

        it('should track game loop frames', () => {
            // Simulate 10 frames
            for (let i = 0; i < 10; i++) {
                debugManager.beginFrame();
                // Simulate work
                debugManager.endFrame();
            }

            expect(debugManager.breakpoints.getFrameNumber()).toBe(10);
        });

        it('should watch values and detect changes', () => {
            let health = 100;
            const watch = debugManager.watch('health', () => health);

            expect(watch.currentValue).toBe(100);

            // Change value and update
            health = 90;
            debugManager.watches.update();

            expect(watch.currentValue).toBe(90);
            expect(watch.changeCount).toBeGreaterThan(0);
        });

        it('should profile code sections', () => {
            debugManager.startRecording();

            for (let i = 0; i < 5; i++) {
                debugManager.beginFrame();

                debugManager.profile('physics', () => {
                    // Simulate physics work
                    let sum = 0;
                    for (let j = 0; j < 1000; j++) sum += j;
                    return sum;
                }, 'physics');

                debugManager.profile('render', () => {
                    // Simulate render work
                    let sum = 0;
                    for (let j = 0; j < 500; j++) sum += j;
                    return sum;
                }, 'render');

                debugManager.endFrame();
            }

            debugManager.stopRecording();

            const stats = debugManager.getTimelineStats();
            expect(stats.totalFrames).toBe(5);
        });

        it('should track function calls with profiling', () => {
            const result = debugManager.trackCall('calculateDamage', () => {
                return debugManager.trackCall('applyModifiers', () => {
                    return debugManager.trackCall('rollDice', () => {
                        return Math.floor(Math.random() * 20) + 1;
                    });
                });
            });

            expect(typeof result).toBe('number');

            const profiles = debugManager.callStack.getAllProfiles();
            expect(profiles.length).toBeGreaterThanOrEqual(3);
        });

        it('should inspect objects deeply', () => {
            const gameState = {
                player: {
                    name: 'Hero',
                    stats: {
                        health: 100,
                        mana: 50,
                        level: 5
                    },
                    inventory: ['sword', 'shield', 'potion']
                },
                enemies: [
                    { id: 1, type: 'goblin' },
                    { id: 2, type: 'orc' }
                ]
            };

            const inspected = debugManager.inspect(gameState, 'GameState');

            expect(inspected.name).toBe('GameState');
            expect(inspected.snapshot.properties.length).toBeGreaterThan(0);

            // Search for a value
            const results = debugManager.inspector.search('sword');
            expect(results.length).toBeGreaterThan(0);
        });

        it('should track and group errors', () => {
            // Track some errors
            debugManager.error(new Error('Connection failed'));
            debugManager.error(new Error('Connection failed')); // Duplicate
            debugManager.error(new Error('Invalid input'));
            debugManager.warn('Low memory');

            const stats = debugManager.errors.getStats();
            expect(stats.total).toBeGreaterThanOrEqual(3);

            const groups = debugManager.errors.getGroups();
            expect(groups.length).toBeGreaterThanOrEqual(1);
        });

        it('should create and manage breakpoints', () => {
            const bp1 = debugManager.break('onDeath');
            const bp2 = debugManager.break('onLevelUp');

            expect(debugManager.breakpoints.getBreakpoints().length).toBe(2);

            debugManager.breakpoints.setBreakpointEnabled(bp1.id, false);
            expect(bp1.enabled).toBe(false);

            debugManager.breakpoints.removeBreakpoint(bp2.id);
            expect(debugManager.breakpoints.getBreakpoints().length).toBe(1);
        });

        it('should export debug data', () => {
            // Generate some debug data
            debugManager.watch('test', () => 42);
            debugManager.error(new Error('Test error'));

            const exported = debugManager.exportData();
            const data = JSON.parse(exported);

            expect(data.snapshot).toBeDefined();
            expect(data.errors).toBeDefined();
        });
    });

    describe('Debug Draw System', () => {
        let draw: DebugDraw;

        beforeEach(() => {
            draw = new DebugDraw();
        });

        it('should create various debug primitives', () => {
            const lineId = draw.line(new Vector3(0, 0, 0), new Vector3(10, 10, 10));
            const pointId = draw.point(new Vector3(5, 5, 5));
            const boxId = draw.box(new Vector3(0, 0, 0), new Vector3(1, 1, 1));
            const sphereId = draw.sphere(new Vector3(0, 0, 0), 5);

            expect(lineId).toBeTruthy();
            expect(pointId).toBeTruthy();
            expect(boxId).toBeTruthy();
            expect(sphereId).toBeTruthy();

            const elements = draw.getElements();
            expect(elements.lines.length).toBeGreaterThan(0);
            expect(elements.points.length).toBeGreaterThan(0);
            expect(elements.boxes.length).toBeGreaterThan(0);
            expect(elements.spheres.length).toBeGreaterThan(0);
        });

        it('should draw complex shapes', () => {
            // Draw axes
            const axesIds = draw.axes(new Vector3(0, 0, 0), 5);
            expect(axesIds.length).toBeGreaterThan(0);

            // Draw grid
            const gridIds = draw.grid(new Vector3(0, 0, 0), 10, 5);
            expect(gridIds.length).toBeGreaterThan(0);

            // Draw path
            const pathIds = draw.path([
                new Vector3(0, 0, 0),
                new Vector3(1, 0, 0),
                new Vector3(1, 1, 0),
                new Vector3(0, 1, 0)
            ], '#ff0000', true);
            expect(pathIds.length).toBe(4); // 4 segments for closed path
        });

        it('should handle timed elements', () => {
            // Create element with 0 duration (single frame)
            draw.line(new Vector3(0, 0, 0), new Vector3(1, 1, 1), '#ff0000', 0);

            // Create persistent element
            draw.line(new Vector3(0, 0, 0), new Vector3(2, 2, 2), '#00ff00', -1);

            const elements = draw.getElements();
            expect(elements.lines.length).toBe(2);
        });

        it('should clear elements', () => {
            draw.line(new Vector3(0, 0, 0), new Vector3(1, 1, 1));
            draw.point(new Vector3(0, 0, 0));

            draw.clear();

            const elements = draw.getElements();
            expect(elements.lines.length).toBe(0);
            expect(elements.points.length).toBe(0);
        });
    });

    describe('Debug Console System', () => {
        let console_: DebugConsole;

        beforeEach(() => {
            console_ = new DebugConsole();
        });

        it('should execute built-in commands', async () => {
            const result = await console_.execute('help');
            expect(result.success).toBe(true);
            expect(result.output).toContain('Available commands');
        });

        it('should handle variables', async () => {
            await console_.execute('x = 42');
            const vars = console_.getVariables();
            expect(vars.get('x')).toBe(42);
        });

        it('should track command history', async () => {
            await console_.execute('echo hello');
            await console_.execute('echo world');

            const history = console_.getHistory();
            expect(history.length).toBe(2);
            expect(history[0]).toBe('echo hello');
        });

        it('should provide autocomplete suggestions', () => {
            const suggestions = console_.getSuggestions('he');
            expect(suggestions).toContain('help');
        });

        it('should register custom commands', async () => {
            console_.registerCommand({
                name: 'greet',
                description: 'Say hello',
                execute: (args) => ({
                    success: true,
                    output: `Hello, ${args[0] || 'World'}!`
                })
            });

            const result = await console_.execute('greet Test');
            expect(result.success).toBe(true);
            expect(result.output).toBe('Hello, Test!');
        });
    });

    describe('Timeline Profiler', () => {
        let profiler: TimelineProfiler;

        beforeEach(() => {
            profiler = new TimelineProfiler();
        });

        it('should record frames with entries', () => {
            profiler.startRecording();

            for (let i = 0; i < 3; i++) {
                profiler.beginFrame();

                const id1 = profiler.begin('update', 'script');
                // Simulate work
                profiler.end(id1);

                const id2 = profiler.begin('render', 'render');
                profiler.end(id2);

                profiler.endFrame();
            }

            profiler.stopRecording();

            const frames = profiler.getFrames();
            expect(frames.length).toBe(3);

            for (const frame of frames) {
                expect(frame.entries.length).toBeGreaterThanOrEqual(2);
            }
        });

        it('should calculate statistics', () => {
            profiler.startRecording();

            for (let i = 0; i < 10; i++) {
                profiler.beginFrame();
                profiler.endFrame();
            }

            profiler.stopRecording();

            const stats = profiler.getStats();
            expect(stats.totalFrames).toBe(10);
            expect(stats.averageFPS).toBeGreaterThan(0);
        });

        it('should generate flame graph data', () => {
            profiler.startRecording();

            profiler.beginFrame();
            const outer = profiler.begin('outer', 'script');
            const inner = profiler.begin('inner', 'script');
            profiler.end(inner);
            profiler.end(outer);
            profiler.endFrame();

            profiler.stopRecording();

            const flameGraph = profiler.generateFlameGraph();
            expect(flameGraph.children.length).toBeGreaterThan(0);
        });

        it('should add markers', () => {
            profiler.startRecording();

            profiler.beginFrame();
            profiler.addMarker('Game Start', 'event');
            profiler.addMarker('Low FPS', 'warning');
            profiler.endFrame();

            profiler.stopRecording();

            const frames = profiler.getFrames();
            expect(frames[0].markers.length).toBe(2);
        });

        it('should export Chrome trace format', () => {
            profiler.startRecording();
            profiler.beginFrame();
            const id = profiler.begin('test', 'script');
            profiler.end(id);
            profiler.endFrame();
            profiler.stopRecording();

            const trace = profiler.exportChromeTrace();
            const parsed = JSON.parse(trace);
            expect(parsed.traceEvents).toBeDefined();
            expect(parsed.traceEvents.length).toBeGreaterThan(0);
        });
    });

    describe('State Inspector Deep Tests', () => {
        let inspector: StateInspector;

        beforeEach(() => {
            inspector = new StateInspector();
        });

        it('should handle circular references', () => {
            const obj: Record<string, unknown> = { name: 'test' };
            obj.self = obj; // Circular reference

            const inspected = inspector.inspect(obj, 'CircularObj');
            expect(inspected).toBeDefined();
            // Should not throw or hang
        });

        it('should track property changes over time', () => {
            const state = { counter: 0 };
            const inspected = inspector.inspect(state, 'State');

            // Simulate changes
            state.counter = 1;
            inspector.updateSnapshot(inspected.id);

            state.counter = 2;
            inspector.updateSnapshot(inspected.id);

            const diffs = inspector.getDiffFromHistory(inspected.id, 1);
            expect(diffs.length).toBeGreaterThan(0);
        });

        it('should modify properties', () => {
            const obj = { value: 10 };
            const inspected = inspector.inspect(obj, 'Test');

            const success = inspector.setProperty(inspected.id, 'value', 20);
            expect(success).toBe(true);
            expect(obj.value).toBe(20);
        });
    });

    describe('Logger System', () => {
        it('should log messages', () => {
            const logger = new Logger();

            // These should not throw
            logger.debug('Debug message');
            logger.info('Info message');
            logger.warn('Warning message');
            logger.error('Error message');

            // Logger should have recorded something
            const history = logger.getHistory();
            expect(history.length).toBeGreaterThan(0);
        });
    });

    describe('Time System', () => {
        it('should have time properties', () => {
            const time = new Time();

            // Time should have these properties
            expect(time.time).toBeDefined();
            expect(typeof time.time).toBe('number');
        });
    });
});

describe('Stress Tests', () => {
    it('should handle many watches without performance issues', () => {
        const watches = new WatchSystem();
        const values: number[] = new Array(100).fill(0);

        // Create 100 watches
        for (let i = 0; i < 100; i++) {
            const index = i;
            watches.addWatch(`value_${i}`, () => values[index]);
        }

        // Update all 100 watches 100 times
        const start = performance.now();
        for (let frame = 0; frame < 100; frame++) {
            values[frame % 100] = frame;
            watches.update(frame);
        }
        const elapsed = performance.now() - start;

        // Should complete in reasonable time (< 1 second)
        expect(elapsed).toBeLessThan(1000);
    });

    it('should handle many call stack entries', () => {
        const tracker = new CallStackTracker();

        const start = performance.now();

        // 1000 nested calls
        const frames = [];
        for (let i = 0; i < 1000; i++) {
            frames.push(tracker.enter(`func_${i}`));
        }

        // Exit all
        for (let i = frames.length - 1; i >= 0; i--) {
            tracker.exit(frames[i]);
        }

        const elapsed = performance.now() - start;
        expect(elapsed).toBeLessThan(500);

        const profiles = tracker.getAllProfiles();
        expect(profiles.length).toBe(1000);
    });

    it('should handle rapid error tracking', () => {
        const errors = new ErrorTracker();

        const start = performance.now();

        for (let i = 0; i < 500; i++) {
            errors.track(new Error(`Error ${i % 10}`)); // 10 unique errors
        }

        const elapsed = performance.now() - start;
        expect(elapsed).toBeLessThan(1000);

        const stats = errors.getStats();
        expect(stats.total).toBe(500);
    });
});

// ==========================================
// WebForge Facade Tests
// ==========================================

import { WebForge, QualityPreset } from '../src/WebForge';
import { Scene } from '../src/scene/Scene';
import { GameObject } from '../src/scene/GameObject';

describe('WebForge Facade', () => {
    it('should create engine with default config', () => {
        const engine = new WebForge({ headless: true });
        expect(engine).toBeDefined();
        expect(engine.isInitialized).toBe(false);
        expect(engine.isRunning).toBe(false);
    });

    it('should initialize all subsystems', async () => {
        const engine = new WebForge({ headless: true });
        await engine.initialize();
        
        expect(engine.isInitialized).toBe(true);
        expect(engine.camera).not.toBeNull();
        expect(engine.physics).not.toBeNull();
        expect(engine.scene).not.toBeNull();
    });

    it('should create scene with real Scene class', async () => {
        const engine = new WebForge({ headless: true });
        await engine.initialize();
        
        const scene = engine.createScene('TestScene');
        expect(scene).toBeInstanceOf(Scene);
        expect(scene.name).toBe('TestScene');
    });

    it('should create game objects and add to scene', async () => {
        const engine = new WebForge({ headless: true });
        await engine.initialize();
        
        const player = engine.createGameObject('Player');
        expect(player).toBeInstanceOf(GameObject);
        expect(player.name).toBe('Player');
        
        // Player is queued for addition; process with an update tick
        const scene = engine.getScene();
        expect(scene).not.toBeNull();
        scene!.update(0.016); // Process pending additions
        
        const found = scene!.findByName('Player');
        expect(found).not.toBeNull();
        expect(found!.name).toBe('Player');
    });

    it('should set game object position with real transform', async () => {
        const engine = new WebForge({ headless: true });
        await engine.initialize();
        
        const player = engine.createGameObject('Player');
        player.transform.position.set(5, 10, -3);
        
        expect(player.transform.position.x).toBeCloseTo(5);
        expect(player.transform.position.y).toBeCloseTo(10);
        expect(player.transform.position.z).toBeCloseTo(-3);
    });

    it('should support parent-child hierarchy', async () => {
        const engine = new WebForge({ headless: true });
        await engine.initialize();
        
        const parent = engine.createGameObject('Parent');
        const child = engine.createGameObject('Child');
        child.setParent(parent);
        
        expect(parent.getChildren().length).toBe(1);
    });

    it('should start and stop engine lifecycle', async () => {
        const engine = new WebForge({ headless: true });
        await engine.initialize();
        
        await engine.start();
        expect(engine.isRunning).toBe(true);
        
        engine.stop();
        expect(engine.isRunning).toBe(false);
    });

    it('should pause and resume', async () => {
        const engine = new WebForge({ headless: true });
        await engine.initialize();
        
        await engine.start();
        engine.pause();
        expect(engine.isPaused).toBe(true);
        
        engine.resume();
        expect(engine.isPaused).toBe(false);
        
        engine.stop();
    });

    it('should accept config options', () => {
        const engine = new WebForge({
            quality: QualityPreset.HIGH,
            physics: true,
            audio: false,
            debug: true,
            targetFPS: 120,
            headless: true
        });
        expect(engine).toBeDefined();
    });

    it('should properly dispose all resources', async () => {
        const engine = new WebForge({ headless: true });
        await engine.initialize();
        
        const player = engine.createGameObject('Player');
        await engine.start();
        
        engine.dispose();
        expect(engine.isInitialized).toBe(false);
        expect(engine.scene).toBeNull();
        expect(engine.camera).toBeNull();
        expect(engine.physics).toBeNull();
    });

    it('should auto-initialize on start if needed', async () => {
        const engine = new WebForge({ headless: true });
        expect(engine.isInitialized).toBe(false);
        
        await engine.start();
        expect(engine.isInitialized).toBe(true);
        expect(engine.isRunning).toBe(true);
        
        engine.stop();
    });

    it('should match the landing page example code', async () => {
        // This is the exact code from the landing page
        const engine = new WebForge({ headless: true, antialias: true });
        await engine.initialize();
        
        const player = engine.createGameObject('Player');
        player.transform.position = new Vector3(0, 1, 0);
        
        await engine.start();
        
        // Verify everything worked
        expect(player.name).toBe('Player');
        expect(player.transform.position.y).toBeCloseTo(1);
        expect(engine.isRunning).toBe(true);
        
        engine.stop();
        engine.dispose();
    });
});

// ==========================================
// Undo/Redo Command System Tests
// ==========================================

import {
    UndoManager,
    TransformVec3Command,
    TransformRotationCommand,
    CreateObjectCommand,
    DeleteObjectCommand,
    RenameCommand,
    PropertyChangeCommand,
    CompositeCommand,
    EditorCommands,
} from '../src/editor/app/EditorCommands';
import { GameObject } from '../src/scene/GameObject';

describe('UndoManager', () => {
    let undoManager: UndoManager;

    beforeEach(() => {
        undoManager = new UndoManager(50);
    });

    it('should start with empty stacks', () => {
        expect(undoManager.canUndo()).toBe(false);
        expect(undoManager.canRedo()).toBe(false);
        expect(undoManager.getUndoCount()).toBe(0);
        expect(undoManager.getRedoCount()).toBe(0);
    });

    it('should execute commands and track history', () => {
        const obj = new GameObject('Test');
        const cmd = EditorCommands.createPositionChange(obj, new Vector3(10, 20, 30));
        undoManager.execute(cmd);

        expect(undoManager.canUndo()).toBe(true);
        expect(undoManager.canRedo()).toBe(false);
        expect(undoManager.getUndoCount()).toBe(1);
        expect(obj.transform.position.x).toBeCloseTo(10);
        expect(obj.transform.position.y).toBeCloseTo(20);
        expect(obj.transform.position.z).toBeCloseTo(30);
    });

    it('should undo commands', () => {
        const obj = new GameObject('Test');
        obj.transform.position.set(1, 2, 3);
        const cmd = EditorCommands.createPositionChange(obj, new Vector3(10, 20, 30));
        undoManager.execute(cmd);
        
        const result = undoManager.undo();
        expect(result).toBe(true);
        expect(obj.transform.position.x).toBeCloseTo(1);
        expect(obj.transform.position.y).toBeCloseTo(2);
        expect(obj.transform.position.z).toBeCloseTo(3);
        expect(undoManager.canRedo()).toBe(true);
    });

    it('should redo commands', () => {
        const obj = new GameObject('Test');
        const cmd = EditorCommands.createPositionChange(obj, new Vector3(10, 20, 30));
        undoManager.execute(cmd);
        undoManager.undo();
        
        const result = undoManager.redo();
        expect(result).toBe(true);
        expect(obj.transform.position.x).toBeCloseTo(10);
        expect(obj.transform.position.y).toBeCloseTo(20);
        expect(obj.transform.position.z).toBeCloseTo(30);
    });

    it('should clear redo stack on new action', () => {
        const obj = new GameObject('Test');
        undoManager.execute(EditorCommands.createPositionChange(obj, new Vector3(1, 0, 0)));
        undoManager.execute(EditorCommands.createPositionChange(obj, new Vector3(2, 0, 0)));
        undoManager.undo();
        expect(undoManager.canRedo()).toBe(true);
        
        // New action clears redo
        undoManager.execute(EditorCommands.createPositionChange(obj, new Vector3(3, 0, 0)));
        expect(undoManager.canRedo()).toBe(false);
    });

    it('should respect max history size', () => {
        const obj = new GameObject('Test');
        const mgr = new UndoManager(5);
        for (let i = 0; i < 10; i++) {
            mgr.execute(EditorCommands.createPositionChange(obj, new Vector3(i, 0, 0)));
        }
        expect(mgr.getUndoCount()).toBe(5);
    });

    it('should clear history', () => {
        const obj = new GameObject('Test');
        undoManager.execute(EditorCommands.createPositionChange(obj, new Vector3(1, 0, 0)));
        undoManager.clear();
        expect(undoManager.canUndo()).toBe(false);
        expect(undoManager.canRedo()).toBe(false);
    });

    it('should emit historyChanged events', () => {
        const events = undoManager.getEvents();
        let eventFired = false;
        events.on('historyChanged', () => { eventFired = true; });
        
        const obj = new GameObject('Test');
        undoManager.execute(EditorCommands.createPositionChange(obj, new Vector3(1, 0, 0)));
        expect(eventFired).toBe(true);
    });
});

describe('EditorCommands', () => {
    it('should handle TransformVec3Command for position', () => {
        const obj = new GameObject('Test');
        obj.transform.position.set(0, 0, 0);
        const cmd = new TransformVec3Command(obj, 'position', new Vector3(0, 0, 0), new Vector3(5, 10, 15));
        
        cmd.execute();
        expect(obj.transform.position.x).toBeCloseTo(5);
        
        cmd.undo();
        expect(obj.transform.position.x).toBeCloseTo(0);
    });

    it('should handle TransformVec3Command for scale', () => {
        const obj = new GameObject('Test');
        obj.transform.scale.set(1, 1, 1);
        const cmd = EditorCommands.createScaleChange(obj, new Vector3(2, 3, 4));
        
        cmd.execute();
        expect(obj.transform.scale.x).toBeCloseTo(2);
        expect(obj.transform.scale.y).toBeCloseTo(3);
        
        cmd.undo();
        expect(obj.transform.scale.x).toBeCloseTo(1);
    });

    it('should handle TransformRotationCommand', () => {
        const obj = new GameObject('Test');
        const oldRot = obj.transform.rotation.clone();
        const newRot = new Quaternion(0, 0.707, 0, 0.707);
        const cmd = new TransformRotationCommand(obj, oldRot, newRot);
        
        cmd.execute();
        expect(obj.transform.rotation.y).toBeCloseTo(0.707);
        
        cmd.undo();
        expect(obj.transform.rotation.y).toBeCloseTo(oldRot.y);
    });

    it('should handle RenameCommand', () => {
        const obj = new GameObject('OldName');
        const cmd = EditorCommands.rename(obj, 'NewName');
        
        cmd.execute();
        expect(obj.name).toBe('NewName');
        
        cmd.undo();
        expect(obj.name).toBe('OldName');
    });

    it('should handle CreateObjectCommand', () => {
        const obj = new GameObject('Created');
        const added: GameObject[] = [];
        const removed: GameObject[] = [];
        
        const cmd = EditorCommands.createObject(
            obj,
            (o) => added.push(o),
            (o) => removed.push(o)
        );
        
        cmd.execute();
        expect(added).toContain(obj);
        
        cmd.undo();
        expect(removed).toContain(obj);
    });

    it('should handle DeleteObjectCommand', () => {
        const obj = new GameObject('Deleted');
        const added: GameObject[] = [];
        const removed: GameObject[] = [];
        
        const cmd = EditorCommands.deleteObject(
            obj,
            (o) => added.push(o),
            (o) => removed.push(o)
        );
        
        cmd.execute();
        expect(removed).toContain(obj);
        
        cmd.undo();
        expect(added).toContain(obj);
    });

    it('should handle CompositeCommand', () => {
        const obj = new GameObject('Test');
        obj.transform.position.set(0, 0, 0);
        
        const cmds = [
            EditorCommands.createPositionChange(obj, new Vector3(10, 0, 0)),
            EditorCommands.rename(obj, 'Renamed')
        ];
        const composite = EditorCommands.composite(cmds, 'Batch');
        
        composite.execute();
        expect(obj.transform.position.x).toBeCloseTo(10);
        expect(obj.name).toBe('Renamed');
        
        composite.undo();
        expect(obj.transform.position.x).toBeCloseTo(0);
        expect(obj.name).toBe('Test');
    });

    it('should handle PropertyChangeCommand', () => {
        const target = { nested: { value: 42 } } as Record<string, unknown>;
        const cmd = new PropertyChangeCommand(target, 'nested.value', 42, 99, 'Change value');
        
        cmd.execute();
        expect((target.nested as Record<string, unknown>).value).toBe(99);
        
        cmd.undo();
        expect((target.nested as Record<string, unknown>).value).toBe(42);
    });
});

// ==========================================
// Network System Tests
// ==========================================

import { MessageType } from '../src/network/NetworkManager';
import { StateSyncManager } from '../src/network/StateSyncManager';

describe('Network System', () => {
    it('should have all message types defined', () => {
        expect(MessageType.CONNECT).toBe('connect');
        expect(MessageType.DISCONNECT).toBe('disconnect');
        expect(MessageType.PING).toBe('ping');
        expect(MessageType.PONG).toBe('pong');
        expect(MessageType.STATE_UPDATE).toBe('state_update');
        expect(MessageType.TRANSFORM_UPDATE).toBe('transform_update');
        expect(MessageType.ENTITY_SPAWN).toBe('entity_spawn');
        expect(MessageType.ENTITY_DESTROY).toBe('entity_destroy');
        expect(MessageType.PLAYER_INPUT).toBe('player_input');
        expect(MessageType.PLAYER_ACTION).toBe('player_action');
        expect(MessageType.CUSTOM_EVENT).toBe('custom_event');
        expect(MessageType.RPC_CALL).toBe('rpc_call');
        expect(MessageType.RPC_RESPONSE).toBe('rpc_response');
    });

    it('should create StateSyncManager', () => {
        // Create a mock network manager
        const mockNetwork = {
            on: vi.fn(),
            broadcast: vi.fn(),
            createMessage: vi.fn(),
        };
        const sync = new StateSyncManager(mockNetwork as any);
        expect(sync).toBeDefined();
    });

    it('should handle transform interpolation with no data', () => {
        const mockNetwork = { on: vi.fn(), broadcast: vi.fn(), createMessage: vi.fn() };
        const sync = new StateSyncManager(mockNetwork as any);
        const result = sync.getInterpolatedTransform('nonexistent');
        expect(result).toBeNull();
    });

    it('should clear entity states', () => {
        const mockNetwork = { on: vi.fn(), broadcast: vi.fn(), createMessage: vi.fn() };
        const sync = new StateSyncManager(mockNetwork as any);
        sync.clearEntity('test-entity');
        sync.clearAll();
        expect(sync.getInterpolatedTransform('test-entity')).toBeNull();
    });
});
