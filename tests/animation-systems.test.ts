/**
 * Animation Systems Tests for WebForge
 * Covers: IK solvers, Blend Trees, and Animation State Machine
 */
import { describe, it, expect, beforeEach } from 'vitest';

// IK
import {
  TwoBoneIK,
  FABRIKSolver,
  IKChain,
  IKManager,
  LookAtIK,
  CCDSolver
} from '../src/animation/IK';
import type { IKJoint } from '../src/animation/IK';

// Blend Trees
import {
  Simple1DBlendTree,
  Simple2DBlendTree,
  DirectBlendTree,
  AdditiveBlendTree,
  BlendTreeManager
} from '../src/animation/BlendTree';

// Animation State Machine
import {
  AnimationStateMachine,
  AnimationState,
  ConditionType,
  ComparisonOperator
} from '../src/animation/AnimationStateMachine';
import type { TransitionCondition } from '../src/animation/AnimationStateMachine';

// Dependencies
import { Vector3 } from '../src/math/Vector3';
import { Quaternion } from '../src/math/Quaternion';
import { AnimationClip, AnimationTrack, TrackType, InterpolationMode } from '../src/animation/AnimationClip';

// Helper: create a simple animation clip with a given duration
function createClip(name: string, duration: number): AnimationClip {
  const clip = new AnimationClip(name, duration);
  const track = new AnimationTrack('root', TrackType.POSITION, InterpolationMode.LINEAR);
  track.addKeyframe(0, new Vector3(0, 0, 0));
  track.addKeyframe(duration, new Vector3(1, 0, 0));
  clip.addTrack(track);
  return clip;
}

// ============================================================
// TwoBoneIK Tests
// ============================================================
describe('TwoBoneIK', () => {
  let ik: TwoBoneIK;

  beforeEach(() => {
    ik = new TwoBoneIK(3, 2);
  });

  it('should store bone lengths', () => {
    expect(ik.getUpperLength()).toBe(3);
    expect(ik.getLowerLength()).toBe(2);
  });

  it('should solve for a reachable target', () => {
    const root = new Vector3(0, 0, 0);
    const target = new Vector3(4, 0, 0);
    const pole = new Vector3(0, 1, 0);
    const result = ik.solve(root, target, pole);

    expect(result.root).toBe(root);
    expect(result.middle).toBeDefined();
    expect(result.end).toBeDefined();
    // Middle joint should not be at the root
    expect(result.middle.distanceTo(root)).toBeGreaterThan(0.1);
  });

  it('should handle target at maximum reach', () => {
    const root = new Vector3(0, 0, 0);
    const target = new Vector3(5, 0, 0); // exactly upper + lower
    const pole = new Vector3(0, 1, 0);
    const result = ik.solve(root, target, pole);

    // Chain should extend nearly fully
    const rootToEnd = result.end.distanceTo(root);
    expect(rootToEnd).toBeGreaterThan(4);
  });

  it('should handle target beyond reach (clamp)', () => {
    const root = new Vector3(0, 0, 0);
    const target = new Vector3(100, 0, 0); // far beyond reach
    const pole = new Vector3(0, 1, 0);
    const result = ik.solve(root, target, pole);

    // Should return valid result without errors
    expect(result.root).toBe(root);
    expect(result.middle).toBeDefined();
    expect(result.end).toBeDefined();
  });

  it('should handle target at root position', () => {
    const root = new Vector3(0, 0, 0);
    const target = new Vector3(0, 0, 0);
    const pole = new Vector3(0, 1, 0);
    const result = ik.solve(root, target, pole);

    // Should return a default pose without errors
    expect(result.root).toBe(root);
    expect(result.middle).toBeDefined();
    expect(result.end).toBeDefined();
  });
});

