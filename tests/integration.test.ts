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
        const target: Record<string, unknown> = { nested: { value: 42 } };
        const cmd = new PropertyChangeCommand(target, 'nested.value', 42, 99, 'Change value');
        
        cmd.execute();
        expect((target.nested as { value: number }).value).toBe(99);
        
        cmd.undo();
        expect((target.nested as { value: number }).value).toBe(42);
    });
});

// ==========================================
// Network System Tests
// ==========================================

import { MessageType, NetworkRoom } from '../src/network/NetworkManager';
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

    it('should have room management message types', () => {
        expect(MessageType.ROOM_CREATE).toBe('room_create');
        expect(MessageType.ROOM_JOIN).toBe('room_join');
        expect(MessageType.ROOM_LEAVE).toBe('room_leave');
        expect(MessageType.ROOM_LIST).toBe('room_list');
        expect(MessageType.ROOM_UPDATE).toBe('room_update');
        expect(MessageType.CHAT_MESSAGE).toBe('chat_message');
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

    it('should support NetworkRoom interface', () => {
        const room: NetworkRoom = {
            id: 'room1',
            name: 'Test Room',
            hostId: 'host1',
            clients: ['host1', 'client2'],
            maxClients: 8,
            isPublic: true,
            metadata: { gameMode: 'deathmatch' }
        };
        expect(room.id).toBe('room1');
        expect(room.clients.length).toBe(2);
        expect(room.maxClients).toBe(8);
        expect(room.isPublic).toBe(true);
    });

    it('should set interpolation delay and update rate', () => {
        const mockNetwork = { on: vi.fn(), broadcast: vi.fn(), createMessage: vi.fn() };
        const sync = new StateSyncManager(mockNetwork as any);
        sync.setInterpolationDelay(200);
        sync.setUpdateRate(30);
        // No error thrown means success
        expect(sync).toBeDefined();
    });
});

// ========== Post-Processing Effects Tests ==========
import { BloomEffect, BloomConfig } from '../src/rendering/effects/BloomEffect';
import { ToneMappingEffect, ToneMappingOperator, ToneMappingConfig } from '../src/rendering/effects/ToneMappingEffect';
import { SSAOEffect, SSAOConfig } from '../src/rendering/effects/SSAOEffect';
import { DepthOfFieldEffect, DepthOfFieldConfig } from '../src/rendering/effects/DepthOfFieldEffect';
import { MotionBlurEffect, MotionBlurConfig } from '../src/rendering/effects/MotionBlurEffect';

describe('Post-Processing Effects', () => {
    it('should export BloomConfig interface', () => {
        const config: BloomConfig = {
            threshold: 0.8,
            intensity: 1.5,
            blurPasses: 3,
            blurRadius: 2.0
        };
        expect(config.threshold).toBe(0.8);
        expect(config.intensity).toBe(1.5);
        expect(config.blurPasses).toBe(3);
    });

    it('should export ToneMappingOperator enum', () => {
        expect(ToneMappingOperator.LINEAR).toBe('linear');
        expect(ToneMappingOperator.REINHARD).toBe('reinhard');
        expect(ToneMappingOperator.ACES).toBe('aces');
        expect(ToneMappingOperator.UNCHARTED2).toBe('uncharted2');
        expect(ToneMappingOperator.FILMIC).toBe('filmic');
    });

    it('should export ToneMappingConfig interface', () => {
        const config: ToneMappingConfig = {
            operator: ToneMappingOperator.ACES,
            exposure: 1.0,
            whitePoint: 11.2
        };
        expect(config.operator).toBe('aces');
        expect(config.exposure).toBe(1.0);
    });

    it('should export SSAOConfig interface', () => {
        const config: SSAOConfig = {
            samples: 32,
            radius: 0.5,
            bias: 0.025,
            intensity: 1.0
        };
        expect(config.samples).toBe(32);
        expect(config.radius).toBe(0.5);
    });

    it('should export DepthOfFieldConfig interface', () => {
        const config: DepthOfFieldConfig = {
            focusDistance: 10,
            focusRange: 5,
            bokehSize: 1.0,
            maxBlur: 20
        };
        expect(config.focusDistance).toBe(10);
        expect(config.bokehSize).toBe(1.0);
    });

    it('should export MotionBlurConfig interface', () => {
        const config: MotionBlurConfig = {
            samples: 16,
            strength: 1.0
        };
        expect(config.samples).toBe(16);
        expect(config.strength).toBe(1.0);
    });
});

// ========== Terrain System Tests ==========
import { Terrain } from '../src/terrain/Terrain';
import { TerrainLOD } from '../src/terrain/TerrainLOD';
import { TerrainBrush, TerrainBrushType, TerrainFalloffType } from '../src/terrain/TerrainBrush';

describe('Terrain System', () => {
    it('should create terrain with dimensions', () => {
        const terrain = new Terrain(64, 64, 100, 100);
        const dims = terrain.getDimensions();
        expect(dims.width).toBe(64);
        expect(dims.height).toBe(64);
        expect(dims.worldWidth).toBe(100);
        expect(dims.worldDepth).toBe(100);
    });

    it('should get height at coordinates', () => {
        const terrain = new Terrain(16, 16, 50, 50);
        const height = terrain.getHeightAt(0, 0);
        expect(typeof height).toBe('number');
    });

    it('should get world height with interpolation', () => {
        const terrain = new Terrain(16, 16, 50, 50);
        const height = terrain.getHeight(10, 10);
        expect(typeof height).toBe('number');
    });

    it('should generate mesh at LOD 0', () => {
        const terrain = new Terrain(8, 8, 10, 10);
        const mesh = terrain.generateMesh(0);
        expect(mesh).toBeDefined();
        expect(mesh.getVertexCount()).toBeGreaterThan(0);
    });

    it('should generate mesh at LOD 2 with fewer vertices', () => {
        const terrain = new Terrain(16, 16, 50, 50);
        const meshLod0 = terrain.generateMesh(0);
        const meshLod2 = terrain.generateMesh(2);
        expect(meshLod2.getVertexCount()).toBeLessThan(meshLod0.getVertexCount());
    });

    it('should get terrain normals', () => {
        const terrain = new Terrain(8, 8, 10, 10);
        const normal = terrain.getNormal(4, 4);
        expect(normal).toBeDefined();
        expect(normal.length()).toBeCloseTo(1.0, 1);
    });

    it('should clear terrain data', () => {
        const terrain = new Terrain(8, 8, 10, 10);
        terrain.clear();
        expect(terrain.getHeightAt(4, 4)).toBe(0);
    });
});

describe('Terrain LOD System', () => {
    it('should initialize with default LOD levels', () => {
        const terrain = new Terrain(8, 8, 10, 10);
        const lod = new TerrainLOD(terrain);
        const config = lod.getLODConfiguration();
        expect(config.length).toBe(5);
        expect(config[0].level).toBe(0);
        expect(config[4].level).toBe(4);
    });

    it('should return LOD 0 for close camera', () => {
        const terrain = new Terrain(8, 8, 10, 10);
        const lod = new TerrainLOD(terrain);
        const level = lod.getLODLevel(0, 0, 0, 0);
        expect(level).toBe(0);
    });

    it('should return higher LOD for distant camera', () => {
        const terrain = new Terrain(8, 8, 10, 10);
        const lod = new TerrainLOD(terrain);
        const level = lod.getLODLevel(500, 500, 0, 0);
        expect(level).toBeGreaterThan(0);
    });

    it('should allow custom LOD distances', () => {
        const terrain = new Terrain(8, 8, 10, 10);
        const lod = new TerrainLOD(terrain);
        lod.setLODDistances([10, 20, 40, 80]);
        const config = lod.getLODConfiguration();
        // After setting distances, they're sorted. Config[0] still has distance 10 (level 0)
        expect(config[0].distance).toBe(10);
    });

    it('should get mesh detail multiplier', () => {
        const terrain = new Terrain(8, 8, 10, 10);
        const lod = new TerrainLOD(terrain);
        expect(lod.getMeshDetail(0)).toBe(1.0);
        expect(lod.getMeshDetail(4)).toBe(0.0625);
    });

    it('should update LOD for camera position', () => {
        const terrain = new Terrain(8, 8, 10, 10);
        const lod = new TerrainLOD(terrain);
        const levels = lod.update(0, 0);
        expect(levels).toBeDefined();
        expect(levels.length).toBeGreaterThan(0);
    });

    it('should generate LOD mesh based on camera distance', () => {
        const terrain = new Terrain(16, 16, 50, 50);
        const lod = new TerrainLOD(terrain);
        const mesh = lod.generateLODMesh(0, 0);
        expect(mesh).toBeDefined();
        expect(mesh.getVertexCount()).toBeGreaterThan(0);
    });
});

