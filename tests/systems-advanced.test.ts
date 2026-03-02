/**
 * Advanced Systems Tests for WebForge
 * Covers: SceneSerializer, PlayerCamera, ExportManager, Inventory, Dialogue, Quest, Network, CharacterController
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Scene serialization
import { Scene } from '../src/scene/Scene';
import { GameObject } from '../src/scene/GameObject';
import {
    SceneSerializer,
    ComponentRegistry,
    type SerializedScene,
} from '../src/scene/SceneSerializer';

// Player camera
import {
    PlayerCamera,
    PlayerCameraMode,
} from '../src/scene/PlayerCamera';

// Export
import {
    ExportManager,
    ExportPlatform,
    type ExportConfig,
} from '../src/export/ExportManager';

// Inventory
import {
    Inventory,
    EquipmentManager,
    LootTable,
    ItemRarity,
    ItemType,
    EquipmentSlot,
    type ItemDefinition,
} from '../src/character/InventorySystem';

// Dialogue
import {
    DialogueManager,
    DialogueBuilder,
    type DialogueTree,
    type DialogueNode,
} from '../src/character/DialogueSystem';

// Quest
import {
    QuestManager,
    QuestChainManager,
    QuestStatus,
    ObjectiveType,
    type QuestDefinition,
} from '../src/character/QuestSystem';

// Network
import {
    NetworkManager,
    MessageType,
    type NetworkMessage,
} from '../src/network/NetworkManager';

// Character controller
import {
    CharacterController,
    CharacterState,
    CharacterMovementPresets,
} from '../src/character/CharacterController';

import { Vector3 } from '../src/math/Vector3';

// ============================================================
// SceneSerializer
// ============================================================
describe('SceneSerializer', () => {
    beforeEach(() => {
        ComponentRegistry.clear();
    });

    it('should serialize and deserialize an empty scene', () => {
        const scene = new Scene('EmptyScene');
        const data = SceneSerializer.serialize(scene);

        expect(data.version).toBe(1);
        expect(data.name).toBe('EmptyScene');
        expect(data.objects).toHaveLength(0);

        const restored = SceneSerializer.deserialize(data);
        expect(restored.name).toBe('EmptyScene');
        expect(restored.getAllObjects()).toHaveLength(0);
    });

    it('should round-trip a scene with objects and transforms', () => {
        const scene = new Scene('TestScene');
        const obj = new GameObject('Player');
        obj.transform.position.set(1, 2, 3);
        obj.transform.scale.set(2, 2, 2);
        scene.add(obj);
        scene.update(0); // flush pending adds

        const restored = SceneSerializer.fromJSON(SceneSerializer.toJSON(scene));
        restored.update(0);
        const found = restored.findByName('Player') as GameObject;
        expect(found).toBeTruthy();
        expect(found.transform.position.x).toBeCloseTo(1);
        expect(found.transform.position.y).toBeCloseTo(2);
        expect(found.transform.position.z).toBeCloseTo(3);
        expect(found.transform.scale.x).toBeCloseTo(2);
    });

    it('should serialize parent-child hierarchy', () => {
        const scene = new Scene('HierScene');
        const parent = new GameObject('Parent');
        const child = new GameObject('Child');
        child.setParent(parent);
        scene.add(parent);
        scene.update(0);

        const data = SceneSerializer.serialize(scene);
        expect(data.objects).toHaveLength(1);
        expect(data.objects[0].children).toHaveLength(1);
        expect(data.objects[0].children[0].name).toBe('Child');
    });

    it('should preserve tags through serialization', () => {
        const scene = new Scene('TagScene');
        const obj = new GameObject('Enemy');
        obj.addTag('hostile');
        scene.add(obj);
        scene.update(0);

        const json = SceneSerializer.toJSON(scene);
        const restored = SceneSerializer.fromJSON(json);
        restored.update(0);
        // Tags are preserved on the GameObject itself
        const enemy = restored.findByName('Enemy') as GameObject;
        expect(enemy).toBeTruthy();
        expect(enemy.getTags()).toContain('hostile');
    });

    it('should clone a scene via round-trip', () => {
        const scene = new Scene('Original');
        const a = new GameObject('A');
        a.transform.position.set(5, 0, 0);
        scene.add(a);
        scene.update(0);

        const clone = SceneSerializer.clone(scene);
        clone.update(0);
        expect(clone.name).toBe('Original');
        const clonedA = clone.findByName('A') as GameObject;
        expect(clonedA.transform.position.x).toBeCloseTo(5);
    });

    it('should compute diff between two scenes', () => {
        const sceneA = new Scene('A');
        sceneA.add(new GameObject('Shared'));
        sceneA.add(new GameObject('Removed'));
        sceneA.update(0);

        const sceneB = new Scene('B');
        const shared = new GameObject('Shared');
        shared.transform.position.set(99, 0, 0); // modified
        sceneB.add(shared);
        sceneB.add(new GameObject('Added'));
        sceneB.update(0);

        const diff = SceneSerializer.diff(sceneA, sceneB);
        expect(diff.added).toContain('Added');
        expect(diff.removed).toContain('Removed');
        expect(diff.modified).toContain('Shared');
    });

    it('should throw on unsupported future version', () => {
        const badData: SerializedScene = {
            version: 999,
            name: 'Bad',
            objects: [],
            metadata: {},
        };
        expect(() => SceneSerializer.deserialize(badData)).toThrow(/Unsupported scene format/);
    });

    it('should serialize with pretty JSON', () => {
        const scene = new Scene('Pretty');
        const json = SceneSerializer.toJSON(scene, true);
        expect(json).toContain('\n');
    });

    it('should use ComponentRegistry for custom components', () => {
        ComponentRegistry.register('Health', {
            serialize: (c: any) => ({ hp: c.hp }),
            deserialize: (d: any) => ({ hp: d.hp, enabled: true, gameObject: null, awake() {}, start() {}, update() {}, destroy() {} }),
        });

        expect(ComponentRegistry.getSerializer('Health')).not.toBeNull();
        expect(ComponentRegistry.getRegisteredTypes()).toContain('Health');

        ComponentRegistry.clear();
        expect(ComponentRegistry.getRegisteredTypes()).toHaveLength(0);
    });

    it('getVersion returns current version', () => {
        expect(SceneSerializer.getVersion()).toBe(1);
    });
});

// ============================================================
// PlayerCamera
// ============================================================
describe('PlayerCamera', () => {
    it('should create FPS camera with defaults', () => {
        const cam = PlayerCamera.createFPS();
        expect(cam.getFOV()).toBe(60);
        expect(cam.getNear()).toBeCloseTo(0.1);
        expect(cam.getFar()).toBe(1000);
    });

    it('should create third-person camera', () => {
        const cam = PlayerCamera.createThirdPerson({ distance: 8 });
        expect(cam.getFOV()).toBe(60);
    });

    it('should create orbital camera', () => {
        const cam = PlayerCamera.createOrbital({ radius: 10, autoRotate: true });
        expect(cam.getFOV()).toBe(60);
    });

    it('should create top-down camera', () => {
        const cam = PlayerCamera.createTopDown({ radius: 20 });
        expect(cam.getFOV()).toBe(60);
    });

    it('should create side-scroller camera', () => {
        const cam = PlayerCamera.createSideScroller({ distance: 15 });
        expect(cam.getFOV()).toBe(60);
    });

    it('should switch modes at runtime', () => {
        const cam = PlayerCamera.createFPS();
        cam.setMode(PlayerCameraMode.ThirdPerson);
        cam.update(1 / 60);
        // No throw means success
    });

    it('should update without errors across all modes', () => {
        const modes = [
            PlayerCameraMode.FirstPerson,
            PlayerCameraMode.ThirdPerson,
            PlayerCameraMode.Orbital,
            PlayerCameraMode.TopDown,
            PlayerCameraMode.SideScroller,
        ];
        for (const mode of modes) {
            const cam = new PlayerCamera({ mode });
            cam.update(1 / 60);
            cam.getPosition();
            cam.getTarget();
            cam.getViewMatrix();
        }
    });

    it('should clamp pitch when rotating', () => {
        const cam = PlayerCamera.createFPS();
        cam.rotate(0, 100); // extreme pitch
        const pitch = cam.getPitch();
        expect(pitch).toBeLessThanOrEqual(Math.PI / 2);
    });

    it('should handle zoom for third-person', () => {
        const cam = PlayerCamera.createThirdPerson({ distance: 5, minDistance: 1, maxDistance: 20 });
        cam.zoom(3);
        cam.update(1 / 60);
        // No errors
    });

    it('should set FOV', () => {
        const cam = PlayerCamera.createFPS();
        cam.setFOV(90);
        expect(cam.getFOV()).toBe(90);
    });

    it('should set and get target/position', () => {
        const cam = PlayerCamera.createThirdPerson();
        cam.setTarget(new Vector3(1, 2, 3));
        cam.setPosition(new Vector3(4, 5, 6));
        cam.update(1 / 60);
        expect(cam.getTarget()).toBeTruthy();
        expect(cam.getPosition()).toBeTruthy();
    });

    it('should compute forward and right vectors', () => {
        const cam = PlayerCamera.createFPS();
        const fwd = cam.getForward();
        const right = cam.getRight();
        const up = cam.getUp();
        expect(fwd.length()).toBeCloseTo(1, 3);
        expect(right.length()).toBeCloseTo(1, 3);
        expect(up.y).toBe(1);
    });

    it('should trigger camera shake', () => {
        const cam = PlayerCamera.createFPS();
        cam.shake(0.5, 0.3);
        cam.update(0.05);
        // Shake offsets the position
        const pos = cam.getPosition();
        expect(pos).toBeTruthy();
    });

    it('should compute move direction from input', () => {
        const cam = PlayerCamera.createFPS();
        const dir = cam.move(1, 0);
        expect(dir.length()).toBeGreaterThan(0);
    });

    it('should support setFollowTarget and setDistance for third-person', () => {
        const cam = PlayerCamera.createThirdPerson();
        cam.setFollowTarget(new Vector3(10, 0, 10));
        cam.setDistance(8);
        cam.update(1 / 60);
    });

    it('should support setOrbitTarget and setRadius for orbital', () => {
        const cam = PlayerCamera.createOrbital();
        cam.setOrbitTarget(new Vector3(0, 5, 0));
        cam.setRadius(12);
        cam.update(1 / 60);
    });
});

// ============================================================
// ExportManager
// ============================================================
describe('ExportManager', () => {
    let manager: ExportManager;

    const baseConfig: ExportConfig = {
        platform: ExportPlatform.WEB,
        outputPath: '/tmp/export',
        projectName: 'TestGame',
        version: '1.0.0',
        optimize: true,
        minify: true,
        sourceMaps: false,
    };

    beforeEach(() => {
        manager = new ExportManager();
    });

    it('should export web platform', async () => {
        const result = await manager.export(baseConfig);
        expect(result.success).toBe(true);
        expect(result.platform).toBe(ExportPlatform.WEB);
        expect(result.artifacts.length).toBeGreaterThan(0);
    });

    it('should export PWA platform', async () => {
        const result = await manager.export({ ...baseConfig, platform: ExportPlatform.PWA });
        expect(result.success).toBe(true);
        expect(result.artifacts.some(a => a.path.includes('manifest.json'))).toBe(true);
        expect(result.artifacts.some(a => a.path.includes('sw.js'))).toBe(true);
    });

    it('should export Electron Windows', async () => {
        const result = await manager.export({ ...baseConfig, platform: ExportPlatform.ELECTRON_WINDOWS });
        expect(result.success).toBe(true);
        expect(result.artifacts.some(a => a.type === 'executable')).toBe(true);
    });

    it('should export Capacitor Android', async () => {
        const result = await manager.export({ ...baseConfig, platform: ExportPlatform.CAPACITOR_ANDROID });
        expect(result.success).toBe(true);
        expect(result.artifacts.some(a => a.path.includes('.apk'))).toBe(true);
    });

    it('should export Cordova iOS', async () => {
        const result = await manager.export({ ...baseConfig, platform: ExportPlatform.CORDOVA_IOS });
        expect(result.success).toBe(true);
        expect(result.artifacts.some(a => a.path.includes('.ipa'))).toBe(true);
    });

    it('should track export history', async () => {
        await manager.export(baseConfig);
        await manager.export({ ...baseConfig, platform: ExportPlatform.PWA });
        expect(manager.getExportHistory()).toHaveLength(2);
        expect(manager.getLastExport()?.platform).toBe(ExportPlatform.PWA);
    });

    it('should clear history', async () => {
        await manager.export(baseConfig);
        manager.clearHistory();
        expect(manager.getExportHistory()).toHaveLength(0);
        expect(manager.getLastExport()).toBeUndefined();
    });

    it('should emit export events', async () => {
        const startedFn = vi.fn();
        const completedFn = vi.fn();
        manager.on('export_started', startedFn);
        manager.on('export_completed', completedFn);

        await manager.export(baseConfig);

        expect(startedFn).toHaveBeenCalledTimes(1);
        expect(completedFn).toHaveBeenCalledTimes(1);
    });

    it('should remove event listener with off', async () => {
        const fn = vi.fn();
        manager.on('export_started', fn);
        manager.off('export_started', fn);
        await manager.export(baseConfig);
        expect(fn).not.toHaveBeenCalled();
    });
});

// ============================================================
// Inventory System
// ============================================================
describe('Inventory', () => {
    const sword: ItemDefinition = {
        id: 'sword_iron',
        name: 'Iron Sword',
        description: 'A sturdy iron sword.',
        type: ItemType.Weapon,
        rarity: ItemRarity.Common,
        stackable: false,
        maxStack: 1,
        weight: 3,
        value: 50,
        properties: { damage: 10, armor: 0 },
        usable: false,
        equippable: true,
        equipSlot: EquipmentSlot.MainHand,
    };

    const potion: ItemDefinition = {
        id: 'health_potion',
        name: 'Health Potion',
        description: 'Restores 50 HP.',
        type: ItemType.Consumable,
        rarity: ItemRarity.Common,
        stackable: true,
        maxStack: 20,
        weight: 0.5,
        value: 10,
        properties: { healing: 50 },
        usable: true,
        equippable: false,
    };

    let inv: Inventory;

    beforeEach(() => {
        inv = new Inventory(10, 100);
    });

    it('should add items and track counts', () => {
        expect(inv.addItem(potion, 5)).toBe(true);
        expect(inv.getItemCount('health_potion')).toBe(5);
        expect(inv.hasItem('health_potion', 3)).toBe(true);
    });

    it('should remove items', () => {
        inv.addItem(potion, 5);
        expect(inv.removeItem('health_potion', 3)).toBe(true);
        expect(inv.getItemCount('health_potion')).toBe(2);
    });

    it('should refuse removal if insufficient quantity', () => {
        inv.addItem(potion, 2);
        expect(inv.removeItem('health_potion', 5)).toBe(false);
    });

    it('should refuse adding when over weight limit', () => {
        // 200 potions weigh 100 but only 10 slots available
        const heavy: ItemDefinition = { ...potion, id: 'heavy', weight: 50, stackable: false, maxStack: 1 };
        inv.addItem(heavy);
        inv.addItem(heavy);
        expect(inv.addItem(heavy)).toBe(false); // would exceed weight
    });

    it('should stack items correctly', () => {
        inv.addItem(potion, 15);
        inv.addItem(potion, 3);
        expect(inv.getItemCount('health_potion')).toBe(18);
    });

    it('should get remaining slots and weight', () => {
        inv.addItem(sword);
        expect(inv.getUsedSlots()).toBe(1);
        expect(inv.getRemainingSlots()).toBe(9);
        expect(inv.getCurrentWeight()).toBeCloseTo(3);
        expect(inv.getRemainingWeight()).toBeCloseTo(97);
    });

    it('should move items between slots', () => {
        inv.addItem(sword);
        inv.addItem(potion, 1);
        expect(inv.moveItem(0, 1)).toBe(true);
    });

    it('should split stacks', () => {
        inv.addItem(potion, 10);
        expect(inv.splitStack('health_potion', 4)).toBe(true);
        expect(inv.getItemCount('health_potion')).toBe(10);
    });

    it('should merge stacks', () => {
        inv.addItem(potion, 10);
        inv.splitStack('health_potion', 3);
        inv.mergeStacks('health_potion');
        expect(inv.getUsedSlots()).toBe(1);
    });

    it('should sort by name', () => {
        inv.addItem(sword);
        inv.addItem(potion, 1);
        inv.sort('name');
        const items = inv.getItems();
        expect(items[0].definition.name).toBe('Health Potion');
        expect(items[1].definition.name).toBe('Iron Sword');
    });

    it('should sort by rarity', () => {
        const rare: ItemDefinition = { ...potion, id: 'rare_pot', name: 'Rare Potion', rarity: ItemRarity.Rare };
        inv.addItem(potion, 1);
        inv.addItem(rare, 1);
        inv.sort('rarity');
        expect(inv.getItems()[0].definition.rarity).toBe(ItemRarity.Rare);
    });

    it('should find items by predicate', () => {
        inv.addItem(sword);
        inv.addItem(potion, 1);
        const weapons = inv.find(i => i.definition.type === ItemType.Weapon);
        expect(weapons).toHaveLength(1);
    });

    it('should report full correctly', () => {
        for (let i = 0; i < 10; i++) inv.addItem({ ...sword, id: `s${i}` });
        expect(inv.isFull()).toBe(true);
    });

    it('should clear all items', () => {
        inv.addItem(potion, 5);
        inv.clear();
        expect(inv.getItems()).toHaveLength(0);
    });

    it('should fire onChange callback', () => {
        const fn = vi.fn();
        inv.onChange = fn;
        inv.addItem(potion, 1);
        expect(fn).toHaveBeenCalled();
    });

    it('should serialize and deserialize via JSON', () => {
        inv.addItem(potion, 7);
        const data = inv.toJSON();
        expect(data.maxSlots).toBe(10);
        expect(data.maxWeight).toBe(100);

        const registry = (id: string) => id === 'health_potion' ? potion : undefined;
        const restored = new Inventory(10, 100);
        restored.fromJSON(data, registry);
        expect(restored.getItemCount('health_potion')).toBe(7);
    });
});

describe('EquipmentManager', () => {
    const helmet: ItemDefinition = {
        id: 'helm_steel',
        name: 'Steel Helmet',
        description: 'A solid helmet.',
        type: ItemType.Armor,
        rarity: ItemRarity.Uncommon,
        stackable: false,
        maxStack: 1,
        weight: 2,
        value: 80,
        properties: { armor: 15, defense: 5 },
        usable: false,
        equippable: true,
        equipSlot: EquipmentSlot.Head,
    };

    it('should equip and unequip items', () => {
        const em = new EquipmentManager();
        const item = { definition: helmet, quantity: 1 };

        expect(em.equip(EquipmentSlot.Head, item)).toBeNull();
        expect(em.getEquipped(EquipmentSlot.Head)).toBe(item);

        const removed = em.unequip(EquipmentSlot.Head);
        expect(removed).toBe(item);
        expect(em.getEquipped(EquipmentSlot.Head)).toBeNull();
    });

    it('should return previous item when re-equipping a slot', () => {
        const em = new EquipmentManager();
        const old = { definition: helmet, quantity: 1 };
        const newer = { definition: { ...helmet, id: 'helm_gold' }, quantity: 1 };

        em.equip(EquipmentSlot.Head, old);
        const prev = em.equip(EquipmentSlot.Head, newer);
        expect(prev).toBe(old);
    });

    it('should aggregate stat bonuses', () => {
        const em = new EquipmentManager();
        em.equip(EquipmentSlot.Head, { definition: helmet, quantity: 1 });
        const bonuses = em.getStatBonuses();
        expect(bonuses['armor']).toBe(15);
        expect(bonuses['defense']).toBe(5);
    });

    it('should compute total armor', () => {
        const em = new EquipmentManager();
        em.equip(EquipmentSlot.Head, { definition: helmet, quantity: 1 });
        expect(em.getTotalArmor()).toBe(15);
    });

    it('should compute total weight', () => {
        const em = new EquipmentManager();
        em.equip(EquipmentSlot.Head, { definition: helmet, quantity: 1 });
        expect(em.getTotalWeight()).toBeCloseTo(2);
    });

    it('should serialize and deserialize equipment', () => {
        const em = new EquipmentManager();
        em.equip(EquipmentSlot.Head, { definition: helmet, quantity: 1 });

        const data = em.toJSON();
        expect(data).toHaveLength(1);
        expect(data[0].slot).toBe(EquipmentSlot.Head);

        const em2 = new EquipmentManager();
        em2.fromJSON(data, (id) => id === 'helm_steel' ? helmet : undefined);
        expect(em2.getEquipped(EquipmentSlot.Head)?.definition.id).toBe('helm_steel');
    });
});

describe('LootTable', () => {
    it('should include guaranteed drops', () => {
        const table = new LootTable();
        table.setGuaranteedDrop('gold_coin', 10);
        const results = table.roll(0);
        expect(results).toEqual([{ itemId: 'gold_coin', quantity: 10 }]);
    });

    it('should roll weighted entries', () => {
        const table = new LootTable();
        table.addEntry('common_item', 100, 1, 1);
        const results = table.roll(3);
        // 3 rolls should produce 3 items
        expect(results).toHaveLength(3);
        expect(results.every(r => r.itemId === 'common_item')).toBe(true);
    });

    it('should remove entries', () => {
        const table = new LootTable();
        table.addEntry('junk', 10, 1, 1);
        table.removeEntry('junk');
        const results = table.roll(1);
        expect(results).toHaveLength(0);
    });
});

// ============================================================
// Dialogue System
// ============================================================
describe('DialogueManager', () => {
    let dm: DialogueManager;
    let tree: DialogueTree;

    beforeEach(() => {
        dm = new DialogueManager();
        tree = DialogueBuilder
            .create('greeting', 'Greeting Dialogue')
            .addNode('start', 'NPC', 'Hello traveller!')
            .addChoice('start', 'Hi there!', 'reply')
            .addChoice('start', 'Goodbye.', null)
            .addNode('reply', 'NPC', 'Safe travels.')
            .addChoice('reply', 'Thanks!', null)
            .build();
        dm.registerTree(tree);
    });

    it('should start dialogue and return start node', () => {
        const node = dm.startDialogue('greeting');
        expect(node).not.toBeNull();
        expect(node!.speaker).toBe('NPC');
        expect(node!.text).toBe('Hello traveller!');
        expect(dm.isInDialogue()).toBe(true);
    });

    it('should return null for unknown tree', () => {
        expect(dm.startDialogue('nonexistent')).toBeNull();
    });

    it('should list available choices', () => {
        dm.startDialogue('greeting');
        const choices = dm.getAvailableChoices();
        expect(choices).toHaveLength(2);
    });

    it('should advance dialogue when selecting a choice', () => {
        dm.startDialogue('greeting');
        const choices = dm.getAvailableChoices();
        const hiChoice = choices.find(c => c.text === 'Hi there!')!;

        const next = dm.selectChoice(hiChoice.id);
        expect(next).not.toBeNull();
        expect(next!.text).toBe('Safe travels.');
    });

    it('should end dialogue when selecting terminal choice', () => {
        dm.startDialogue('greeting');
        const choices = dm.getAvailableChoices();
        const byeChoice = choices.find(c => c.text === 'Goodbye.')!;

        const next = dm.selectChoice(byeChoice.id);
        expect(next).toBeNull();
        expect(dm.isInDialogue()).toBe(false);
    });

    it('should track dialogue history', () => {
        dm.startDialogue('greeting');
        const choices = dm.getAvailableChoices();
        dm.selectChoice(choices[0].id);

        const history = dm.getDialogueHistory();
        expect(history).toHaveLength(2);
        expect(history[0].speaker).toBe('NPC');
    });

    it('should fire callbacks', () => {
        const startFn = vi.fn();
        const endFn = vi.fn();
        const nodeFn = vi.fn();
        const choiceFn = vi.fn();

        dm.onDialogueStart = startFn;
        dm.onDialogueEnd = endFn;
        dm.onNodeChange = nodeFn;
        dm.onChoiceMade = choiceFn;

        dm.startDialogue('greeting');
        expect(startFn).toHaveBeenCalledTimes(1);
        expect(nodeFn).toHaveBeenCalledTimes(1);

        const choices = dm.getAvailableChoices();
        dm.selectChoice(choices.find(c => c.nextNodeId === null)!.id);
        expect(choiceFn).toHaveBeenCalledTimes(1);
        expect(endFn).toHaveBeenCalledTimes(1);
    });

    it('should set and get variables', () => {
        dm.setVariable('reputation', 10);
        expect(dm.getVariable('reputation')).toBe(10);
    });

    it('should evaluate conditions', () => {
        dm.setVariable('gold', 100);
        expect(dm.evaluateCondition({ type: 'variable', key: 'gold', operator: '>=', value: 50 })).toBe(true);
        expect(dm.evaluateCondition({ type: 'variable', key: 'gold', operator: '<', value: 50 })).toBe(false);
    });

    it('should apply effects', () => {
        dm.startDialogue('greeting');
        dm.applyEffects([{ type: 'setVariable', key: 'met_npc', value: true }]);
        expect(dm.getVariable('met_npc')).toBe(true);
    });

    it('should filter choices by condition', () => {
        const condTree = DialogueBuilder
            .create('cond', 'Conditional')
            .addNode('start', 'NPC', 'Pick one.')
            .addChoice('start', 'Rich option', null)
            .addCondition('start', { type: 'variable', key: 'gold', operator: '>=', value: 100 })
            .addChoice('start', 'Free option', null)
            .build();

        dm.registerTree(condTree);
        dm.setVariable('gold', 10);
        dm.startDialogue('cond');
        const choices = dm.getAvailableChoices();
        expect(choices).toHaveLength(1);
        expect(choices[0].text).toBe('Free option');
    });

    it('should serialize and restore dialogue state', () => {
        dm.startDialogue('greeting');
        const snapshot = dm.toJSON();

        const dm2 = new DialogueManager();
        dm2.fromJSON(snapshot);
        expect(dm2.isInDialogue()).toBe(true);
        expect(dm2.getCurrentNode()?.text).toBe('Hello traveller!');
    });

    it('should register custom effect and condition handlers', () => {
        const effectFn = vi.fn();
        dm.registerEffectHandler('playSound', effectFn);
        dm.applyEffects([{ type: 'custom', key: 'playSound', value: 'ding.wav' }]);

        const condFn = vi.fn().mockReturnValue(true);
        dm.registerConditionHandler('hasAchievement', condFn);
        expect(dm.evaluateCondition({ type: 'custom', key: 'hasAchievement', operator: '==', value: true })).toBe(true);
    });

    it('should remove a registered tree', () => {
        dm.removeTree('greeting');
        expect(dm.startDialogue('greeting')).toBeNull();
    });

    it('should endDialogue explicitly', () => {
        dm.startDialogue('greeting');
        dm.endDialogue();
        expect(dm.isInDialogue()).toBe(false);
    });
});

describe('DialogueBuilder', () => {
    it('should build a valid tree', () => {
        const tree = DialogueBuilder
            .create('test', 'Test')
            .addNode('n1', 'A', 'Hello')
            .addChoice('n1', 'ok', null)
            .build();

        expect(tree.id).toBe('test');
        expect(tree.startNodeId).toBe('n1');
        expect(tree.nodes.size).toBe(1);
    });

    it('should throw if building empty tree', () => {
        expect(() => DialogueBuilder.create('empty', 'Empty').build()).toThrow();
    });

    it('should support setVariable and setStartNode', () => {
        const tree = DialogueBuilder
            .create('t', 'T')
            .addNode('a', 'X', 'A')
            .addNode('b', 'X', 'B')
            .setStartNode('b')
            .setVariable('mood', 'happy')
            .build();

        expect(tree.startNodeId).toBe('b');
        expect(tree.variables['mood']).toBe('happy');
    });

    it('should throw when adding choice to nonexistent node', () => {
        const builder = DialogueBuilder.create('t', 'T');
        expect(() => builder.addChoice('missing', 'text', null)).toThrow();
    });
});

// ============================================================
// Quest System
// ============================================================
describe('QuestManager', () => {
    let qm: QuestManager;

    const killGoblinsQuest: QuestDefinition = {
        id: 'quest_goblins',
        name: 'Goblin Slayer',
        description: 'Defeat 5 goblins.',
        category: 'side',
        level: 3,
        objectives: [
            { id: 'kill_goblins', description: 'Kill goblins', type: ObjectiveType.Kill, targetId: 'goblin', targetCount: 5, currentCount: 0, completed: false, optional: false, hidden: false },
        ],
        rewards: { experience: 100, currency: 50 },
        repeatable: false,
    };

    const fetchQuest: QuestDefinition = {
        id: 'quest_fetch',
        name: 'Herb Collector',
        description: 'Collect 3 herbs.',
        category: 'side',
        level: 1,
        objectives: [
            { id: 'collect_herbs', description: 'Collect herbs', type: ObjectiveType.Collect, targetId: 'herb', targetCount: 3, currentCount: 0, completed: false, optional: false, hidden: false },
        ],
        rewards: { experience: 30 },
        repeatable: true,
    };

    beforeEach(() => {
        qm = new QuestManager();
        qm.registerQuest(killGoblinsQuest);
        qm.registerQuest(fetchQuest);
    });

    it('should start a quest', () => {
        expect(qm.startQuest('quest_goblins')).toBe(true);
        expect(qm.getActiveQuests()).toHaveLength(1);
    });

    it('should reject starting unregistered quest', () => {
        expect(qm.startQuest('nonexistent')).toBe(false);
    });

    it('should not double-start an active quest', () => {
        qm.startQuest('quest_goblins');
        expect(qm.startQuest('quest_goblins')).toBe(false);
    });

    it('should track objective progress', () => {
        qm.startQuest('quest_goblins');
        qm.updateObjective('quest_goblins', 'kill_goblins', 3);
        expect(qm.getObjectiveProgress('quest_goblins', 'kill_goblins')).toBeCloseTo(0.6);
    });

    it('should auto-complete when all objectives are done', () => {
        qm.startQuest('quest_goblins');
        qm.updateObjective('quest_goblins', 'kill_goblins', 5);
        const quest = qm.getQuest('quest_goblins');
        expect(quest?.status).toBe(QuestStatus.Completed);
    });

    it('should grant rewards on completion', () => {
        const completeFn = vi.fn();
        qm.onQuestComplete(completeFn);

        qm.startQuest('quest_goblins');
        qm.updateObjective('quest_goblins', 'kill_goblins', 5);

        expect(completeFn).toHaveBeenCalledTimes(1);
        const reward = completeFn.mock.calls[0][1];
        expect(reward.experience).toBe(100);
    });

    it('should fail a quest', () => {
        const failFn = vi.fn();
        qm.onQuestFail(failFn);

        qm.startQuest('quest_goblins');
        qm.failQuest('quest_goblins');
        expect(qm.getQuest('quest_goblins')?.status).toBe(QuestStatus.Failed);
        expect(failFn).toHaveBeenCalledTimes(1);
    });

    it('should abandon a quest', () => {
        qm.startQuest('quest_goblins');
        qm.setTrackedQuest('quest_goblins');
        qm.abandonQuest('quest_goblins');
        expect(qm.getQuest('quest_goblins')).toBeNull();
        expect(qm.getTrackedQuest()).toBeNull();
    });

    it('should notify events to matching objectives', () => {
        qm.startQuest('quest_goblins');
        qm.notifyEvent(ObjectiveType.Kill, 'goblin', 2);
        expect(qm.getObjectiveProgress('quest_goblins', 'kill_goblins')).toBeCloseTo(0.4);
    });

    it('should respect prerequisites', () => {
        const chainedQuest: QuestDefinition = {
            ...fetchQuest,
            id: 'quest_chain',
            prerequisites: ['quest_goblins'],
            repeatable: false,
        };
        qm.registerQuest(chainedQuest);

        expect(qm.isQuestAvailable('quest_chain')).toBe(false);
        qm.startQuest('quest_goblins');
        qm.updateObjective('quest_goblins', 'kill_goblins', 5);
        expect(qm.isQuestAvailable('quest_chain')).toBe(true);
    });

    it('should allow repeatable quests to restart', () => {
        qm.startQuest('quest_fetch');
        qm.updateObjective('quest_fetch', 'collect_herbs', 3);
        expect(qm.getQuest('quest_fetch')?.status).toBe(QuestStatus.Completed);
        expect(qm.isQuestAvailable('quest_fetch')).toBe(true);
    });

    it('should report quest progress', () => {
        qm.startQuest('quest_goblins');
        expect(qm.getQuestProgress('quest_goblins')).toBe(0);
        qm.updateObjective('quest_goblins', 'kill_goblins', 2);
        expect(qm.getQuestProgress('quest_goblins')).toBeCloseTo(0.4);
    });

    it('should track and retrieve tracked quest', () => {
        qm.startQuest('quest_goblins');
        qm.setTrackedQuest('quest_goblins');
        expect(qm.getTrackedQuest()?.definition.id).toBe('quest_goblins');
    });

    it('should get counts', () => {
        expect(qm.getQuestCount()).toBe(2);
        qm.startQuest('quest_goblins');
        expect(qm.getActiveQuestCount()).toBe(1);
    });

    it('should get available quests', () => {
        const available = qm.getAvailableQuests();
        expect(available.length).toBe(2);
    });

    it('should serialize and restore state', () => {
        qm.startQuest('quest_goblins');
        qm.updateObjective('quest_goblins', 'kill_goblins', 3);
        qm.setTrackedQuest('quest_goblins');

        const data = qm.toJSON();

        const qm2 = new QuestManager();
        qm2.registerQuest(killGoblinsQuest);
        qm2.registerQuest(fetchQuest);
        qm2.fromJSON(data);

        expect(qm2.getQuestProgress('quest_goblins')).toBeCloseTo(0.6);
        expect(qm2.getTrackedQuest()?.definition.id).toBe('quest_goblins');
    });

    it('should remove a quest definition', () => {
        qm.removeQuest('quest_fetch');
        expect(qm.getQuestCount()).toBe(1);
    });

    it('should fire objective update callback', () => {
        const fn = vi.fn();
        qm.onObjectiveUpdate(fn);
        qm.startQuest('quest_goblins');
        qm.updateObjective('quest_goblins', 'kill_goblins', 1);
        expect(fn).toHaveBeenCalledTimes(1);
    });
});

describe('QuestChainManager', () => {
    it('should track chain progress', () => {
        const qm = new QuestManager();
        const q1: QuestDefinition = {
            id: 'chain_1', name: 'Chain 1', description: '', category: 'main', level: 1,
            objectives: [{ id: 'o1', description: 'Do', type: ObjectiveType.Custom, targetCount: 1, currentCount: 0, completed: false, optional: false, hidden: false }],
            rewards: {}, repeatable: false,
        };
        const q2: QuestDefinition = { ...q1, id: 'chain_2', name: 'Chain 2' };

        qm.registerQuest(q1);
        qm.registerQuest(q2);

        const chains = new QuestChainManager(qm);
        chains.registerChain(['chain_1', 'chain_2']);

        expect(chains.getChainProgress('chain_1')).toBe(0);
        expect(chains.isChainComplete('chain_1')).toBe(false);

        qm.startQuest('chain_1');
        qm.updateObjective('chain_1', 'o1', 1);

        expect(chains.getChainProgress('chain_1')).toBe(0.5);
    });
});

// ============================================================
// Network Manager (mock concrete subclass)
// ============================================================
describe('NetworkManager', () => {
    class MockNetworkManager extends NetworkManager {
        public sentMessages: Array<{ message: NetworkMessage; targetId?: string }> = [];

        public async connect(_address: string): Promise<void> {
            this.localClientId = 'local_player';
        }

        public disconnect(): void {
            this.clients.clear();
        }

        public send(message: NetworkMessage, targetId?: string): void {
            this.sentMessages.push({ message, targetId });
        }

        // Expose protected method for testing
        public injectMessage(message: NetworkMessage): void {
            this.handleMessage(message);
        }

        // Expose for testing
        public addClient(id: string): void {
            this.clients.set(id, { id, isConnected: true, latency: 0, lastMessageTime: Date.now() });
        }
    }

    let nm: MockNetworkManager;

    beforeEach(async () => {
        nm = new MockNetworkManager();
        await nm.connect('ws://localhost');
    });

    it('should assign local client id on connect', () => {
        expect(nm.getLocalClientId()).toBe('local_player');
    });

    it('should register and fire message handlers', () => {
        const fn = vi.fn();
        nm.on(MessageType.CHAT_MESSAGE, fn);

        nm.injectMessage({
            type: MessageType.CHAT_MESSAGE,
            senderId: 'other',
            timestamp: Date.now(),
            data: { text: 'hello' },
        });

        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should unregister message handlers', () => {
        const fn = vi.fn();
        nm.on(MessageType.CHAT_MESSAGE, fn);
        nm.off(MessageType.CHAT_MESSAGE, fn);

        nm.injectMessage({
            type: MessageType.CHAT_MESSAGE,
            senderId: 'other',
            timestamp: Date.now(),
            data: {},
        });

        expect(fn).not.toHaveBeenCalled();
    });

    it('should create messages with correct structure', () => {
        const msg = nm.createMessage(MessageType.PLAYER_ACTION, { action: 'jump' });
        expect(msg.type).toBe(MessageType.PLAYER_ACTION);
        expect(msg.senderId).toBe('local_player');
        expect(msg.data.action).toBe('jump');
        expect(msg.reliable).toBe(true);
    });

    it('should manage clients', () => {
        nm.addClient('p1');
        nm.addClient('p2');

        expect(nm.getClientCount()).toBe(2);
        expect(nm.getClients()).toHaveLength(2);
        expect(nm.getClient('p1')?.isConnected).toBe(true);
        expect(nm.isConnected('p1')).toBe(true);
        expect(nm.isConnected('unknown')).toBe(false);
    });

    it('should create and manage rooms', () => {
        nm.createRoom('Lobby', 4, true);
        const room = nm.getCurrentRoom();
        expect(room).not.toBeNull();
        expect(room!.name).toBe('Lobby');
        expect(room!.maxClients).toBe(4);
        expect(nm.getRooms()).toHaveLength(1);
    });

    it('should join and leave rooms', () => {
        nm.createRoom('Room1', 4);
        const rooms = nm.getRooms();
        const roomId = rooms[0].id;

        // Leave current room
        nm.leaveRoom();
        expect(nm.getCurrentRoom()).toBeNull();

        // Re-join
        expect(nm.joinRoom(roomId)).toBe(true);
        expect(nm.getCurrentRoom()?.id).toBe(roomId);
    });

    it('should reject joining full room', () => {
        nm.createRoom('Tiny', 1);
        const roomId = nm.getRooms()[0].id;
        // Room already has local_player, and maxClients=1
        expect(nm.joinRoom(roomId)).toBe(false);
    });

    it('should register and call RPC handlers', () => {
        const handler = vi.fn().mockReturnValue(42);
        nm.registerRPC('getHealth', handler);

        nm.injectMessage({
            type: MessageType.RPC_CALL,
            senderId: 'other',
            timestamp: Date.now(),
            data: { callId: 1, name: 'getHealth', args: [] },
        });

        expect(handler).toHaveBeenCalledWith('other', []);
        // Should have sent an RPC_RESPONSE
        expect(nm.sentMessages.some(m => m.message.type === MessageType.RPC_RESPONSE)).toBe(true);
    });

    it('should unregister RPC handler', () => {
        nm.registerRPC('test', () => {});
        nm.unregisterRPC('test');

        nm.injectMessage({
            type: MessageType.RPC_CALL,
            senderId: 'other',
            timestamp: Date.now(),
            data: { callId: 2, name: 'test', args: [] },
        });

        // Should respond with error
        const response = nm.sentMessages.find(m => m.message.type === MessageType.RPC_RESPONSE);
        expect(response?.message.data.error).toContain('not found');
    });

    it('should manage entity state', () => {
        nm.addClient('p1');
        nm.spawnEntity('enemy_01', [10, 0, 5]);

        const states = nm.getEntityStates();
        expect(states).toHaveLength(1);
        expect(states[0].entityId).toBe('enemy_01');

        nm.updateEntityTransform('enemy_01', [20, 0, 10]);
        nm.destroyEntity('enemy_01');
        expect(nm.getEntityStates()).toHaveLength(0);
    });

    it('should handle entity updates from network messages', () => {
        nm.injectMessage({
            type: MessageType.ENTITY_SPAWN,
            senderId: 'other',
            timestamp: Date.now(),
            data: { entityId: 'remote_01', ownerId: 'other', position: [1, 2, 3] },
        });
        expect(nm.getEntityStates()).toHaveLength(1);

        nm.injectMessage({
            type: MessageType.ENTITY_DESTROY,
            senderId: 'other',
            timestamp: Date.now(),
            data: { entityId: 'remote_01' },
        });
        expect(nm.getEntityStates()).toHaveLength(0);
    });

    it('should broadcast to connected clients', () => {
        nm.addClient('p1');
        nm.addClient('p2');
        nm.broadcast(nm.createMessage(MessageType.CHAT_MESSAGE, { text: 'hi' }));
        // Should send to p1 and p2 (not local_player)
        expect(nm.sentMessages).toHaveLength(2);
    });

    it('should send chat', () => {
        nm.addClient('p1');
        nm.sendChat('hello world');
        expect(nm.sentMessages.some(m => m.message.data.text === 'hello world')).toBe(true);
    });

    it('should disconnect and clear clients', () => {
        nm.addClient('p1');
        nm.disconnect();
        expect(nm.getClientCount()).toBe(0);
    });
});

// ============================================================
// CharacterController
// ============================================================
describe('CharacterController', () => {
    let cc: CharacterController;

    beforeEach(() => {
        cc = new CharacterController();
    });

    it('should start in Idle state at origin', () => {
        expect(cc.getState()).toBe(CharacterState.Idle);
        expect(cc.position.x).toBe(0);
        expect(cc.position.y).toBe(0);
        expect(cc.position.z).toBe(0);
    });

    it('should transition states', () => {
        const fn = vi.fn();
        cc.onStateChange = fn;
        cc.setState(CharacterState.Running);
        expect(cc.getState()).toBe(CharacterState.Running);
        expect(fn).toHaveBeenCalledWith(CharacterState.Idle, CharacterState.Running);
    });

    it('should not fire callback for same-state transition', () => {
        const fn = vi.fn();
        cc.onStateChange = fn;
        cc.setState(CharacterState.Idle); // already idle
        expect(fn).not.toHaveBeenCalled();
    });

    it('should move in the forward direction', () => {
        cc.move(new Vector3(0, 0, 1), 1 / 60);
        cc.update(1 / 60);
        expect(cc.getSpeed()).toBeGreaterThan(0);
    });

    it('should jump when grounded', () => {
        expect(cc.jump()).toBe(true);
        expect(cc.getState()).toBe(CharacterState.Jumping);
        expect(cc.velocity.y).toBeGreaterThan(0);
    });

    it('should not jump when airborne', () => {
        cc.jump();
        expect(cc.jump()).toBe(false);
    });

    it('should apply gravity when airborne', () => {
        cc.jump();
        cc.applyGravity(0.1);
        // velocity.y should decrease
        expect(cc.velocity.y).toBeLessThan(7); // jumpForce is 7
    });

    it('should sprint', () => {
        cc.sprint(true);
        cc.move(new Vector3(0, 0, 1), 1 / 60);
        expect(cc.getState()).toBe(CharacterState.Sprinting);
    });

    it('should crouch', () => {
        cc.crouch(true);
        expect(cc.getState()).toBe(CharacterState.Crouching);
        cc.crouch(false);
        expect(cc.getState()).toBe(CharacterState.Idle);
    });

    it('should set swimming state', () => {
        cc.setSwimming(true);
        expect(cc.getState()).toBe(CharacterState.Swimming);
        cc.setSwimming(false);
    });

    it('should set climbing state', () => {
        cc.setClimbing(true);
        expect(cc.getState()).toBe(CharacterState.Climbing);
        cc.setClimbing(false);
    });

    it('should teleport', () => {
        cc.teleport(new Vector3(10, 5, 20));
        expect(cc.position.x).toBeCloseTo(10);
        expect(cc.position.y).toBeCloseTo(5);
        expect(cc.velocity.x).toBe(0);
    });

    it('should look at yaw/pitch with clamped pitch', () => {
        cc.lookAt(Math.PI, 100); // extreme pitch
        expect(cc.pitch).toBeLessThanOrEqual(Math.PI / 2);
        expect(cc.yaw).toBeCloseTo(Math.PI);
    });

    it('should compute forward and right directions', () => {
        const fwd = cc.getForwardDirection();
        const right = cc.getRightDirection();
        expect(fwd.length()).toBeCloseTo(1, 3);
        expect(right.length()).toBeCloseTo(1, 3);
    });

    it('should reset to initial state', () => {
        cc.teleport(new Vector3(10, 10, 10));
        cc.setState(CharacterState.Running);
        cc.reset();
        expect(cc.position.x).toBe(0);
        expect(cc.getState()).toBe(CharacterState.Idle);
    });

    it('should not move when dead', () => {
        cc.setState(CharacterState.Dead);
        cc.move(new Vector3(0, 0, 1), 1 / 60);
        cc.update(1 / 60);
        expect(cc.getSpeed()).toBe(0);
    });

    it('should get and set config', () => {
        const cfg = cc.getConfig();
        expect(cfg.moveSpeed).toBe(5);
        cc.setConfig({ moveSpeed: 10 });
        expect(cc.getConfig().moveSpeed).toBe(10);
    });
});

describe('CharacterMovementPresets', () => {
    it('should provide FPS defaults', () => {
        const cfg = CharacterMovementPresets.defaultFPS();
        expect(cfg.moveSpeed).toBe(5);
        expect(cfg.gravity).toBe(18);
    });

    it('should provide third-person defaults', () => {
        const cfg = CharacterMovementPresets.thirdPerson();
        expect(cfg.moveSpeed).toBe(4);
    });

    it('should provide platformer defaults', () => {
        const cfg = CharacterMovementPresets.platformer();
        expect(cfg.jumpForce).toBe(12);
        expect(cfg.airControl).toBeCloseTo(0.8);
    });

    it('should provide realistic defaults', () => {
        const cfg = CharacterMovementPresets.realistic();
        expect(cfg.gravity).toBeCloseTo(9.81);
    });
});