// ============================================================
// FABRIKSolver Tests
// ============================================================
describe('FABRIKSolver', () => {
  it('should calculate total chain length', () => {
    const joints = [
      new Vector3(0, 0, 0),
      new Vector3(0, 2, 0),
      new Vector3(0, 5, 0)
    ];
    const solver = new FABRIKSolver(joints);
    expect(solver.getTotalLength()).toBe(5);
  });

  it('should solve for a reachable target', () => {
    const joints = [
      new Vector3(0, 0, 0),
      new Vector3(0, 2, 0),
      new Vector3(0, 4, 0)
    ];
    const solver = new FABRIKSolver(joints, 20, 0.01);
    const target = new Vector3(3, 1, 0);
    const root = new Vector3(0, 0, 0);
    const result = solver.solve(target, root);

    expect(result.length).toBe(3);
    // Root should stay at origin
    expect(result[0].x).toBeCloseTo(0, 1);
    expect(result[0].y).toBeCloseTo(0, 1);
  });

  it('should extend fully toward unreachable target', () => {
    const joints = [
      new Vector3(0, 0, 0),
      new Vector3(0, 2, 0),
      new Vector3(0, 4, 0)
    ];
    const solver = new FABRIKSolver(joints);
    const target = new Vector3(100, 0, 0);
    const root = new Vector3(0, 0, 0);
    const result = solver.solve(target, root);

    // All joints should be roughly along the X axis toward target
    for (let i = 1; i < result.length; i++) {
      expect(result[i].x).toBeGreaterThan(result[i - 1].x - 0.01);
    }
  });

  it('should preserve bone count after solving', () => {
    const joints = [
      new Vector3(0, 0, 0),
      new Vector3(0, 3, 0),
      new Vector3(0, 3, 3)
    ];
    const solver = new FABRIKSolver(joints, 20, 0.01);
    const target = new Vector3(2, 2, 0);
    const root = new Vector3(0, 0, 0);
    const result = solver.solve(target, root);

    expect(result.length).toBe(3);
    // Root should remain at origin after backward pass
    expect(result[0].x).toBeCloseTo(0, 1);
    expect(result[0].y).toBeCloseTo(0, 1);
  });

  it('should return joints via getJoints()', () => {
    const joints = [new Vector3(0, 0, 0), new Vector3(0, 1, 0)];
    const solver = new FABRIKSolver(joints);
    expect(solver.getJoints().length).toBe(2);
  });
});

// ============================================================
// IKChain Tests
// ============================================================
describe('IKChain', () => {
  function makeJoints(): IKJoint[] {
    return [
      { position: new Vector3(0, 0, 0), rotation: Quaternion.identity(), length: 2 },
      { position: new Vector3(0, 2, 0), rotation: Quaternion.identity(), length: 2 },
      { position: new Vector3(0, 4, 0), rotation: Quaternion.identity(), length: 0 }
    ];
  }

  it('should default to FABRIK solver', () => {
    const chain = new IKChain(makeJoints());
    expect(chain.getSolverType()).toBe('FABRIK');
  });

  it('should use CCD solver when specified', () => {
    const chain = new IKChain(makeJoints(), false);
    expect(chain.getSolverType()).toBe('CCD');
  });

  it('should solve and update joint positions', () => {
    const joints = makeJoints();
    const chain = new IKChain(joints);
    const target = new Vector3(2, 2, 0);
    chain.solve(target);

    const solved = chain.getJoints();
    expect(solved.length).toBe(3);
    // Joints should have moved from their original straight-up positions
    expect(solved[2].position.x).not.toBeCloseTo(0, 0);
  });

  it('should return all joints via getJoints()', () => {
    const chain = new IKChain(makeJoints());
    expect(chain.getJoints().length).toBe(3);
  });
});

// ============================================================
// IKManager Tests
// ============================================================
describe('IKManager', () => {
  let manager: IKManager;

  beforeEach(() => {
    manager = new IKManager();
  });

  it('should add and retrieve IK chains', () => {
    const joints: IKJoint[] = [
      { position: new Vector3(0, 0, 0), rotation: Quaternion.identity(), length: 1 },
      { position: new Vector3(0, 1, 0), rotation: Quaternion.identity(), length: 0 }
    ];
    const chain = new IKChain(joints);
    manager.addChain('arm', chain);
    expect(manager.getChain('arm')).toBe(chain);
  });

  it('should add and retrieve TwoBoneIK', () => {
    const ik = new TwoBoneIK(2, 2);
    manager.addTwoBoneIK('leg', ik);
    expect(manager.getTwoBoneIK('leg')).toBe(ik);
  });

  it('should remove chains and two-bone IKs', () => {
    const ik = new TwoBoneIK(1, 1);
    manager.addTwoBoneIK('arm', ik);
    manager.removeTwoBoneIK('arm');
    expect(manager.getTwoBoneIK('arm')).toBeUndefined();
  });

  it('should clear all solvers', () => {
    manager.addTwoBoneIK('a', new TwoBoneIK(1, 1));
    const joints: IKJoint[] = [
      { position: new Vector3(0, 0, 0), rotation: Quaternion.identity(), length: 1 },
      { position: new Vector3(0, 1, 0), rotation: Quaternion.identity(), length: 0 }
    ];
    manager.addChain('b', new IKChain(joints));
    manager.clear();
    expect(manager.getTwoBoneIK('a')).toBeUndefined();
    expect(manager.getChain('b')).toBeUndefined();
  });
});

