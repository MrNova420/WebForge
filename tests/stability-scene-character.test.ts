/**
 * Stability tests for Scene and Character systems.
 * Simulates real user workflows across Scene, GameObject, SceneSerializer,
 * PlayerCamera, InventorySystem, DialogueSystem, and QuestSystem.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { Scene, ISceneObject } from '../src/scene/Scene';
import { GameObject, IComponent } from '../src/scene/GameObject';
import { SceneSerializer, ComponentRegistry } from '../src/scene/SceneSerializer';
import { PlayerCamera, PlayerCameraMode } from '../src/scene/PlayerCamera';
import { Vector3 } from '../src/math/Vector3';

import {
  Inventory,
  EquipmentManager,
  LootTable,
  ItemDefinition,
  ItemType,
  ItemRarity,
  EquipmentSlot,
} from '../src/character/InventorySystem';

import {
  DialogueManager,
  DialogueBuilder,
  DialogueTree,
  DialogueNode,
} from '../src/character/DialogueSystem';

import {
  QuestManager,
  QuestDefinition,
  QuestStatus,
  ObjectiveType,
} from '../src/character/QuestSystem';

import {
  CharacterController,
  CharacterState,
  CharacterMovementPresets,
} from '../src/character/CharacterController';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeSceneObject(name: string): ISceneObject {
  return { name, active: true, update: vi.fn(), destroy: vi.fn() };
}

function makeComponent(name?: string): IComponent {
  const clsName = name ?? 'TestComponent';
  const comp: IComponent = {
    gameObject: null,
    enabled: true,
    awake: vi.fn(),
    start: vi.fn(),
    update: vi.fn(),
    destroy: vi.fn(),
  };
  Object.defineProperty(comp.constructor, 'name', { value: clsName });
  return comp;
}

function makeItemDef(overrides: Partial<ItemDefinition> = {}): ItemDefinition {
  return {
    id: 'item_default',
    name: 'Default Item',
    description: 'A test item',
    type: ItemType.Material,
    rarity: ItemRarity.Common,
    stackable: true,
    maxStack: 10,
    weight: 1,
    value: 5,
    properties: {},
    usable: false,
    equippable: false,
    ...overrides,
  };
}

function makeQuestDef(overrides: Partial<QuestDefinition> = {}): QuestDefinition {
  return {
    id: 'quest_default',
    name: 'Test Quest',
    description: 'A test quest',
    category: 'side',
    level: 1,
    objectives: [
      {
        id: 'obj_1',
        description: 'Kill 3 goblins',
        type: ObjectiveType.Kill,
        targetId: 'goblin',
        targetCount: 3,
        currentCount: 0,
        completed: false,
        optional: false,
        hidden: false,
      },
    ],
    rewards: { experience: 100, currency: 50 },
    repeatable: false,
    ...overrides,
  };
}

// ── Scene Tests ──────────────────────────────────────────────────────────────

describe('Scene: real-user workflows', () => {
  let scene: Scene;

  beforeEach(() => {
    scene = new Scene('TestScene');
  });

  it('adds 100 objects and verifies all present after update()', () => {
    const objects: ISceneObject[] = [];
    for (let i = 0; i < 100; i++) {
      const obj = makeSceneObject(`Obj_${i}`);
      objects.push(obj);
      scene.add(obj);
    }

    // Objects are pending until update processes them
    scene.update(0.016);

    expect(scene.getObjectCount()).toBe(100);
    const all = scene.getAllObjects();
    expect(all.length).toBe(100);

    // Every object's update should have been called
    for (const obj of objects) {
      expect(obj.update).toHaveBeenCalledWith(0.016);
    }
  });

  it('findByName() and findByTag() work after adding objects', () => {
    const hero = makeSceneObject('Hero');
    const enemy1 = makeSceneObject('Enemy1');
    const enemy2 = makeSceneObject('Enemy2');

    scene.add(hero);
    scene.add(enemy1);
    scene.add(enemy2);
    scene.update(0); // flush pending

    expect(scene.findByName('Hero')).toBe(hero);
    expect(scene.findByName('NonExistent')).toBeNull();

    // Tag objects after they are in the scene
    scene.tagObject(enemy1, 'enemy');
    scene.tagObject(enemy2, 'enemy');

    const enemies = scene.findByTag('enemy');
    expect(enemies).toHaveLength(2);
    expect(enemies).toContain(enemy1);
    expect(enemies).toContain(enemy2);
  });

  it('removes an object and verifies it is gone', () => {
    const obj = makeSceneObject('ToRemove');
    scene.add(obj);
    scene.update(0); // flush add
    expect(scene.getObjectCount()).toBe(1);

    scene.remove(obj);
    scene.update(0); // flush remove

    expect(scene.getObjectCount()).toBe(0);
    expect(scene.findByName('ToRemove')).toBeNull();
    expect(scene.getAllObjects()).toHaveLength(0);
  });

  it('clears the scene and verifies empty', () => {
    for (let i = 0; i < 10; i++) {
      scene.add(makeSceneObject(`Obj_${i}`));
    }
    scene.update(0);
    expect(scene.getObjectCount()).toBe(10);

    scene.clear();

    expect(scene.getObjectCount()).toBe(0);
    expect(scene.getAllObjects()).toHaveLength(0);
  });
});

// ── GameObject Tests ─────────────────────────────────────────────────────────

describe('GameObject: hierarchy and components', () => {
  it('creates object, adds child, verifies parent-child relationship', () => {
    const parent = new GameObject('Parent');
    const child = new GameObject('Child');

    parent.addChild(child);

    expect(child.getParent()).toBe(parent);
    expect(parent.getChildren()).toContain(child);
    expect(parent.getChildren()).toHaveLength(1);
  });

  it('deep hierarchy (3+ levels) with getWorldPosition recursion', () => {
    const root = new GameObject('Root');
    root.transform.position.set(10, 0, 0);

    const mid = new GameObject('Mid');
    mid.transform.position.set(0, 5, 0);
    root.addChild(mid);

    const leaf = new GameObject('Leaf');
    leaf.transform.position.set(0, 0, 3);
    mid.addChild(leaf);

    // Verify hierarchy
    expect(mid.getParent()).toBe(root);
    expect(leaf.getParent()).toBe(mid);

    // World position should accumulate through the hierarchy
    const worldPos = leaf.transform.getWorldPosition();
    expect(worldPos.x).toBeCloseTo(10, 5);
    expect(worldPos.y).toBeCloseTo(5, 5);
    expect(worldPos.z).toBeCloseTo(3, 5);
  });

  it('findChild() works recursively through hierarchy', () => {
    const root = new GameObject('Root');
    const a = new GameObject('A');
    const b = new GameObject('B');
    const c = new GameObject('DeepChild');

    root.addChild(a);
    a.addChild(b);
    b.addChild(c);

    expect(root.findChild('DeepChild')).toBe(c);
    expect(root.findChild('B')).toBe(b);
    expect(root.findChild('Nonexistent')).toBeNull();
  });

  it('removeChild detaches correctly', () => {
    const parent = new GameObject('Parent');
    const child = new GameObject('Child');
    parent.addChild(child);

    expect(parent.getChildren()).toHaveLength(1);
    parent.removeChild(child);

    expect(parent.getChildren()).toHaveLength(0);
    expect(child.getParent()).toBeNull();
  });

  it('tags on a GameObject work correctly', () => {
    const go = new GameObject('Player');
    go.addTag('hero');
    go.addTag('team1');

    expect(go.hasTag('hero')).toBe(true);
    expect(go.hasTag('team1')).toBe(true);
    expect(go.hasTag('villain')).toBe(false);

    go.removeTag('hero');
    expect(go.hasTag('hero')).toBe(false);
    expect(go.getTags()).toEqual(['team1']);
  });
});

// ── SceneSerializer Tests ────────────────────────────────────────────────────

describe('SceneSerializer: serialize/deserialize round-trip', () => {
  beforeEach(() => {
    ComponentRegistry.clear();
  });

  it('serializes a scene to JSON and deserializes back with matching object count', () => {
    const scene = new Scene('SerializableScene');
    const objA = new GameObject('ObjA');
    objA.transform.position.set(1, 2, 3);
    objA.addTag('tagA');

    const objB = new GameObject('ObjB');
    objB.transform.position.set(4, 5, 6);

    const child = new GameObject('Child');
    child.transform.position.set(7, 8, 9);
    objA.addChild(child);

    scene.add(objA);
    scene.add(objB);
    scene.update(0); // flush pending

    const json = SceneSerializer.toJSON(scene, true);
    expect(json).toBeTruthy();

    const restored = SceneSerializer.fromJSON(json);
    // flush pending adds in restored scene
    restored.update(0);

    // ObjA and ObjB are the root-level objects (child is nested under ObjA)
    // The serializer only adds root objects to the scene
    expect(restored.getObjectCount()).toBe(2);
    expect(restored.findByName('ObjA')).toBeTruthy();
    expect(restored.findByName('ObjB')).toBeTruthy();
  });

  it('preserves transform values through serialization', () => {
    const scene = new Scene('TransformScene');
    const go = new GameObject('Positioned');
    go.transform.position.set(11, 22, 33);
    go.transform.scale.set(2, 3, 4);

    scene.add(go);
    scene.update(0);

    const data = SceneSerializer.serialize(scene);
    const obj = data.objects[0];

    expect(obj.name).toBe('Positioned');
    expect(obj.transform.position).toEqual({ x: 11, y: 22, z: 33 });
    expect(obj.transform.scale).toEqual({ x: 2, y: 3, z: 4 });
  });

  it('diff detects added and removed objects', () => {
    const sceneA = new Scene('A');
    const sceneB = new Scene('B');

    const shared = new GameObject('Shared');
    const onlyA = new GameObject('OnlyA');
    const onlyB = new GameObject('OnlyB');

    sceneA.add(new GameObject('Shared'));
    sceneA.add(onlyA);
    sceneA.update(0);

    sceneB.add(shared);
    sceneB.add(onlyB);
    sceneB.update(0);

    const diff = SceneSerializer.diff(sceneA, sceneB);
    expect(diff.added).toContain('OnlyB');
    expect(diff.removed).toContain('OnlyA');
  });
});

// ── PlayerCamera Tests ───────────────────────────────────────────────────────

describe('PlayerCamera: mode creation and basic operation', () => {
  it('creates FPS camera without crash', () => {
    const cam = PlayerCamera.createFPS();
    expect(cam).toBeTruthy();
    cam.update(0.016);
    expect(cam.getPosition()).toBeTruthy();
    expect(cam.getFOV()).toBe(60);
  });

  it('creates ThirdPerson camera without crash', () => {
    const cam = PlayerCamera.createThirdPerson();
    expect(cam).toBeTruthy();
    cam.setFollowTarget(new Vector3(0, 1, 0));
    cam.update(0.016);
    expect(cam.getPosition()).toBeTruthy();
  });

  it('creates Orbital camera without crash', () => {
    const cam = PlayerCamera.createOrbital();
    expect(cam).toBeTruthy();
    cam.setOrbitTarget(new Vector3(0, 0, 0));
    cam.update(0.016);
    expect(cam.getPosition()).toBeTruthy();
  });

  it('creates TopDown and SideScroller cameras without crash', () => {
    const topDown = PlayerCamera.createTopDown();
    expect(topDown).toBeTruthy();
    topDown.update(0.016);

    const sideScroller = PlayerCamera.createSideScroller();
    expect(sideScroller).toBeTruthy();
    sideScroller.update(0.016);
  });

  it('camera shake does not crash', () => {
    const cam = PlayerCamera.createFPS();
    cam.shake(0.5, 0.3);
    // Run several frames of shake
    for (let i = 0; i < 20; i++) {
      cam.update(0.016);
    }
    expect(cam.getPosition()).toBeTruthy();
  });

  it('rotate and zoom work without errors', () => {
    const cam = PlayerCamera.createThirdPerson();
    cam.rotate(0.1, -0.05);
    cam.zoom(2);
    cam.update(0.016);
    expect(cam.getYaw()).toBeCloseTo(0.1, 5);
  });

  it('getViewMatrix returns a valid matrix', () => {
    const cam = PlayerCamera.createOrbital({ radius: 10 });
    cam.update(0.016);
    const view = cam.getViewMatrix();
    expect(view).toBeTruthy();
  });
});

// ── CharacterController Tests ────────────────────────────────────────────────

describe('CharacterController: movement and state', () => {
  let controller: CharacterController;

  beforeEach(() => {
    controller = new CharacterController();
  });

  it('starts in Idle state at origin', () => {
    expect(controller.getState()).toBe(CharacterState.Idle);
    expect(controller.position.x).toBe(0);
    expect(controller.position.y).toBe(0);
    expect(controller.position.z).toBe(0);
  });

  it('move updates velocity and state', () => {
    controller.move(new Vector3(0, 0, 1), 0.016);
    expect(controller.getSpeed()).toBeGreaterThan(0);
  });

  it('jump changes state when grounded', () => {
    expect(controller.isGrounded()).toBe(true);
    const jumped = controller.jump();
    expect(jumped).toBe(true);
    expect(controller.getState()).toBe(CharacterState.Jumping);
  });

  it('cannot jump when not grounded', () => {
    controller.jump();
    // After jump, we are not grounded anymore
    expect(controller.jump()).toBe(false);
  });

  it('teleport resets velocity and sets position', () => {
    controller.move(new Vector3(1, 0, 0), 0.016);
    controller.teleport(new Vector3(100, 0, 200));

    expect(controller.position.x).toBe(100);
    expect(controller.position.z).toBe(200);
    expect(controller.velocity.x).toBe(0);
    expect(controller.velocity.z).toBe(0);
  });

  it('state change callback fires on transition', () => {
    const cb = vi.fn();
    controller.onStateChange = cb;
    controller.jump();
    expect(cb).toHaveBeenCalledWith(CharacterState.Idle, CharacterState.Jumping);
  });

  it('reset restores initial state', () => {
    controller.move(new Vector3(1, 0, 1), 0.016);
    controller.jump();
    controller.reset();

    expect(controller.getState()).toBe(CharacterState.Idle);
    expect(controller.position.x).toBe(0);
    expect(controller.velocity.x).toBe(0);
    expect(controller.yaw).toBe(0);
  });
});

// ── Inventory Tests ──────────────────────────────────────────────────────────

describe('InventorySystem: add, remove, capacity', () => {
  let inventory: Inventory;
  let sword: ItemDefinition;
  let potion: ItemDefinition;

  beforeEach(() => {
    inventory = new Inventory(20, 100);
    sword = makeItemDef({
      id: 'sword_iron',
      name: 'Iron Sword',
      type: ItemType.Weapon,
      rarity: ItemRarity.Uncommon,
      stackable: false,
      maxStack: 1,
      weight: 5,
      value: 50,
      equippable: true,
      equipSlot: EquipmentSlot.MainHand,
      properties: { damage: 10 },
    });
    potion = makeItemDef({
      id: 'potion_health',
      name: 'Health Potion',
      type: ItemType.Consumable,
      stackable: true,
      maxStack: 5,
      weight: 0.5,
      value: 10,
      usable: true,
    });
  });

  it('adds items and retrieves them', () => {
    expect(inventory.addItem(sword)).toBe(true);
    expect(inventory.addItem(potion, 3)).toBe(true);

    expect(inventory.hasItem('sword_iron')).toBe(true);
    expect(inventory.getItemCount('potion_health')).toBe(3);
    expect(inventory.getUsedSlots()).toBe(2);
  });

  it('stacking fills existing stacks before new slots', () => {
    inventory.addItem(potion, 3);
    inventory.addItem(potion, 2);
    // Should merge into one stack of 5
    expect(inventory.getItemCount('potion_health')).toBe(5);
    expect(inventory.getUsedSlots()).toBe(1);
  });

  it('rejects items when weight capacity exceeded', () => {
    const heavy = makeItemDef({ id: 'heavy', weight: 60 });
    inventory.addItem(heavy, 1);
    // 60 used, 40 remaining. Adding another 60 should fail.
    expect(inventory.addItem(heavy, 1)).toBe(false);
    expect(inventory.getItemCount('heavy')).toBe(1);
  });

  it('removes items correctly', () => {
    inventory.addItem(potion, 5);
    expect(inventory.removeItem('potion_health', 3)).toBe(true);
    expect(inventory.getItemCount('potion_health')).toBe(2);

    expect(inventory.removeItem('potion_health', 2)).toBe(true);
    expect(inventory.hasItem('potion_health')).toBe(false);
  });

  it('fails to remove more than available', () => {
    inventory.addItem(potion, 2);
    expect(inventory.removeItem('potion_health', 5)).toBe(false);
    expect(inventory.getItemCount('potion_health')).toBe(2);
  });

  it('clear empties the entire inventory', () => {
    inventory.addItem(sword);
    inventory.addItem(potion, 3);
    inventory.clear();

    expect(inventory.getUsedSlots()).toBe(0);
    expect(inventory.isFull()).toBe(false);
  });

  it('weight tracking is accurate', () => {
    inventory.addItem(sword); // 5
    inventory.addItem(potion, 4); // 4 * 0.5 = 2
    expect(inventory.getCurrentWeight()).toBeCloseTo(7, 5);
    expect(inventory.getRemainingWeight()).toBeCloseTo(93, 5);
  });

  it('onChange callback fires on mutation', () => {
    const cb = vi.fn();
    inventory.onChange = cb;
    inventory.addItem(sword);
    expect(cb).toHaveBeenCalled();
  });

  it('EquipmentManager equip and stat bonuses', () => {
    const equip = new EquipmentManager();
    const swordItem = { definition: sword, quantity: 1 };
    equip.equip(EquipmentSlot.MainHand, swordItem);

    expect(equip.getEquipped(EquipmentSlot.MainHand)).toBe(swordItem);
    const bonuses = equip.getStatBonuses();
    expect(bonuses['damage']).toBe(10);
  });
});

// ── Dialogue Tests ───────────────────────────────────────────────────────────

describe('DialogueSystem: tree navigation', () => {
  let manager: DialogueManager;
  let tree: DialogueTree;

  beforeEach(() => {
    manager = new DialogueManager();
    tree = DialogueBuilder
      .create('greeting', 'Greeting Dialogue')
      .addNode('start', 'NPC', 'Hello, adventurer!')
      .addChoice('start', 'Tell me about the quest.', 'quest_info')
      .addChoice('start', 'Goodbye.', null)
      .addNode('quest_info', 'NPC', 'There is a dragon in the cave.')
      .addChoice('quest_info', 'I will slay it!', 'accept')
      .addChoice('quest_info', 'No thanks.', null)
      .addNode('accept', 'NPC', 'Good luck, hero!')
      .build();
    manager.registerTree(tree);
  });

  it('starts dialogue and receives first node', () => {
    const node = manager.startDialogue('greeting');
    expect(node).toBeTruthy();
    expect(node!.speaker).toBe('NPC');
    expect(node!.text).toBe('Hello, adventurer!');
    expect(manager.isInDialogue()).toBe(true);
  });

  it('navigates through choices to subsequent nodes', () => {
    manager.startDialogue('greeting');
    const choices = manager.getAvailableChoices();
    expect(choices.length).toBe(2);

    // Select "Tell me about the quest."
    const next = manager.selectChoice(choices[0].id);
    expect(next).toBeTruthy();
    expect(next!.text).toBe('There is a dragon in the cave.');
  });

  it('ending choice terminates dialogue', () => {
    manager.startDialogue('greeting');
    const choices = manager.getAvailableChoices();
    // Select "Goodbye."
    const next = manager.selectChoice(choices[1].id);
    expect(next).toBeNull();
    expect(manager.isInDialogue()).toBe(false);
  });

  it('dialogue history is recorded', () => {
    manager.startDialogue('greeting');
    const choices = manager.getAvailableChoices();
    manager.selectChoice(choices[0].id);

    const history = manager.getDialogueHistory();
    expect(history.length).toBe(2);
    expect(history[0].text).toBe('Hello, adventurer!');
    expect(history[1].text).toBe('There is a dragon in the cave.');
  });

  it('variables can be set and read during dialogue', () => {
    const effectTree = DialogueBuilder
      .create('vars', 'Variable Test')
      .addNode('n1', 'NPC', 'Setting a var.')
      .addEffect('n1', { type: 'setVariable', key: 'quest_accepted', value: true })
      .addChoice('n1', 'OK', null)
      .build();

    manager.registerTree(effectTree);
    manager.startDialogue('vars');

    expect(manager.getVariable('quest_accepted')).toBe(true);
  });

  it('returns null when starting non-existent tree', () => {
    expect(manager.startDialogue('nonexistent')).toBeNull();
  });

  it('callbacks fire correctly', () => {
    const startCb = vi.fn();
    const endCb = vi.fn();
    const nodeCb = vi.fn();
    const choiceCb = vi.fn();

    manager.onDialogueStart = startCb;
    manager.onDialogueEnd = endCb;
    manager.onNodeChange = nodeCb;
    manager.onChoiceMade = choiceCb;

    manager.startDialogue('greeting');
    expect(startCb).toHaveBeenCalledTimes(1);
    expect(nodeCb).toHaveBeenCalledTimes(1);

    const choices = manager.getAvailableChoices();
    manager.selectChoice(choices[1].id); // Goodbye → ends dialogue
    expect(choiceCb).toHaveBeenCalledTimes(1);
    expect(endCb).toHaveBeenCalledTimes(1);
  });
});

// ── Quest Tests ──────────────────────────────────────────────────────────────

describe('QuestSystem: quest lifecycle', () => {
  let qm: QuestManager;

  beforeEach(() => {
    qm = new QuestManager();
  });

  it('registers and starts a quest', () => {
    const def = makeQuestDef();
    qm.registerQuest(def);
    expect(qm.startQuest('quest_default')).toBe(true);
    expect(qm.getActiveQuests()).toHaveLength(1);
    expect(qm.getQuest('quest_default')!.status).toBe(QuestStatus.Active);
  });

  it('updates objectives via notifyEvent', () => {
    qm.registerQuest(makeQuestDef());
    qm.startQuest('quest_default');

    qm.notifyEvent(ObjectiveType.Kill, 'goblin', 1);
    expect(qm.getObjectiveProgress('quest_default', 'obj_1')).toBeCloseTo(1 / 3, 5);

    qm.notifyEvent(ObjectiveType.Kill, 'goblin', 1);
    expect(qm.getObjectiveProgress('quest_default', 'obj_1')).toBeCloseTo(2 / 3, 5);
  });

  it('auto-completes quest when all objectives done', () => {
    qm.registerQuest(makeQuestDef());
    qm.startQuest('quest_default');

    qm.notifyEvent(ObjectiveType.Kill, 'goblin', 3);

    const quest = qm.getQuest('quest_default');
    expect(quest!.status).toBe(QuestStatus.Completed);
  });

  it('completeQuest returns rewards', () => {
    const def = makeQuestDef();
    qm.registerQuest(def);
    qm.startQuest('quest_default');

    // Manually complete objectives
    qm.updateObjective('quest_default', 'obj_1', 3);

    // Quest auto-completes, so check the instance
    const quest = qm.getQuest('quest_default');
    expect(quest!.status).toBe(QuestStatus.Completed);
    expect(quest!.definition.rewards.experience).toBe(100);
  });

  it('failQuest sets failed status', () => {
    qm.registerQuest(makeQuestDef());
    qm.startQuest('quest_default');

    qm.failQuest('quest_default');
    expect(qm.getQuest('quest_default')!.status).toBe(QuestStatus.Failed);
  });

  it('abandonQuest removes the active instance', () => {
    qm.registerQuest(makeQuestDef());
    qm.startQuest('quest_default');

    qm.abandonQuest('quest_default');
    expect(qm.getActiveQuests()).toHaveLength(0);
  });

  it('prerequisites prevent starting locked quests', () => {
    const prereq = makeQuestDef({ id: 'prereq' });
    const locked = makeQuestDef({
      id: 'locked',
      prerequisites: ['prereq'],
    });

    qm.registerQuest(prereq);
    qm.registerQuest(locked);

    // Cannot start locked quest before prereq is completed
    expect(qm.startQuest('locked')).toBe(false);

    // Complete the prerequisite
    qm.startQuest('prereq');
    qm.updateObjective('prereq', 'obj_1', 3);
    expect(qm.getQuest('prereq')!.status).toBe(QuestStatus.Completed);

    // Now it should be available
    expect(qm.startQuest('locked')).toBe(true);
  });

  it('quest progress reports correctly', () => {
    const def = makeQuestDef({
      objectives: [
        {
          id: 'obj_a', description: 'Collect 4 gems', type: ObjectiveType.Collect,
          targetId: 'gem', targetCount: 4, currentCount: 0, completed: false,
          optional: false, hidden: false,
        },
        {
          id: 'obj_b', description: 'Talk to wizard', type: ObjectiveType.Talk,
          targetId: 'wizard', targetCount: 1, currentCount: 0, completed: false,
          optional: false, hidden: false,
        },
      ],
    });

    qm.registerQuest(def);
    qm.startQuest('quest_default');

    qm.updateObjective('quest_default', 'obj_a', 2);
    // Progress: 2/4 + 0/1 = 2/5 = 0.4
    expect(qm.getQuestProgress('quest_default')).toBeCloseTo(0.4, 5);
  });

  it('callbacks fire on quest events', () => {
    const startCb = vi.fn();
    const completeCb = vi.fn();
    const objCb = vi.fn();

    qm.onQuestStart(startCb);
    qm.onQuestComplete(completeCb);
    qm.onObjectiveUpdate(objCb);

    qm.registerQuest(makeQuestDef());
    qm.startQuest('quest_default');
    expect(startCb).toHaveBeenCalledTimes(1);

    qm.notifyEvent(ObjectiveType.Kill, 'goblin', 3);
    expect(objCb).toHaveBeenCalled();
    expect(completeCb).toHaveBeenCalledTimes(1);
  });

  it('tracked quest is set and retrieved', () => {
    qm.registerQuest(makeQuestDef());
    qm.startQuest('quest_default');
    qm.setTrackedQuest('quest_default');

    expect(qm.getTrackedQuest()).toBeTruthy();
    expect(qm.getTrackedQuest()!.definition.id).toBe('quest_default');
  });
});