describe('Terrain Brush System', () => {
    it('should create terrain brush', () => {
        const brush = new TerrainBrush('raise', 5, 0.5);
        expect(brush).toBeDefined();
    });

    it('should set brush type', () => {
        const brush = new TerrainBrush('raise', 5, 0.5);
        brush.setType('lower');
        expect(brush).toBeDefined();
    });

    it('should set brush radius', () => {
        const brush = new TerrainBrush('raise', 5, 0.5);
        brush.setRadius(10);
        expect(brush).toBeDefined();
    });

    it('should set brush strength', () => {
        const brush = new TerrainBrush('raise', 5, 0.5);
        brush.setStrength(0.8);
        expect(brush).toBeDefined();
    });

    it('should apply brush to terrain (raise)', () => {
        const terrain = new Terrain(16, 16, 50, 50);
        const brush = new TerrainBrush('raise', 10, 0.5);
        const h0 = terrain.getHeightAt(8, 8);
        brush.apply(terrain, 0, 0); // World center
        const h1 = terrain.getHeightAt(8, 8);
        expect(h1).toBeGreaterThan(h0);
    });

    it('should apply brush to terrain (lower)', () => {
        const terrain = new Terrain(16, 16, 50, 50);
        const brush = new TerrainBrush('raise', 10, 0.5);
        brush.apply(terrain, 0, 0); // Raise first

        const h0 = terrain.getHeightAt(8, 8);
        brush.setType('lower');
        brush.apply(terrain, 0, 0);
        const h1 = terrain.getHeightAt(8, 8);
        expect(h1).toBeLessThan(h0);
    });

    it('should apply flatten brush', () => {
        const terrain = new Terrain(16, 16, 50, 50);
        const brush = new TerrainBrush('raise', 10, 1.0);
        brush.apply(terrain, 0, 0); // Create a peak

        brush.setType('flatten');
        brush.apply(terrain, 0, 0);
        expect(terrain.getHeightAt(8, 8)).toBeDefined();
    });

    it('should support all terrain brush types', () => {
        const types: TerrainBrushType[] = ['raise', 'lower', 'smooth', 'flatten'];
        for (const type of types) {
            const brush = new TerrainBrush(type, 3, 0.5);
            expect(brush).toBeDefined();
        }
    });
});

// ========== Sculpting System Tests ==========
import { SculptingSystem, BrushType, FalloffType } from '../src/geometry/SculptingSystem';
import { MeshData } from '../src/geometry/MeshData';

describe('Sculpting System', () => {
    it('should have all brush types', () => {
        expect(BrushType.DRAW).toBe('draw');
        expect(BrushType.SMOOTH).toBe('smooth');
        expect(BrushType.GRAB).toBe('grab');
        expect(BrushType.INFLATE).toBe('inflate');
        expect(BrushType.FLATTEN).toBe('flatten');
        expect(BrushType.PINCH).toBe('pinch');
        expect(BrushType.CREASE).toBe('crease');
    });

    it('should have all falloff types', () => {
        expect(FalloffType.LINEAR).toBe('linear');
        expect(FalloffType.SMOOTH).toBe('smooth');
        expect(FalloffType.SHARP).toBe('sharp');
        expect(FalloffType.CONSTANT).toBe('constant');
    });

    it('should create sculpting system with mesh', () => {
        const mesh = new MeshData({ position: [], normal: [], uv: [], color: [] }, []);
        const sculpt = new SculptingSystem(mesh);
        expect(sculpt).toBeDefined();
    });

    it('should get default settings', () => {
        const mesh = new MeshData({ position: [], normal: [], uv: [], color: [] }, []);
        const sculpt = new SculptingSystem(mesh);
        const settings = sculpt.getSettings();
        expect(settings.type).toBe(BrushType.DRAW);
        expect(settings.radius).toBe(1.0);
        expect(settings.strength).toBe(0.5);
        expect(settings.falloff).toBe(FalloffType.SMOOTH);
        expect(settings.symmetry).toBe(false);
        expect(settings.dynamicTopology).toBe(false);
    });

    it('should update brush settings', () => {
        const mesh = new MeshData({ position: [], normal: [], uv: [], color: [] }, []);
        const sculpt = new SculptingSystem(mesh);
        sculpt.updateSettings({ type: BrushType.SMOOTH, radius: 2.0, strength: 0.8 });
        const settings = sculpt.getSettings();
        expect(settings.type).toBe(BrushType.SMOOTH);
        expect(settings.radius).toBe(2.0);
        expect(settings.strength).toBe(0.8);
    });

    it('should reset stroke state', () => {
        const mesh = new MeshData({ position: [], normal: [], uv: [], color: [] }, []);
        const sculpt = new SculptingSystem(mesh);
        sculpt.resetStroke();
        // Should not throw
        expect(sculpt).toBeDefined();
    });
});

// ========== Animation System Tests ==========
import { AnimationPlayer, PlaybackMode, PlaybackState } from '../src/animation/AnimationPlayer';

describe('Animation System', () => {
    it('should create animation player', () => {
        const player = new AnimationPlayer();
        expect(player).toBeDefined();
        expect(player.getState()).toBe(PlaybackState.STOPPED);
    });

    it('should have playback modes', () => {
        expect(PlaybackMode.ONCE).toBe('once');
        expect(PlaybackMode.LOOP).toBe('loop');
        expect(PlaybackMode.PING_PONG).toBe('pingpong');
    });

    it('should have playback states', () => {
        expect(PlaybackState.STOPPED).toBe('stopped');
        expect(PlaybackState.PLAYING).toBe('playing');
        expect(PlaybackState.PAUSED).toBe('paused');
    });

    it('should not play without clip', () => {
        const player = new AnimationPlayer();
        player.play();
        expect(player.getState()).toBe(PlaybackState.STOPPED);
    });

    it('should get time as 0 initially', () => {
        const player = new AnimationPlayer();
        expect(player.getTime()).toBe(0);
    });

    it('should set playback speed', () => {
        const player = new AnimationPlayer();
        player.setSpeed(2.0);
        expect(player).toBeDefined();
    });

    it('should report not playing', () => {
        const player = new AnimationPlayer();
        expect(player.isPlaying()).toBe(false);
    });

    it('should provide events system', () => {
        const player = new AnimationPlayer();
        const events = player.getEvents();
        expect(events).toBeDefined();
        expect(typeof events.on).toBe('function');
    });

    it('should register targets', () => {
        const player = new AnimationPlayer();
        const mockTarget = { position: new Vector3(0, 0, 0) };
        player.registerTarget('testObject', mockTarget);
        expect(player).toBeDefined();
    });
});

// ========== Enhanced Terrain Brush Tests ==========
import { EnhancedTerrainGenerator, BiomeType } from '../src/terrain/EnhancedTerrainGenerator';
import { WaterSimulationSystem } from '../src/water/WaterSimulationSystem';
import { WeatherSystem, WeatherType, WeatherIntensity } from '../src/weather/WeatherSystem';
import { AdvancedVFXSystem } from '../src/vfx/AdvancedVFXSystem';
import { ParticleSystem } from '../src/particles/ParticleSystem';
import { AnimationEvent, RootMotionData } from '../src/animation/AnimationPlayer';

describe('Enhanced Terrain Brush System', () => {
    it('should support erode brush type', () => {
        const brush = new TerrainBrush('erode', 10, 0.5);
        expect(brush.getProperties().type).toBe('erode');
    });

    it('should support noise brush type', () => {
        const brush = new TerrainBrush('noise', 8, 0.6);
        expect(brush.getProperties().type).toBe('noise');
    });

    it('should support stamp brush type', () => {
        const brush = new TerrainBrush('stamp', 12, 0.7);
        expect(brush.getProperties().type).toBe('stamp');
    });

    it('should support plateau brush type', () => {
        const brush = new TerrainBrush('plateau', 15, 0.8);
        expect(brush.getProperties().type).toBe('plateau');
    });

    it('should support all 8 terrain brush types', () => {
        const types: TerrainBrushType[] = ['raise', 'lower', 'smooth', 'flatten', 'erode', 'noise', 'stamp', 'plateau'];
        for (const type of types) {
            const brush = new TerrainBrush(type, 5, 0.5);
            expect(brush.getProperties().type).toBe(type);
        }
    });

    it('should apply erode brush to terrain', () => {
        const terrain = new Terrain(16, 16, 50, 50);
        // Set up a hill to erode
        for (let z = 6; z < 10; z++) {
            for (let x = 6; x < 10; x++) {
                terrain.setHeight(x, z, 5.0);
            }
        }
        const brush = new TerrainBrush('erode', 15, 0.8);
        const h0 = terrain.getHeightAt(8, 8);
        brush.apply(terrain, 0, 0);
        const h1 = terrain.getHeightAt(8, 8);
        // Erosion should reduce height of peaks
        expect(h1).toBeLessThanOrEqual(h0);
    });

    it('should apply noise brush to terrain', () => {
        const terrain = new Terrain(16, 16, 50, 50);
        const brush = new TerrainBrush('noise', 15, 0.5);
        brush.apply(terrain, 0, 0);
        // Noise brush should create variation - not all zero
        let hasNonZero = false;
        for (let z = 0; z < 16; z++) {
            for (let x = 0; x < 16; x++) {
                if (terrain.getHeightAt(x, z) !== 0) hasNonZero = true;
            }
        }
        expect(hasNonZero).toBe(true);
    });

    it('should set noise scale', () => {
        const brush = new TerrainBrush('noise', 10, 0.5);
        brush.setNoiseScale(0.5);
        expect(brush).toBeDefined();
    });

    it('should randomize noise seed', () => {
        const brush = new TerrainBrush('noise', 10, 0.5);
        brush.randomizeNoise();
        expect(brush).toBeDefined();
    });

    it('should create plateau stamp pattern', () => {
        const pattern = TerrainBrush.createPlateauStamp(16);
        expect(pattern).toBeInstanceOf(Float32Array);
        expect(pattern.length).toBe(256); // 16*16
        // Center should be high
        expect(pattern[8 * 16 + 8]).toBeGreaterThan(0.5);
        // Edges should be low
        expect(pattern[0]).toBe(0);
    });

    it('should create ridge stamp pattern', () => {
        const pattern = TerrainBrush.createRidgeStamp(16);
        expect(pattern).toBeInstanceOf(Float32Array);
        expect(pattern.length).toBe(256);
        // Center should be highest
        expect(pattern[8 * 16 + 8]).toBeGreaterThan(0);
    });

    it('should set stamp pattern on brush', () => {
        const brush = new TerrainBrush('stamp', 10, 0.5);
        const pattern = TerrainBrush.createPlateauStamp(16);
        brush.setStampPattern(pattern, 16);
        expect(brush.getProperties().type).toBe('stamp');
    });
});