// ============================================================
// Simple1DBlendTree Tests
// ============================================================
describe('Simple1DBlendTree', () => {
  let tree: Simple1DBlendTree;
  let walkClip: AnimationClip;
  let runClip: AnimationClip;

  beforeEach(() => {
    tree = new Simple1DBlendTree();
    walkClip = createClip('walk', 1.0);
    runClip = createClip('run', 0.8);
  });

  it('should start with no samples', () => {
    expect(tree.getSamples().length).toBe(0);
    expect(tree.getParameter()).toBe(0);
  });

  it('should add samples sorted by threshold', () => {
    tree.addSample(runClip, 1.0);
    tree.addSample(walkClip, 0.0);
    const samples = tree.getSamples();
    expect(samples.length).toBe(2);
    expect(samples[0].threshold).toBe(0.0);
    expect(samples[1].threshold).toBe(1.0);
  });

  it('should give full weight to exact threshold match', () => {
    tree.addSample(walkClip, 0.0);
    tree.addSample(runClip, 1.0);
    tree.setParameter(0.0);
    const active = tree.getActiveSamples();
    expect(active.length).toBe(1);
    expect(active[0].clip.name).toBe('walk');
    expect(active[0].weight).toBe(1.0);
  });

  it('should interpolate weights between two samples', () => {
    tree.addSample(walkClip, 0.0);
    tree.addSample(runClip, 1.0);
    tree.setParameter(0.5);
    const samples = tree.getSamples();
    expect(samples[0].weight).toBeCloseTo(0.5, 2);
    expect(samples[1].weight).toBeCloseTo(0.5, 2);
  });

  it('should clamp below lowest threshold', () => {
    tree.addSample(walkClip, 0.0);
    tree.addSample(runClip, 1.0);
    tree.setParameter(-1.0);
    const active = tree.getActiveSamples();
    expect(active.length).toBe(1);
    expect(active[0].weight).toBe(1.0);
    expect(active[0].threshold).toBe(0.0);
  });

  it('should clamp above highest threshold', () => {
    tree.addSample(walkClip, 0.0);
    tree.addSample(runClip, 1.0);
    tree.setParameter(5.0);
    const active = tree.getActiveSamples();
    expect(active.length).toBe(1);
    expect(active[0].weight).toBe(1.0);
    expect(active[0].threshold).toBe(1.0);
  });
});

// ============================================================
// Simple2DBlendTree Tests
// ============================================================
describe('Simple2DBlendTree', () => {
  let tree: Simple2DBlendTree;

  beforeEach(() => {
    tree = new Simple2DBlendTree();
    tree.addSample(createClip('idle', 1.0), 0, 0);
    tree.addSample(createClip('forward', 1.0), 0, 1);
    tree.addSample(createClip('right', 1.0), 1, 0);
  });

  it('should add samples', () => {
    expect(tree.getSamples().length).toBe(3);
  });

  it('should give highest weight to nearest sample', () => {
    tree.setParameters(0.1, 0.1);
    const samples = tree.getSamples();
    // idle at (0,0) should have the highest weight since it's nearest to (0.1, 0.1)
    const idle = samples.find(s => s.clip.name === 'idle')!;
    const forward = samples.find(s => s.clip.name === 'forward')!;
    expect(idle.weight).toBeGreaterThan(forward.weight);
  });

  it('should return parameters', () => {
    tree.setParameters(0.5, 0.7);
    const params = tree.getParameters();
    expect(params.x).toBe(0.5);
    expect(params.y).toBe(0.7);
  });

  it('should have weights that sum to approximately 1', () => {
    tree.setParameters(0.3, 0.3);
    const active = tree.getActiveSamples();
    const total = active.reduce((sum, s) => sum + s.weight, 0);
    expect(total).toBeCloseTo(1.0, 1);
  });
});

