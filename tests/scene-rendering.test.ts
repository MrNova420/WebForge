/**
 * Scene and Rendering Subsystem Tests for WebForge
 * Covers: Scene management, GameObject hierarchy/components, Camera, and Light types
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { Scene, ISceneObject } from '../src/scene/Scene';
import { GameObject, IComponent } from '../src/scene/GameObject';
import { Camera } from '../src/rendering/Camera';
import { Vector3 } from '../src/math/Vector3';
import {
  LightType,
  DirectionalLight,
  PointLight,
  SpotLight,
  AreaLight
} from '../src/rendering/Light';

// Helper: minimal ISceneObject for Scene tests
function createSceneObject(name: string): ISceneObject {
  return {
    name,
    active: true,
    update: vi.fn(),
    destroy: vi.fn()
  };
}

// Helper: minimal IComponent for GameObject tests
function createComponent(name?: string): IComponent {
  const ComponentClass = name
    ? { [name]: class { gameObject = null; enabled = true; awake = vi.fn(); start = vi.fn(); update = vi.fn(); destroy = vi.fn(); } }[name]
    : class TestComponent { gameObject = null; enabled = true; awake = vi.fn(); start = vi.fn(); update = vi.fn(); destroy = vi.fn(); };
  return new ComponentClass() as unknown as IComponent;
}

// ============================================================
// Scene Tests
// ============================================================
describe('Scene', () => {
  let scene: Scene;

  beforeEach(() => {
    scene = new Scene('TestScene');
  });

  describe('creation', () => {
    it('should create with given name', () => {
      expect(scene.name).toBe('TestScene');
    });

    it('should default to active', () => {
      expect(scene.active).toBe(true);
    });

    it('should use default name when none provided', () => {
      const s = new Scene();
      expect(s.name).toBe('Scene');
    });

    it('should start with zero objects', () => {
      expect(scene.getObjectCount()).toBe(0);
      expect(scene.getAllObjects()).toEqual([]);
    });
  });

  describe('add / remove objects', () => {
    it('should add objects after update (deferred)', () => {
      const obj = createSceneObject('Player');
      scene.add(obj);
      // Not yet in scene until update processes pending changes
      expect(scene.getObjectCount()).toBe(0);
      scene.update(0);
      expect(scene.getObjectCount()).toBe(1);
    });

    it('should find added object by name', () => {
      const obj = createSceneObject('Enemy');
      scene.add(obj);
      scene.update(0);
      expect(scene.findByName('Enemy')).toBe(obj);
    });

    it('should return null for unknown name', () => {
      expect(scene.findByName('Ghost')).toBeNull();
    });

    it('should remove objects after update (deferred)', () => {
      const obj = createSceneObject('NPC');
      scene.add(obj);
      scene.update(0);
      scene.remove(obj);
      // Still in scene until next update
      expect(scene.getObjectCount()).toBe(1);
      scene.update(0);
      expect(scene.getObjectCount()).toBe(0);
    });

    it('should not add duplicate objects', () => {
      const obj = createSceneObject('Dup');
      scene.add(obj);
      scene.update(0);
      scene.add(obj); // duplicate – should warn, not add
      scene.update(0);
      expect(scene.getObjectCount()).toBe(1);
    });

    it('should emit object:added event', () => {
      const handler = vi.fn();
      scene.getEvents().on('object:added', handler);
      const obj = createSceneObject('A');
      scene.add(obj);
      scene.update(0);
      expect(handler).toHaveBeenCalledWith(obj);
    });

    it('should emit object:removed event', () => {
      const handler = vi.fn();
      scene.getEvents().on('object:removed', handler);
      const obj = createSceneObject('B');
      scene.add(obj);
      scene.update(0);
      scene.remove(obj);
      scene.update(0);
      expect(handler).toHaveBeenCalledWith(obj);
    });
  });

  describe('tagging', () => {
    it('should tag objects and find by tag', () => {
      const e1 = createSceneObject('E1');
      const e2 = createSceneObject('E2');
      scene.add(e1);
      scene.add(e2);
      scene.update(0);
      scene.tagObject(e1, 'enemy');
      scene.tagObject(e2, 'enemy');
      const enemies = scene.findByTag('enemy');
      expect(enemies).toHaveLength(2);
      expect(enemies).toContain(e1);
      expect(enemies).toContain(e2);
    });

    it('should return empty array for unknown tag', () => {
      expect(scene.findByTag('nonexistent')).toEqual([]);
    });

    it('should untag objects', () => {
      const obj = createSceneObject('X');
      scene.add(obj);
      scene.update(0);
      scene.tagObject(obj, 'item');
      expect(scene.findByTag('item')).toHaveLength(1);
      scene.untagObject(obj, 'item');
      expect(scene.findByTag('item')).toEqual([]);
    });

    it('should not tag object not in scene', () => {
      const obj = createSceneObject('Outside');
      scene.tagObject(obj, 'tag'); // should warn, not crash
      expect(scene.findByTag('tag')).toEqual([]);
    });
  });

  describe('update', () => {
    it('should call update on active objects', () => {
      const obj = createSceneObject('Updatable');
      scene.add(obj);
      scene.update(0.016);
      expect(obj.update).toHaveBeenCalledWith(0.016);
    });

    it('should not update inactive objects', () => {
      const obj = createSceneObject('Inactive');
      obj.active = false;
      scene.add(obj);
      scene.update(0.016);
      // update called once during processPendingChanges tick – but obj.active is false so skipped
      expect(obj.update).not.toHaveBeenCalled();
    });

    it('should not update when scene is disabled', () => {
      const obj = createSceneObject('Frozen');
      scene.add(obj);
      scene.update(0); // process pending
      scene.disable();
      scene.update(0.016);
      // update was called during first update(0), but not after disable
      expect(obj.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('enable / disable', () => {
    it('should toggle active flag', () => {
      scene.disable();
      expect(scene.active).toBe(false);
      scene.enable();
      expect(scene.active).toBe(true);
    });

    it('should emit scene:enabled and scene:disabled events', () => {
      const enabled = vi.fn();
      const disabled = vi.fn();
      scene.getEvents().on('scene:enabled', enabled);
      scene.getEvents().on('scene:disabled', disabled);
      scene.disable();
      expect(disabled).toHaveBeenCalledOnce();
      scene.enable();
      expect(enabled).toHaveBeenCalledOnce();
    });
  });

  describe('clear / destroy', () => {
    it('should clear all objects and call destroy on them', () => {
      const obj = createSceneObject('Temp');
      scene.add(obj);
      scene.update(0);
      scene.clear();
      expect(scene.getObjectCount()).toBe(0);
      expect(obj.destroy).toHaveBeenCalled();
    });

    it('should emit scene:cleared', () => {
      const handler = vi.fn();
      scene.getEvents().on('scene:cleared', handler);
      scene.clear();
      expect(handler).toHaveBeenCalledOnce();
    });

    it('should destroy scene and clear events', () => {
      const obj = createSceneObject('D');
      scene.add(obj);
      scene.update(0);
      scene.destroy();
      expect(scene.getObjectCount()).toBe(0);
    });
  });
});

// ============================================================
// GameObject Tests
// ============================================================
describe('GameObject', () => {
  let go: GameObject;

  beforeEach(() => {
    go = new GameObject('Hero');
  });

  describe('creation', () => {
    it('should have the given name', () => {
      expect(go.name).toBe('Hero');
    });

    it('should default to active', () => {
      expect(go.active).toBe(true);
    });

    it('should use default name when none provided', () => {
      const g = new GameObject();
      expect(g.name).toBe('GameObject');
    });

    it('should have a Transform', () => {
      expect(go.transform).toBeDefined();
      expect(go.transform.position).toBeDefined();
    });
  });

  describe('parent-child hierarchy', () => {
    it('should set parent and add as child', () => {
      const child = new GameObject('Child');
      child.setParent(go);
      expect(child.getParent()).toBe(go);
      expect(go.getChildren()).toContain(child);
    });

    it('should remove child when setParent(null)', () => {
      const child = new GameObject('Child');
      child.setParent(go);
      child.setParent(null);
      expect(child.getParent()).toBeNull();
      expect(go.getChildren()).toHaveLength(0);
    });

    it('should addChild via parent', () => {
      const child = new GameObject('Child');
      go.addChild(child);
      expect(child.getParent()).toBe(go);
      expect(go.getChildren()).toContain(child);
    });

    it('should removeChild', () => {
      const child = new GameObject('Child');
      go.addChild(child);
      go.removeChild(child);
      expect(child.getParent()).toBeNull();
      expect(go.getChildren()).toHaveLength(0);
    });

    it('should findChild by name (direct)', () => {
      const child = new GameObject('Weapon');
      go.addChild(child);
      expect(go.findChild('Weapon')).toBe(child);
    });

    it('should findChild recursively', () => {
      const child = new GameObject('Arm');
      const grandchild = new GameObject('Hand');
      go.addChild(child);
      child.addChild(grandchild);
      expect(go.findChild('Hand')).toBe(grandchild);
    });

    it('should return null for unfound child', () => {
      expect(go.findChild('Missing')).toBeNull();
    });

    it('should update children during update', () => {
      const child = new GameObject('Child');
      go.addChild(child);
      const comp = createComponent('ChildComp');
      child.addComponent(comp);
      go.update(0.016);
      expect(comp.update).toHaveBeenCalledWith(0.016);
    });

    it('should not update inactive children', () => {
      const child = new GameObject('Inactive');
      child.active = false;
      go.addChild(child);
      const comp = createComponent('InactiveComp');
      child.addComponent(comp);
      go.update(0.016);
      expect(comp.update).not.toHaveBeenCalled();
    });
  });

  describe('components', () => {
    it('should add and retrieve component by type name', () => {
      const comp = createComponent('MyRenderer');
      go.addComponent(comp);
      expect(go.getComponent('MyRenderer')).toBe(comp);
    });

    it('should set gameObject reference on component', () => {
      const comp = createComponent('Comp');
      go.addComponent(comp);
      expect(comp.gameObject).toBe(go);
    });

    it('should throw when adding duplicate component type', () => {
      const c1 = createComponent('Dup');
      const c2 = createComponent('Dup');
      go.addComponent(c1);
      expect(() => go.addComponent(c2)).toThrow();
    });

    it('should check hasComponent', () => {
      const comp = createComponent('Physics');
      go.addComponent(comp);
      expect(go.hasComponent('Physics')).toBe(true);
      expect(go.hasComponent('Audio')).toBe(false);
    });

    it('should remove component', () => {
      const comp = createComponent('Removable');
      go.addComponent(comp);
      go.removeComponent(comp);
      expect(go.hasComponent('Removable')).toBe(false);
      expect(comp.destroy).toHaveBeenCalled();
      expect(comp.gameObject).toBeNull();
    });

    it('should getAllComponents', () => {
      const c1 = createComponent('A');
      const c2 = createComponent('B');
      go.addComponent(c1);
      go.addComponent(c2);
      expect(go.getAllComponents()).toHaveLength(2);
    });

    it('should call awake and start on components during first update', () => {
      const comp = createComponent('LifecycleComp');
      go.addComponent(comp);
      go.update(0.016);
      expect(comp.awake).toHaveBeenCalled();
      expect(comp.start).toHaveBeenCalled();
    });

    it('should call update on enabled components', () => {
      const comp = createComponent('UpdComp');
      go.addComponent(comp);
      go.update(0.016);
      expect(comp.update).toHaveBeenCalledWith(0.016);
    });

    it('should not call update on disabled components', () => {
      const comp = createComponent('DisComp');
      comp.enabled = false;
      go.addComponent(comp);
      go.update(0.016);
      expect(comp.update).not.toHaveBeenCalled();
    });
  });

  describe('tags', () => {
    it('should add and check tags', () => {
      go.addTag('player');
      expect(go.hasTag('player')).toBe(true);
      expect(go.hasTag('enemy')).toBe(false);
    });

    it('should remove tags', () => {
      go.addTag('player');
      go.removeTag('player');
      expect(go.hasTag('player')).toBe(false);
    });

    it('should getTags', () => {
      go.addTag('a');
      go.addTag('b');
      const tags = go.getTags();
      expect(tags).toContain('a');
      expect(tags).toContain('b');
      expect(tags).toHaveLength(2);
    });
  });

  describe('clone', () => {
    it('should clone name with suffix', () => {
      const clone = go.clone();
      expect(clone.name).toBe('Hero_Clone');
    });

    it('should preserve active state', () => {
      go.active = false;
      const clone = go.clone();
      expect(clone.active).toBe(false);
    });

    it('should copy tags', () => {
      go.addTag('player');
      const clone = go.clone();
      expect(clone.hasTag('player')).toBe(true);
    });
  });

  describe('destroy', () => {
    it('should destroy children', () => {
      const child = new GameObject('Child');
      go.addChild(child);
      const comp = createComponent('CComp');
      child.addComponent(comp);
      go.destroy();
      expect(go.getChildren()).toHaveLength(0);
      expect(comp.destroy).toHaveBeenCalled();
    });

    it('should destroy components', () => {
      const comp = createComponent('DComp');
      go.addComponent(comp);
      go.destroy();
      expect(comp.destroy).toHaveBeenCalled();
      expect(comp.gameObject).toBeNull();
    });

    it('should detach from parent', () => {
      const parent = new GameObject('Parent');
      go.setParent(parent);
      go.destroy();
      expect(parent.getChildren()).toHaveLength(0);
    });
  });

  describe('toString', () => {
    it('should produce readable string', () => {
      const str = go.toString();
      expect(str).toContain('Hero');
      expect(str).toContain('active: true');
    });
  });
});

// ============================================================
// Camera Tests
// ============================================================
describe('Camera', () => {
  let camera: Camera;

  beforeEach(() => {
    camera = new Camera();
  });

  describe('creation', () => {
    it('should default to perspective projection', () => {
      expect(camera.getProjectionType()).toBe('perspective');
    });

    it('should have default FOV of ~45 degrees', () => {
      expect(camera.getFov()).toBeCloseTo(Math.PI / 4);
    });

    it('should have default aspect ratio 16/9', () => {
      expect(camera.getAspect()).toBeCloseTo(16 / 9);
    });

    it('should have near/far planes', () => {
      expect(camera.getNear()).toBeCloseTo(0.1);
      expect(camera.getFar()).toBeCloseTo(1000);
    });
  });

  describe('perspective configuration', () => {
    it('should update perspective parameters', () => {
      camera.setPerspective(Math.PI / 3, 4 / 3, 0.5, 500);
      expect(camera.getFov()).toBeCloseTo(Math.PI / 3);
      expect(camera.getAspect()).toBeCloseTo(4 / 3);
      expect(camera.getNear()).toBeCloseTo(0.5);
      expect(camera.getFar()).toBeCloseTo(500);
    });

    it('should update FOV independently', () => {
      camera.setFov(Math.PI / 2);
      expect(camera.getFov()).toBeCloseTo(Math.PI / 2);
    });

    it('should update aspect ratio independently', () => {
      camera.setAspect(2.0);
      expect(camera.getAspect()).toBeCloseTo(2.0);
    });
  });

  describe('orthographic configuration', () => {
    it('should switch to orthographic', () => {
      camera.setOrthographic(-10, 10, -5, 5, 0.1, 100);
      expect(camera.getProjectionType()).toBe('orthographic');
    });

    it('should return ortho near/far', () => {
      camera.setOrthographic(-10, 10, -5, 5, 1, 200);
      expect(camera.getNear()).toBeCloseTo(1);
      expect(camera.getFar()).toBeCloseTo(200);
    });
  });

  describe('position and lookAt', () => {
    it('should set position', () => {
      camera.setPosition(new Vector3(5, 10, 15));
      const pos = camera.getPosition();
      expect(pos.x).toBeCloseTo(5);
      expect(pos.y).toBeCloseTo(10);
      expect(pos.z).toBeCloseTo(15);
    });

    it('should have a transform', () => {
      expect(camera.getTransform()).toBeDefined();
    });
  });

  describe('matrices', () => {
    it('should produce a view matrix', () => {
      const view = camera.getViewMatrix();
      expect(view).toBeDefined();
    });

    it('should produce a projection matrix', () => {
      const proj = camera.getProjectionMatrix();
      expect(proj).toBeDefined();
    });

    it('should produce a view-projection matrix', () => {
      const vp = camera.getViewProjectionMatrix();
      expect(vp).toBeDefined();
    });

    it('should recalculate projection when parameters change', () => {
      const p1 = camera.getProjectionMatrix();
      camera.setPerspective(Math.PI / 3, 1, 0.5, 100);
      const p2 = camera.getProjectionMatrix();
      // Matrices should differ after parameter change
      expect(p1).not.toBe(p2);
    });
  });

  describe('clone', () => {
    it('should produce independent copy', () => {
      camera.setPerspective(Math.PI / 3, 2, 1, 500);
      camera.setPosition(new Vector3(1, 2, 3));
      const clone = camera.clone();
      expect(clone.getFov()).toBeCloseTo(Math.PI / 3);
      expect(clone.getAspect()).toBeCloseTo(2);
      expect(clone.getProjectionType()).toBe('perspective');
      // Modify original – clone should be independent
      camera.setFov(Math.PI / 6);
      expect(clone.getFov()).toBeCloseTo(Math.PI / 3);
    });
  });

  describe('screenToWorldRay', () => {
    it('should return origin and direction', () => {
      camera.setPosition(new Vector3(0, 0, 10));
      const ray = camera.screenToWorldRay(0.5, 0.5);
      expect(ray.origin).toBeDefined();
      expect(ray.direction).toBeDefined();
    });
  });
});

// ============================================================
// Light Tests
// ============================================================
describe('DirectionalLight', () => {
  it('should have DIRECTIONAL type', () => {
    const light = new DirectionalLight();
    expect(light.type).toBe(LightType.DIRECTIONAL);
  });

  it('should default to white color, intensity 1', () => {
    const light = new DirectionalLight();
    expect(light.color.x).toBeCloseTo(1);
    expect(light.color.y).toBeCloseTo(1);
    expect(light.color.z).toBeCloseTo(1);
    expect(light.intensity).toBeCloseTo(1);
  });

  it('should accept config overrides', () => {
    const light = new DirectionalLight({
      color: new Vector3(1, 0.5, 0),
      intensity: 2,
      direction: new Vector3(1, -1, 0),
      castShadow: true,
      shadowMapSize: 2048,
      shadowBias: 0.001
    });
    expect(light.intensity).toBe(2);
    expect(light.castShadow).toBe(true);
    expect(light.shadowMapSize).toBe(2048);
    expect(light.shadowBias).toBeCloseTo(0.001);
  });

  it('should normalize direction', () => {
    const light = new DirectionalLight({ direction: new Vector3(3, 0, 0) });
    expect(light.direction.length()).toBeCloseTo(1);
  });

  it('should update direction via setDirection', () => {
    const light = new DirectionalLight();
    light.setDirection(new Vector3(0, 0, -1));
    expect(light.direction.z).toBeCloseTo(-1);
    expect(light.direction.length()).toBeCloseTo(1);
  });

  it('should compute effective color', () => {
    const light = new DirectionalLight({ color: new Vector3(1, 0.5, 0), intensity: 2 });
    const eff = light.getEffectiveColor();
    expect(eff.x).toBeCloseTo(2);
    expect(eff.y).toBeCloseTo(1);
    expect(eff.z).toBeCloseTo(0);
  });

  it('should produce view and projection matrices', () => {
    const light = new DirectionalLight();
    expect(light.getViewMatrix()).toBeDefined();
    expect(light.getProjectionMatrix()).toBeDefined();
  });

  it('should default enabled to true', () => {
    const light = new DirectionalLight();
    expect(light.enabled).toBe(true);
  });

  it('should support shadow camera settings', () => {
    const light = new DirectionalLight({
      shadowCameraSize: 20,
      shadowCameraNear: 1,
      shadowCameraFar: 100
    });
    expect(light.shadowCameraSize).toBe(20);
    expect(light.shadowCameraNear).toBe(1);
    expect(light.shadowCameraFar).toBe(100);
  });
});

describe('PointLight', () => {
  it('should have POINT type', () => {
    const light = new PointLight();
    expect(light.type).toBe(LightType.POINT);
  });

  it('should have default attenuation factors', () => {
    const light = new PointLight();
    expect(light.constant).toBeCloseTo(1.0);
    expect(light.linear).toBeCloseTo(0.09);
    expect(light.quadratic).toBeCloseTo(0.032);
  });

  it('should accept config overrides', () => {
    const light = new PointLight({ range: 50, intensity: 3 });
    expect(light.range).toBe(50);
    expect(light.intensity).toBe(3);
  });

  it('should calculate attenuation', () => {
    const light = new PointLight();
    const near = light.calculateAttenuation(0);
    const far = light.calculateAttenuation(100);
    expect(near).toBeGreaterThan(far);
    expect(near).toBeCloseTo(1); // at distance 0
    expect(far).toBeGreaterThanOrEqual(0);
    expect(far).toBeLessThanOrEqual(1);
  });

  it('should produce view matrix for cubemap faces', () => {
    const light = new PointLight();
    for (let face = 0; face < 6; face++) {
      expect(light.getViewMatrix(face)).toBeDefined();
    }
  });

  it('should produce projection matrix', () => {
    const light = new PointLight();
    expect(light.getProjectionMatrix()).toBeDefined();
  });

  it('should default shadows off', () => {
    const light = new PointLight();
    expect(light.castShadow).toBe(false);
  });

  it('should enable shadows via config', () => {
    const light = new PointLight({ castShadow: true, shadowMapSize: 512 });
    expect(light.castShadow).toBe(true);
    expect(light.shadowMapSize).toBe(512);
  });
});

describe('SpotLight', () => {
  it('should have SPOT type', () => {
    const light = new SpotLight();
    expect(light.type).toBe(LightType.SPOT);
  });

  it('should have default cone angles', () => {
    const light = new SpotLight();
    expect(light.innerConeAngle).toBeCloseTo(Math.PI / 6);
    expect(light.outerConeAngle).toBeCloseTo(Math.PI / 4);
  });

  it('should accept config overrides', () => {
    const light = new SpotLight({
      direction: new Vector3(0, 0, -1),
      range: 30,
      innerConeAngle: Math.PI / 8,
      outerConeAngle: Math.PI / 3
    });
    expect(light.range).toBe(30);
    expect(light.innerConeAngle).toBeCloseTo(Math.PI / 8);
    expect(light.outerConeAngle).toBeCloseTo(Math.PI / 3);
  });

  it('should normalize direction', () => {
    const light = new SpotLight({ direction: new Vector3(5, 0, 0) });
    expect(light.direction.length()).toBeCloseTo(1);
  });

  it('should update direction via setDirection', () => {
    const light = new SpotLight();
    light.setDirection(new Vector3(1, 0, 0));
    expect(light.direction.x).toBeCloseTo(1);
    expect(light.direction.length()).toBeCloseTo(1);
  });

  it('should compute cone cosines', () => {
    const light = new SpotLight();
    expect(light.innerConeCos).toBeCloseTo(Math.cos(Math.PI / 6));
    expect(light.outerConeCos).toBeCloseTo(Math.cos(Math.PI / 4));
  });

  it('should produce view and projection matrices', () => {
    const light = new SpotLight();
    expect(light.getViewMatrix()).toBeDefined();
    expect(light.getProjectionMatrix()).toBeDefined();
  });
});

describe('AreaLight', () => {
  it('should have AREA type', () => {
    const light = new AreaLight();
    expect(light.type).toBe(LightType.AREA);
  });

  it('should have default dimensions', () => {
    const light = new AreaLight();
    expect(light.width).toBe(1);
    expect(light.height).toBe(1);
  });

  it('should accept config overrides', () => {
    const light = new AreaLight({ width: 4, height: 2, intensity: 5 });
    expect(light.width).toBe(4);
    expect(light.height).toBe(2);
    expect(light.intensity).toBe(5);
  });

  it('should compute area', () => {
    const light = new AreaLight({ width: 3, height: 4 });
    expect(light.area).toBe(12);
  });

  it('should normalize direction', () => {
    const light = new AreaLight({ direction: new Vector3(0, 0, -5) });
    expect(light.direction.length()).toBeCloseTo(1);
  });

  it('should update direction via setDirection', () => {
    const light = new AreaLight();
    light.setDirection(new Vector3(1, 0, 0));
    expect(light.direction.x).toBeCloseTo(1);
  });

  it('should produce view and projection matrices', () => {
    const light = new AreaLight();
    expect(light.getViewMatrix()).toBeDefined();
    expect(light.getProjectionMatrix()).toBeDefined();
  });
});