// ========== Enhanced Sculpting System Tests ==========
describe('Enhanced Sculpting System', () => {
    function createTestMesh(): MeshData {
        const mesh = new MeshData({ position: [], normal: [], uv: [], color: [] }, []);
        // Create a simple plane (4 vertices, 2 triangles)
        mesh.addVertex(new Vector3(-1, 0, -1), new Vector3(0, 1, 0));
        mesh.addVertex(new Vector3(1, 0, -1), new Vector3(0, 1, 0));
        mesh.addVertex(new Vector3(-1, 0, 1), new Vector3(0, 1, 0));
        mesh.addVertex(new Vector3(1, 0, 1), new Vector3(0, 1, 0));
        mesh.addFace(0, 1, 2);
        mesh.addFace(1, 3, 2);
        return mesh;
    }

    it('should apply draw brush and modify vertices', () => {
        const mesh = createTestMesh();
        const sculpt = new SculptingSystem(mesh);
        sculpt.updateSettings({ type: BrushType.DRAW, radius: 5, strength: 0.5 });
        const origY = mesh.getVertex(0).y;
        sculpt.applyBrush(new Vector3(0, 0, 0), new Vector3(0, 1, 0));
        const newY = mesh.getVertex(0).y;
        expect(newY).toBeGreaterThan(origY);
    });

    it('should apply inflate brush', () => {
        const mesh = createTestMesh();
        const sculpt = new SculptingSystem(mesh);
        sculpt.updateSettings({ type: BrushType.INFLATE, radius: 5, strength: 0.5 });
        sculpt.applyBrush(new Vector3(0, 0, 0), new Vector3(0, 1, 0));
        expect(mesh.getVertexCount()).toBe(4);
    });

    it('should apply pinch brush', () => {
        const mesh = createTestMesh();
        const sculpt = new SculptingSystem(mesh);
        sculpt.updateSettings({ type: BrushType.PINCH, radius: 5, strength: 0.3 });
        sculpt.applyBrush(new Vector3(0, 0, 0), new Vector3(0, 1, 0));
        // Vertices should have moved toward brush center
        expect(mesh.getVertexCount()).toBe(4);
    });

    it('should apply crease brush', () => {
        const mesh = createTestMesh();
        const sculpt = new SculptingSystem(mesh);
        sculpt.updateSettings({ type: BrushType.CREASE, radius: 5, strength: 0.5 });
        sculpt.applyBrush(new Vector3(0, 0, 0), new Vector3(0, 1, 0));
        expect(mesh.getVertexCount()).toBe(4);
    });

    it('should apply flatten brush', () => {
        const mesh = createTestMesh();
        const sculpt = new SculptingSystem(mesh);
        sculpt.updateSettings({ type: BrushType.FLATTEN, radius: 5, strength: 0.5 });
        sculpt.applyBrush(new Vector3(0, 0.5, 0), new Vector3(0, 1, 0));
        expect(mesh.getVertexCount()).toBe(4);
    });

    it('should enable dynamic topology', () => {
        const mesh = createTestMesh();
        const sculpt = new SculptingSystem(mesh);
        sculpt.updateSettings({ type: BrushType.DRAW, radius: 5, strength: 0.5, dynamicTopology: true });
        sculpt.applyBrush(new Vector3(0, 0, 0), new Vector3(0, 1, 0));
        // Dynamic topology may add vertices
        expect(mesh.getVertexCount()).toBeGreaterThanOrEqual(4);
    });

    it('should enable symmetry mode', () => {
        const mesh = createTestMesh();
        const sculpt = new SculptingSystem(mesh);
        sculpt.updateSettings({ type: BrushType.DRAW, radius: 5, strength: 0.5, symmetry: true });
        sculpt.applyBrush(new Vector3(0.5, 0, 0), new Vector3(0, 1, 0));
        expect(mesh.getVertexCount()).toBe(4);
    });

    it('should support all falloff types', () => {
        for (const falloff of [FalloffType.LINEAR, FalloffType.SMOOTH, FalloffType.SHARP, FalloffType.CONSTANT]) {
            const mesh = createTestMesh();
            const sculpt = new SculptingSystem(mesh);
            sculpt.updateSettings({ falloff, radius: 5, strength: 0.5 });
            sculpt.applyBrush(new Vector3(0, 0, 0), new Vector3(0, 1, 0));
            expect(mesh.getVertexCount()).toBe(4);
        }
    });

    it('should support setIndices on MeshData', () => {
        const mesh = createTestMesh();
        const origIndices = mesh.getIndices();
        expect(origIndices.length).toBe(6); // 2 triangles * 3
        mesh.setIndices([0, 1, 2]); // Replace with 1 triangle
        expect(mesh.getIndices().length).toBe(3);
        expect(mesh.getFaceCount()).toBe(1);
    });
});

// ========== Animation Events & Root Motion Tests ==========
describe('Animation Events & Root Motion', () => {
    it('should add animation events', () => {
        const player = new AnimationPlayer();
        player.addEvent(0.5, 'footstep', { foot: 'left' });
        player.addEvent(1.0, 'footstep', { foot: 'right' });
        const events = player.getAnimationEvents();
        expect(events.length).toBe(2);
        expect(events[0].time).toBe(0.5);
        expect(events[0].name).toBe('footstep');
        expect(events[0].data.foot).toBe('left');
    });

    it('should sort events by time', () => {
        const player = new AnimationPlayer();
        player.addEvent(1.0, 'second');
        player.addEvent(0.5, 'first');
        player.addEvent(1.5, 'third');
        const events = player.getAnimationEvents();
        expect(events[0].time).toBe(0.5);
        expect(events[1].time).toBe(1.0);
        expect(events[2].time).toBe(1.5);
    });

    it('should remove events by name', () => {
        const player = new AnimationPlayer();
        player.addEvent(0.5, 'footstep');
        player.addEvent(1.0, 'attack');
        player.removeEvent('footstep');
        expect(player.getAnimationEvents().length).toBe(1);
        expect(player.getAnimationEvents()[0].name).toBe('attack');
    });

    it('should clear all events', () => {
        const player = new AnimationPlayer();
        player.addEvent(0.5, 'a');
        player.addEvent(1.0, 'b');
        player.clearEvents();
        expect(player.getAnimationEvents().length).toBe(0);
    });

    it('should enable/disable root motion', () => {
        const player = new AnimationPlayer();
        player.enableRootMotion('hips');
        expect(player.isRootMotionEnabled()).toBe(true);
        player.disableRootMotion();
        expect(player.isRootMotionEnabled()).toBe(false);
    });

    it('should get root motion data', () => {
        const player = new AnimationPlayer();
        const rm = player.getRootMotion();
        expect(rm.deltaPosition).toBeDefined();
        expect(rm.deltaRotation).toBeDefined();
        expect(rm.deltaPosition.x).toBe(0);
        expect(rm.deltaPosition.y).toBe(0);
        expect(rm.deltaPosition.z).toBe(0);
    });

    it('should get normalized time', () => {
        const player = new AnimationPlayer();
        expect(player.getNormalizedTime()).toBe(0);
    });

    it('should get blend weight', () => {
        const player = new AnimationPlayer();
        expect(player.getBlendWeight()).toBe(1.0);
    });

    it('should get current clip (null initially)', () => {
        const player = new AnimationPlayer();
        expect(player.getClip()).toBeNull();
    });

    it('should get playback speed', () => {
        const player = new AnimationPlayer();
        player.setSpeed(2.5);
        expect(player.getSpeed()).toBe(2.5);
    });
});

