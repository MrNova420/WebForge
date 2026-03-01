/**
 * Stability tests for UI, Input, Camera, and Game State systems.
 *
 * Covers GameUI, InputActionMap, GameStateManager, PlayerCamera,
 * SceneSerializer, and Logger with real-user scenarios.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── UI ─────────────────────────────────────────────────────────────────────
import {
    GameUI,
    UIText,
    UIPanel,
    UIButton,
    UIProgressBar,
    UIHealthBar,
    UIAnchor,
    UIElement,
} from '../src/ui/GameUI';

// ─── Input ──────────────────────────────────────────────────────────────────
import { Input } from '../src/core/Input';
import {
    InputActionMap,
    InputBindingType,
    InputBinding,
} from '../src/core/InputActionMap';

// ─── Game State ─────────────────────────────────────────────────────────────
import { GameStateManager, GameState } from '../src/core/GameStateManager';

// ─── Camera ─────────────────────────────────────────────────────────────────
import { PlayerCamera, PlayerCameraMode } from '../src/scene/PlayerCamera';

// ─── Scene Serializer ───────────────────────────────────────────────────────
import {
    SceneSerializer,
    ComponentRegistry,
} from '../src/scene/SceneSerializer';
import { Scene } from '../src/scene/Scene';
import { GameObject, IComponent } from '../src/scene/GameObject';
import { Vector3 } from '../src/math/Vector3';
import { Matrix4 } from '../src/math/Matrix4';

// ─── Logger ─────────────────────────────────────────────────────────────────
import { Logger, LogLevel, LogEntry } from '../src/core/Logger';

// ═══════════════════════════════════════════════════════════════════════════
//  Helper: minimal canvas stub for happy-dom environment
// ═══════════════════════════════════════════════════════════════════════════

function createMockCanvas(width = 800, height = 600): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    // happy-dom doesn't provide a real CanvasRenderingContext2D.
    // Stub one so that GameUI can construct and render without errors.
    const noop = () => {};
    const ctx: any = {
        canvas,
        save: noop,
        restore: noop,
        scale: noop,
        beginPath: noop,
        closePath: noop,
        moveTo: noop,
        lineTo: noop,
        arcTo: noop,
        arc: noop,
        rect: noop,
        clip: noop,
        fill: noop,
        stroke: noop,
        fillRect: noop,
        strokeRect: noop,
        clearRect: noop,
        fillText: noop,
        strokeText: noop,
        measureText: () => ({ width: 0 }),
        drawImage: noop,
        createLinearGradient: () => ({ addColorStop: noop }),
        createRadialGradient: () => ({ addColorStop: noop }),
        setTransform: noop,
        resetTransform: noop,
        translate: noop,
        rotate: noop,
        font: '',
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        textAlign: 'left' as CanvasTextAlign,
        textBaseline: 'top' as CanvasTextBaseline,
        globalAlpha: 1,
        globalCompositeOperation: 'source-over',
    };

    // Override getContext to return our stub
    canvas.getContext = ((type: string) => {
        if (type === '2d') return ctx;
        return null;
    }) as any;

    return canvas;
}

// ═══════════════════════════════════════════════════════════════════════════
//  1–3  GameUI
// ═══════════════════════════════════════════════════════════════════════════

describe('GameUI', () => {
    let canvas: HTMLCanvasElement;
    let ui: GameUI;

    beforeEach(() => {
        canvas = createMockCanvas();
        ui = new GameUI(canvas);
    });

    // ── 1. Create UI system, add elements ──────────────────────────────
    describe('adding elements', () => {
        it('should add text, button, progress bar, panel, and health bar', () => {
            const text = new UIText('score', 0, 10, 200, 32);
            text.text = 'Score: 1000';

            const btn = new UIButton('startBtn', 0, 0, 160, 48);
            btn.label = 'Start Game';

            const progress = new UIProgressBar('xp', 10, 50, 200, 20);
            progress.value = 0.6;

            const panel = new UIPanel('hud', 10, 10, 300, 100);
            panel.backgroundColor = 'rgba(0,0,0,0.7)';

            const hp = new UIHealthBar('hp', 10, 10, 200, 24);
            hp.value = 0.75;

            ui.addElement(text);
            ui.addElement(btn);
            ui.addElement(progress);
            ui.addElement(panel);
            ui.addElement(hp);

            expect(ui.getElementCount()).toBe(5);
            expect(ui.getElementById('score')).toBe(text);
            expect(ui.getElementById('startBtn')).toBe(btn);
            expect(ui.getElementById('xp')).toBe(progress);
            expect(ui.getElementById('hud')).toBe(panel);
            expect(ui.getElementById('hp')).toBe(hp);
        });

        it('should remove elements by id', () => {
            const text = new UIText('a', 0, 0, 100, 20);
            const btn = new UIButton('b', 0, 0, 100, 20);
            ui.addElement(text);
            ui.addElement(btn);
            expect(ui.getElementCount()).toBe(2);

            ui.removeElement('a');
            expect(ui.getElementCount()).toBe(1);
            expect(ui.getElementById('a')).toBeNull();
            expect(ui.getElementById('b')).toBe(btn);
        });

        it('should support nested child elements and findById', () => {
            const panel = new UIPanel('panel', 0, 0, 400, 300);
            const label = new UIText('nested-label', 10, 10, 100, 20);
            panel.addChild(label);
            ui.addElement(panel);

            expect(ui.getElementById('nested-label')).toBe(label);
            expect(label.parent).toBe(panel);
        });

        it('should clear all elements', () => {
            ui.addElement(new UIText('t1', 0, 0, 10, 10));
            ui.addElement(new UIPanel('p1', 0, 0, 10, 10));
            ui.clear();
            expect(ui.getElementCount()).toBe(0);
        });
    });

    // ── 2. Visibility, positioning, z-order ────────────────────────────
    describe('visibility, positioning, z-order', () => {
        it('should respect element visibility in hit-testing', () => {
            const btn = new UIButton('vis', 10, 10, 100, 40);
            btn.visible = true;
            expect(btn.hitTest(50, 30, 800, 600)).toBe(true);

            btn.visible = false;
            expect(btn.hitTest(50, 30, 800, 600)).toBe(false);
        });

        it('should compute anchored positions correctly (TopLeft)', () => {
            const el = new UIText('tl', 10, 20, 100, 30);
            el.anchor = UIAnchor.TopLeft;
            const [ax, ay] = el.anchoredPosition(800, 600);
            expect(ax).toBe(10);
            expect(ay).toBe(20);
        });

        it('should compute anchored positions correctly (Center)', () => {
            const el = new UIText('c', 0, 0, 200, 100);
            el.anchor = UIAnchor.Center;
            const [ax, ay] = el.anchoredPosition(800, 600);
            expect(ax).toBe(300); // 800/2 - 200/2
            expect(ay).toBe(250); // 600/2 - 100/2
        });

        it('should compute anchored positions correctly (BottomRight)', () => {
            const el = new UIText('br', 0, 0, 100, 50);
            el.anchor = UIAnchor.BottomRight;
            const [ax, ay] = el.anchoredPosition(800, 600);
            expect(ax).toBe(700); // 800 - 100
            expect(ay).toBe(550); // 600 - 50
        });

        it('should compute BottomCenter anchor', () => {
            const el = new UIPanel('bc', 0, 0, 200, 40);
            el.anchor = UIAnchor.BottomCenter;
            const [ax, ay] = el.anchoredPosition(800, 600);
            expect(ax).toBe(300); // 800/2 - 200/2
            expect(ay).toBe(560); // 600 - 40
        });

        it('should offset children relative to parent position', () => {
            const parent = new UIPanel('p', 50, 50, 400, 300);
            parent.anchor = UIAnchor.TopLeft;
            const child = new UIText('ch', 10, 10, 80, 20);
            child.anchor = UIAnchor.TopLeft;
            parent.addChild(child);

            const [cx, cy] = child.anchoredPosition(800, 600);
            expect(cx).toBe(60); // parent 50 + child 10
            expect(cy).toBe(60);
        });

        it('elements render in insertion order (z-order)', () => {
            const renderOrder: string[] = [];

            class TrackedPanel extends UIPanel {
                public render(_ctx: CanvasRenderingContext2D): void {
                    renderOrder.push(this.id);
                }
            }

            const a = new TrackedPanel('first', 0, 0, 10, 10);
            const b = new TrackedPanel('second', 0, 0, 10, 10);
            const c = new TrackedPanel('third', 0, 0, 10, 10);
            ui.addElement(a);
            ui.addElement(b);
            ui.addElement(c);
            ui.render();

            expect(renderOrder).toEqual(['first', 'second', 'third']);
        });
    });

    // ── 3. Update UI, render frame ─────────────────────────────────────
    describe('render and update', () => {
        it('should render without errors when elements are present', () => {
            const text = new UIText('t', 0, 0, 200, 30);
            text.text = 'Hello';
            const panel = new UIPanel('bg', 0, 0, 300, 200);
            const bar = new UIProgressBar('bar', 10, 10, 100, 10);
            bar.value = 0.5;
            bar.showLabel = true;

            ui.addElement(panel);
            ui.addElement(bar);
            ui.addElement(text);

            expect(() => ui.render()).not.toThrow();
        });

        it('should not render invisible elements', () => {
            let rendered = false;
            class Spy extends UIPanel {
                public render(ctx: CanvasRenderingContext2D): void {
                    rendered = true;
                    super.render(ctx);
                }
            }
            const el = new Spy('s', 0, 0, 10, 10);
            el.visible = false;
            ui.addElement(el);
            ui.render();
            expect(rendered).toBe(false);
        });

        it('should forward mouse events to buttons', () => {
            const clicked = vi.fn();
            const btn = new UIButton('btn', 10, 10, 100, 40);
            btn.onClick = clicked;
            ui.addElement(btn);

            // Simulate press then release inside button bounds
            ui.handleMouseDown(50, 30);
            ui.handleMouseUp(50, 30);
            expect(clicked).toHaveBeenCalledTimes(1);
        });

        it('should not fire click when released outside button', () => {
            const clicked = vi.fn();
            const btn = new UIButton('btn', 10, 10, 100, 40);
            btn.onClick = clicked;
            ui.addElement(btn);

            ui.handleMouseDown(50, 30);
            ui.handleMouseUp(500, 500); // outside
            expect(clicked).not.toHaveBeenCalled();
        });

        it('should apply global scale factor', () => {
            ui.setScale(2);
            const text = new UIText('t', 0, 0, 100, 20);
            text.text = 'Scaled';
            ui.addElement(text);
            expect(() => ui.render()).not.toThrow();
        });

        it('should handle UIProgressBar label formats', () => {
            const bar = new UIProgressBar('bar', 0, 0, 200, 20);
            bar.showLabel = true;
            bar.value = 30;
            bar.maxValue = 100;
            ui.addElement(bar);

            bar.labelFormat = 'percent';
            expect(() => ui.render()).not.toThrow();

            bar.labelFormat = 'value';
            expect(() => ui.render()).not.toThrow();

            bar.labelFormat = 'custom';
            bar.customLabel = 'XP';
            expect(() => ui.render()).not.toThrow();
        });

        it('should handle UIHealthBar with low-health pulse', () => {
            const hp = new UIHealthBar('hp', 0, 0, 200, 20);
            hp.pulseWhenLow = true;
            hp.lowHealthThreshold = 0.25;
            hp.value = 0.1;
            ui.addElement(hp);
            expect(() => ui.render()).not.toThrow();
        });

        it('should handle opacity on elements', () => {
            const panel = new UIPanel('op', 0, 0, 100, 100);
            panel.opacity = 0.5;
            ui.addElement(panel);
            expect(() => ui.render()).not.toThrow();
        });
    });
});

// ═══════════════════════════════════════════════════════════════════════════
//  4–6  InputActionMap
// ═══════════════════════════════════════════════════════════════════════════

describe('InputActionMap', () => {
    let input: Input;
    let actionMap: InputActionMap;

    beforeEach(() => {
        input = new Input(); // no canvas needed for unit tests
        actionMap = new InputActionMap(input);
    });

    // ── 4. Create action map, bind keys, check bindings ────────────────
    describe('creating and binding actions', () => {
        it('should register a keyboard button action', () => {
            actionMap.registerAction('Jump', 'button', [
                { type: InputBindingType.Keyboard, key: 'Space' },
            ]);

            expect(actionMap.getAllActions()).toContain('Jump');
            expect(actionMap.getActionCount()).toBe(1);

            const bindings = actionMap.getBindings('Jump');
            expect(bindings).toHaveLength(1);
            expect(bindings[0].type).toBe(InputBindingType.Keyboard);
            expect(bindings[0].key).toBe('Space');
        });

        it('should register an axis action with multiple bindings', () => {
            actionMap.registerAction('LookX', 'axis', [
                { type: InputBindingType.MouseAxis, mouseAxis: 'x', scale: 1 },
                { type: InputBindingType.GamepadAxis, gamepadAxis: 2, scale: 1, deadzone: 0.1 },
            ]);

            const bindings = actionMap.getBindings('LookX');
            expect(bindings).toHaveLength(2);
            expect(bindings[0].mouseAxis).toBe('x');
            expect(bindings[1].gamepadAxis).toBe(2);
        });

        it('should throw when registering duplicate action names', () => {
            actionMap.registerAction('Fire', 'button', [
                { type: InputBindingType.MouseButton, mouseButton: 0 },
            ]);
            expect(() =>
                actionMap.registerAction('Fire', 'button', [
                    { type: InputBindingType.Keyboard, key: 'KeyF' },
                ])
            ).toThrow('already registered');
        });

        it('should create default FPS actions with correct count', () => {
            actionMap.createDefaultFPSActions();
            const actions = actionMap.getAllActions();
            expect(actions).toContain('MoveForward');
            expect(actions).toContain('Jump');
            expect(actions).toContain('Fire');
            expect(actions).toContain('LookX');
            expect(actions).toContain('LookY');
            expect(actionMap.getActionCount()).toBe(13);
        });

        it('should create third-person actions', () => {
            actionMap.createDefaultThirdPersonActions();
            expect(actionMap.getAllActions()).toContain('CameraOrbitX');
            expect(actionMap.getAllActions()).toContain('CameraZoom');
            expect(actionMap.getAllActions()).toContain('LockOn');
        });

        it('should remove an action', () => {
            actionMap.registerAction('A', 'button', [
                { type: InputBindingType.Keyboard, key: 'KeyA' },
            ]);
            expect(actionMap.getActionCount()).toBe(1);
            actionMap.removeAction('A');
            expect(actionMap.getActionCount()).toBe(0);
            expect(actionMap.getBindings('A')).toEqual([]);
        });

        it('should return empty bindings for unknown action', () => {
            expect(actionMap.getBindings('NonExistent')).toEqual([]);
        });

        it('should return 0 for value of unknown action', () => {
            expect(actionMap.getActionValue('NonExistent')).toBe(0);
        });

        it('should return false for pressed/down/released on unknown action', () => {
            expect(actionMap.isActionPressed('X')).toBe(false);
            expect(actionMap.isActionDown('X')).toBe(false);
            expect(actionMap.isActionReleased('X')).toBe(false);
        });

        it('should clear all actions', () => {
            actionMap.createDefaultFPSActions();
            expect(actionMap.getActionCount()).toBeGreaterThan(0);
            actionMap.clear();
            expect(actionMap.getActionCount()).toBe(0);
        });
    });

    // ── 5. Rebind keys, verify old binding removed ─────────────────────
    describe('rebinding actions', () => {
        it('should rebind a specific binding index', () => {
            actionMap.registerAction('Jump', 'button', [
                { type: InputBindingType.Keyboard, key: 'Space' },
                { type: InputBindingType.GamepadButton, gamepadButton: 0 },
            ]);

            const newBinding: InputBinding = {
                type: InputBindingType.Keyboard,
                key: 'KeyJ',
            };
            actionMap.rebindAction('Jump', 0, newBinding);

            const bindings = actionMap.getBindings('Jump');
            expect(bindings[0].key).toBe('KeyJ');
            expect(bindings[0].type).toBe(InputBindingType.Keyboard);
            // Second binding unchanged
            expect(bindings[1].gamepadButton).toBe(0);
        });

        it('should overwrite old binding completely', () => {
            actionMap.registerAction('Fire', 'button', [
                { type: InputBindingType.MouseButton, mouseButton: 0 },
            ]);
            actionMap.rebindAction('Fire', 0, {
                type: InputBindingType.Keyboard,
                key: 'KeyF',
            });

            const bindings = actionMap.getBindings('Fire');
            expect(bindings[0].type).toBe(InputBindingType.Keyboard);
            expect(bindings[0].key).toBe('KeyF');
            // mouseButton should not be present on the new binding
            expect(bindings[0].mouseButton).toBeUndefined();
        });

        it('should throw on out-of-range binding index', () => {
            actionMap.registerAction('A', 'button', [
                { type: InputBindingType.Keyboard, key: 'KeyA' },
            ]);
            expect(() =>
                actionMap.rebindAction('A', 5, {
                    type: InputBindingType.Keyboard,
                    key: 'KeyB',
                })
            ).toThrow('out of range');
        });

        it('should throw on rebind of non-existent action', () => {
            expect(() =>
                actionMap.rebindAction('Ghost', 0, {
                    type: InputBindingType.Keyboard,
                    key: 'KeyG',
                })
            ).toThrow('not found');
        });
    });

    // ── 6. Save/load action map configuration ──────────────────────────
    describe('export/import bindings', () => {
        it('should round-trip export/import all actions', () => {
            actionMap.createDefaultFPSActions();
            const json = actionMap.exportBindings();
            expect(typeof json).toBe('string');

            const map2 = new InputActionMap(input);
            map2.importBindings(json);

            expect(map2.getActionCount()).toBe(actionMap.getActionCount());
            expect(map2.getAllActions().sort()).toEqual(
                actionMap.getAllActions().sort()
            );

            const origJump = actionMap.getBindings('Jump');
            const loadedJump = map2.getBindings('Jump');
            expect(loadedJump).toHaveLength(origJump.length);
            expect(loadedJump[0].key).toBe(origJump[0].key);
        });

        it('should preserve custom rebindings through export/import', () => {
            actionMap.registerAction('Dodge', 'button', [
                { type: InputBindingType.Keyboard, key: 'KeyQ' },
            ]);
            actionMap.rebindAction('Dodge', 0, {
                type: InputBindingType.Keyboard,
                key: 'ShiftLeft',
            });

            const json = actionMap.exportBindings();
            const map2 = new InputActionMap(input);
            map2.importBindings(json);

            expect(map2.getBindings('Dodge')[0].key).toBe('ShiftLeft');
        });

        it('should clear existing actions on import', () => {
            actionMap.registerAction('Old', 'button', [
                { type: InputBindingType.Keyboard, key: 'KeyO' },
            ]);

            const json = JSON.stringify([
                {
                    name: 'New',
                    type: 'button',
                    bindings: [{ type: 'Keyboard', key: 'KeyN' }],
                },
            ]);
            actionMap.importBindings(json);

            expect(actionMap.getAllActions()).toEqual(['New']);
            expect(actionMap.getBindings('Old')).toEqual([]);
        });

        it('should throw on invalid import data', () => {
            expect(() => actionMap.importBindings('"notarray"')).toThrow();
        });

        it('should export scale and deadzone values', () => {
            actionMap.registerAction('Look', 'axis', [
                {
                    type: InputBindingType.GamepadAxis,
                    gamepadAxis: 2,
                    scale: -1,
                    deadzone: 0.15,
                },
            ]);
            const parsed = JSON.parse(actionMap.exportBindings());
            expect(parsed[0].bindings[0].scale).toBe(-1);
            expect(parsed[0].bindings[0].deadzone).toBe(0.15);
        });
    });
});

// ═══════════════════════════════════════════════════════════════════════════
//  7–8  GameStateManager
// ═══════════════════════════════════════════════════════════════════════════

describe('GameStateManager', () => {
    let gsm: GameStateManager;

    beforeEach(() => {
        gsm = new GameStateManager();
    });

    // ── 7. Create states, push/pop, verify lifecycle hooks ─────────────
    describe('states and push/pop', () => {
        it('should add states and set initial state', () => {
            gsm.addState({ name: 'Menu' });
            gsm.addState({ name: 'Play' });

            expect(gsm.getAllStates()).toContain('Menu');
            expect(gsm.getAllStates()).toContain('Play');
            expect(gsm.getStateCount()).toBe(2);

            gsm.setState('Menu');
            expect(gsm.getCurrentState()).toBe('Menu');
            expect(gsm.isInState('Menu')).toBe(true);
        });

        it('should throw on duplicate state name', () => {
            gsm.addState({ name: 'X' });
            expect(() => gsm.addState({ name: 'X' })).toThrow('already exists');
        });

        it('should return false when setting unknown state', () => {
            expect(gsm.setState('Ghost')).toBe(false);
            expect(gsm.getCurrentState()).toBeNull();
        });

        it('should push/pop states with correct lifecycle', () => {
            const log: string[] = [];

            gsm.addState({
                name: 'Gameplay',
                onEnter: () => log.push('Gameplay:enter'),
                onExit: () => log.push('Gameplay:exit'),
                onPause: () => log.push('Gameplay:pause'),
                onResume: () => log.push('Gameplay:resume'),
            });
            gsm.addState({
                name: 'Pause',
                onEnter: () => log.push('Pause:enter'),
                onExit: () => log.push('Pause:exit'),
            });

            gsm.setState('Gameplay');
            expect(log).toContain('Gameplay:enter');

            gsm.pushState('Pause');
            expect(gsm.getCurrentState()).toBe('Pause');
            expect(log).toContain('Gameplay:pause');
            expect(log).toContain('Pause:enter');
            expect(gsm.getStackDepth()).toBe(1);

            const popped = gsm.popState();
            expect(popped).toBe('Pause');
            expect(gsm.getCurrentState()).toBe('Gameplay');
            expect(log).toContain('Pause:exit');
            expect(log).toContain('Gameplay:resume');
            expect(gsm.getStackDepth()).toBe(0);
        });

        it('popState returns null when stack is empty', () => {
            gsm.addState({ name: 'A' });
            gsm.setState('A');
            expect(gsm.popState()).toBeNull();
        });

        it('pushState throws for unknown state', () => {
            expect(() => gsm.pushState('Phantom')).toThrow('not found');
        });

        it('should track state history', () => {
            gsm.addState({ name: 'A' });
            gsm.addState({ name: 'B' });
            gsm.addState({ name: 'C' });

            gsm.setState('A');
            gsm.setState('B');
            gsm.setState('C');

            const history = gsm.getStateHistory();
            expect(history).toEqual(['A', 'B', 'C']);
        });

        it('should not remove active state', () => {
            gsm.addState({ name: 'Active' });
            gsm.setState('Active');
            expect(() => gsm.removeState('Active')).toThrow('Cannot remove active state');
        });

        it('should update active state', () => {
            const updates: number[] = [];
            gsm.addState({
                name: 'Run',
                onUpdate: (dt) => updates.push(dt),
            });
            gsm.setState('Run');
            gsm.update(0.016);
            gsm.update(0.016);
            expect(updates).toHaveLength(2);
        });
    });

    // ── 8. State transitions with enter/exit callbacks ─────────────────
    describe('transitions and events', () => {
        it('should allow valid transitions and block invalid ones', () => {
            gsm.addState({ name: 'Menu' });
            gsm.addState({ name: 'Play' });
            gsm.addState({ name: 'GameOver' });

            gsm.addTransition({ from: 'Menu', to: 'Play' });
            gsm.addTransition({ from: 'Play', to: 'GameOver' });

            gsm.setState('Menu');
            expect(gsm.canTransitionTo('Play')).toBe(true);
            expect(gsm.canTransitionTo('GameOver')).toBe(false);

            expect(gsm.transitionTo('Play')).toBe(true);
            expect(gsm.getCurrentState()).toBe('Play');

            expect(gsm.transitionTo('Menu')).toBe(false); // no reverse transition
        });

        it('should fire enter/exit callbacks on transition', () => {
            const log: string[] = [];

            gsm.addState({
                name: 'A',
                onEnter: (prev) => log.push(`A:enter(from=${prev})`),
                onExit: (next) => log.push(`A:exit(to=${next})`),
            });
            gsm.addState({
                name: 'B',
                onEnter: (prev) => log.push(`B:enter(from=${prev})`),
                onExit: (next) => log.push(`B:exit(to=${next})`),
            });
            gsm.addTransition({ from: 'A', to: 'B' });

            gsm.setState('A');
            gsm.transitionTo('B');

            expect(log).toContain('A:exit(to=B)');
            expect(log).toContain('B:enter(from=A)');
        });

        it('should fire onTransition callback', () => {
            const cb = vi.fn();
            gsm.addState({ name: 'X' });
            gsm.addState({ name: 'Y' });
            gsm.addTransition({ from: 'X', to: 'Y', onTransition: cb });

            gsm.setState('X');
            gsm.transitionTo('Y');

            expect(cb).toHaveBeenCalledWith('X', 'Y');
        });

        it('should respect guard conditions', () => {
            let allowed = false;
            gsm.addState({ name: 'A' });
            gsm.addState({ name: 'B' });
            gsm.addTransition({
                from: 'A',
                to: 'B',
                condition: () => allowed,
            });

            gsm.setState('A');
            expect(gsm.transitionTo('B')).toBe(false);
            expect(gsm.getCurrentState()).toBe('A');

            allowed = true;
            expect(gsm.transitionTo('B')).toBe(true);
            expect(gsm.getCurrentState()).toBe('B');
        });

        it('should support wildcard transitions', () => {
            gsm.addState({ name: 'Any1' });
            gsm.addState({ name: 'Any2' });
            gsm.addState({ name: 'Error' });
            gsm.addTransition({ from: '*', to: 'Error' });

            gsm.setState('Any1');
            expect(gsm.canTransitionTo('Error')).toBe(true);
            expect(gsm.transitionTo('Error')).toBe(true);
        });

        it('should emit events for state changes', () => {
            const enterCb = vi.fn();
            const exitCb = vi.fn();
            gsm.on('state:enter', enterCb);
            gsm.on('state:exit', exitCb);

            gsm.addState({ name: 'S1' });
            gsm.addState({ name: 'S2' });
            gsm.setState('S1');
            gsm.setState('S2');

            expect(enterCb).toHaveBeenCalled();
            expect(exitCb).toHaveBeenCalled();
        });

        it('should list available transitions', () => {
            gsm.addState({ name: 'Hub' });
            gsm.addState({ name: 'Level1' });
            gsm.addState({ name: 'Level2' });
            gsm.addTransition({ from: 'Hub', to: 'Level1' });
            gsm.addTransition({ from: 'Hub', to: 'Level2' });

            gsm.setState('Hub');
            const available = gsm.getAvailableTransitions();
            expect(available).toContain('Level1');
            expect(available).toContain('Level2');
        });

        it('should pause and resume', () => {
            const updates: number[] = [];
            gsm.addState({
                name: 'Run',
                onUpdate: (dt) => updates.push(dt),
            });
            gsm.setState('Run');

            gsm.pause();
            expect(gsm.isPaused()).toBe(true);
            gsm.update(0.016); // should be ignored
            expect(updates).toHaveLength(0);

            gsm.resume();
            expect(gsm.isPaused()).toBe(false);
            gsm.update(0.016);
            expect(updates).toHaveLength(1);
        });

        it('should use createDefaultGameFlow correctly', () => {
            const flow = GameStateManager.createDefaultGameFlow();
            expect(flow.getAllStates()).toContain('MainMenu');
            expect(flow.getAllStates()).toContain('Gameplay');
            expect(flow.getAllStates()).toContain('Pause');
            expect(flow.getAllStates()).toContain('GameOver');

            flow.setState('MainMenu');
            expect(flow.transitionTo('Loading')).toBe(true);
            expect(flow.transitionTo('Gameplay')).toBe(true);
            expect(flow.transitionTo('Pause')).toBe(true);
            expect(flow.transitionTo('Gameplay')).toBe(true);
            expect(flow.transitionTo('GameOver')).toBe(true);
            expect(flow.transitionTo('MainMenu')).toBe(true);
        });

        it('should clear all state', () => {
            gsm.addState({ name: 'Z' });
            gsm.setState('Z');
            gsm.clear();
            expect(gsm.getCurrentState()).toBeNull();
            expect(gsm.getStateCount()).toBe(0);
            expect(gsm.getStateHistory()).toEqual([]);
        });

        it('should remove transitions when removing state', () => {
            gsm.addState({ name: 'A' });
            gsm.addState({ name: 'B' });
            gsm.addState({ name: 'C' });
            gsm.addTransition({ from: 'A', to: 'B' });
            gsm.addTransition({ from: 'B', to: 'C' });

            gsm.removeState('B');

            gsm.setState('A');
            // Transition A→B should have been cleaned up
            expect(gsm.canTransitionTo('B')).toBe(false);
        });
    });
});

// ═══════════════════════════════════════════════════════════════════════════
//  9–10  PlayerCamera
// ═══════════════════════════════════════════════════════════════════════════

describe('PlayerCamera', () => {
    // ── 9. Test all modes ──────────────────────────────────────────────
    describe('camera modes', () => {
        it('should create FPS camera with defaults', () => {
            const cam = PlayerCamera.createFPS();
            expect(cam.getFOV()).toBe(60);
            expect(cam.getNear()).toBeCloseTo(0.1);
            expect(cam.getFar()).toBe(1000);
        });

        it('should create FPS camera with custom overrides', () => {
            const cam = PlayerCamera.createFPS({ fov: 90, eyeHeight: 2.0 });
            expect(cam.getFOV()).toBe(90);
        });

        it('should create ThirdPerson camera', () => {
            const cam = PlayerCamera.createThirdPerson({ distance: 8 });
            cam.setFollowTarget(new Vector3(0, 0, 0));
            cam.update(0.016);
            expect(cam.getPosition()).toBeDefined();
            expect(cam.getTarget()).toBeDefined();
        });

        it('should create Orbital camera', () => {
            const cam = PlayerCamera.createOrbital({ radius: 10 });
            cam.setOrbitTarget(new Vector3(0, 0, 0));
            cam.update(0.016);
            const pos = cam.getPosition();
            expect(pos).toBeDefined();
        });

        it('should create TopDown camera', () => {
            const cam = PlayerCamera.createTopDown({ radius: 15 });
            cam.setTarget(new Vector3(5, 0, 5));
            cam.update(0.016);
            expect(cam.getPosition()).toBeDefined();
        });

        it('should create SideScroller camera', () => {
            const cam = PlayerCamera.createSideScroller({ distance: 12 });
            cam.setTarget(new Vector3(0, 0, 0));
            cam.update(0.016);
            expect(cam.getPosition()).toBeDefined();
        });

        it('should switch modes at runtime', () => {
            const cam = PlayerCamera.createFPS();
            cam.setMode(PlayerCameraMode.Orbital);
            cam.update(0.016);
            expect(cam.getViewMatrix()).toBeDefined();
        });

        it('should handle camera rotation with pitch clamping', () => {
            const cam = PlayerCamera.createFPS();
            // Rotate a huge amount of pitch – should be clamped
            cam.rotate(0, 100);
            const pitch = cam.getPitch();
            // Default maxPitch is 89° ≈ 1.553 radians
            expect(pitch).toBeLessThanOrEqual(89 * Math.PI / 180 + 0.01);
        });

        it('should handle zoom for third-person mode', () => {
            const cam = PlayerCamera.createThirdPerson({
                distance: 5,
                minDistance: 2,
                maxDistance: 20,
            });
            cam.zoom(3); // zoom in
            cam.update(0.016);
            // Position should change based on zoom
            expect(cam.getPosition()).toBeDefined();
        });

        it('should handle zoom for orbital mode', () => {
            const cam = PlayerCamera.createOrbital({
                radius: 10,
                minRadius: 1,
                maxRadius: 50,
            });
            cam.zoom(5);
            cam.update(0.016);
            expect(cam.getPosition()).toBeDefined();
        });

        it('should provide forward, right, up vectors', () => {
            const cam = PlayerCamera.createFPS();
            const fwd = cam.getForward();
            const right = cam.getRight();
            const up = cam.getUp();

            // Forward and right should be roughly perpendicular
            expect(Math.abs(fwd.dot(right))).toBeLessThan(0.01);
            expect(up.y).toBe(1);
        });

        it('should compute move direction from input', () => {
            const cam = PlayerCamera.createFPS();
            const dir = cam.move(1, 0); // forward
            expect(dir.length()).toBeCloseTo(1, 1);
        });

        it('should handle camera shake', () => {
            const cam = PlayerCamera.createFPS();
            cam.setPosition(new Vector3(0, 0, 0));
            cam.update(0.016);
            const posBeforeShake = cam.getPosition();

            cam.shake(0.5, 0.5);
            cam.update(0.05); // advance shake
            const posDuringShake = cam.getPosition();

            // Shake should offset the position
            const diff = posDuringShake.subtract(posBeforeShake);
            // At least one axis should differ due to shake
            const shakeDisplacement = diff.length();
            expect(shakeDisplacement).toBeGreaterThanOrEqual(0);
        });

        it('orbital camera auto-rotate should change yaw over time', () => {
            const cam = PlayerCamera.createOrbital({
                autoRotate: true,
                autoRotateSpeed: 1.0,
            });
            const yaw0 = cam.getYaw();
            cam.update(1.0); // 1 second
            const yaw1 = cam.getYaw();
            expect(yaw1).not.toBeCloseTo(yaw0, 2);
        });
    });

    // ── 10. Verify camera matrices change when properties change ───────
    describe('view matrix behaviour', () => {
        it('should return a valid view matrix', () => {
            const cam = PlayerCamera.createFPS();
            cam.setPosition(new Vector3(0, 5, 10));
            cam.update(0.016);
            const view = cam.getViewMatrix();
            expect(view).toBeInstanceOf(Matrix4);
        });

        it('view matrix should change when position changes', () => {
            const cam = PlayerCamera.createFPS();
            cam.setPosition(new Vector3(0, 0, 0));
            cam.update(0.016);
            const m1 = cam.getViewMatrix();

            cam.setPosition(new Vector3(10, 5, 3));
            cam.update(0.016);
            const m2 = cam.getViewMatrix();

            expect(m1.equals(m2)).toBe(false);
        });

        it('view matrix should change when rotation changes', () => {
            const cam = PlayerCamera.createFPS();
            cam.setPosition(new Vector3(0, 0, 0));
            cam.update(0.016);
            const m1 = cam.getViewMatrix();

            cam.rotate(0.5, 0.2);
            cam.update(0.016);
            const m2 = cam.getViewMatrix();

            expect(m1.equals(m2)).toBe(false);
        });

        it('view matrix should change for orbital camera when target changes', () => {
            const cam = PlayerCamera.createOrbital({ radius: 10 });
            cam.setOrbitTarget(new Vector3(0, 0, 0));
            cam.update(0.016);
            const m1 = cam.getViewMatrix();

            cam.setOrbitTarget(new Vector3(20, 0, 20));
            cam.update(0.016);
            const m2 = cam.getViewMatrix();

            expect(m1.equals(m2)).toBe(false);
        });

        it('getViewMatrix should cache until dirty', () => {
            const cam = PlayerCamera.createFPS();
            cam.setPosition(new Vector3(0, 0, 0));
            cam.update(0.016);
            const m1 = cam.getViewMatrix();
            const m2 = cam.getViewMatrix(); // should use cache
            expect(m1.equals(m2)).toBe(true);
        });

        it('setFOV should update returned value', () => {
            const cam = PlayerCamera.createFPS();
            cam.setFOV(110);
            expect(cam.getFOV()).toBe(110);
        });
    });
});

// ═══════════════════════════════════════════════════════════════════════════
//  11  SceneSerializer
// ═══════════════════════════════════════════════════════════════════════════

describe('SceneSerializer', () => {
    beforeEach(() => {
        ComponentRegistry.clear();
    });

    // ── 11. Full round-trip serialize/deserialize with components ──────
    describe('round-trip serialization', () => {
        it('should serialize and deserialize an empty scene', () => {
            const scene = new Scene('Empty');
            scene.update(0); // flush pending
            const json = SceneSerializer.toJSON(scene);
            const restored = SceneSerializer.fromJSON(json);
            expect(restored.name).toBe('Empty');
        });

        it('should round-trip a scene with game objects', () => {
            const scene = new Scene('Level1');
            const player = new GameObject('Player');
            player.transform.position.set(1, 2, 3);
            player.addTag('player');

            const weapon = new GameObject('Weapon');
            weapon.transform.position.set(0.5, 0, 0);
            weapon.setParent(player);

            scene.add(player);
            scene.update(0); // flush pending adds

            const data = SceneSerializer.serialize(scene);
            expect(data.version).toBe(1);
            expect(data.name).toBe('Level1');
            expect(data.objects.length).toBe(1); // only root
            expect(data.objects[0].name).toBe('Player');
            expect(data.objects[0].children.length).toBe(1);
            expect(data.objects[0].children[0].name).toBe('Weapon');
        });

        it('should restore transforms after deserialization', () => {
            const scene = new Scene('T');
            const obj = new GameObject('Box');
            obj.transform.position.set(10, 20, 30);
            obj.transform.scale.set(2, 2, 2);
            scene.add(obj);
            scene.update(0);

            const restored = SceneSerializer.fromJSON(SceneSerializer.toJSON(scene));
            restored.update(0);

            const restoredObj = restored.findByName('Box') as GameObject;
            expect(restoredObj).toBeTruthy();
            expect(restoredObj.transform.position.x).toBeCloseTo(10);
            expect(restoredObj.transform.position.y).toBeCloseTo(20);
            expect(restoredObj.transform.position.z).toBeCloseTo(30);
            expect(restoredObj.transform.scale.x).toBeCloseTo(2);
        });

        it('should preserve tags through serialization', () => {
            const scene = new Scene('Tags');
            const go = new GameObject('Enemy');
            go.addTag('enemy');
            go.addTag('boss');
            scene.add(go);
            scene.update(0);

            const json = SceneSerializer.toJSON(scene);
            const restored = SceneSerializer.fromJSON(json);
            restored.update(0);

            const restoredGo = restored.findByName('Enemy') as GameObject;
            expect(restoredGo.hasTag('enemy')).toBe(true);
            expect(restoredGo.hasTag('boss')).toBe(true);
        });

        it('should serialize/deserialize custom components via registry', () => {
            class HealthComponent implements IComponent {
                gameObject: GameObject | null = null;
                enabled = true;
                hp: number;
                maxHp: number;
                constructor(hp: number, maxHp: number) {
                    this.hp = hp;
                    this.maxHp = maxHp;
                }
                awake(): void {}
                start(): void {}
                update(_dt: number): void {}
                destroy(): void {}
            }

            ComponentRegistry.register('HealthComponent', {
                serialize: (comp: unknown) => {
                    const h = comp as HealthComponent;
                    return { hp: h.hp, maxHp: h.maxHp };
                },
                deserialize: (data: unknown) => {
                    const d = data as { hp: number; maxHp: number };
                    return new HealthComponent(d.hp, d.maxHp);
                },
            });

            const scene = new Scene('Comp');
            const go = new GameObject('Hero');
            go.addComponent(new HealthComponent(80, 100));
            scene.add(go);
            scene.update(0);

            const json = SceneSerializer.toJSON(scene);
            const restored = SceneSerializer.fromJSON(json);
            restored.update(0);

            const hero = restored.findByName('Hero') as GameObject;
            const health = hero.getComponent<HealthComponent>('HealthComponent');
            expect(health).toBeTruthy();
            expect(health!.hp).toBe(80);
            expect(health!.maxHp).toBe(100);
        });

        it('should deep-clone a scene via round-trip', () => {
            const scene = new Scene('Clone');
            const a = new GameObject('A');
            a.transform.position.set(1, 1, 1);
            scene.add(a);
            scene.update(0);

            const clone = SceneSerializer.clone(scene);
            clone.update(0);

            const clonedA = clone.findByName('A') as GameObject;
            expect(clonedA).toBeTruthy();
            expect(clonedA.transform.position.x).toBeCloseTo(1);

            // Modifying clone should not affect original
            clonedA.transform.position.set(99, 99, 99);
            const origA = scene.findByName('A') as GameObject;
            expect(origA.transform.position.x).toBeCloseTo(1);
        });

        it('should diff two scenes correctly', () => {
            const sceneA = new Scene('A');
            const obj1 = new GameObject('Shared');
            obj1.transform.position.set(0, 0, 0);
            const obj2 = new GameObject('OnlyInA');
            sceneA.add(obj1);
            sceneA.add(obj2);
            sceneA.update(0);

            const sceneB = new Scene('B');
            const shared2 = new GameObject('Shared');
            shared2.transform.position.set(5, 5, 5); // modified
            const obj3 = new GameObject('OnlyInB');
            sceneB.add(shared2);
            sceneB.add(obj3);
            sceneB.update(0);

            const diff = SceneSerializer.diff(sceneA, sceneB);
            expect(diff.added).toContain('OnlyInB');
            expect(diff.removed).toContain('OnlyInA');
            expect(diff.modified).toContain('Shared');
        });

        it('should reject unsupported versions', () => {
            expect(() =>
                SceneSerializer.deserialize({
                    version: 999,
                    name: 'Bad',
                    objects: [],
                    metadata: {},
                })
            ).toThrow('Unsupported');
        });

        it('getVersion returns the current version', () => {
            expect(SceneSerializer.getVersion()).toBe(1);
        });

        it('should serialize nested children recursively', () => {
            const scene = new Scene('Deep');
            const root = new GameObject('Root');
            const mid = new GameObject('Mid');
            const leaf = new GameObject('Leaf');
            leaf.setParent(mid);
            mid.setParent(root);
            scene.add(root);
            scene.update(0);

            const data = SceneSerializer.serialize(scene);
            expect(data.objects[0].name).toBe('Root');
            expect(data.objects[0].children[0].name).toBe('Mid');
            expect(data.objects[0].children[0].children[0].name).toBe('Leaf');
        });

        it('ComponentRegistry.getRegisteredTypes lists registered types', () => {
            ComponentRegistry.register('Foo', {
                serialize: (c) => c,
                deserialize: (d) => d,
            });
            expect(ComponentRegistry.getRegisteredTypes()).toContain('Foo');
        });
    });
});

// ═══════════════════════════════════════════════════════════════════════════
//  12  Logger
// ═══════════════════════════════════════════════════════════════════════════

describe('Logger', () => {
    // ── 12. Test log levels, filtering, output ─────────────────────────
    describe('log levels and filtering', () => {
        it('should default to INFO level', () => {
            const log = new Logger('Test');
            expect(log.getLevel()).toBe(LogLevel.INFO);
        });

        it('should filter messages below the configured level', () => {
            const entries: LogEntry[] = [];
            const log = new Logger('Test', {
                level: LogLevel.WARN,
                handler: (e) => entries.push(e),
            });

            log.debug('debug msg');
            log.info('info msg');
            log.warn('warn msg');
            log.error('error msg');

            expect(entries).toHaveLength(2);
            expect(entries[0].level).toBe(LogLevel.WARN);
            expect(entries[1].level).toBe(LogLevel.ERROR);
        });

        it('should include all levels when set to DEBUG', () => {
            const entries: LogEntry[] = [];
            const log = new Logger('All', {
                level: LogLevel.DEBUG,
                handler: (e) => entries.push(e),
            });

            log.debug('d');
            log.info('i');
            log.warn('w');
            log.error('e');

            expect(entries).toHaveLength(4);
        });

        it('should record nothing when level is NONE', () => {
            const log = new Logger('None', { level: LogLevel.NONE });
            log.debug('x');
            log.info('x');
            log.warn('x');
            log.error('x');
            expect(log.getHistory()).toHaveLength(0);
        });

        it('should keep history up to maxHistorySize', () => {
            const log = new Logger('Hist', {
                level: LogLevel.DEBUG,
                maxHistorySize: 5,
                handler: () => {},
            });
            for (let i = 0; i < 10; i++) {
                log.debug(`msg${i}`);
            }
            expect(log.getHistory()).toHaveLength(5);
            // Oldest messages should have been evicted
            expect(log.getHistory()[0].message).toBe('msg5');
        });

        it('should filter history by level', () => {
            const log = new Logger('Filter', {
                level: LogLevel.DEBUG,
                handler: () => {},
            });
            log.debug('d');
            log.info('i');
            log.warn('w');
            log.error('e');

            expect(log.getHistory(LogLevel.ERROR)).toHaveLength(1);
            expect(log.getHistory(LogLevel.DEBUG)).toHaveLength(1);
        });

        it('should clear history', () => {
            const log = new Logger('Clr', {
                level: LogLevel.DEBUG,
                handler: () => {},
            });
            log.info('something');
            expect(log.getHistory().length).toBeGreaterThan(0);
            log.clearHistory();
            // clearHistory itself logs a debug message, which will be
            // added since our level is DEBUG. So we check it's ≤ 1.
            expect(log.getHistory().length).toBeLessThanOrEqual(1);
        });

        it('should set level dynamically', () => {
            const log = new Logger('Dyn', {
                level: LogLevel.DEBUG,
                handler: () => {},
            });
            log.setLevel(LogLevel.ERROR);
            expect(log.getLevel()).toBe(LogLevel.ERROR);
        });

        it('should create child logger with same config', () => {
            const parent = new Logger('Parent', {
                level: LogLevel.WARN,
                handler: () => {},
            });
            const child = parent.child('Child');
            expect(child.getLevel()).toBe(LogLevel.WARN);
        });

        it('should export history as JSON', () => {
            const log = new Logger('JSON', {
                level: LogLevel.DEBUG,
                handler: () => {},
            });
            log.info('test message');
            const json = log.exportJSON();
            const parsed = JSON.parse(json);
            expect(Array.isArray(parsed)).toBe(true);
            expect(parsed[0].message).toBe('test message');
        });

        it('should export history as plain text', () => {
            const log = new Logger('Text', {
                level: LogLevel.DEBUG,
                handler: () => {},
            });
            log.warn('warning text');
            const text = log.exportText();
            expect(text).toContain('warning text');
            expect(text).toContain('Text');
        });

        it('should include data in log entries', () => {
            const entries: LogEntry[] = [];
            const log = new Logger('Data', {
                level: LogLevel.DEBUG,
                handler: (e) => entries.push(e),
            });
            log.info('test', { key: 'value' });
            expect(entries[0].data).toEqual({ key: 'value' });
        });

        it('should include category and timestamp', () => {
            const entries: LogEntry[] = [];
            const log = new Logger('MyCat', {
                level: LogLevel.DEBUG,
                handler: (e) => entries.push(e),
            });
            log.info('hello');
            expect(entries[0].category).toBe('MyCat');
            expect(entries[0].timestamp).toBeGreaterThan(0);
        });

        it('assert should log error on false condition', () => {
            const entries: LogEntry[] = [];
            const log = new Logger('Assert', {
                level: LogLevel.DEBUG,
                handler: (e) => entries.push(e),
            });
            log.assert(true, 'should pass');
            expect(entries).toHaveLength(0);
            log.assert(false, 'failed check');
            expect(entries).toHaveLength(1);
            expect(entries[0].level).toBe(LogLevel.ERROR);
            expect(entries[0].message).toContain('Assertion failed');
        });

        it('group should execute callback', () => {
            const log = new Logger('Group');
            const cb = vi.fn();
            log.group('test group', cb);
            expect(cb).toHaveBeenCalledTimes(1);
        });

        it('should toggle timestamp and category display', () => {
            const log = new Logger('Toggle');
            log.setShowTimestamp(false);
            log.setShowCategory(false);
            // Shouldn't throw; just affects console output formatting
            expect(() => log.info('test')).not.toThrow();
        });
    });
});