// ============================================================
// DirectBlendTree Tests
// ============================================================
describe('DirectBlendTree', () => {
  let tree: DirectBlendTree;

  beforeEach(() => {
    tree = new DirectBlendTree();
    tree.addSample('walk', createClip('walk', 1.0));
    tree.addSample('run', createClip('run', 0.8));
  });

  it('should add samples with zero weight', () => {
    expect(tree.getSamples().length).toBe(2);
    expect(tree.getWeight('walk')).toBe(0);
  });

  it('should set and get weights', () => {
    tree.setWeight('walk', 0.6);
    expect(tree.getWeight('walk')).toBeCloseTo(0.6);
  });

  it('should clamp weights to [0, 1]', () => {
    tree.setWeight('walk', 2.0);
    expect(tree.getWeight('walk')).toBe(1.0);
    tree.setWeight('walk', -0.5);
    expect(tree.getWeight('walk')).toBe(0);
  });

  it('should normalize weights', () => {
    tree.setWeight('walk', 0.8);
    tree.setWeight('run', 0.4);
    tree.normalizeWeights();
    const total = tree.getWeight('walk') + tree.getWeight('run');
    expect(total).toBeCloseTo(1.0, 5);
  });

  it('should filter active samples', () => {
    tree.setWeight('walk', 0.5);
    const active = tree.getActiveSamples();
    expect(active.length).toBe(1);
  });
});

// ============================================================
// AdditiveBlendTree Tests
// ============================================================
describe('AdditiveBlendTree', () => {
  let tree: AdditiveBlendTree;

  beforeEach(() => {
    tree = new AdditiveBlendTree();
  });

  it('should start with no base clip', () => {
    expect(tree.getBaseClip()).toBeNull();
  });

  it('should set base clip', () => {
    const clip = createClip('base', 1.0);
    tree.setBaseClip(clip);
    expect(tree.getBaseClip()).toBe(clip);
  });

  it('should add and retrieve additive clips', () => {
    tree.addAdditiveClip('aim', createClip('aim', 0.5), 0.7);
    const clips = tree.getAdditiveClips();
    expect(clips.length).toBe(1);
    expect(clips[0].name).toBe('aim');
    expect(clips[0].weight).toBe(0.7);
  });

  it('should update additive weight', () => {
    tree.addAdditiveClip('hit', createClip('hit', 0.3));
    tree.setAdditiveWeight('hit', 0.5);
    const clips = tree.getAdditiveClips();
    expect(clips[0].weight).toBe(0.5);
  });

  it('should clamp additive weight', () => {
    tree.addAdditiveClip('hit', createClip('hit', 0.3));
    tree.setAdditiveWeight('hit', 2.0);
    expect(tree.getAdditiveClips()[0].weight).toBe(1.0);
  });

  it('should remove additive clip', () => {
    tree.addAdditiveClip('hit', createClip('hit', 0.3));
    tree.removeAdditiveClip('hit');
    expect(tree.getAdditiveClips().length).toBe(0);
  });

  it('should filter active additive clips', () => {
    tree.addAdditiveClip('a', createClip('a', 1), 0.5);
    tree.addAdditiveClip('b', createClip('b', 1), 0);
    expect(tree.getActiveAdditiveClips().length).toBe(1);
  });
});