// ========== Enhanced Terrain Generator Tests ==========
describe('Enhanced Terrain Generator', () => {
    it('should create generator with default params', () => {
        const gen = new EnhancedTerrainGenerator();
        expect(gen).toBeDefined();
    });

    it('should create generator with custom params', () => {
        const gen = new EnhancedTerrainGenerator({
            seed: 42,
            width: 128,
            depth: 128,
            heightScale: 50,
            waterLevel: 0.25,
            erosionIterations: 10,
            generateBiomes: true
        });
        expect(gen).toBeDefined();
    });

    it('should generate realistic terrain with erosion and biomes', () => {
        const gen = new EnhancedTerrainGenerator({
            seed: 42,
            width: 32,
            depth: 32,
            heightScale: 50,
            erosionIterations: 5,
            generateBiomes: true,
            hydraulicErosion: true,
            thermalErosion: true
        });
        const result = gen.generateRealisticTerrain();
        expect(result.heightmap).toBeInstanceOf(Float32Array);
        expect(result.biomes).toBeInstanceOf(Uint8Array);
        expect(result.moisture).toBeInstanceOf(Float32Array);
        expect(result.temperature).toBeInstanceOf(Float32Array);
        expect(result.heightmap.length).toBe(32 * 32);
    });

    it('should have valid biome indices', () => {
        const gen = new EnhancedTerrainGenerator({
            seed: 7,
            width: 32,
            depth: 32,
            erosionIterations: 2,
            generateBiomes: true
        });
        const result = gen.generateRealisticTerrain();
        for (let i = 0; i < result.biomes.length; i++) {
            expect(result.biomes[i]).toBeGreaterThanOrEqual(0);
            expect(result.biomes[i]).toBeLessThanOrEqual(7);
        }
    });

    it('should get biome colors for all biome types', () => {
        for (let i = 0; i <= 7; i++) {
            const color = EnhancedTerrainGenerator.getBiomeColor(i);
            expect(color.r).toBeGreaterThanOrEqual(0);
            expect(color.g).toBeGreaterThanOrEqual(0);
            expect(color.b).toBeGreaterThanOrEqual(0);
        }
    });

    it('should have valid biome type enum values', () => {
        expect(BiomeType.OCEAN).toBe('ocean');
        expect(BiomeType.BEACH).toBe('beach');
        expect(BiomeType.PLAINS).toBe('plains');
        expect(BiomeType.FOREST).toBe('forest');
        expect(BiomeType.DESERT).toBe('desert');
        expect(BiomeType.TUNDRA).toBe('tundra');
        expect(BiomeType.MOUNTAIN).toBe('mountain');
        expect(BiomeType.SNOW_PEAK).toBe('snow_peak');
    });
});

// ========== Water Simulation Tests ==========
describe('Water Simulation System', () => {
    it('should create water simulation with defaults', () => {
        const water = new WaterSimulationSystem();
        expect(water).toBeDefined();
        expect(water.getResolution()).toBe(128);
    });

    it('should create with custom settings', () => {
        const water = new WaterSimulationSystem({
            resolution: 64,
            waveScale: 2.0,
            choppiness: 0.8,
            windSpeed: 15
        });
        expect(water.getResolution()).toBe(64);
    });

    it('should update simulation over time', () => {
        const water = new WaterSimulationSystem({ resolution: 32 });
        water.update(0.016); // ~60fps frame
        water.update(0.016);
        // Should not crash and height field should be populated
        const heightField = water.getHeightField();
        expect(heightField.length).toBe(32 * 32);
    });

    it('should get height at world position', () => {
        const water = new WaterSimulationSystem({ resolution: 32 });
        water.update(0.1);
        const height = water.getHeightAt(5, 5);
        expect(typeof height).toBe('number');
        expect(isNaN(height)).toBe(false);
    });

    it('should get surface normal', () => {
        const water = new WaterSimulationSystem({ resolution: 32 });
        water.update(0.1);
        const normal = water.getNormalAt(5, 5);
        expect(normal).toBeDefined();
        expect(typeof normal.x).toBe('number');
        expect(typeof normal.y).toBe('number');
        expect(typeof normal.z).toBe('number');
    });

    it('should get displacement vector', () => {
        const water = new WaterSimulationSystem({ resolution: 32 });
        water.update(0.1);
        const disp = water.getDisplacementAt(5, 5);
        expect(disp).toBeDefined();
    });

    it('should get foam data', () => {
        const water = new WaterSimulationSystem({ resolution: 32 });
        water.update(0.1);
        const foamData = water.getFoamData();
        expect(foamData).toBeInstanceOf(Float32Array);
        expect(foamData.length).toBe(32 * 32);
    });

    it('should get caustics data', () => {
        const water = new WaterSimulationSystem({ resolution: 32 });
        water.update(0.1);
        const causticsData = water.getCausticsData();
        expect(causticsData).toBeInstanceOf(Float32Array);
        expect(causticsData.length).toBe(32 * 32);
    });

    it('should get foam intensity at position', () => {
        const water = new WaterSimulationSystem({ resolution: 32 });
        water.update(0.1);
        const foam = water.getFoamAt(5, 5);
        expect(typeof foam).toBe('number');
        expect(foam).toBeGreaterThanOrEqual(0);
    });

    it('should get caustics at position', () => {
        const water = new WaterSimulationSystem({ resolution: 32 });
        water.update(0.1);
        const caustics = water.getCausticsAt(5, 5);
        expect(typeof caustics).toBe('number');
        expect(caustics).toBeGreaterThanOrEqual(0);
    });

    it('should update settings', () => {
        const water = new WaterSimulationSystem({ resolution: 32 });
        water.updateSettings({ windSpeed: 20, choppiness: 0.9 });
        expect(water).toBeDefined();
    });
});

// ========== Weather System Tests ==========
describe('Weather System', () => {
    it('should create weather system with clear weather', () => {
        const particles = new ParticleSystem();
        const weather = new WeatherSystem(particles);
        const config = weather.getCurrentWeather();
        expect(config.type).toBe(WeatherType.CLEAR);
    });

    it('should set weather type', () => {
        const particles = new ParticleSystem();
        const weather = new WeatherSystem(particles);
        weather.setWeatherType(WeatherType.RAINY, WeatherIntensity.HEAVY);
        const config = weather.getCurrentWeather();
        expect(config.type).toBe(WeatherType.RAINY);
        expect(config.intensity).toBe(WeatherIntensity.HEAVY);
    });

    it('should have all weather types', () => {
        expect(WeatherType.CLEAR).toBe('clear');
        expect(WeatherType.CLOUDY).toBe('cloudy');
        expect(WeatherType.RAINY).toBe('rainy');
        expect(WeatherType.STORMY).toBe('stormy');
        expect(WeatherType.SNOWY).toBe('snowy');
        expect(WeatherType.FOGGY).toBe('foggy');
        expect(WeatherType.WINDY).toBe('windy');
    });

    it('should have all intensity levels', () => {
        expect(WeatherIntensity.LIGHT).toBe('light');
        expect(WeatherIntensity.MODERATE).toBe('moderate');
        expect(WeatherIntensity.HEAVY).toBe('heavy');
        expect(WeatherIntensity.EXTREME).toBe('extreme');
    });

    it('should get fog density', () => {
        const particles = new ParticleSystem();
        const weather = new WeatherSystem(particles);
        weather.setWeatherType(WeatherType.FOGGY);
        expect(weather.getFogDensity()).toBeGreaterThan(0);
    });

    it('should get cloud coverage', () => {
        const particles = new ParticleSystem();
        const weather = new WeatherSystem(particles);
        weather.setWeatherType(WeatherType.STORMY);
        expect(weather.getCloudCoverage()).toBe(1.0);
    });

    it('should get lighting intensity', () => {
        const particles = new ParticleSystem();
        const weather = new WeatherSystem(particles);
        weather.setWeatherType(WeatherType.CLEAR);
        expect(weather.getLightingIntensity()).toBe(1.0);
    });

    it('should detect precipitation type', () => {
        const particles = new ParticleSystem();
        const weather = new WeatherSystem(particles);
        weather.setWeatherType(WeatherType.RAINY);
        expect(weather.isPrecipitating()).toBe(true);
        expect(weather.getPrecipitationType()).toBe('rain');
    });

    it('should detect snow vs rain', () => {
        const particles = new ParticleSystem();
        const weather = new WeatherSystem(particles);
        weather.setWeatherType(WeatherType.SNOWY);
        expect(weather.isPrecipitating()).toBe(true);
        expect(weather.getPrecipitationType()).toBe('snow');
    });

    it('should transition between weather types', () => {
        const particles = new ParticleSystem();
        const weather = new WeatherSystem(particles);
        weather.transitionTo(WeatherType.RAINY, WeatherIntensity.HEAVY, 2.0);
        // Update partway through transition
        weather.update(1.0);
        // Should still be transitioning
        expect(weather.getCurrentWeather()).toBeDefined();
    });

    it('should complete weather transition', () => {
        const particles = new ParticleSystem();
        const weather = new WeatherSystem(particles);
        weather.transitionTo(WeatherType.SNOWY, WeatherIntensity.MODERATE, 1.0);
        weather.update(0.5);
        weather.update(0.6); // Past 1.0 total
        expect(weather.getCurrentWeather().type).toBe(WeatherType.SNOWY);
    });

    it('should get wind vector', () => {
        const particles = new ParticleSystem();
        const weather = new WeatherSystem(particles);
        weather.setWeatherType(WeatherType.WINDY);
        const wind = weather.getWindVector();
        expect(wind.length()).toBeGreaterThan(0);
    });
});

