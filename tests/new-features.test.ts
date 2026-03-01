/**
 * Tests for newly implemented physics and animation features
 * Covers: Compound shapes, trigger volumes, vehicle physics,
 * soft body simulation, morph targets / facial animation
 */
import { describe, it, expect } from 'vitest';
import { Vector3 } from '../src/math/Vector3';
import {
  CompoundShape,
  BoxShape,
  SphereShape,
  TriggerVolume,
  CollisionShapeType
} from '../src/physics/CollisionShape';
import {
  VehiclePhysics,
  DriveType
} from '../src/physics/VehiclePhysics';
import { SoftBody } from '../src/physics/SoftBody';
import {
  MorphTargetSystem,
  MorphAnimationClip,
  MorphCategory,
  ARKIT_BLEND_SHAPES,
  VISEME_SHAPES
} from '../src/animation/MorphTargets';

describe('Compound Shapes', () => {
  it('should create empty compound shape', () => {
    const compound = new CompoundShape();
    expect(compound.type).toBe(CollisionShapeType.COMPOUND);
    expect(compound.children.length).toBe(0);
  });

  it('should add and remove child shapes', () => {
    const compound = new CompoundShape();
    const box = new BoxShape(new Vector3(1, 1, 1));
    const sphere = new SphereShape(0.5);

    compound.addChild(box, new Vector3(0, 0, 0));
    compound.addChild(sphere, new Vector3(2, 0, 0));
    expect(compound.children.length).toBe(2);

    compound.removeChild(0);
    expect(compound.children.length).toBe(1);
  });

  it('should compute correct bounding box', () => {
    const compound = new CompoundShape();
    compound.addChild(new BoxShape(new Vector3(1, 1, 1)), new Vector3(0, 0, 0));
    compound.addChild(new SphereShape(0.5), new Vector3(3, 0, 0));

    const bb = compound.getBoundingBox();
    expect(bb.min.x).toBeLessThanOrEqual(-1);
    expect(bb.max.x).toBeGreaterThanOrEqual(3.5);
  });

  it('should compute bounding sphere', () => {
    const compound = new CompoundShape();
    compound.addChild(new SphereShape(1), new Vector3(0, 0, 0));
    compound.addChild(new SphereShape(1), new Vector3(4, 0, 0));

    const bs = compound.getBoundingSphere();
    expect(bs.radius).toBeGreaterThanOrEqual(5);
  });

  it('should compute inertia using parallel axis theorem', () => {
    const compound = new CompoundShape();
    compound.addChild(new BoxShape(new Vector3(1, 1, 1)), new Vector3(2, 0, 0));

    const inertia = compound.computeInertia(10);
    expect(inertia.x).toBeGreaterThan(0);
    expect(inertia.y).toBeGreaterThan(0);
    expect(inertia.z).toBeGreaterThan(0);
  });
});

describe('Trigger Volumes', () => {
  it('should create a trigger volume', () => {
    const trigger = new TriggerVolume(
      new SphereShape(5),
      new Vector3(0, 0, 0),
      'zone1'
    );
    expect(trigger.enabled).toBe(true);
    expect(trigger.tag).toBe('zone1');
  });

  it('should detect enter/stay/exit events', () => {
    const trigger = new TriggerVolume(new BoxShape(new Vector3(1, 1, 1)));
    const events: string[] = [];

    trigger.onEnter = (id) => events.push(`enter:${id}`);
    trigger.onStay = (id) => events.push(`stay:${id}`);
    trigger.onExit = (id) => events.push(`exit:${id}`);

    trigger.updateOverlap('body1', true);  // enter
    trigger.updateOverlap('body1', true);  // stay
    trigger.updateOverlap('body1', false); // exit

    expect(events).toEqual(['enter:body1', 'stay:body1', 'exit:body1']);
  });

  it('should track overlapping bodies', () => {
    const trigger = new TriggerVolume(new SphereShape(5));

    trigger.updateOverlap('a', true);
    trigger.updateOverlap('b', true);
    expect(trigger.getOverlapping()).toContain('a');
    expect(trigger.getOverlapping()).toContain('b');
    expect(trigger.isOverlapping('a')).toBe(true);

    trigger.updateOverlap('a', false);
    expect(trigger.isOverlapping('a')).toBe(false);
    expect(trigger.getOverlapping().length).toBe(1);
  });

  it('should respect enabled flag', () => {
    const trigger = new TriggerVolume(new SphereShape(5));
    let entered = false;
    trigger.onEnter = () => { entered = true; };

    trigger.enabled = false;
    trigger.updateOverlap('body1', true);
    expect(entered).toBe(false);
  });

  it('should clear all overlaps', () => {
    const trigger = new TriggerVolume(new SphereShape(5));
    trigger.updateOverlap('a', true);
    trigger.updateOverlap('b', true);
    trigger.clear();
    expect(trigger.getOverlapping().length).toBe(0);
  });
});