// ============================================================
// BlendTreeManager Tests
// ============================================================
describe('BlendTreeManager', () => {
  let manager: BlendTreeManager;

  beforeEach(() => {
    manager = new BlendTreeManager();
  });

  it('should create and retrieve 1D blend tree', () => {
    const tree = manager.create1DBlendTree('locomotion');
    expect(tree).toBeInstanceOf(Simple1DBlendTree);
    expect(manager.getBlendTree('locomotion')).toBe(tree);
  });

  it('should create and retrieve 2D blend tree', () => {
    const tree = manager.create2DBlendTree('movement');
    expect(tree).toBeInstanceOf(Simple2DBlendTree);
    expect(manager.getBlendTree('movement')).toBe(tree);
  });

  it('should create direct and additive blend trees', () => {
    const direct = manager.createDirectBlendTree('layers');
    const additive = manager.createAdditiveBlendTree('additive');
    expect(direct).toBeInstanceOf(DirectBlendTree);
    expect(additive).toBeInstanceOf(AdditiveBlendTree);
  });

  it('should remove blend tree', () => {
    manager.create1DBlendTree('test');
    manager.removeBlendTree('test');
    expect(manager.getBlendTree('test')).toBeUndefined();
  });

  it('should clear all blend trees', () => {
    manager.create1DBlendTree('a');
    manager.create2DBlendTree('b');
    manager.clear();
    expect(manager.getBlendTree('a')).toBeUndefined();
    expect(manager.getBlendTree('b')).toBeUndefined();
  });
});

// ============================================================
// AnimationStateMachine Tests
// ============================================================
describe('AnimationStateMachine', () => {
  let sm: AnimationStateMachine;
  let idleClip: AnimationClip;
  let walkClip: AnimationClip;
  let runClip: AnimationClip;

  beforeEach(() => {
    sm = new AnimationStateMachine();
    idleClip = createClip('idle', 2.0);
    walkClip = createClip('walk', 1.0);
    runClip = createClip('run', 0.8);
  });

  it('should start with no current state', () => {
    expect(sm.getCurrentState()).toBeNull();
    expect(sm.isInTransition()).toBe(false);
  });

  it('should add states and set default', () => {
    sm.createState('idle', idleClip);
    sm.setDefaultState('idle');
    expect(sm.getCurrentState()).toBe('idle');
  });

  it('should add parameters', () => {
    sm.addParameter('speed', ConditionType.FLOAT, 0);
    sm.addParameter('isGrounded', ConditionType.BOOL, true);
    // No error = success; parameters are used later in transitions
  });

  it('should create states with transitions', () => {
    const idle = sm.createState('idle', idleClip);
    sm.createState('walk', walkClip);

    sm.addParameter('speed', ConditionType.FLOAT, 0);

    const condition: TransitionCondition = {
      parameter: 'speed',
      operator: ComparisonOperator.GREATER,
      value: 0.1
    };
    const transition = idle.addTransition('walk', [condition], 0.2);

    expect(transition.fromState).toBe('idle');
    expect(transition.toState).toBe('walk');
    expect(transition.duration).toBe(0.2);
    expect(transition.conditions.length).toBe(1);
  });

  it('should transition when condition is met', () => {
    const idle = sm.createState('idle', idleClip);
    sm.createState('walk', walkClip);

    sm.addParameter('speed', ConditionType.FLOAT, 0);
    idle.addTransition('walk', [{
      parameter: 'speed',
      operator: ComparisonOperator.GREATER,
      value: 0.1
    }], 0.25);

    sm.setDefaultState('idle');
    expect(sm.getCurrentState()).toBe('idle');

    // Trigger transition
    sm.setFloat('speed', 1.0);
    expect(sm.isInTransition()).toBe(true);
  });

  it('should complete transition after sufficient time', () => {
    const idle = sm.createState('idle', idleClip);
    sm.createState('walk', walkClip);

    sm.addParameter('speed', ConditionType.FLOAT, 0);
    idle.addTransition('walk', [{
      parameter: 'speed',
      operator: ComparisonOperator.GREATER,
      value: 0.1
    }], 0.2);

    sm.setDefaultState('idle');
    sm.setFloat('speed', 1.0);
    expect(sm.isInTransition()).toBe(true);

    // Update past transition duration
    sm.update(0.25);
    expect(sm.isInTransition()).toBe(false);
    expect(sm.getCurrentState()).toBe('walk');
  });

  it('should not transition when condition is not met', () => {
    const idle = sm.createState('idle', idleClip);
    sm.createState('walk', walkClip);

    sm.addParameter('speed', ConditionType.FLOAT, 0);
    idle.addTransition('walk', [{
      parameter: 'speed',
      operator: ComparisonOperator.GREATER,
      value: 0.5
    }], 0.2);

    sm.setDefaultState('idle');
    sm.setFloat('speed', 0.3);
    expect(sm.isInTransition()).toBe(false);
    expect(sm.getCurrentState()).toBe('idle');
  });

  it('should handle bool parameters', () => {
    const idle = sm.createState('idle', idleClip);
    sm.createState('walk', walkClip);

    sm.addParameter('moving', ConditionType.BOOL, false);
    idle.addTransition('walk', [{
      parameter: 'moving',
      operator: ComparisonOperator.EQUAL,
      value: true
    }], 0.1);

    sm.setDefaultState('idle');
    sm.setBool('moving', true);
    expect(sm.isInTransition()).toBe(true);
  });

  it('should handle trigger parameters (auto-reset)', () => {
    const idle = sm.createState('idle', idleClip);
    sm.createState('walk', walkClip);

    sm.addParameter('jump', ConditionType.TRIGGER, false);
    idle.addTransition('walk', [{
      parameter: 'jump',
      operator: ComparisonOperator.EQUAL,
      value: true
    }], 0.1);

    sm.setDefaultState('idle');
    sm.setTrigger('jump');
    expect(sm.isInTransition()).toBe(true);
  });

  it('should track transition progress', () => {
    const idle = sm.createState('idle', idleClip);
    sm.createState('walk', walkClip);

    sm.addParameter('go', ConditionType.BOOL, false);
    idle.addTransition('walk', [{
      parameter: 'go',
      operator: ComparisonOperator.EQUAL,
      value: true
    }], 1.0);

    sm.setDefaultState('idle');
    sm.setBool('go', true);

    sm.update(0.5);
    expect(sm.getTransitionProgress()).toBeCloseTo(0.5, 1);
    expect(sm.isInTransition()).toBe(true);
  });

  it('should emit events for state changes', () => {
    sm.createState('idle', idleClip);
    const events: string[] = [];
    sm.getEvents().on('stateEnter', (data: any) => {
      events.push(data.state);
    });

    sm.setDefaultState('idle');
    expect(events).toContain('idle');
  });

  it('should update without errors when no state is set', () => {
    sm.update(0.016);
    expect(sm.getCurrentState()).toBeNull();
  });

  it('should expose current and next players', () => {
    sm.createState('idle', idleClip);
    sm.setDefaultState('idle');
    expect(sm.getCurrentPlayer()).toBeDefined();
    expect(sm.getNextPlayer()).toBeNull(); // not transitioning
  });

  it('should handle integer parameters', () => {
    const idle = sm.createState('idle', idleClip);
    sm.createState('walk', walkClip);

    sm.addParameter('level', ConditionType.INT, 0);
    idle.addTransition('walk', [{
      parameter: 'level',
      operator: ComparisonOperator.GREATER_OR_EQUAL,
      value: 2
    }], 0.1);

    sm.setDefaultState('idle');
    sm.setInt('level', 3);
    expect(sm.isInTransition()).toBe(true);
  });
});