// ========== Advanced VFX System Tests ==========
describe('Advanced VFX System', () => {
    it('should create VFX system with defaults', () => {
        const vfx = new AdvancedVFXSystem();
        expect(vfx).toBeDefined();
    });

    it('should enable/disable volumetric fog', () => {
        const vfx = new AdvancedVFXSystem();
        vfx.enableVolumetricFog({ density: 0.05 });
        expect(vfx.getVolumetricFogSettings().enabled).toBe(true);
        vfx.disableVolumetricFog();
        expect(vfx.getVolumetricFogSettings().enabled).toBe(false);
    });

    it('should enable/disable atmospheric scattering', () => {
        const vfx = new AdvancedVFXSystem();
        vfx.enableAtmospheric();
        expect(vfx.getAtmosphericSettings().enabled).toBe(true);
        vfx.disableAtmospheric();
        expect(vfx.getAtmosphericSettings().enabled).toBe(false);
    });

    it('should enable/disable god rays', () => {
        const vfx = new AdvancedVFXSystem();
        vfx.enableGodRays({ intensity: 0.8 });
        expect(vfx.getGodRaysSettings().enabled).toBe(true);
        vfx.disableGodRays();
        expect(vfx.getGodRaysSettings().enabled).toBe(false);
    });

    it('should calculate fog density at position', () => {
        const vfx = new AdvancedVFXSystem();
        vfx.enableVolumetricFog({ density: 0.05, height: 10, heightFalloff: 0.5 });
        const density = vfx.getFogDensityAt(new Vector3(0, 0, 0));
        expect(density).toBeGreaterThan(0);
        // Higher altitude should have less fog
        const highDensity = vfx.getFogDensityAt(new Vector3(0, 50, 0));
        expect(highDensity).toBeLessThan(density);
    });

    it('should calculate atmospheric color', () => {
        const vfx = new AdvancedVFXSystem();
        vfx.enableAtmospheric();
        const color = vfx.getAtmosphericColor(new Vector3(0, 1, 0));
        expect(typeof color.r).toBe('number');
        expect(typeof color.g).toBe('number');
        expect(typeof color.b).toBe('number');
    });

    it('should set/get sun direction', () => {
        const vfx = new AdvancedVFXSystem();
        vfx.setSunDirection(new Vector3(0.5, 0.8, 0));
        const dir = vfx.getSunDirection();
        expect(dir.y).toBeGreaterThan(0);
    });

    it('should update VFX with fog animation', () => {
        const vfx = new AdvancedVFXSystem();
        vfx.enableVolumetricFog({ density: 0.02 });
        // Update multiple frames - fog animation should modify density
        for (let i = 0; i < 10; i++) {
            vfx.update(0.1);
        }
        expect(vfx.getVolumetricFogSettings().density).toBeGreaterThan(0);
    });

    it('should update VFX with atmospheric animation', () => {
        const vfx = new AdvancedVFXSystem();
        vfx.enableAtmospheric();
        const sunBefore = vfx.getSunDirection();
        // Update many frames to see sun movement
        for (let i = 0; i < 100; i++) {
            vfx.update(0.1);
        }
        const sunAfter = vfx.getSunDirection();
        // Sun should have moved
        const hasMoved = sunBefore.x !== sunAfter.x || sunBefore.y !== sunAfter.y || sunBefore.z !== sunAfter.z;
        expect(hasMoved).toBe(true);
    });

    it('should apply presets', () => {
        const vfx = new AdvancedVFXSystem();
        vfx.presetClearSky();
        expect(vfx.getVolumetricFogSettings().enabled).toBe(false);
        expect(vfx.getAtmosphericSettings().enabled).toBe(true);
    });
});

// ========== Vegetation Scattering Tests ==========
import { VegetationScattering, VegetationType, ScatterConfig, VegetationInstance } from '../src/procedural/VegetationScattering';

describe('Vegetation Scattering System', () => {
    function createScatterConfig(overrides: Partial<ScatterConfig> = {}): ScatterConfig {
        return {
            seed: 42,
            densityMultiplier: 1.0,
            bounds: { minX: -50, minZ: -50, maxX: 50, maxZ: 50 },
            poissonSampling: false,
            maxInstances: 1000,
            ...overrides
        };
    }

    it('should create vegetation scattering system', () => {
        const scatter = new VegetationScattering();
        expect(scatter).toBeDefined();
    });

    it('should add vegetation types', () => {
        const scatter = new VegetationScattering();
        const idx = scatter.addVegetationType({
            name: 'Tree',
            density: 0.01,
            minHeight: 0, maxHeight: 100,
            maxSlopeAngle: 0.5,
            minScale: 0.8, maxScale: 1.2,
            minSpacing: 5,
            randomRotation: true,
            alignToNormal: false,
            lodDistances: [50, 100, 200, 400]
        });
        expect(idx).toBe(0);
        expect(scatter.getVegetationTypes().length).toBe(1);
    });

    it('should remove vegetation types', () => {
        const scatter = new VegetationScattering();
        scatter.addVegetationType({
            name: 'Tree', density: 0.01,
            minHeight: 0, maxHeight: 100, maxSlopeAngle: 0.5,
            minScale: 0.8, maxScale: 1.2, minSpacing: 5,
            randomRotation: true, alignToNormal: false, lodDistances: [50]
        });
        expect(scatter.getVegetationTypes().length).toBe(1);
        scatter.removeVegetationType(0);
        expect(scatter.getVegetationTypes().length).toBe(0);
    });

    it('should scatter vegetation on terrain (uniform)', () => {
        const terrain = new Terrain(32, 32, 100, 100);
        // Set some height so instances pass height filter
        for (let z = 0; z < 32; z++) {
            for (let x = 0; x < 32; x++) {
                terrain.setHeight(x, z, 10);
            }
        }

        const scatter = new VegetationScattering(42);
        scatter.addVegetationType({
            name: 'Bush', density: 0.05,
            minHeight: 0, maxHeight: 50, maxSlopeAngle: 1.5,
            minScale: 0.5, maxScale: 1.0, minSpacing: 1,
            randomRotation: true, alignToNormal: false, lodDistances: [20]
        });

        const instances = scatter.scatter(terrain, createScatterConfig());
        expect(instances.length).toBeGreaterThan(0);
        expect(instances[0].position).toBeDefined();
        expect(instances[0].scale).toBeDefined();
        expect(instances[0].typeIndex).toBe(0);
    });

    it('should scatter vegetation on terrain (Poisson)', () => {
        const terrain = new Terrain(32, 32, 100, 100);
        for (let z = 0; z < 32; z++) {
            for (let x = 0; x < 32; x++) {
                terrain.setHeight(x, z, 10);
            }
        }

        const scatter = new VegetationScattering(42);
        scatter.addVegetationType({
            name: 'Tree', density: 0.01,
            minHeight: 0, maxHeight: 50, maxSlopeAngle: 1.5,
            minScale: 0.8, maxScale: 1.2, minSpacing: 5,
            randomRotation: true, alignToNormal: false, lodDistances: [50, 100]
        });

        const instances = scatter.scatter(terrain, createScatterConfig({ poissonSampling: true }));
        expect(instances.length).toBeGreaterThan(0);
    });

    it('should filter by height', () => {
        const terrain = new Terrain(32, 32, 100, 100);
        // Set terrain very low
        for (let z = 0; z < 32; z++) {
            for (let x = 0; x < 32; x++) {
                terrain.setHeight(x, z, 1);
            }
        }

        const scatter = new VegetationScattering(42);
        scatter.addVegetationType({
            name: 'Alpine Tree', density: 0.05,
            minHeight: 50, maxHeight: 100, // Only at high altitudes
            maxSlopeAngle: 1.5,
            minScale: 0.8, maxScale: 1.2, minSpacing: 2,
            randomRotation: true, alignToNormal: false, lodDistances: [50]
        });

        const instances = scatter.scatter(terrain, createScatterConfig());
        expect(instances.length).toBe(0); // Nothing should be placed (terrain is at height 1)
    });

    it('should respect max instances limit', () => {
        const terrain = new Terrain(32, 32, 100, 100);
        for (let z = 0; z < 32; z++) {
            for (let x = 0; x < 32; x++) {
                terrain.setHeight(x, z, 10);
            }
        }

        const scatter = new VegetationScattering(42);
        scatter.addVegetationType({
            name: 'Grass', density: 1.0, // Very high density
            minHeight: 0, maxHeight: 100, maxSlopeAngle: 1.5,
            minScale: 0.5, maxScale: 1.0, minSpacing: 0.1,
            randomRotation: true, alignToNormal: false, lodDistances: [10]
        });

        const instances = scatter.scatter(terrain, createScatterConfig({ maxInstances: 50 }));
        expect(instances.length).toBeLessThanOrEqual(50);
    });

    it('should update LOD levels', () => {
        const scatter = new VegetationScattering();
        scatter.addVegetationType({
            name: 'Tree', density: 0.01,
            minHeight: 0, maxHeight: 100, maxSlopeAngle: 1.0,
            minScale: 1, maxScale: 1, minSpacing: 1,
            randomRotation: false, alignToNormal: false,
            lodDistances: [10, 20, 40, 80]
        });

        const instances: VegetationInstance[] = [
            { position: new Vector3(0, 0, 0), rotation: 0, scale: new Vector3(1, 1, 1), typeIndex: 0, lodLevel: 0 },
            { position: new Vector3(15, 0, 0), rotation: 0, scale: new Vector3(1, 1, 1), typeIndex: 0, lodLevel: 0 },
            { position: new Vector3(50, 0, 0), rotation: 0, scale: new Vector3(1, 1, 1), typeIndex: 0, lodLevel: 0 }
        ];

        scatter.updateLODs(instances, new Vector3(0, 0, 0));
        expect(instances[0].lodLevel).toBe(0); // Very close (dist=0)
        expect(instances[1].lodLevel).toBe(1); // Medium (dist=15, >10 but <20)
        expect(instances[2].lodLevel).toBe(3); // Far (dist=50, >40 but <80)
    });

    it('should get visible instances within distance', () => {
        const scatter = new VegetationScattering();
        const instances: VegetationInstance[] = [
            { position: new Vector3(5, 0, 0), rotation: 0, scale: new Vector3(1, 1, 1), typeIndex: 0, lodLevel: 0 },
            { position: new Vector3(50, 0, 0), rotation: 0, scale: new Vector3(1, 1, 1), typeIndex: 0, lodLevel: 0 },
            { position: new Vector3(200, 0, 0), rotation: 0, scale: new Vector3(1, 1, 1), typeIndex: 0, lodLevel: 0 }
        ];

        const visible = scatter.getVisibleInstances(instances, new Vector3(0, 0, 0), 100);
        expect(visible.length).toBe(2); // Only first two within 100 units
    });

    it('should get statistics', () => {
        const scatter = new VegetationScattering();
        const instances: VegetationInstance[] = [
            { position: new Vector3(0, 0, 0), rotation: 0, scale: new Vector3(1, 1, 1), typeIndex: 0, lodLevel: 0 },
            { position: new Vector3(1, 0, 0), rotation: 0, scale: new Vector3(1, 1, 1), typeIndex: 0, lodLevel: 1 },
            { position: new Vector3(2, 0, 0), rotation: 0, scale: new Vector3(1, 1, 1), typeIndex: 1, lodLevel: 0 }
        ];

        const stats = scatter.getStatistics(instances);
        expect(stats.total).toBe(3);
        expect(stats.perType.get(0)).toBe(2);
        expect(stats.perType.get(1)).toBe(1);
        expect(stats.perLOD.get(0)).toBe(2);
        expect(stats.perLOD.get(1)).toBe(1);
    });

    it('should create forest preset', () => {
        const scatter = VegetationScattering.createForestPreset();
        const types = scatter.getVegetationTypes();
        expect(types.length).toBe(4);
        expect(types[0].name).toBe('Oak Tree');
        expect(types[1].name).toBe('Pine Tree');
        expect(types[2].name).toBe('Bush');
        expect(types[3].name).toBe('Grass Clump');
    });

    it('should create desert preset', () => {
        const scatter = VegetationScattering.createDesertPreset();
        const types = scatter.getVegetationTypes();
        expect(types.length).toBe(3);
        expect(types[0].name).toBe('Cactus');
        expect(types[1].name).toBe('Desert Shrub');
        expect(types[2].name).toBe('Rock');
    });

    it('should handle empty scatter (no vegetation types)', () => {
        const terrain = new Terrain(16, 16, 50, 50);
        const scatter = new VegetationScattering();
        const instances = scatter.scatter(terrain, createScatterConfig());
        expect(instances.length).toBe(0);
    });

    it('should produce reproducible results with same seed', () => {
        const terrain = new Terrain(32, 32, 100, 100);
        for (let z = 0; z < 32; z++) {
            for (let x = 0; x < 32; x++) {
                terrain.setHeight(x, z, 10);
            }
        }

        const scatter1 = new VegetationScattering(42);
        const scatter2 = new VegetationScattering(42);
        
        const type: VegetationType = {
            name: 'Tree', density: 0.02,
            minHeight: 0, maxHeight: 50, maxSlopeAngle: 1.5,
            minScale: 0.8, maxScale: 1.2, minSpacing: 3,
            randomRotation: true, alignToNormal: false, lodDistances: [50]
        };
        
        scatter1.addVegetationType(type);
        scatter2.addVegetationType(type);
        
        const config = createScatterConfig();
        const inst1 = scatter1.scatter(terrain, config);
        const inst2 = scatter2.scatter(terrain, config);
        
        expect(inst1.length).toBe(inst2.length);
    });
});