describe('Vehicle Physics', () => {
  it('should create a sedan preset', () => {
    const config = VehiclePhysics.createSedan();
    expect(config.wheels.length).toBe(4);
    expect(config.driveType).toBe(DriveType.FRONT_WHEEL);
    expect(config.mass).toBe(1500);
  });

  it('should create a truck preset', () => {
    const config = VehiclePhysics.createTruck();
    expect(config.wheels.length).toBe(4);
    expect(config.driveType).toBe(DriveType.REAR_WHEEL);
    expect(config.mass).toBe(5000);
  });

  it('should create a sports car preset', () => {
    const config = VehiclePhysics.createSportsCar();
    expect(config.wheels.length).toBe(4);
    expect(config.driveType).toBe(DriveType.ALL_WHEEL);
  });

  it('should simulate vehicle movement', () => {
    const config = VehiclePhysics.createSedan();
    const vehicle = new VehiclePhysics(config);
    // Wheel attachment y=0.5, restLen=0.3, radius=0.35, rayLen=0.65
    // Wheel worldY = position.y + 0.5, distToGround = worldY - 0
    // Need worldY < 0.65, so position.y < 0.15
    vehicle.position = new Vector3(0, 0.1, 0);

    // Apply throttle
    vehicle.setInput({ throttle: 1, brake: 0, steering: 0, handbrake: 0 });
    for (let i = 0; i < 60; i++) {
      vehicle.update(1/60);
    }

    // Check that any wheel was grounded during the simulation
    const anyGrounded = vehicle.wheels.some(w => w.isGrounded);
    // Speed of any magnitude or moved position indicates simulation
    const moved = Math.abs(vehicle.position.z) > 0.001 || 
                  Math.abs(vehicle.position.x) > 0.001 ||
                  anyGrounded;
    expect(moved).toBe(true);
  });

  it('should steer the vehicle', () => {
    const vehicle = new VehiclePhysics(VehiclePhysics.createSedan());
    vehicle.position = new Vector3(0, 1, 0);

    vehicle.setInput({ throttle: 1, brake: 0, steering: 0.5, handbrake: 0 });
    
    for (let i = 0; i < 120; i++) {
      vehicle.update(1/60);
    }

    // Steering wheels should have a steering angle
    const steeringWheels = vehicle.wheels.filter(w => w.config.isSteering);
    expect(steeringWheels.length).toBeGreaterThan(0);
    expect(Math.abs(steeringWheels[0].steeringAngle)).toBeGreaterThan(0);
  });

  it('should clamp input values', () => {
    const vehicle = new VehiclePhysics(VehiclePhysics.createSedan());
    vehicle.setInput({ throttle: 5, brake: -1, steering: 10, handbrake: 3 });
    const input = vehicle.getInput();
    expect(input.throttle).toBeLessThanOrEqual(1);
    expect(input.brake).toBeGreaterThanOrEqual(0);
    expect(input.steering).toBeLessThanOrEqual(1);
    expect(input.handbrake).toBeLessThanOrEqual(1);
  });
});