// ============================================================
// AnimationState Tests
// ============================================================
describe('AnimationState', () => {
  it('should store name and clip', () => {
    const clip = createClip('idle', 1.0);
    const state = new AnimationState('idle', clip);
    expect(state.name).toBe('idle');
    expect(state.clip).toBe(clip);
    expect(state.speed).toBe(1.0);
    expect(state.loop).toBe(true);
  });

  it('should add transitions', () => {
    const clip = createClip('idle', 1.0);
    const state = new AnimationState('idle', clip);
    const transition = state.addTransition('walk', [], 0.3);

    expect(state.transitions.length).toBe(1);
    expect(transition.fromState).toBe('idle');
    expect(transition.toState).toBe('walk');
    expect(transition.hasExitTime).toBe(false);
  });
});

// ============================================================
// LookAtIK Tests
// ============================================================
describe('LookAtIK', () => {
  it('should return a quaternion for a target', () => {
    const position = new Vector3(0, 0, 0);
    const target = new Vector3(0, 0, -5);
    const result = LookAtIK.solve(position, target);
    expect(result).toBeInstanceOf(Quaternion);
  });

  it('should return constrained rotation', () => {
    const position = new Vector3(0, 0, 0);
    const target = new Vector3(10, 0, 0);
    const maxAngle = Math.PI / 4;
    const result = LookAtIK.solveConstrained(position, target, maxAngle);
    expect(result).toBeInstanceOf(Quaternion);
  });
});