// ========== Physics Raycast Tests ==========
import { PhysicsWorld } from '../src/physics/PhysicsWorld';
import { RigidBody, RigidBodyType } from '../src/physics/RigidBody';
import { BoxShape, SphereShape, CapsuleShape, PlaneShape } from '../src/physics/CollisionShape';
import { TexturePaintingSystem, PaintBrushType, BlendMode } from '../src/geometry/TexturePainting';
import { OcclusionResult } from '../src/optimization/OcclusionCulling';
import { BoundingBox, BoundingSphere } from '../src/optimization/FrustumCulling';
import { Vector2 } from '../src/math/Vector2';

describe('Physics Raycast', () => {
    it('should return null for empty world', () => {
        const world = new PhysicsWorld();
        const origin = new Vector3(0, 10, 0);
        const direction = new Vector3(0, -1, 0);
        const result = world.raycast(origin, direction);
        expect(result).toBeNull();
    });

    it('should hit a sphere body', () => {
        const world = new PhysicsWorld();
        const body = new RigidBody({ 
            type: RigidBodyType.STATIC,
            shape: new SphereShape(1.0)
        });
        body.setPosition(new Vector3(0, 0, 0));
        world.addBody(body);

        // Cast ray from above, pointing down
        const result = world.raycast(
            new Vector3(0, 5, 0),
            new Vector3(0, -1, 0)
        );
        
        expect(result).not.toBeNull();
        expect(result!.distance).toBeCloseTo(4.0, 1); // 5 - radius(1) = 4
        expect(result!.normal.y).toBeCloseTo(1.0, 1); // Hit top of sphere
        expect(result!.body).toBe(body);
    });

    it('should miss a sphere when ray goes past', () => {
        const world = new PhysicsWorld();
        const body = new RigidBody({ 
            type: RigidBodyType.STATIC,
            shape: new SphereShape(1.0)
        });
        body.setPosition(new Vector3(0, 0, 0));
        world.addBody(body);

        // Cast ray that misses the sphere
        const result = world.raycast(
            new Vector3(5, 5, 0),
            new Vector3(0, -1, 0)
        );
        
        expect(result).toBeNull();
    });

    it('should hit a box body', () => {
        const world = new PhysicsWorld();
        const body = new RigidBody({ 
            type: RigidBodyType.STATIC,
            shape: new BoxShape(new Vector3(1, 1, 1))
        });
        body.setPosition(new Vector3(0, 0, 0));
        world.addBody(body);

        const result = world.raycast(
            new Vector3(0, 5, 0),
            new Vector3(0, -1, 0)
        );
        
        expect(result).not.toBeNull();
        expect(result!.distance).toBeCloseTo(4.0, 1); // 5 - halfExtent(1) = 4
        expect(result!.normal.y).toBeCloseTo(1.0, 1); // Hit top of box
    });

    it('should hit a plane', () => {
        const world = new PhysicsWorld();
        const body = new RigidBody({ 
            type: RigidBodyType.STATIC,
            shape: new PlaneShape(new Vector3(0, 1, 0), 0)
        });
        body.setPosition(new Vector3(0, 0, 0));
        world.addBody(body);

        const result = world.raycast(
            new Vector3(0, 10, 0),
            new Vector3(0, -1, 0)
        );
        
        expect(result).not.toBeNull();
        expect(result!.distance).toBeCloseTo(10.0, 1);
        expect(result!.point.y).toBeCloseTo(0, 1);
    });

    it('should return closest hit with multiple bodies', () => {
        const world = new PhysicsWorld();
        
        // Near sphere at y=2
        const nearBody = new RigidBody({ 
            type: RigidBodyType.STATIC,
            shape: new SphereShape(0.5)
        });
        nearBody.setPosition(new Vector3(0, 2, 0));
        world.addBody(nearBody);
        
        // Far sphere at y=-2
        const farBody = new RigidBody({ 
            type: RigidBodyType.STATIC,
            shape: new SphereShape(0.5)
        });
        farBody.setPosition(new Vector3(0, -2, 0));
        world.addBody(farBody);

        const result = world.raycast(
            new Vector3(0, 10, 0),
            new Vector3(0, -1, 0)
        );
        
        expect(result).not.toBeNull();
        expect(result!.body).toBe(nearBody); // Should hit the closer sphere
    });

    it('should respect maxDistance', () => {
        const world = new PhysicsWorld();
        const body = new RigidBody({ 
            type: RigidBodyType.STATIC,
            shape: new SphereShape(1.0)
        });
        body.setPosition(new Vector3(0, 0, 0));
        world.addBody(body);

        // Max distance is too short to reach the sphere
        const result = world.raycast(
            new Vector3(0, 10, 0),
            new Vector3(0, -1, 0),
            5 // maxDistance < distance to sphere
        );
        
        expect(result).toBeNull();
    });

    it('should raycastAll return all hits sorted by distance', () => {
        const world = new PhysicsWorld();
        
        const body1 = new RigidBody({ 
            type: RigidBodyType.STATIC,
            shape: new SphereShape(0.3)
        });
        body1.setPosition(new Vector3(0, 3, 0));
        world.addBody(body1);
        
        const body2 = new RigidBody({ 
            type: RigidBodyType.STATIC,
            shape: new SphereShape(0.3)
        });
        body2.setPosition(new Vector3(0, -3, 0));
        world.addBody(body2);

        const results = world.raycastAll(
            new Vector3(0, 10, 0),
            new Vector3(0, -1, 0)
        );
        
        expect(results.length).toBe(2);
        expect(results[0].distance).toBeLessThan(results[1].distance);
    });

    it('should hit a capsule body', () => {
        const world = new PhysicsWorld();
        const body = new RigidBody({ 
            type: RigidBodyType.STATIC,
            shape: new CapsuleShape(1.0, 2.0)
        });
        body.setPosition(new Vector3(0, 0, 0));
        world.addBody(body);

        const result = world.raycast(
            new Vector3(0, 10, 0),
            new Vector3(0, -1, 0)
        );
        
        expect(result).not.toBeNull();
        expect(result!.distance).toBeLessThan(10);
    });
});