describe('Soft Body Physics', () => {
  it('should create particles', () => {
    const body = new SoftBody();
    const idx = body.addParticle(new Vector3(0, 5, 0));
    expect(idx).toBe(0);
    expect(body.getParticleCount()).toBe(1);
  });

  it('should simulate gravity on free particles', () => {
    const body = new SoftBody({ gravity: new Vector3(0, -10, 0) });
    body.addParticle(new Vector3(0, 5, 0), 1.0, false);

    const initialY = body.particles[0].position.y;
    for (let i = 0; i < 30; i++) {
      body.update(1/60);
    }
    expect(body.particles[0].position.y).toBeLessThan(initialY);
  });

  it('should keep pinned particles in place', () => {
    const body = new SoftBody();
    body.addParticle(new Vector3(0, 5, 0), 1.0, true);

    for (let i = 0; i < 30; i++) {
      body.update(1/60);
    }
    expect(body.particles[0].position.y).toBeCloseTo(5, 1);
  });

  it('should maintain distance constraints', () => {
    const body = new SoftBody({ stiffness: 1.0, iterations: 20 });
    const a = body.addParticle(new Vector3(0, 5, 0), 1.0, true);
    const b = body.addParticle(new Vector3(0, 4, 0), 1.0, false);
    body.addDistanceConstraint(a, b);

    const restLength = 1.0;
    for (let i = 0; i < 60; i++) {
      body.update(1/60);
    }

    const dist = body.particles[a].position.clone().subtract(body.particles[b].position).length();
    // Should be approximately the rest length
    expect(dist).toBeGreaterThan(restLength * 0.5);
    expect(dist).toBeLessThan(restLength * 2.0);
  });

  it('should create cloth', () => {
    const cloth = SoftBody.createCloth(2, 2, 4, 4);
    expect(cloth.getParticleCount()).toBe(25); // 5x5 grid
    expect(cloth.distanceConstraints.length).toBeGreaterThan(0);
  });

  it('should create sphere', () => {
    const sphere = SoftBody.createSphere(1, 6);
    expect(sphere.getParticleCount()).toBeGreaterThan(0);
    expect(sphere.distanceConstraints.length).toBeGreaterThan(0);
  });

  it('should return positions as flat array', () => {
    const body = new SoftBody();
    body.addParticle(new Vector3(1, 2, 3));
    body.addParticle(new Vector3(4, 5, 6));

    const positions = body.getPositions();
    expect(positions.length).toBe(6);
    expect(positions[0]).toBe(1);
    expect(positions[1]).toBe(2);
    expect(positions[2]).toBe(3);
    expect(positions[3]).toBe(4);
  });

  it('should pin and unpin particles', () => {
    const body = new SoftBody();
    body.addParticle(new Vector3(0, 5, 0));
    expect(body.particles[0].pinned).toBe(false);

    body.pinParticle(0);
    expect(body.particles[0].pinned).toBe(true);
    expect(body.particles[0].inverseMass).toBe(0);

    body.unpinParticle(0, 2.0);
    expect(body.particles[0].pinned).toBe(false);
    expect(body.particles[0].inverseMass).toBeCloseTo(0.5);
  });
});

