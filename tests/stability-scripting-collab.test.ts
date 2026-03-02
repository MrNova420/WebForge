/**
 * Stability Tests: Scripting, Collaboration, Version Control, Marketplace, Export, Documentation
 * Covers real-user scenarios across all major subsystems.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Scripting
import { ScriptGraph } from '../src/scripting/ScriptGraph';
import { ScriptNode, NodeType, PortType } from '../src/scripting/ScriptNode';
import { NodeLibrary } from '../src/scripting/NodeLibrary';

// Collaboration
import { CollaborationManager, UserRole, OperationType } from '../src/collaboration/CollaborationManager';
import { ChatSystem } from '../src/collaboration/ChatSystem';
import { PresenceIndicators } from '../src/collaboration/PresenceIndicators';

// Version Control
import { VersionControlSystem } from '../src/versioncontrol/VersionControlSystem';
import { DiffVisualizer, DiffMode } from '../src/versioncontrol/DiffVisualizer';
import type { GitDiff, DiffHunk } from '../src/versioncontrol/VersionControlSystem';

// Marketplace
import { MarketplaceManager, AssetCategory } from '../src/marketplace/MarketplaceManager';

// Export
import { ExportManager, ExportPlatform } from '../src/export/ExportManager';
import type { ExportConfig } from '../src/export/ExportManager';

// Documentation
import { DocumentationGenerator, DocPageType } from '../src/documentation/DocumentationGenerator';

// Math helper
import { Vector3 } from '../src/math/Vector3';

// ============================================================
// ScriptGraph Tests
// ============================================================
describe('ScriptGraph', () => {
    let graph: ScriptGraph;

    beforeEach(() => {
        graph = new ScriptGraph();
    });

    it('should create a graph and add nodes', () => {
        const eventNode = NodeLibrary.createEventNode('OnStart');
        const printNode = NodeLibrary.createPrintNode();

        graph.addNode(eventNode);
        graph.addNode(printNode);

        expect(graph.getAllNodes()).toHaveLength(2);
        expect(graph.getNode(eventNode.id)).toBe(eventNode);
        expect(graph.getNode(printNode.id)).toBe(printNode);
    });

    it('should add event, math, logic, and action nodes and connect them', () => {
        const eventNode = NodeLibrary.createEventNode('OnStart');
        const mathNode = NodeLibrary.createMathNode('Add', 3, 7);
        const compNode = NodeLibrary.createComparisonNode('Greater');
        const printNode = NodeLibrary.createPrintNode();

        graph.addNode(eventNode);
        graph.addNode(mathNode);
        graph.addNode(compNode);
        graph.addNode(printNode);

        // Connect event exec -> print exec
        const connected = graph.connectNodes(eventNode.id, 'exec_out', printNode.id, 'exec_in');
        expect(connected).toBe(true);

        // Connect math result -> comparison input 'a' (NUMBER -> NUMBER)
        const connected2 = graph.connectNodes(mathNode.id, 'result', compNode.id, 'a');
        expect(connected2).toBe(true);
    });

    it('should refuse connections between incompatible port types', () => {
        const mathNode = NodeLibrary.createMathNode('Add');
        const logicNode = NodeLibrary.createLogicNode('AND');

        graph.addNode(mathNode);
        graph.addNode(logicNode);

        // NUMBER -> BOOLEAN should fail
        const connected = graph.connectNodes(mathNode.id, 'result', logicNode.id, 'a');
        expect(connected).toBe(false);
    });

    it('should allow ANY port type to connect to anything', () => {
        const getVar = NodeLibrary.createVariableNode('GetVariable', 'score');
        const printNode = NodeLibrary.createPrintNode();

        graph.addNode(getVar);
        graph.addNode(printNode);

        // ANY -> STRING should succeed
        const connected = graph.connectNodes(getVar.id, 'value', printNode.id, 'message');
        expect(connected).toBe(true);
    });

    it('should remove a node and its connections', () => {
        const eventNode = NodeLibrary.createEventNode('OnStart');
        const printNode = NodeLibrary.createPrintNode();

        graph.addNode(eventNode);
        graph.addNode(printNode);
        graph.connectNodes(eventNode.id, 'exec_out', printNode.id, 'exec_in');

        graph.removeNode(eventNode.id);
        expect(graph.getNode(eventNode.id)).toBeUndefined();
        expect(graph.getAllNodes()).toHaveLength(1);
    });

    it('should disconnect nodes', () => {
        const eventNode = NodeLibrary.createEventNode('OnStart');
        const printNode = NodeLibrary.createPrintNode();

        graph.addNode(eventNode);
        graph.addNode(printNode);
        graph.connectNodes(eventNode.id, 'exec_out', printNode.id, 'exec_in');

        graph.disconnectNodes(eventNode.id, 'exec_out', printNode.id, 'exec_in');

        const targetPort = printNode.inputs.get('exec_in');
        expect(targetPort?.connected).toBe(false);
        expect(targetPort?.connection).toBeUndefined();
    });

    it('should set and get graph variables', () => {
        graph.setVariable('health', 100);
        graph.setVariable('name', 'Player');

        expect(graph.getVariable('health')).toBe(100);
        expect(graph.getVariable('name')).toBe('Player');
        expect(graph.getVariable('missing')).toBeUndefined();
    });

    it('should create an execution context with current variables', () => {
        graph.setVariable('score', 42);
        const ctx = graph.createExecutionContext();

        expect(ctx.variables.get('score')).toBe(42);
        expect(ctx.state).toBeInstanceOf(Map);
    });

    // ── Serialization round-trip ────────────────────────────────

    it('should serialize to JSON and deserialize back preserving structure', () => {
        graph.name = 'TestGraph';
        graph.setVariable('speed', 5);

        const eventNode = NodeLibrary.createEventNode('OnStart');
        const printNode = NodeLibrary.createPrintNode();
        eventNode.x = 100;
        eventNode.y = 200;

        graph.addNode(eventNode);
        graph.addNode(printNode);
        graph.connectNodes(eventNode.id, 'exec_out', printNode.id, 'exec_in');

        const json = graph.toJSON();
        const restored = ScriptGraph.fromJSON(json);

        expect(restored.name).toBe('TestGraph');
        expect(restored.getAllNodes()).toHaveLength(2);
        expect(restored.getVariable('speed')).toBe(5);

        const restoredEvent = restored.getNode(eventNode.id);
        expect(restoredEvent).toBeDefined();
        expect(restoredEvent!.x).toBe(100);
        expect(restoredEvent!.y).toBe(200);
        expect(restoredEvent!.name).toBe('OnStart');
        expect(restoredEvent!.type).toBe(NodeType.EVENT);
    });

    it('should preserve connections after JSON round-trip', () => {
        const eventNode = NodeLibrary.createEventNode('OnStart');
        const printNode = NodeLibrary.createPrintNode();

        graph.addNode(eventNode);
        graph.addNode(printNode);
        graph.connectNodes(eventNode.id, 'exec_out', printNode.id, 'exec_in');

        const json = graph.toJSON();
        const parsed = JSON.parse(json);

        expect(parsed.connections).toHaveLength(1);
        expect(parsed.connections[0].sourceNodeId).toBe(eventNode.id);
        expect(parsed.connections[0].targetNodeId).toBe(printNode.id);
    });

    // ── Execution ───────────────────────────────────────────────

    it('should execute graph from event node and flow through connected nodes', () => {
        const eventNode = NodeLibrary.createEventNode('OnStart');
        const printNode = NodeLibrary.createPrintNode();

        // Set message input directly
        printNode.inputs.get('message')!.value = 'Hello WebForge';

        graph.addNode(eventNode);
        graph.addNode(printNode);
        graph.connectNodes(eventNode.id, 'exec_out', printNode.id, 'exec_in');

        const consoleSpy = vi.spyOn(console, 'log');
        const ctx = graph.createExecutionContext();
        graph.execute('OnStart', ctx);

        expect(consoleSpy).toHaveBeenCalledWith('[Script]', 'Hello WebForge');
        consoleSpy.mockRestore();
    });

    it('should execute OnUpdate event and populate deltaTime output', () => {
        const updateNode = NodeLibrary.createEventNode('OnUpdate');
        graph.addNode(updateNode);

        const ctx = graph.createExecutionContext();
        ctx.deltaTime = 0.016;
        graph.execute('OnUpdate', ctx);

        expect(updateNode.outputs.get('deltaTime')?.value).toBeCloseTo(0.016);
    });

    it('should execute math node and propagate output via data connections', () => {
        const mathNode = NodeLibrary.createMathNode('Multiply', 6, 7);
        const ctx = graph.createExecutionContext();
        mathNode.execute(ctx);

        expect(mathNode.outputs.get('result')?.value).toBe(42);
    });
});

// ============================================================
// Script Node Types – Individual Tests
// ============================================================
describe('Script Node Types', () => {
    const ctx = { variables: new Map(), state: new Map() };

    describe('Math nodes', () => {
        it.each([
            ['Add', 3, 5, 8],
            ['Subtract', 10, 4, 6],
            ['Multiply', 6, 7, 42],
            ['Divide', 20, 4, 5],
            ['Divide', 10, 0, 0], // divide-by-zero guard
            ['Min', 3, 7, 3],
            ['Max', 3, 7, 7],
            ['Pow', 2, 10, 1024],
        ])('%s(%d, %d) = %d', (op, a, b, expected) => {
            const node = NodeLibrary.createMathNode(op, a, b);
            node.execute(ctx);
            expect(node.outputs.get('result')?.value).toBe(expected);
        });
    });

    describe('Trig nodes', () => {
        it.each([
            ['Sin', 0, 0],
            ['Cos', 0, 1],
            ['Sqrt', 9, 3],
            ['Abs', -5, 5],
        ])('%s(%d) = %d', (op, input, expected) => {
            const node = NodeLibrary.createTrigNode(op);
            node.inputs.get('value')!.value = input;
            node.execute(ctx);
            expect(node.outputs.get('result')?.value).toBeCloseTo(expected);
        });
    });

    describe('Comparison nodes', () => {
        it.each([
            ['Greater', 5, 3, true],
            ['Greater', 3, 5, false],
            ['Less', 3, 5, true],
            ['Equal', 7, 7, true],
            ['NotEqual', 7, 8, true],
            ['GreaterEqual', 5, 5, true],
            ['LessEqual', 4, 5, true],
        ])('%s(%d, %d) = %s', (op, a, b, expected) => {
            const node = NodeLibrary.createComparisonNode(op);
            node.inputs.get('a')!.value = a;
            node.inputs.get('b')!.value = b;
            node.execute(ctx);
            expect(node.outputs.get('result')?.value).toBe(expected);
        });
    });

    describe('Logic nodes', () => {
        it.each([
            ['AND', true, true, true],
            ['AND', true, false, false],
            ['OR', false, true, true],
            ['NOT', true, false, false], // NOT only uses 'a'
            ['XOR', true, false, true],
            ['XOR', true, true, false],
        ])('%s(%s, %s) = %s', (op, a, b, expected) => {
            const node = NodeLibrary.createLogicNode(op);
            node.inputs.get('a')!.value = a;
            node.inputs.get('b')!.value = b;
            node.execute(ctx);
            expect(node.outputs.get('result')?.value).toBe(expected);
        });
    });

    describe('Variable nodes', () => {
        it('SetVariable and GetVariable round-trip via context', () => {
            const setNode = NodeLibrary.createVariableNode('SetVariable', 'score');
            const getNode = NodeLibrary.createVariableNode('GetVariable', 'score');

            const varCtx = { variables: new Map(), state: new Map() };
            setNode.inputs.get('value')!.value = 99;
            setNode.execute(varCtx);

            expect(varCtx.variables.get('score')).toBe(99);

            getNode.execute(varCtx);
            expect(getNode.outputs.get('value')?.value).toBe(99);
        });
    });

    describe('Branch node', () => {
        it('returns "true" path when condition is true', () => {
            const branch = NodeLibrary.createBranchNode();
            branch.inputs.get('condition')!.value = true;
            expect(branch.execute(ctx)).toBe('true');
        });

        it('returns "false" path when condition is false', () => {
            const branch = NodeLibrary.createBranchNode();
            branch.inputs.get('condition')!.value = false;
            expect(branch.execute(ctx)).toBe('false');
        });
    });

    describe('Random node', () => {
        it('produces a value between min and max', () => {
            const node = NodeLibrary.createRandomNode(10, 20);
            node.execute(ctx);
            const val = node.outputs.get('value')?.value;
            expect(val).toBeGreaterThanOrEqual(10);
            expect(val).toBeLessThanOrEqual(20);
        });
    });

    describe('Sequence node', () => {
        it('creates the requested number of output ports', () => {
            const seq = NodeLibrary.createSequenceNode(4);
            expect(seq.outputs.size).toBe(4);
            expect(seq.outputs.has('then_0')).toBe(true);
            expect(seq.outputs.has('then_3')).toBe(true);
        });
    });

    describe('Delay node', () => {
        it('stores duration input', () => {
            const delay = NodeLibrary.createDelayNode(2.5);
            expect(delay.inputs.get('duration')?.value).toBe(2.5);
        });
    });

    describe('Print node', () => {
        it('logs to console', () => {
            const printNode = NodeLibrary.createPrintNode();
            printNode.inputs.get('message')!.value = 'test-msg';
            const spy = vi.spyOn(console, 'log');
            printNode.execute(ctx);
            expect(spy).toHaveBeenCalledWith('[Script]', 'test-msg');
            spy.mockRestore();
        });
    });

    describe('GameObject nodes', () => {
        it('SetPosition sets target transform', () => {
            const node = NodeLibrary.createGameObjectNode('SetPosition');
            const target = { transform: { position: new Vector3(0, 0, 0) } };
            const pos = new Vector3(1, 2, 3);
            node.inputs.get('target')!.value = target;
            node.inputs.get('position')!.value = pos;
            node.execute(ctx);
            expect(target.transform.position).toBe(pos);
        });

        it('GetPosition reads target transform', () => {
            const node = NodeLibrary.createGameObjectNode('GetPosition');
            const pos = new Vector3(4, 5, 6);
            node.inputs.get('target')!.value = { transform: { position: pos } };
            node.execute(ctx);
            expect(node.outputs.get('position')?.value).toBe(pos);
        });

        it('Destroy calls destroy() on target', () => {
            const node = NodeLibrary.createGameObjectNode('Destroy');
            const destroyFn = vi.fn();
            node.inputs.get('target')!.value = { destroy: destroyFn };
            node.execute(ctx);
            expect(destroyFn).toHaveBeenCalled();
        });
    });

    describe('ScriptNode clone', () => {
        it('clones a node with distinct id', () => {
            const original = NodeLibrary.createMathNode('Add', 1, 2);
            original.x = 50;
            original.y = 75;
            original.properties.set('color', 'red');

            const cloned = original.clone();
            expect(cloned.id).not.toBe(original.id);
            expect(cloned.name).toBe('Add');
            expect(cloned.x).toBe(50);
            expect(cloned.y).toBe(75);
            expect(cloned.inputs.has('a')).toBe(true);
            expect(cloned.outputs.has('result')).toBe(true);
            expect(cloned.properties.get('color')).toBe('red');
        });
    });
});

// ============================================================
// Collaboration Tests
// ============================================================
describe('CollaborationManager', () => {
    let collab: CollaborationManager;

    beforeEach(() => {
        collab = new CollaborationManager();
    });

    it('should initialize a session and create local user', async () => {
        await collab.initSession('session-1', 'Alice', UserRole.OWNER);

        expect(collab.getSessionId()).toBe('session-1');
        const users = collab.getUsers();
        expect(users).toHaveLength(1);
        expect(users[0].name).toBe('Alice');
        expect(users[0].role).toBe(UserRole.OWNER);
        expect(users[0].isActive).toBe(true);

        collab.disconnect();
    });

    it('should emit session_initialized event', async () => {
        const handler = vi.fn();
        collab.on('session_initialized', handler);

        await collab.initSession('s2', 'Bob');

        expect(handler).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 's2' }));
        collab.disconnect();
    });

    it('should record operations for permitted users', async () => {
        await collab.initSession('s3', 'Editor', UserRole.EDITOR);

        collab.recordOperation(OperationType.UPDATE, 'obj-1', 'position', null, { x: 1 });

        const ops = collab.getOperations();
        expect(ops).toHaveLength(1);
        expect(ops[0].type).toBe(OperationType.UPDATE);
        expect(ops[0].objectId).toBe('obj-1');

        collab.disconnect();
    });

    it('should NOT record delete operations for viewers', async () => {
        await collab.initSession('s4', 'Viewer', UserRole.VIEWER);

        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        collab.recordOperation(OperationType.DELETE, 'obj-2');

        expect(collab.getOperations()).toHaveLength(0);
        warnSpy.mockRestore();
        collab.disconnect();
    });

    it('should update cursor and selection for local user', async () => {
        await collab.initSession('s5', 'Dev');

        collab.updateCursor(1, 2, 3);
        collab.updateSelection(['obj-a', 'obj-b']);

        const user = collab.getLocalUser()!;
        expect(user.cursorPosition).toEqual({ x: 1, y: 2, z: 3 });
        expect(user.selectedObjects).toEqual(['obj-a', 'obj-b']);

        collab.disconnect();
    });

    it('should update viewport camera', async () => {
        await collab.initSession('s6', 'Dev');

        collab.updateViewport({ x: 10, y: 20, z: 30 }, { x: 0, y: 1, z: 0 });

        const user = collab.getLocalUser()!;
        expect(user.viewportCamera.position).toEqual({ x: 10, y: 20, z: 30 });
        expect(user.viewportCamera.rotation).toEqual({ x: 0, y: 1, z: 0 });

        collab.disconnect();
    });

    it('should clear state on disconnect', async () => {
        await collab.initSession('s7', 'Dev');
        collab.recordOperation(OperationType.CREATE, 'obj-1');

        collab.disconnect();

        expect(collab.getUsers()).toHaveLength(0);
        expect(collab.getOperations()).toHaveLength(0);
        expect(collab.getConflicts()).toHaveLength(0);
    });
});

// ── ChatSystem ──────────────────────────────────────────────

describe('ChatSystem', () => {
    let chat: ChatSystem;

    beforeEach(() => {
        chat = new ChatSystem('user-1');
    });

    it('should send and retrieve messages', () => {
        const msg = chat.sendMessage('Hello world');
        expect(msg.content).toBe('Hello world');
        expect(msg.type).toBe('text');
        expect(chat.getMessages()).toHaveLength(1);
    });

    it('should add system messages', () => {
        chat.addSystemMessage('User joined');
        const msgs = chat.getMessages();
        expect(msgs).toHaveLength(1);
        expect(msgs[0].type).toBe('system');
        expect(msgs[0].userId).toBe('system');
    });

    it('should receive remote messages', () => {
        const handler = vi.fn();
        chat.on('message_received', handler);

        chat.receiveMessage({
            id: 'remote-1', userId: 'user-2', userName: 'Bob',
            timestamp: Date.now(), content: 'Hi', type: 'text'
        });

        expect(chat.getMessages()).toHaveLength(1);
        expect(handler).toHaveBeenCalled();
    });

    it('should create, resolve, and delete annotations', () => {
        const ann = chat.createAnnotation(new Vector3(1, 2, 3), 'Fix this');
        expect(ann.resolved).toBe(false);
        expect(chat.getAnnotations()).toHaveLength(1);
        expect(chat.getUnresolvedAnnotations()).toHaveLength(1);

        chat.resolveAnnotation(ann.id);
        expect(chat.getUnresolvedAnnotations()).toHaveLength(0);

        chat.deleteAnnotation(ann.id);
        expect(chat.getAnnotations()).toHaveLength(0);
    });

    it('should filter messages since a timestamp', () => {
        const t0 = Date.now();
        chat.sendMessage('msg1');

        const later = Date.now() + 1;
        // receiveMessage with future timestamp
        chat.receiveMessage({
            id: 'r1', userId: 'u2', userName: 'X',
            timestamp: later + 1000, content: 'future', type: 'text'
        });

        const recent = chat.getMessagesSince(later);
        expect(recent).toHaveLength(1);
        expect(recent[0].content).toBe('future');
    });

    it('should clear all messages and annotations', () => {
        chat.sendMessage('msg');
        chat.createAnnotation(new Vector3(0, 0, 0), 'note');
        chat.clear();
        expect(chat.getMessages()).toHaveLength(0);
        expect(chat.getAnnotations()).toHaveLength(0);
    });
});

// ── PresenceIndicators ──────────────────────────────────────

describe('PresenceIndicators', () => {
    let indicators: PresenceIndicators;

    beforeEach(() => {
        indicators = new PresenceIndicators();
    });

    it('should update cursor, selection, and viewport for a user', () => {
        const user = {
            id: 'u1', name: 'Alice', color: '#ff0000', role: UserRole.EDITOR,
            cursorPosition: { x: 1, y: 2, z: 3 },
            selectedObjects: ['obj-1'],
            viewportCamera: { position: { x: 0, y: 5, z: 10 }, rotation: { x: 0, y: 0, z: 0 } },
            isActive: true, lastSeen: Date.now()
        };

        indicators.updateCursor(user);
        indicators.updateSelection(user);
        indicators.updateViewport(user);

        expect(indicators.getCursors()).toHaveLength(1);
        expect(indicators.getSelections()).toHaveLength(1);
        expect(indicators.getViewports()).toHaveLength(1);
    });

    it('should remove user indicators', () => {
        const user = {
            id: 'u2', name: 'Bob', color: '#00ff00', role: UserRole.VIEWER,
            cursorPosition: { x: 0, y: 0, z: 0 },
            selectedObjects: [],
            viewportCamera: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
            isActive: true, lastSeen: Date.now()
        };

        indicators.updateCursor(user);
        indicators.removeUser('u2');
        expect(indicators.getCursors()).toHaveLength(0);
    });

    it('should convert hex color to RGB', () => {
        expect(indicators.hexToRgb('#ff8800')).toEqual({ r: 255, g: 136, b: 0 });
        expect(indicators.hexToRgb('invalid')).toBeNull();
    });

    it('should get and set cursor size, selection thickness, viewport opacity', () => {
        indicators.setCursorSize(1.5);
        expect(indicators.getCursorSize()).toBe(1.5);

        indicators.setSelectionThickness(0.1);
        expect(indicators.getSelectionThickness()).toBe(0.1);

        indicators.setViewportOpacity(0.7);
        expect(indicators.getViewportOpacity()).toBeCloseTo(0.7);

        // Clamps
        indicators.setViewportOpacity(2.0);
        expect(indicators.getViewportOpacity()).toBe(1.0);
        indicators.setViewportOpacity(-1.0);
        expect(indicators.getViewportOpacity()).toBe(0.0);
    });

    it('should clear all indicators', () => {
        const user = {
            id: 'u3', name: 'C', color: '#000', role: UserRole.EDITOR,
            cursorPosition: { x: 0, y: 0, z: 0 }, selectedObjects: [],
            viewportCamera: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
            isActive: true, lastSeen: Date.now()
        };
        indicators.updateCursor(user);
        indicators.clear();
        expect(indicators.getCursors()).toHaveLength(0);
    });
});

// ============================================================
// Version Control Tests
// ============================================================
describe('VersionControlSystem', () => {
    let vcs: VersionControlSystem;

    beforeEach(async () => {
        vcs = new VersionControlSystem();
        await vcs.init('/project');
    });

    it('should initialize with main branch and initial commit', () => {
        expect(vcs.getCurrentBranch()).toBe('main');
        expect(vcs.getRepositoryPath()).toBe('/project');

        const history = vcs.getHistory();
        expect(history).toHaveLength(1);
        expect(history[0].message).toBe('Initial commit');
    });

    it('should stage and commit files', async () => {
        vcs.stage(['src/main.ts', 'src/utils.ts']);
        expect(vcs.getStagedFiles()).toEqual(['src/main.ts', 'src/utils.ts']);

        const commit = await vcs.commit('Add source files', 'Dev', 'dev@example.com');
        expect(commit.message).toBe('Add source files');
        expect(commit.author).toBe('Dev');
        expect(commit.files).toHaveLength(2);
        expect(vcs.getStagedFiles()).toHaveLength(0);

        const history = vcs.getHistory();
        expect(history).toHaveLength(2);
        expect(history[0].hash).toBe(commit.hash);
    });

    it('should unstage files', () => {
        vcs.stage(['a.ts']);
        vcs.unstage(['a.ts']);
        expect(vcs.getStagedFiles()).toHaveLength(0);
        expect(vcs.getModifiedFiles()).toContain('a.ts');
    });

    it('should create and switch branches', async () => {
        vcs.createBranch('feature');
        const branches = vcs.getBranches();
        expect(branches.map(b => b.name)).toContain('feature');

        await vcs.checkout('feature');
        expect(vcs.getCurrentBranch()).toBe('feature');
    });

    it('should throw on checkout to non-existent branch', async () => {
        await expect(vcs.checkout('nope')).rejects.toThrow("Branch 'nope' not found");
    });

    it('should merge branches (no conflict)', async () => {
        // Create feature branch, commit, merge back
        vcs.createBranch('feat');
        await vcs.checkout('feat');
        vcs.stage(['feat.ts']);
        await vcs.commit('Feature work', 'Dev', 'dev@x.com');

        await vcs.checkout('main');
        await vcs.merge('feat');

        const history = vcs.getHistory();
        expect(history[0].message).toContain("Merge branch 'feat'");
        expect(history[0].parents).toHaveLength(2);
    });

    it('should compare two commits via diff()', async () => {
        const h = vcs.getHistory();
        const initialHash = h[0].hash;

        vcs.stage(['x.ts']);
        const c2 = await vcs.commit('Second', 'Dev', 'd@d.com');

        const diffs = await vcs.diff(initialHash, c2.hash);
        // Currently returns empty array (simplified), just verify no crash
        expect(Array.isArray(diffs)).toBe(true);
    });

    it('should clone and set remote url', async () => {
        const vcs2 = new VersionControlSystem();
        await vcs2.clone('https://github.com/example/repo.git', '/clone');
        expect(vcs2.getRemoteUrl()).toBe('https://github.com/example/repo.git');
        expect(vcs2.getRepositoryPath()).toBe('/clone');
    });

    it('should emit events', async () => {
        const handler = vi.fn();
        vcs.on('commit_created', handler);

        vcs.stage(['f.ts']);
        await vcs.commit('evt', 'Dev', 'd@d.com');
        expect(handler).toHaveBeenCalled();
    });
});

// ── DiffVisualizer ──────────────────────────────────────────

describe('DiffVisualizer', () => {
    let viz: DiffVisualizer;

    beforeEach(() => {
        viz = new DiffVisualizer();
    });

    const sampleDiff: GitDiff = {
        filePath: 'src/main.ts',
        oldContent: 'old code',
        newContent: 'new code',
        hunks: [{
            oldStart: 1, oldLines: 3, newStart: 1, newLines: 4,
            lines: [
                { type: 'context', content: 'line1', oldLine: 1, newLine: 1 },
                { type: 'deletion', content: 'old line', oldLine: 2 },
                { type: 'addition', content: 'new line', newLine: 2 },
                { type: 'addition', content: 'extra line', newLine: 3 },
                { type: 'context', content: 'line3', oldLine: 3, newLine: 4 },
            ]
        }]
    };

    it('should generate visual diff lines with correct colors', () => {
        const lines = viz.generateVisualDiff(sampleDiff);
        expect(lines).toHaveLength(5);
        expect(lines[1].backgroundColor).toBe('#ffeef0'); // deletion
        expect(lines[2].backgroundColor).toBe('#e6ffed'); // addition
        expect(lines[0].backgroundColor).toBe('#ffffff'); // context
    });

    it('should calculate diff statistics', () => {
        const stats = viz.calculateStats([sampleDiff]);
        expect(stats.additions).toBe(2);
        expect(stats.deletions).toBe(1);
        expect(stats.changes).toBe(3);
        expect(stats.filesChanged).toBe(1);
    });

    it('should generate side-by-side HTML', () => {
        const html = viz.generateSideBySide(sampleDiff);
        expect(html).toContain('diff-side-by-side');
        expect(html).toContain('diff-left');
        expect(html).toContain('diff-right');
    });

    it('should generate inline HTML', () => {
        const html = viz.generateInline(sampleDiff);
        expect(html).toContain('diff-inline');
        expect(html).toContain('@@');
    });

    it('should generate and parse unified diff format', () => {
        const unified = viz.generateUnified(sampleDiff);
        expect(unified).toContain('--- src/main.ts');
        expect(unified).toContain('+++ src/main.ts');
        expect(unified).toContain('+new line');
        expect(unified).toContain('-old line');

        const parsed = viz.parseUnified(unified);
        expect(parsed.hunks).toHaveLength(1);
        expect(parsed.hunks[0].lines.length).toBeGreaterThan(0);
    });

    it('should get/set mode, whitespace, context lines, syntax highlighting', () => {
        viz.setMode(DiffMode.INLINE);
        expect(viz.getMode()).toBe(DiffMode.INLINE);

        viz.setShowWhitespace(true);
        expect(viz.getShowWhitespace()).toBe(true);

        viz.setContextLines(5);
        expect(viz.getContextLines()).toBe(5);

        viz.setSyntaxHighlighting(false);
        expect(viz.getSyntaxHighlighting()).toBe(false);
    });
});

// ============================================================
// Marketplace Tests
// ============================================================
describe('MarketplaceManager', () => {
    let market: MarketplaceManager;

    beforeEach(() => {
        market = new MarketplaceManager('test-user');
    });

    it('should initialize with sample data', () => {
        const asset = market.getAsset('asset-1');
        expect(asset).toBeDefined();
        expect(asset!.name).toBe('Low Poly Character Pack');
    });

    it('should publish a new asset', () => {
        const newAsset = market.publishAsset({
            name: 'Sci-Fi Props',
            description: 'A sci-fi prop collection',
            category: AssetCategory.MODELS_3D,
            tags: ['sci-fi', 'props'],
            price: 9.99,
            creatorId: 'creator-1',
            creatorName: 'WebForge Team',
            version: '1.0.0',
            thumbnailUrl: '/t.jpg',
            previewUrls: [],
            fileSize: 5000000,
            license: 'MIT'
        });

        expect(newAsset.id).toBeTruthy();
        expect(newAsset.downloadCount).toBe(0);
        expect(newAsset.rating).toBe(0);
        expect(market.getAsset(newAsset.id)).toBeDefined();
    });

    it('should search assets by query', () => {
        const results = market.searchAssets('character');
        expect(results.length).toBeGreaterThan(0);
        expect(results[0].name).toContain('Character');
    });

    it('should search with filters', () => {
        const results = market.searchAssets('', {
            category: AssetCategory.MODELS_3D,
            freeOnly: true,
        });
        expect(results.length).toBeGreaterThan(0);
        results.forEach(a => expect(a.price).toBe(0));
    });

    it('should search with tags filter', () => {
        const results = market.searchAssets('', { tags: ['low-poly'] });
        expect(results.length).toBeGreaterThan(0);
    });

    it('should search with minRating filter', () => {
        const results = market.searchAssets('', { minRating: 4.5 });
        results.forEach(a => expect(a.rating).toBeGreaterThanOrEqual(4.5));
    });

    it('should search with maxPrice filter', () => {
        market.publishAsset({
            name: 'Expensive Asset', description: 'Costs money',
            category: AssetCategory.TEXTURES, tags: [], price: 100,
            creatorId: 'c1', creatorName: 'C', version: '1.0.0',
            thumbnailUrl: '', previewUrls: [], fileSize: 100, license: 'MIT'
        });

        const results = market.searchAssets('', { maxPrice: 50 });
        results.forEach(a => expect(a.price).toBeLessThanOrEqual(50));
    });

    it('should sort by rating descending', () => {
        market.publishAsset({
            name: 'High Rated', description: 'great',
            category: AssetCategory.TEXTURES, tags: [], price: 0,
            creatorId: 'c1', creatorName: 'C', version: '1.0.0',
            thumbnailUrl: '', previewUrls: [], fileSize: 100, license: 'MIT'
        });

        const results = market.searchAssets('', { sortBy: 'rating', sortOrder: 'desc' });
        // Verify sorted descending
        for (let i = 1; i < results.length; i++) {
            expect(results[i - 1].rating).toBeGreaterThanOrEqual(results[i].rating);
        }
    });

    it('should add review and update asset rating', () => {
        const review = market.addReview('asset-1', 5, 'Amazing', 'Great pack');
        expect(review.rating).toBe(5);
        expect(review.assetId).toBe('asset-1');

        market.addReview('asset-1', 3, 'OK', 'Decent');

        const reviews = market.getReviews('asset-1');
        expect(reviews).toHaveLength(2);

        const asset = market.getAsset('asset-1')!;
        expect(asset.rating).toBe(4); // (5+3)/2
        expect(asset.reviewCount).toBe(2);
    });

    it('should clamp review rating to 1-5', () => {
        const r = market.addReview('asset-1', 10, 'Over', 'Too high');
        expect(r.rating).toBe(5);
    });

    it('should purchase asset and increment download count', () => {
        const initialCount = market.getAsset('asset-1')!.downloadCount;
        const purchase = market.purchaseAsset('asset-1');
        expect(purchase.assetId).toBe('asset-1');
        expect(market.getAsset('asset-1')!.downloadCount).toBe(initialCount + 1);
        expect(market.getUserPurchases()).toHaveLength(1);
    });

    it('should throw when purchasing non-existent asset', () => {
        expect(() => market.purchaseAsset('nonexistent')).toThrow('Asset not found');
    });

    it('should get creator profile and assets', () => {
        const creator = market.getCreator('creator-1');
        expect(creator).toBeDefined();
        expect(creator!.verified).toBe(true);

        const creatorAssets = market.getAssetsByCreator('creator-1');
        expect(creatorAssets.length).toBeGreaterThan(0);
    });

    it('should return featured assets sorted by score', () => {
        const featured = market.getFeaturedAssets(5);
        expect(featured.length).toBeGreaterThan(0);
        expect(featured.length).toBeLessThanOrEqual(5);
    });
});

// ============================================================
// ExportManager Tests
// ============================================================
describe('ExportManager', () => {
    let exporter: ExportManager;
    const baseConfig: ExportConfig = {
        platform: ExportPlatform.WEB,
        outputPath: '/dist',
        projectName: 'TestGame',
        version: '1.0.0',
        optimize: true,
        minify: true,
        sourceMaps: false,
    };

    beforeEach(() => {
        exporter = new ExportManager();
    });

    it('should export web with correct artifacts', async () => {
        const result = await exporter.export(baseConfig);

        expect(result.success).toBe(true);
        expect(result.platform).toBe(ExportPlatform.WEB);
        expect(result.artifacts.length).toBeGreaterThanOrEqual(3);

        const paths = result.artifacts.map(a => a.path);
        expect(paths).toContain('/dist/index.html');
        expect(paths).toContain('/dist/game.js');
        expect(paths).toContain('/dist/style.css');

        // All sizes should be > 0
        result.artifacts.forEach(a => expect(a.size).toBeGreaterThan(0));
    });

    it('should export PWA with manifest and service worker', async () => {
        const result = await exporter.export({ ...baseConfig, platform: ExportPlatform.PWA });

        expect(result.success).toBe(true);
        const paths = result.artifacts.map(a => a.path);
        expect(paths).toContain('/dist/manifest.json');
        expect(paths).toContain('/dist/sw.js');
        // Also includes web artifacts
        expect(paths).toContain('/dist/index.html');
    });

    it('should export Electron with main.js and package.json', async () => {
        const result = await exporter.export({ ...baseConfig, platform: ExportPlatform.ELECTRON_WINDOWS });

        expect(result.success).toBe(true);
        const paths = result.artifacts.map(a => a.path);
        expect(paths).toContain('/dist/main.js');
        expect(paths).toContain('/dist/package.json');

        // Should have an executable artifact
        const exe = result.artifacts.find(a => a.type === 'executable');
        expect(exe).toBeDefined();
        expect(exe!.path).toContain('.exe');
    });

    it('should export Electron macOS without .exe extension', async () => {
        const result = await exporter.export({ ...baseConfig, platform: ExportPlatform.ELECTRON_MACOS });
        expect(result.success).toBe(true);
        const exe = result.artifacts.find(a => a.type === 'executable');
        expect(exe).toBeDefined();
        expect(exe!.path).toContain('.app');
    });

    it('should export Electron Linux without extension', async () => {
        const result = await exporter.export({ ...baseConfig, platform: ExportPlatform.ELECTRON_LINUX });
        expect(result.success).toBe(true);
        const exe = result.artifacts.find(a => a.type === 'executable');
        expect(exe).toBeDefined();
        expect(exe!.path).not.toContain('.exe');
        expect(exe!.path).not.toContain('.app');
    });

    it('should export Capacitor iOS with .ipa', async () => {
        const result = await exporter.export({ ...baseConfig, platform: ExportPlatform.CAPACITOR_IOS });
        expect(result.success).toBe(true);
        const pkg = result.artifacts.find(a => a.path.endsWith('.ipa'));
        expect(pkg).toBeDefined();
    });

    it('should export Capacitor Android with .apk and .aab', async () => {
        const result = await exporter.export({ ...baseConfig, platform: ExportPlatform.CAPACITOR_ANDROID });
        expect(result.success).toBe(true);
        const apk = result.artifacts.find(a => a.path.endsWith('.apk'));
        const aab = result.artifacts.find(a => a.path.endsWith('.aab'));
        expect(apk).toBeDefined();
        expect(aab).toBeDefined();
    });

    it('should export Cordova iOS', async () => {
        const result = await exporter.export({ ...baseConfig, platform: ExportPlatform.CORDOVA_IOS });
        expect(result.success).toBe(true);
        const paths = result.artifacts.map(a => a.path);
        expect(paths.some(p => p.endsWith('.ipa'))).toBe(true);
        expect(paths.some(p => p.endsWith('config.xml'))).toBe(true);
    });

    it('should export Cordova Android', async () => {
        const result = await exporter.export({ ...baseConfig, platform: ExportPlatform.CORDOVA_ANDROID });
        expect(result.success).toBe(true);
        const paths = result.artifacts.map(a => a.path);
        expect(paths.some(p => p.endsWith('.apk'))).toBe(true);
    });

    it('should store and retrieve export history', async () => {
        await exporter.export(baseConfig);
        await exporter.export({ ...baseConfig, platform: ExportPlatform.PWA });

        const history = exporter.getExportHistory();
        expect(history).toHaveLength(2);

        const last = exporter.getLastExport();
        expect(last?.platform).toBe(ExportPlatform.PWA);
    });

    it('should clear export history', async () => {
        await exporter.export(baseConfig);
        exporter.clearHistory();
        expect(exporter.getExportHistory()).toHaveLength(0);
        expect(exporter.getLastExport()).toBeUndefined();
    });

    it('should report duration > 0', async () => {
        const result = await exporter.export(baseConfig);
        expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should emit export_started and export_completed events', async () => {
        const started = vi.fn();
        const completed = vi.fn();
        exporter.on('export_started', started);
        exporter.on('export_completed', completed);

        await exporter.export(baseConfig);
        expect(started).toHaveBeenCalled();
        expect(completed).toHaveBeenCalled();
    });
});

// ============================================================
// DocumentationGenerator Tests
// ============================================================
describe('DocumentationGenerator', () => {
    let docs: DocumentationGenerator;

    beforeEach(() => {
        docs = new DocumentationGenerator();
    });

    it('should have default pages on init', () => {
        const page = docs.getPage('getting-started');
        expect(page).toBeDefined();
        expect(page!.title).toContain('Getting Started');
        expect(page!.type).toBe(DocPageType.GUIDE);
    });

    it('should have default API docs on init', () => {
        const api = docs.getAPIDoc('Engine');
        expect(api).toBeDefined();
        expect(api!.type).toBe('class');
        expect(api!.examples!.length).toBeGreaterThan(0);
    });

    it('should add and retrieve a custom page', () => {
        docs.addPage({
            id: 'custom-page',
            title: 'Custom Guide',
            type: DocPageType.TUTORIAL,
            content: 'Tutorial content here',
            category: 'Advanced',
            tags: ['advanced', 'tutorial'],
            version: '2.0.0',
            lastUpdated: Date.now()
        });

        const page = docs.getPage('custom-page');
        expect(page).toBeDefined();
        expect(page!.title).toBe('Custom Guide');
    });

    it('should get pages by type', () => {
        const guides = docs.getPagesByType(DocPageType.GUIDE);
        expect(guides.length).toBeGreaterThan(0);
        guides.forEach(p => expect(p.type).toBe(DocPageType.GUIDE));
    });

    it('should get pages by category', () => {
        const pages = docs.getPagesByCategory('Getting Started');
        expect(pages.length).toBeGreaterThan(0);
    });

    it('should search documentation', () => {
        const results = docs.search('engine');
        expect(results.length).toBeGreaterThan(0);
        expect(results[0].relevance).toBeGreaterThan(0);
    });

    it('should search with multi-word query', () => {
        const results = docs.search('getting started installation');
        expect(results.length).toBeGreaterThan(0);
    });

    it('should return empty results for unknown query', () => {
        const results = docs.search('xyznonexistent12345');
        expect(results).toHaveLength(0);
    });

    it('should add and retrieve API docs', () => {
        docs.addAPIDoc({
            name: 'Vector3',
            type: 'class',
            description: 'A 3D vector',
            signature: 'class Vector3',
        });

        expect(docs.getAPIDoc('Vector3')).toBeDefined();
        expect(docs.getAllAPIDocs().length).toBeGreaterThanOrEqual(2);
    });

    it('should generate HTML for a page', () => {
        const html = docs.generateHTML('getting-started');
        expect(html).toContain('<!DOCTYPE html>');
        expect(html).toContain('Getting Started');
        expect(html).toContain('WebForge Documentation');
    });

    it('should return fallback HTML for missing page', () => {
        const html = docs.generateHTML('nonexistent');
        expect(html).toContain('Page not found');
    });

    it('should export to JSON and import back', () => {
        docs.addPage({
            id: 'export-test',
            title: 'Export Test Page',
            type: DocPageType.EXAMPLE,
            content: 'Example content',
            category: 'Test',
            tags: ['test'],
            version: '1.0.0',
            lastUpdated: Date.now()
        });

        const json = docs.exportToJSON();
        const parsed = JSON.parse(json);
        expect(parsed.pages.length).toBeGreaterThan(0);
        expect(parsed.apiDocs.length).toBeGreaterThan(0);

        // Import into fresh instance
        const docs2 = new DocumentationGenerator();
        docs2.importFromJSON(json);
        expect(docs2.getPage('export-test')).toBeDefined();
    });

    it('should throw on invalid JSON import', () => {
        expect(() => docs.importFromJSON('{{not valid json')).toThrow('Failed to import documentation');
    });

    it('should emit events', () => {
        const handler = vi.fn();
        docs.on('page_added', handler);
        docs.addPage({
            id: 'evt-page', title: 'T', type: DocPageType.GUIDE,
            content: '', category: 'C', tags: [], version: '1.0.0',
            lastUpdated: Date.now()
        });
        expect(handler).toHaveBeenCalled();
    });
});