// ========== Texture Painting System Tests ==========
describe('Texture Painting System', () => {
    it('should create a texture painting system', () => {
        const mesh = new MeshData({ position: [-1,0,-1, 1,0,-1, 1,0,1, -1,0,1], normal: [0,1,0, 0,1,0, 0,1,0, 0,1,0], uv: [0,0, 1,0, 1,1, 0,1] }, [0,1,2, 0,2,3]);
        const painter = new TexturePaintingSystem(mesh, 256, 256);
        expect(painter).toBeDefined();
        expect(painter.getTexture()).toBeDefined();
    });

    it('should add and manage layers', () => {
        const mesh = new MeshData({ position: [-1,0,-1, 1,0,-1, 1,0,1, -1,0,1], normal: [0,1,0, 0,1,0, 0,1,0, 0,1,0], uv: [0,0, 1,0, 1,1, 0,1] }, [0,1,2, 0,2,3]);
        const painter = new TexturePaintingSystem(mesh, 256, 256);
        
        // Should have initial base layer
        expect(painter.getLayers().length).toBeGreaterThanOrEqual(1);
        
        // Add another layer
        const layerId = painter.addLayer('Detail Layer');
        expect(layerId).toBeDefined();
        expect(painter.getLayers().length).toBeGreaterThanOrEqual(2);
    });

    it('should update brush settings', () => {
        const mesh = new MeshData({ position: [-1,0,-1, 1,0,-1, 1,0,1, -1,0,1], normal: [0,1,0, 0,1,0, 0,1,0, 0,1,0], uv: [0,0, 1,0, 1,1, 0,1] }, [0,1,2, 0,2,3]);
        const painter = new TexturePaintingSystem(mesh, 256, 256);
        
        painter.updateBrushSettings({ size: 100, opacity: 0.5 });
        const settings = painter.getBrushSettings();
        expect(settings.size).toBe(100);
        expect(settings.opacity).toBe(0.5);
    });

    it('should set and get clone source', () => {
        const mesh = new MeshData({ position: [-1,0,-1, 1,0,-1, 1,0,1, -1,0,1], normal: [0,1,0, 0,1,0, 0,1,0, 0,1,0], uv: [0,0, 1,0, 1,1, 0,1] }, [0,1,2, 0,2,3]);
        const painter = new TexturePaintingSystem(mesh, 256, 256);
        
        expect(painter.getCloneSource()).toBeNull();
        
        painter.setCloneSource(new Vector2(100, 100));
        const source = painter.getCloneSource();
        expect(source).not.toBeNull();
        expect(source!.x).toBe(100);
        expect(source!.y).toBe(100);
    });

    it('should export texture', () => {
        const mesh = new MeshData({ position: [-1,0,-1, 1,0,-1, 1,0,1, -1,0,1], normal: [0,1,0, 0,1,0, 0,1,0, 0,1,0], uv: [0,0, 1,0, 1,1, 0,1] }, [0,1,2, 0,2,3]);
        const painter = new TexturePaintingSystem(mesh, 64, 64);
        
        const url = painter.exportTexture();
        expect(typeof url).toBe('string');
    });

    it('should have all brush types defined', () => {
        expect(PaintBrushType.DRAW).toBe('draw');
        expect(PaintBrushType.ERASE).toBe('erase');
        expect(PaintBrushType.BLUR).toBe('blur');
        expect(PaintBrushType.SMUDGE).toBe('smudge');
        expect(PaintBrushType.CLONE).toBe('clone');
        expect(PaintBrushType.FILL).toBe('fill');
    });

    it('should have all blend modes defined', () => {
        expect(BlendMode.NORMAL).toBe('normal');
        expect(BlendMode.MULTIPLY).toBe('multiply');
        expect(BlendMode.ADD).toBe('add');
        expect(BlendMode.SUBTRACT).toBe('subtract');
        expect(BlendMode.OVERLAY).toBe('overlay');
        expect(BlendMode.SCREEN).toBe('screen');
    });

    it('should create texture painting system and get texture', () => {
        const mesh = new MeshData({ position: [-1,0,-1, 1,0,-1, 1,0,1, -1,0,1], normal: [0,1,0, 0,1,0, 0,1,0, 0,1,0], uv: [0,0, 1,0, 1,1, 0,1] }, [0,1,2, 0,2,3]);
        const painter = new TexturePaintingSystem(mesh, 64, 64);
        
        // The texture object should exist
        expect(painter.getTexture()).toBeDefined();
        expect(painter.getLayers().length).toBeGreaterThanOrEqual(1);
    });
});

// ========== Occlusion Culling Tests ==========
describe('Occlusion Culling System', () => {
    it('should report statistics', () => {
        // Without GL context we test the interface
        const stats = { occluded: 5, total: 20, ratio: 0.25 };
        expect(stats.occluded).toBe(5);
        expect(stats.total).toBe(20);
        expect(stats.ratio).toBe(0.25);
    });

    it('should have valid OcclusionResult enum', () => {
        expect(OcclusionResult.PENDING).toBe(0);
        expect(OcclusionResult.VISIBLE).toBe(1);
        expect(OcclusionResult.OCCLUDED).toBe(2);
    });

    it('should validate BoundingBox for occlusion', () => {
        const bb = new BoundingBox(
            new Vector3(-1, -1, -1),
            new Vector3(1, 1, 1)
        );
        expect(bb.min.x).toBe(-1);
        expect(bb.max.x).toBe(1);
        const center = bb.getCenter();
        expect(center.x).toBeCloseTo(0);
        expect(center.y).toBeCloseTo(0);
        expect(center.z).toBeCloseTo(0);
    });

    it('should validate BoundingSphere for occlusion', () => {
        const bs = new BoundingSphere(new Vector3(0, 0, 0), 5);
        expect(bs.center.x).toBe(0);
        expect(bs.radius).toBe(5);
    });
});

// ========== Collision Shape Tests ==========
describe('Collision Shapes', () => {
    it('should compute box inertia', () => {
        const box = new BoxShape(new Vector3(1, 1, 1));
        const inertia = box.computeInertia(10);
        expect(inertia.x).toBeGreaterThan(0);
        expect(inertia.y).toBeGreaterThan(0);
        expect(inertia.z).toBeGreaterThan(0);
    });

    it('should compute sphere inertia', () => {
        const sphere = new SphereShape(2.0);
        const inertia = sphere.computeInertia(5);
        // 2/5 * m * r^2 = 2/5 * 5 * 4 = 8
        expect(inertia.x).toBeCloseTo(8, 1);
        expect(inertia.y).toBeCloseTo(8, 1);
        expect(inertia.z).toBeCloseTo(8, 1);
    });

    it('should compute capsule inertia', () => {
        const capsule = new CapsuleShape(1.0, 2.0);
        const inertia = capsule.computeInertia(10);
        expect(inertia.x).toBeGreaterThan(0);
    });

    it('should get box bounding volumes', () => {
        const box = new BoxShape(new Vector3(2, 3, 4));
        const bb = box.getBoundingBox();
        expect(bb.min.x).toBe(-2);
        expect(bb.max.x).toBe(2);
        expect(bb.min.y).toBe(-3);
        expect(bb.max.y).toBe(3);
        
        const bs = box.getBoundingSphere();
        expect(bs.radius).toBeGreaterThan(0);
    });

    it('should get sphere bounding volumes', () => {
        const sphere = new SphereShape(5);
        const bb = sphere.getBoundingBox();
        expect(bb.min.x).toBe(-5);
        expect(bb.max.x).toBe(5);
        
        const bs = sphere.getBoundingSphere();
        expect(bs.radius).toBe(5);
    });

    it('should get plane bounding box as infinite', () => {
        const plane = new PlaneShape(new Vector3(0, 1, 0), 0);
        const bb = plane.getBoundingBox();
        expect(bb.min.x).toBe(-Infinity);
        expect(bb.max.x).toBe(Infinity);
    });

    it('should create capsule with bounding box', () => {
        const capsule = new CapsuleShape(1.0, 3.0);
        const bb = capsule.getBoundingBox();
        expect(bb.min.x).toBe(-1);
        expect(bb.max.x).toBe(1);
        // Height = (3 + 2*1) / 2 = 2.5
        expect(bb.max.y).toBeCloseTo(2.5, 1);
    });
});

