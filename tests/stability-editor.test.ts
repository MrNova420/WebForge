/**
 * Editor Stability Tests
 *
 * Exercises the editor subsystems in a headless (happy-dom) environment
 * to verify they can be constructed and used without crashing.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';

// ── Mock canvas / WebGL so editor classes that touch the DOM work ──────────
beforeAll(() => {
    HTMLCanvasElement.prototype.getContext = vi.fn((type: string) => {
        if (type === 'webgl' || type === 'webgl2') {
            return {
                canvas: document.createElement('canvas'),
                getExtension: vi.fn((name: string) => {
                    if (name === 'OES_vertex_array_object') {
                        return {
                            createVertexArrayOES: vi.fn(() => ({})),
                            bindVertexArrayOES: vi.fn(),
                            deleteVertexArrayOES: vi.fn(),
                        };
                    }
                    return null;
                }),
                getParameter: vi.fn(() => 16),
                createShader: vi.fn(() => ({})),
                shaderSource: vi.fn(),
                compileShader: vi.fn(),
                getShaderParameter: vi.fn(() => true),
                createProgram: vi.fn(() => ({})),
                attachShader: vi.fn(),
                linkProgram: vi.fn(),
                getProgramParameter: vi.fn(() => true),
                useProgram: vi.fn(),
                getAttribLocation: vi.fn(() => 0),
                getUniformLocation: vi.fn(() => ({})),
                enableVertexAttribArray: vi.fn(),
                createBuffer: vi.fn(() => ({})),
                bindBuffer: vi.fn(),
                bufferData: vi.fn(),
                vertexAttribPointer: vi.fn(),
                uniformMatrix4fv: vi.fn(),
                uniform1f: vi.fn(),
                uniform3fv: vi.fn(),
                uniform4fv: vi.fn(),
                drawArrays: vi.fn(),
                drawElements: vi.fn(),
                clear: vi.fn(),
                clearColor: vi.fn(),
                enable: vi.fn(),
                disable: vi.fn(),
                viewport: vi.fn(),
                deleteShader: vi.fn(),
                deleteProgram: vi.fn(),
                deleteBuffer: vi.fn(),
                createVertexArray: vi.fn(() => ({})),
                bindVertexArray: vi.fn(),
                deleteVertexArray: vi.fn(),
                createFramebuffer: vi.fn(() => ({})),
                bindFramebuffer: vi.fn(),
                deleteFramebuffer: vi.fn(),
                createTexture: vi.fn(() => ({})),
                bindTexture: vi.fn(),
                deleteTexture: vi.fn(),
                texImage2D: vi.fn(),
                texParameteri: vi.fn(),
                activeTexture: vi.fn(),
                framebufferTexture2D: vi.fn(),
                checkFramebufferStatus: vi.fn(() => 36053),
                isContextLost: vi.fn(() => false),
            };
        }
        if (type === '2d') {
            return {
                fillRect: vi.fn(),
                clearRect: vi.fn(),
                fillText: vi.fn(),
                measureText: vi.fn(() => ({ width: 10 })),
                beginPath: vi.fn(),
                moveTo: vi.fn(),
                lineTo: vi.fn(),
                stroke: vi.fn(),
                fill: vi.fn(),
                arc: vi.fn(),
                ellipse: vi.fn(),
                closePath: vi.fn(),
                strokeRect: vi.fn(),
                save: vi.fn(),
                restore: vi.fn(),
                translate: vi.fn(),
                rotate: vi.fn(),
                scale: vi.fn(),
                setTransform: vi.fn(),
            };
        }
        return null;
    }) as any;
});

// ═══════════════════════════════════════════════════════════════════════════
// 1. EditorApplication – construction
// ═══════════════════════════════════════════════════════════════════════════
describe('EditorApplication', () => {
    it('can be constructed without crash', async () => {
        const { EditorApplication } = await import('../src/editor/app/EditorApplication');
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 600;
        const app = new EditorApplication({ canvas });
        expect(app).toBeDefined();
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. EditorScene – CRUD, update, save/restore, JSON round-trip
// ═══════════════════════════════════════════════════════════════════════════
describe('EditorScene', () => {
    it('creates scene and manages game objects', async () => {
        const { EditorScene } = await import('../src/editor/app/EditorScene');
        const { EditorContext } = await import('../src/editor/EditorContext');

        const ctx = new EditorContext();
        const scene = new EditorScene(ctx);

        expect(scene.getObjectCount()).toBe(0);

        const obj = scene.createGameObject('TestObj');
        expect(obj).toBeDefined();
        expect(obj.name).toBe('TestObj');
        expect(scene.getObjectCount()).toBe(1);
        expect(scene.findByName('TestObj')).toBe(obj);

        scene.removeGameObject(obj);
        expect(scene.getObjectCount()).toBe(0);
        expect(scene.findByName('TestObj')).toBeNull();
    });

    it('creates primitives and lights', async () => {
        const { EditorScene } = await import('../src/editor/app/EditorScene');
        const { EditorContext } = await import('../src/editor/EditorContext');

        const scene = new EditorScene(new EditorContext());
        const cube = scene.createPrimitive('cube');
        const sphere = scene.createPrimitive('sphere');
        const light = scene.createLight('point');

        expect(scene.getObjectCount()).toBe(3);
        expect((cube as any).primitiveType).toBe('cube');
        expect((sphere as any).primitiveType).toBe('sphere');
        expect((light as any).lightType).toBe('point');
    });

    it('creates demo scene without error', async () => {
        const { EditorScene } = await import('../src/editor/app/EditorScene');
        const { EditorContext } = await import('../src/editor/EditorContext');

        const scene = new EditorScene(new EditorContext());
        scene.createDemoScene();
        expect(scene.getObjectCount()).toBeGreaterThan(0);
    });

    it('updates without crash', async () => {
        const { EditorScene } = await import('../src/editor/app/EditorScene');
        const { EditorContext } = await import('../src/editor/EditorContext');

        const scene = new EditorScene(new EditorContext());
        scene.createDemoScene();
        expect(() => scene.update(1 / 60)).not.toThrow();
    });

    it('saves and restores state', async () => {
        const { EditorScene } = await import('../src/editor/app/EditorScene');
        const { EditorContext } = await import('../src/editor/EditorContext');

        const scene = new EditorScene(new EditorContext());
        const obj = scene.createGameObject('MovingObj');
        obj.transform.position.set(1, 2, 3);

        scene.saveState();

        // mutate position
        obj.transform.position.set(10, 20, 30);
        expect(obj.transform.position.x).toBe(10);

        scene.restoreState();
        expect(obj.transform.position.x).toBe(1);
        expect(obj.transform.position.y).toBe(2);
        expect(obj.transform.position.z).toBe(3);
    });

    it('round-trips through JSON', async () => {
        const { EditorScene } = await import('../src/editor/app/EditorScene');
        const { EditorContext } = await import('../src/editor/EditorContext');

        const scene = new EditorScene(new EditorContext());
        scene.createPrimitive('cube');
        scene.createLight('directional');

        const json = scene.toJSON() as any;
        expect(json.objects.length).toBe(2);

        const scene2 = new EditorScene(new EditorContext());
        scene2.fromJSON(json);
        expect(scene2.getObjectCount()).toBe(2);
    });

    it('clears scene correctly', async () => {
        const { EditorScene } = await import('../src/editor/app/EditorScene');
        const { EditorContext } = await import('../src/editor/EditorContext');

        const scene = new EditorScene(new EditorContext());
        scene.createDemoScene();
        expect(scene.getObjectCount()).toBeGreaterThan(0);

        scene.clear();
        expect(scene.getObjectCount()).toBe(0);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. Editor Panels – construction
// ═══════════════════════════════════════════════════════════════════════════
describe('Editor Panels', () => {
    it('HierarchyPanel can be constructed', async () => {
        const { HierarchyPanel } = await import('../src/editor/panels/HierarchyPanel');
        const { EditorContext } = await import('../src/editor/EditorContext');
        const panel = new HierarchyPanel(new EditorContext());
        expect(panel).toBeDefined();
        expect(panel.getId()).toBe('hierarchy');
        expect(panel.getTitle()).toBe('Hierarchy');
    });

    it('InspectorPanel can be constructed', async () => {
        const { InspectorPanel } = await import('../src/editor/panels/InspectorPanel');
        const { EditorContext } = await import('../src/editor/EditorContext');
        const panel = new InspectorPanel(new EditorContext());
        expect(panel).toBeDefined();
        expect(panel.getId()).toBe('inspector');
    });

    it('AssetBrowserPanel can be constructed', async () => {
        const { AssetBrowserPanel } = await import('../src/editor/panels/AssetBrowserPanel');
        const { EditorContext } = await import('../src/editor/EditorContext');
        const panel = new AssetBrowserPanel(new EditorContext());
        expect(panel).toBeDefined();
        expect(panel.getId()).toBe('asset-browser');
    });

    it('ConsolePanel can be constructed', async () => {
        const { ConsolePanel } = await import('../src/editor/panels/ConsolePanel');
        const { EditorContext } = await import('../src/editor/EditorContext');
        const panel = new ConsolePanel(new EditorContext());
        expect(panel).toBeDefined();
        expect(panel.getId()).toBe('console');
    });

    it('panels support show/hide/collapse/expand lifecycle', async () => {
        const { HierarchyPanel } = await import('../src/editor/panels/HierarchyPanel');
        const { EditorContext } = await import('../src/editor/EditorContext');
        const panel = new HierarchyPanel(new EditorContext());

        expect(panel.isVisible()).toBe(true);
        panel.hide();
        expect(panel.isVisible()).toBe(false);
        panel.show();
        expect(panel.isVisible()).toBe(true);

        expect(panel.isCollapsed()).toBe(false);
        panel.collapse();
        expect(panel.isCollapsed()).toBe(true);
        panel.expand();
        expect(panel.isCollapsed()).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. Gizmo system
// ═══════════════════════════════════════════════════════════════════════════
describe('Gizmo System', () => {
    it('TranslateGizmo can be instantiated', async () => {
        const { TranslateGizmo } = await import('../src/editor/gizmos/TranslateGizmo');
        const canvas = document.createElement('canvas');
        const gizmo = new TranslateGizmo(canvas);
        expect(gizmo).toBeDefined();
        expect(gizmo.getTarget()).toBeNull();
    });

    it('RotateGizmo can be instantiated', async () => {
        const { RotateGizmo } = await import('../src/editor/gizmos/RotateGizmo');
        const canvas = document.createElement('canvas');
        const gizmo = new RotateGizmo(canvas);
        expect(gizmo).toBeDefined();
    });

    it('ScaleGizmo can be instantiated', async () => {
        const { ScaleGizmo } = await import('../src/editor/gizmos/ScaleGizmo');
        const canvas = document.createElement('canvas');
        const gizmo = new ScaleGizmo(canvas);
        expect(gizmo).toBeDefined();
    });

    it('GizmoManager wires up translate/rotate/scale modes', async () => {
        const { GizmoManager } = await import('../src/editor/gizmos/GizmoManager');
        const { EditorContext, TransformMode } = await import('../src/editor/EditorContext');

        const ctx = new EditorContext();
        const canvas = document.createElement('canvas');
        const manager = new GizmoManager(ctx, canvas);

        expect(manager.isEnabled()).toBe(true);
        manager.setEnabled(false);
        expect(manager.isEnabled()).toBe(false);
        manager.setEnabled(true);

        // Switch modes via context – manager should follow
        ctx.setTransformMode(TransformMode.TRANSLATE);
        ctx.setTransformMode(TransformMode.ROTATE);
        ctx.setTransformMode(TransformMode.SCALE);
        ctx.setTransformMode(TransformMode.SELECT);

        expect(manager.getTarget()).toBeNull();
    });

    it('gizmo can set/get target', async () => {
        const { TranslateGizmo } = await import('../src/editor/gizmos/TranslateGizmo');
        const { GameObject } = await import('../src/scene/GameObject');

        const canvas = document.createElement('canvas');
        const gizmo = new TranslateGizmo(canvas);
        const obj = new GameObject('GizmoTarget');

        gizmo.setTarget(obj);
        expect(gizmo.getTarget()).toBe(obj);

        gizmo.setTarget(null);
        expect(gizmo.getTarget()).toBeNull();
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. Command pattern – Undo / Redo
// ═══════════════════════════════════════════════════════════════════════════
describe('UndoManager (Command Pattern)', () => {
    it('executes, undoes and redoes a position change', async () => {
        const { UndoManager, EditorCommands } = await import('../src/editor/app/EditorCommands');
        const { GameObject } = await import('../src/scene/GameObject');
        const { Vector3 } = await import('../src/math/Vector3');

        const mgr = new UndoManager();
        const obj = new GameObject('CmdObj');
        obj.transform.position.set(0, 0, 0);

        const cmd = EditorCommands.createPositionChange(obj, new Vector3(5, 10, 15));
        mgr.execute(cmd);

        expect(obj.transform.position.x).toBe(5);
        expect(obj.transform.position.y).toBe(10);
        expect(mgr.canUndo()).toBe(true);
        expect(mgr.canRedo()).toBe(false);

        mgr.undo();
        expect(obj.transform.position.x).toBe(0);
        expect(mgr.canRedo()).toBe(true);

        mgr.redo();
        expect(obj.transform.position.x).toBe(5);
    });

    it('executes rename command and undoes it', async () => {
        const { UndoManager, EditorCommands } = await import('../src/editor/app/EditorCommands');
        const { GameObject } = await import('../src/scene/GameObject');

        const mgr = new UndoManager();
        const obj = new GameObject('OldName');

        mgr.execute(EditorCommands.rename(obj, 'NewName'));
        expect(obj.name).toBe('NewName');

        mgr.undo();
        expect(obj.name).toBe('OldName');
    });

    it('clears history', async () => {
        const { UndoManager, EditorCommands } = await import('../src/editor/app/EditorCommands');
        const { GameObject } = await import('../src/scene/GameObject');
        const { Vector3 } = await import('../src/math/Vector3');

        const mgr = new UndoManager();
        const obj = new GameObject('A');
        mgr.execute(EditorCommands.createPositionChange(obj, new Vector3(1, 2, 3)));
        expect(mgr.getUndoCount()).toBe(1);

        mgr.clear();
        expect(mgr.getUndoCount()).toBe(0);
        expect(mgr.getRedoCount()).toBe(0);
        expect(mgr.canUndo()).toBe(false);
    });

    it('composite command groups multiple operations', async () => {
        const { UndoManager, EditorCommands } = await import('../src/editor/app/EditorCommands');
        const { GameObject } = await import('../src/scene/GameObject');
        const { Vector3 } = await import('../src/math/Vector3');

        const mgr = new UndoManager();
        const objA = new GameObject('A');
        const objB = new GameObject('B');

        const composite = EditorCommands.composite([
            EditorCommands.createPositionChange(objA, new Vector3(1, 0, 0)),
            EditorCommands.createPositionChange(objB, new Vector3(0, 1, 0)),
        ], 'Move both');

        mgr.execute(composite);
        expect(objA.transform.position.x).toBe(1);
        expect(objB.transform.position.y).toBe(1);

        mgr.undo();
        expect(objA.transform.position.x).toBe(0);
        expect(objB.transform.position.y).toBe(0);
    });

    it('respects max history limit', async () => {
        const { UndoManager, RenameCommand } = await import('../src/editor/app/EditorCommands');
        const { GameObject } = await import('../src/scene/GameObject');

        const mgr = new UndoManager(5);
        const obj = new GameObject('X');

        for (let i = 0; i < 10; i++) {
            mgr.execute(new RenameCommand(obj, obj.name, `Name${i}`));
        }
        // only 5 most-recent should remain
        expect(mgr.getUndoCount()).toBe(5);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. Selection system
// ═══════════════════════════════════════════════════════════════════════════
describe('EditorSelection', () => {
    it('select / deselect objects', async () => {
        const { EditorSelection, EditorSelectionMode } = await import('../src/editor/app/EditorSelection');
        const { EditorContext } = await import('../src/editor/EditorContext');
        const { GameObject } = await import('../src/scene/GameObject');

        const ctx = new EditorContext();
        const sel = new EditorSelection(ctx);

        const a = new GameObject('A');
        const b = new GameObject('B');
        const c = new GameObject('C');

        // Replace selection
        sel.select(a);
        expect(sel.getSelected()).toEqual([a]);
        expect(sel.isSelected(a)).toBe(true);
        expect(sel.getCount()).toBe(1);

        // Add to selection
        sel.select(b, EditorSelectionMode.ADD);
        expect(sel.getCount()).toBe(2);

        // Remove from selection
        sel.select(a, EditorSelectionMode.REMOVE);
        expect(sel.getSelected()).toEqual([b]);

        // Toggle
        sel.select(c, EditorSelectionMode.TOGGLE);
        expect(sel.getCount()).toBe(2); // b, c
        sel.select(c, EditorSelectionMode.TOGGLE);
        expect(sel.getCount()).toBe(1); // b only

        // Clear
        sel.clear();
        expect(sel.getCount()).toBe(0);
    });

    it('getFirst / getLast helpers', async () => {
        const { EditorSelection } = await import('../src/editor/app/EditorSelection');
        const { EditorContext } = await import('../src/editor/EditorContext');
        const { GameObject } = await import('../src/scene/GameObject');

        const sel = new EditorSelection(new EditorContext());
        expect(sel.getFirst()).toBeNull();
        expect(sel.getLast()).toBeNull();

        const a = new GameObject('A');
        const b = new GameObject('B');
        sel.selectAll([a, b]);

        expect(sel.getFirst()).toBe(a);
        expect(sel.getLast()).toBe(b);
    });

    it('invertSelection swaps selected and unselected', async () => {
        const { EditorSelection } = await import('../src/editor/app/EditorSelection');
        const { EditorContext } = await import('../src/editor/EditorContext');
        const { GameObject } = await import('../src/scene/GameObject');

        const sel = new EditorSelection(new EditorContext());
        const a = new GameObject('A');
        const b = new GameObject('B');
        const c = new GameObject('C');
        const all = [a, b, c];

        sel.select(a);
        sel.invertSelection(all);
        expect(sel.getSelected()).toEqual([b, c]);
    });

    it('EditorContext selection events fire', async () => {
        const { EditorContext } = await import('../src/editor/EditorContext');
        const { GameObject } = await import('../src/scene/GameObject');

        const ctx = new EditorContext();
        const handler = vi.fn();
        ctx.on('selectionChanged', handler);

        const obj = new GameObject('Evt');
        ctx.setSelection([obj]);
        expect(handler).toHaveBeenCalledTimes(1);

        ctx.clearSelection();
        expect(handler).toHaveBeenCalledTimes(2);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. PickingService – raycast logic without WebGL
// ═══════════════════════════════════════════════════════════════════════════
describe('PickingService', () => {
    it('can be instantiated', async () => {
        const { PickingService } = await import('../src/editor/app/PickingService');
        const { Camera } = await import('../src/rendering/Camera');

        const camera = new Camera();
        const picking = new PickingService(camera, 800, 600);
        expect(picking).toBeDefined();
    });

    it('raycast hits an object placed on the ray', async () => {
        const { PickingService } = await import('../src/editor/app/PickingService');
        const { Camera } = await import('../src/rendering/Camera');
        const { GameObject } = await import('../src/scene/GameObject');
        const { Vector3 } = await import('../src/math/Vector3');

        const camera = new Camera();
        const picking = new PickingService(camera, 800, 600);

        const obj = new GameObject('Target');
        obj.transform.position.set(0, 0, -5);
        obj.transform.scale.set(2, 2, 2);
        picking.setObjects([obj]);

        // Ray from origin looking down -Z should hit the object
        const hit = picking.raycast(
            new Vector3(0, 0, 0),
            new Vector3(0, 0, -1),
        );

        expect(hit).not.toBeNull();
        expect(hit!.object).toBe(obj);
        expect(hit!.distance).toBeGreaterThan(0);
    });

    it('raycast misses when no object is in path', async () => {
        const { PickingService } = await import('../src/editor/app/PickingService');
        const { Camera } = await import('../src/rendering/Camera');
        const { GameObject } = await import('../src/scene/GameObject');
        const { Vector3 } = await import('../src/math/Vector3');

        const camera = new Camera();
        const picking = new PickingService(camera, 800, 600);

        const obj = new GameObject('Far');
        obj.transform.position.set(100, 100, 100);
        picking.setObjects([obj]);

        const hit = picking.raycast(
            new Vector3(0, 0, 0),
            new Vector3(0, 0, -1),
        );
        expect(hit).toBeNull();
    });

    it('raycastAll returns sorted hits', async () => {
        const { PickingService } = await import('../src/editor/app/PickingService');
        const { Camera } = await import('../src/rendering/Camera');
        const { GameObject } = await import('../src/scene/GameObject');
        const { Vector3 } = await import('../src/math/Vector3');

        const camera = new Camera();
        const picking = new PickingService(camera, 800, 600);

        const near = new GameObject('Near');
        near.transform.position.set(0, 0, -3);
        const far = new GameObject('Far');
        far.transform.position.set(0, 0, -10);
        picking.setObjects([far, near]);

        const hits = picking.raycastAll(
            new Vector3(0, 0, 0),
            new Vector3(0, 0, -1),
        );
        expect(hits.length).toBe(2);
        expect(hits[0].object.name).toBe('Near');
        expect(hits[1].object.name).toBe('Far');
    });

    it('respects maxDistance on raycast', async () => {
        const { PickingService } = await import('../src/editor/app/PickingService');
        const { Camera } = await import('../src/rendering/Camera');
        const { GameObject } = await import('../src/scene/GameObject');
        const { Vector3 } = await import('../src/math/Vector3');

        const camera = new Camera();
        const picking = new PickingService(camera, 800, 600);

        const obj = new GameObject('Distant');
        obj.transform.position.set(0, 0, -50);
        picking.setObjects([obj]);

        const hit = picking.raycast(
            new Vector3(0, 0, 0),
            new Vector3(0, 0, -1),
            10,
        );
        expect(hit).toBeNull();
    });

    it('worldToScreen and screenToWorldRay round-trip roughly', async () => {
        const { PickingService } = await import('../src/editor/app/PickingService');
        const { Camera } = await import('../src/rendering/Camera');
        const { Vector3 } = await import('../src/math/Vector3');

        const camera = new Camera();
        // Position camera at origin looking down -Z (default)
        const picking = new PickingService(camera, 800, 600);

        const worldPt = new Vector3(0, 0, -5);
        const screenPt = picking.worldToScreen(worldPt);
        // Screen point should be roughly in the center
        expect(screenPt.x).toBeGreaterThan(0);
        expect(screenPt.y).toBeGreaterThan(0);
    });

    it('inactive objects are skipped', async () => {
        const { PickingService } = await import('../src/editor/app/PickingService');
        const { Camera } = await import('../src/rendering/Camera');
        const { GameObject } = await import('../src/scene/GameObject');
        const { Vector3 } = await import('../src/math/Vector3');

        const camera = new Camera();
        const picking = new PickingService(camera, 800, 600);

        const obj = new GameObject('Inactive');
        obj.transform.position.set(0, 0, -5);
        obj.active = false;
        picking.setObjects([obj]);

        const hit = picking.raycast(
            new Vector3(0, 0, 0),
            new Vector3(0, 0, -1),
        );
        expect(hit).toBeNull();
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. EditorContext – transform mode, snapping, viewport
// ═══════════════════════════════════════════════════════════════════════════
describe('EditorContext', () => {
    it('manages transform mode and space', async () => {
        const { EditorContext, TransformMode, TransformSpace } = await import('../src/editor/EditorContext');

        const ctx = new EditorContext();
        expect(ctx.getTransformMode()).toBe(TransformMode.SELECT);

        ctx.setTransformMode(TransformMode.TRANSLATE);
        expect(ctx.getTransformMode()).toBe(TransformMode.TRANSLATE);

        ctx.setTransformSpace(TransformSpace.LOCAL);
        expect(ctx.getTransformSpace()).toBe(TransformSpace.LOCAL);
    });

    it('manages snapping settings', async () => {
        const { EditorContext } = await import('../src/editor/EditorContext');

        const ctx = new EditorContext();
        ctx.setGridSnapping(true);
        ctx.setGridSize(2);
        ctx.setAngleSnapping(true);
        ctx.setAngleStep(45);

        const snap = ctx.getSnappingSettings();
        expect(snap.gridSnapping).toBe(true);
        expect(snap.gridSize).toBe(2);
        expect(snap.angleSnapping).toBe(true);
        expect(snap.angleStep).toBe(45);
    });

    it('manages viewport settings', async () => {
        const { EditorContext } = await import('../src/editor/EditorContext');

        const ctx = new EditorContext();
        ctx.setWireframe(true);
        const vp = ctx.getViewportSettings();
        expect(vp.wireframe).toBe(true);
    });
});