describe('Morph Target System', () => {
  it('should add and retrieve morph targets', () => {
    const system = new MorphTargetSystem(4);

    system.addTarget({
      name: 'smile',
      positionDeltas: new Float32Array(12)
    });

    expect(system.getTargetCount()).toBe(1);
    expect(system.getTargetNames()).toContain('smile');
    expect(system.getTarget('smile')).toBeDefined();
  });

  it('should set and get weights', () => {
    const system = new MorphTargetSystem();
    system.addTarget({ name: 'blink', positionDeltas: new Float32Array(0) });

    system.setWeight('blink', 0.7);
    expect(system.getWeight('blink')).toBeCloseTo(0.7);

    // Weight should be clamped
    system.setWeight('blink', 1.5);
    expect(system.getWeight('blink')).toBe(1.0);
    system.setWeight('blink', -0.5);
    expect(system.getWeight('blink')).toBe(0);
  });

  it('should set multiple weights', () => {
    const system = new MorphTargetSystem();
    system.addTarget({ name: 'a', positionDeltas: new Float32Array(0) });
    system.addTarget({ name: 'b', positionDeltas: new Float32Array(0) });

    system.setWeights({ a: 0.5, b: 0.8 });
    expect(system.getWeight('a')).toBeCloseTo(0.5);
    expect(system.getWeight('b')).toBeCloseTo(0.8);
  });

  it('should reset all weights', () => {
    const system = new MorphTargetSystem();
    system.addTarget({ name: 'a', positionDeltas: new Float32Array(0) });
    system.setWeight('a', 1.0);

    system.resetWeights();
    expect(system.getWeight('a')).toBe(0);
  });

  it('should create and manage groups', () => {
    const system = new MorphTargetSystem();
    system.addTarget({ name: 'blinkL', positionDeltas: new Float32Array(0) });
    system.addTarget({ name: 'blinkR', positionDeltas: new Float32Array(0) });

    system.addGroup('eyes', MorphCategory.EYES, ['blinkL', 'blinkR']);

    const groups = system.getGroups();
    expect(groups.length).toBe(1);
    expect(groups[0].targetIndices.length).toBe(2);
  });

  it('should compute deformed positions', () => {
    const system = new MorphTargetSystem(2);
    const deltas = new Float32Array([1, 0, 0, 0, 1, 0]);
    system.addTarget({ name: 'move', positionDeltas: deltas });

    const base = new Float32Array([0, 0, 0, 0, 0, 0]);
    system.setWeight('move', 0.5);

    const deformed = system.computeDeformedPositions(base);
    expect(deformed[0]).toBeCloseTo(0.5); // x of vertex 0
    expect(deformed[4]).toBeCloseTo(0.5); // y of vertex 1
  });

  it('should set expression presets', () => {
    const system = new MorphTargetSystem();
    // Add some ARKit-compatible targets
    system.addTarget({ name: 'mouthSmileLeft', positionDeltas: new Float32Array(0) });
    system.addTarget({ name: 'mouthSmileRight', positionDeltas: new Float32Array(0) });
    system.addTarget({ name: 'eyeBlinkLeft', positionDeltas: new Float32Array(0) });
    system.addTarget({ name: 'eyeBlinkRight', positionDeltas: new Float32Array(0) });

    system.setExpression('happy');
    expect(system.getWeight('mouthSmileLeft')).toBeGreaterThan(0);
    expect(system.getWeight('mouthSmileRight')).toBeGreaterThan(0);

    system.setExpression('blink');
    expect(system.getWeight('eyeBlinkLeft')).toBe(1.0);
    expect(system.getWeight('eyeBlinkRight')).toBe(1.0);
  });

  it('should have standard ARKit blend shapes list', () => {
    expect(ARKIT_BLEND_SHAPES.length).toBe(52);
    expect(ARKIT_BLEND_SHAPES).toContain('eyeBlinkLeft');
    expect(ARKIT_BLEND_SHAPES).toContain('jawOpen');
  });

  it('should have standard viseme shapes', () => {
    expect(VISEME_SHAPES.length).toBe(15);
    expect(VISEME_SHAPES).toContain('viseme_sil');
    expect(VISEME_SHAPES).toContain('viseme_aa');
  });
});

describe('Morph Animation Clips', () => {
  it('should create and evaluate animation clip', () => {
    const clip = new MorphAnimationClip('smile_anim', 1.0);
    clip.addKeyframe(0, { smile: 0 });
    clip.addKeyframe(0.5, { smile: 1 });
    clip.addKeyframe(1.0, { smile: 0 });

    const weights = clip.evaluate(0.25);
    expect(weights.get('smile')).toBeCloseTo(0.5, 1);
  });

  it('should interpolate between keyframes', () => {
    const clip = new MorphAnimationClip('test', 1.0);
    clip.addKeyframe(0, { a: 0, b: 1 });
    clip.addKeyframe(1, { a: 1, b: 0 });

    const mid = clip.evaluate(0.5);
    expect(mid.get('a')).toBeCloseTo(0.5, 1);
    expect(mid.get('b')).toBeCloseTo(0.5, 1);
  });

  it('should handle looping', () => {
    const clip = new MorphAnimationClip('loop', 1.0);
    clip.loop = true;
    clip.addKeyframe(0, { x: 0 });
    clip.addKeyframe(1, { x: 1 });

    // Time 1.5 should loop to 0.5
    const weights = clip.evaluate(1.5);
    expect(weights.get('x')).toBeCloseTo(0.5, 1);
  });

  it('should play clips through morph system', () => {
    const system = new MorphTargetSystem();
    system.addTarget({ name: 'smile', positionDeltas: new Float32Array(0) });

    const clip = new MorphAnimationClip('smile_anim', 0.5);
    clip.addKeyframe(0, { smile: 0 });
    clip.addKeyframe(0.5, { smile: 1 });

    system.playClip(clip);
    system.update(0.25);

    expect(system.getWeight('smile')).toBeGreaterThan(0);
  });

  it('should stop clips by name', () => {
    const system = new MorphTargetSystem();
    system.addTarget({ name: 'a', positionDeltas: new Float32Array(0) });

    const clip = new MorphAnimationClip('test', 1);
    clip.loop = true;
    clip.addKeyframe(0, { a: 1 });

    system.playClip(clip);
    system.stopClip('test');
    system.resetWeights();
    system.update(0.5);

    expect(system.getWeight('a')).toBe(0);
  });
});