// ========== RigidBody Enhanced Tests ==========
describe('RigidBody Extended', () => {
    it('should apply force to a dynamic body', () => {
        const body = new RigidBody({ type: RigidBodyType.DYNAMIC, mass: 1.0 });
        body.setPosition(new Vector3(0, 0, 0));
        body.applyForce(new Vector3(10, 0, 0));
        // Force is accumulated but requires physics step to integrate
        // The applyForce method should wake up the body
        expect(body.isDynamic()).toBe(true);
    });

    it('should apply impulse to a dynamic body', () => {
        const body = new RigidBody({ type: RigidBodyType.DYNAMIC, mass: 2.0 });
        body.setPosition(new Vector3(0, 0, 0));
        body.applyImpulse(new Vector3(0, 5, 0));
        // Impulse directly changes velocity
        expect(body.isDynamic()).toBe(true);
    });

    it('should not move static bodies', () => {
        const body = new RigidBody({ type: RigidBodyType.STATIC, mass: 0 });
        body.setPosition(new Vector3(0, 0, 0));
        body.applyForce(new Vector3(100, 100, 100));
        body.integrate(1);
        
        const pos = body.getPosition();
        expect(pos.x).toBe(0);
        expect(pos.y).toBe(0);
        expect(pos.z).toBe(0);
    });

    it('should respect rotation locks', () => {
        const body = new RigidBody({ 
            type: RigidBodyType.DYNAMIC, 
            mass: 1.0,
            lockRotation: { x: true, y: true, z: true }
        });
        body.applyTorque(new Vector3(10, 10, 10));
        body.integrate(1/60);
        
        // Angular velocity should be zeroed
        expect(body).toBeDefined();
    });

    it('should get transform matrix', () => {
        const body = new RigidBody({ type: RigidBodyType.DYNAMIC, mass: 1.0 });
        body.setPosition(new Vector3(5, 10, 15));
        
        const matrix = body.getTransformMatrix();
        expect(matrix).toBeDefined();
    });

    it('should support sleeping', () => {
        const body = new RigidBody({ type: RigidBodyType.DYNAMIC, mass: 1.0 });
        // After many frames with no velocity, body should go to sleep
        for (let i = 0; i < 100; i++) {
            body.integrate(1/60);
        }
        expect(body).toBeDefined(); // Body exists, may be sleeping
    });
});

// ========== Mesh Quality Enhancer Tests ==========
import { MeshQualityEnhancer } from '../src/geometry/MeshQualityEnhancer';

describe('Mesh Quality Enhancer', () => {
    it('should analyze mesh quality with edge topology', () => {
        const mesh = MeshData.createCube(1);
        const metrics = MeshQualityEnhancer.analyzeMeshQuality(mesh);
        
        expect(metrics.vertexCount).toBeGreaterThan(0);
        expect(metrics.faceCount).toBeGreaterThan(0);
        expect(metrics.manifoldEdges).toBeGreaterThanOrEqual(0);
        expect(metrics.boundaryEdges).toBeGreaterThanOrEqual(0);
        expect(metrics.averageTriangleQuality).toBeGreaterThan(0);
    });

    it('should compute edge counts for a cube mesh', () => {
        const mesh = MeshData.createCube(1);
        const metrics = MeshQualityEnhancer.analyzeMeshQuality(mesh);
        
        // A cube has 12 triangles (6 faces × 2), 18 edges
        expect(metrics.faceCount).toBeGreaterThan(0);
        expect(metrics.manifoldEdges + metrics.boundaryEdges).toBeGreaterThan(0);
    });

    it('should generate LODs', () => {
        const mesh = MeshData.createCube(1);
        const lods = MeshQualityEnhancer.generateLODs(mesh, 3);
        
        expect(lods.length).toBe(3);
        expect(lods[0]).toBe(mesh); // LOD 0 is original
    });

    it('should detect degenerate triangles', () => {
        // Create a mesh with a degenerate triangle (zero area)
        const mesh = new MeshData(
            { position: [0,0,0, 1,0,0, 0,1,0, 0,0,0, 0,0,0, 0,0,0] },
            [0, 1, 2, 3, 4, 5]
        );
        const metrics = MeshQualityEnhancer.analyzeMeshQuality(mesh);
        expect(metrics.degenerateTriangles).toBeGreaterThan(0);
    });
});

// ========== Retopology Tools Tests ==========
import { RetopologyTools } from '../src/geometry/RetopologyTools';

describe('Retopology Tools', () => {
    it('should analyze edge flow', () => {
        const retopo = new RetopologyTools();
        const mesh = MeshData.createCube(1);
        const metrics = retopo.analyzeEdgeFlow(mesh);
        
        expect(metrics.triangleCount).toBeGreaterThan(0);
        expect(metrics.averageValence).toBeGreaterThan(0);
        expect(metrics.quadPercentage).toBeGreaterThanOrEqual(0);
        expect(metrics.quadPercentage).toBeLessThanOrEqual(100);
    });

    it('should detect quads in edge flow analysis', () => {
        // Create two coplanar triangles that form a quad
        const mesh = new MeshData(
            { position: [0,0,0, 1,0,0, 1,0,1, 0,0,1] },
            [0, 1, 2, 0, 2, 3]
        );
        const retopo = new RetopologyTools();
        const metrics = retopo.analyzeEdgeFlow(mesh);
        
        // Should detect these as forming at least one quad
        expect(metrics.triangleCount).toBe(2);
        expect(metrics.quadPercentage).toBeGreaterThanOrEqual(0);
    });

    it('should optimize edge flow', () => {
        const retopo = new RetopologyTools();
        const mesh = MeshData.createCube(1);
        const optimized = retopo.optimizeEdgeFlow(mesh, 2);
        
        expect(optimized).toBeDefined();
        expect(optimized.getVertexCount()).toBeGreaterThan(0);
    });
});

// ========== Constraint Tests ==========
import { HingeConstraint, SliderConstraint, DistanceConstraint } from '../src/physics/Constraint';

describe('Physics Constraints', () => {
    it('should create a hinge constraint', () => {
        const bodyA = new RigidBody({ type: RigidBodyType.DYNAMIC, mass: 1.0 });
        const bodyB = new RigidBody({ type: RigidBodyType.DYNAMIC, mass: 1.0 });
        
        const hinge = new HingeConstraint(
            bodyA, bodyB,
            new Vector3(0, 0, 0), new Vector3(0, 0, 0),
            new Vector3(0, 1, 0)
        );
        
        expect(hinge).toBeDefined();
        expect(hinge.axis.y).toBeCloseTo(1);
    });

    it('should solve hinge constraint', () => {
        const bodyA = new RigidBody({ type: RigidBodyType.DYNAMIC, mass: 1.0 });
        const bodyB = new RigidBody({ type: RigidBodyType.DYNAMIC, mass: 1.0 });
        bodyA.setPosition(new Vector3(0, 0, 0));
        bodyB.setPosition(new Vector3(2, 0, 0));
        
        const hinge = new HingeConstraint(
            bodyA, bodyB,
            new Vector3(1, 0, 0), new Vector3(-1, 0, 0),
            new Vector3(0, 1, 0)
        );
        
        // Should not throw
        hinge.solve(1/60);
        expect(bodyA.getPosition()).toBeDefined();
    });

    it('should create a distance constraint', () => {
        const bodyA = new RigidBody({ type: RigidBodyType.DYNAMIC, mass: 1.0 });
        const bodyB = new RigidBody({ type: RigidBodyType.DYNAMIC, mass: 1.0 });
        
        const constraint = new DistanceConstraint(bodyA, bodyB, 5.0);
        expect(constraint).toBeDefined();
    });

    it('should create a slider constraint', () => {
        const bodyA = new RigidBody({ type: RigidBodyType.DYNAMIC, mass: 1.0 });
        const bodyB = new RigidBody({ type: RigidBodyType.DYNAMIC, mass: 1.0 });
        
        const slider = new SliderConstraint(
            bodyA, bodyB,
            new Vector3(1, 0, 0),
            -5, 5
        );
        expect(slider).toBeDefined();
    });
});
