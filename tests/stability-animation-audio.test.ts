/**
 * Stability tests for Animation and Audio systems
 *
 * Simulates real-user workflows covering:
 *  1. AnimationClip – create clip with position track, add keyframes, evaluate
 *  2. AnimationPlayer – play/update, verify value changes
 *  3. AnimationStateMachine – create states, transitions, trigger transition
 *  4. BlendTree – 1D blend tree at different parameters
 *  5. IK – TwoBoneIK chain, solve toward target
 *  6. Skeleton – create with bones, verify hierarchy
 *  7. MorphTargets – set blend-shape weights
 *  8. Audio context/manager initialisation
 *  9. AudioSource – volume / pitch properties
 * 10. AnimationClip keyframe interpolation accuracy
 */
import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest';

// Animation
import {
  AnimationClip,
  AnimationTrack,
  TrackType,
  InterpolationMode
} from '../src/animation/AnimationClip';
import { AnimationPlayer, PlaybackMode, PlaybackState } from '../src/animation/AnimationPlayer';
import {
  AnimationStateMachine,
  AnimationState,
  ConditionType,
  ComparisonOperator
} from '../src/animation/AnimationStateMachine';
import {
  Simple1DBlendTree,
  BlendTreeManager
} from '../src/animation/BlendTree';
import { TwoBoneIK, FABRIKSolver } from '../src/animation/IK';
import { Bone, Skeleton, SkinnedMesh } from '../src/animation/Skeleton';
import {
  MorphTargetSystem,
  MorphAnimationClip,
  MorphCategory
} from '../src/animation/MorphTargets';

// Audio
import { WebForgeAudioContext } from '../src/audio/AudioContext';
import { AudioSource, AudioSourceState } from '../src/audio/AudioSource';
import { AudioManager } from '../src/audio/AudioManager';

// Math helpers
import { Vector3 } from '../src/math/Vector3';
import { Quaternion } from '../src/math/Quaternion';

// ─── helpers ────────────────────────────────────────────────────────────────

/** Create a minimal clip with a linear position track. */
function makePositionClip(name: string, duration: number, from: Vector3, to: Vector3): AnimationClip {
  const clip = new AnimationClip(name, duration);
  const track = new AnimationTrack('root', TrackType.POSITION, InterpolationMode.LINEAR);
  track.addKeyframe(0, from);
  track.addKeyframe(duration, to);
  clip.addTrack(track);
  return clip;
}

// ─── 1. AnimationClip ───────────────────────────────────────────────────────

describe('AnimationClip – real-user workflow', () => {
  it('creates a clip with a position track, adds keyframes, and evaluates at time t', () => {
    const clip = new AnimationClip('walk');
    const track = new AnimationTrack('hips', TrackType.POSITION, InterpolationMode.LINEAR);

    track.addKeyframe(0, new Vector3(0, 0, 0));
    track.addKeyframe(1, new Vector3(10, 0, 0));
    clip.addTrack(track);

    expect(clip.getDuration()).toBe(1);
    expect(clip.tracks.length).toBe(1);

    // Evaluate at midpoint
    const result = clip.evaluate(0.5);
    const hipsValues = result.get('hips')!;
    const pos = hipsValues.get(TrackType.POSITION) as Vector3;
    expect(pos.x).toBeCloseTo(5, 1);
    expect(pos.y).toBeCloseTo(0, 1);
  });

  it('handles evaluation before first and after last keyframe', () => {
    const track = new AnimationTrack('obj', TrackType.POSITION, InterpolationMode.LINEAR);
    track.addKeyframe(1, new Vector3(0, 0, 0));
    track.addKeyframe(2, new Vector3(10, 0, 0));

    const before = track.evaluate(0) as Vector3;
    expect(before.x).toBeCloseTo(0, 1);

    const after = track.evaluate(5) as Vector3;
    expect(after.x).toBeCloseTo(10, 1);
  });

  it('supports step interpolation (no smoothing)', () => {
    const track = new AnimationTrack('obj', TrackType.POSITION, InterpolationMode.STEP);
    track.addKeyframe(0, new Vector3(0, 0, 0));
    track.addKeyframe(1, new Vector3(10, 0, 0));

    const mid = track.evaluate(0.5) as Vector3;
    expect(mid.x).toBeCloseTo(0, 1); // step stays at previous keyframe
  });

  it('supports numeric property tracks', () => {
    const track = new AnimationTrack('light', TrackType.PROPERTY, InterpolationMode.LINEAR);
    track.property = 'intensity';
    track.addKeyframe(0, 0);
    track.addKeyframe(1, 1);

    expect(track.evaluate(0.5)).toBeCloseTo(0.5, 2);
  });
});

// ─── 2. AnimationPlayer ─────────────────────────────────────────────────────

describe('AnimationPlayer – play / update / verify values', () => {
  let player: AnimationPlayer;
  let target: { position: Vector3 };

  beforeEach(() => {
    player = new AnimationPlayer();
    target = { position: new Vector3(0, 0, 0) };
  });

  it('plays a clip and updates target position over time', () => {
    const clip = makePositionClip('run', 2, new Vector3(0, 0, 0), new Vector3(10, 0, 0));
    player.setClip(clip);
    player.registerTarget('root', target);
    player.play(PlaybackMode.ONCE);

    expect(player.isPlaying()).toBe(true);
    expect(player.getState()).toBe(PlaybackState.PLAYING);

    // Advance half-way
    player.update(1);
    expect(target.position.x).toBeCloseTo(5, 1);

    // Advance to end – ONCE mode stops
    player.update(1);
    expect(player.getState()).toBe(PlaybackState.STOPPED);
  });

  it('loops correctly', () => {
    const clip = makePositionClip('loop', 1, new Vector3(0, 0, 0), new Vector3(4, 0, 0));
    player.setClip(clip);
    player.registerTarget('root', target);
    player.play(PlaybackMode.LOOP);

    player.update(1.5); // wraps to 0.5
    expect(target.position.x).toBeCloseTo(2, 1);
  });

  it('pauses and resumes', () => {
    const clip = makePositionClip('jog', 2, new Vector3(0, 0, 0), new Vector3(8, 0, 0));
    player.setClip(clip);
    player.registerTarget('root', target);
    player.play();
    player.update(1);
    player.pause();

    expect(player.getState()).toBe(PlaybackState.PAUSED);
    const posAfterPause = target.position.x;

    // Updating while paused should not move
    player.update(1);
    expect(target.position.x).toBe(posAfterPause);
  });

  it('supports playback speed', () => {
    const clip = makePositionClip('fast', 2, new Vector3(0, 0, 0), new Vector3(10, 0, 0));
    player.setClip(clip);
    player.registerTarget('root', target);
    player.setSpeed(2);
    player.play();

    player.update(0.5); // effective time = 1 s
    expect(target.position.x).toBeCloseTo(5, 1);
  });

  it('fires animation events', () => {
    const clip = makePositionClip('evClip', 2, new Vector3(), new Vector3(1, 0, 0));
    player.setClip(clip);
    player.registerTarget('root', target);
    player.addEvent(0.5, 'footstep', { foot: 'left' });

    const received: any[] = [];
    player.getEvents().on('animationEvent', (data: any) => received.push(data));

    player.play();
    player.update(1); // should trigger event at 0.5
    expect(received.length).toBeGreaterThanOrEqual(1);
    expect(received[0].name).toBe('footstep');
  });

  it('crossFadeTo transitions to a new clip', () => {
    const clipA = makePositionClip('a', 2, new Vector3(0, 0, 0), new Vector3(4, 0, 0));
    const clipB = makePositionClip('b', 2, new Vector3(0, 0, 0), new Vector3(8, 0, 0));

    player.setClip(clipA);
    player.registerTarget('root', target);
    player.play();
    player.crossFadeTo(clipB, 0.5);

    // After full blend duration the current clip should be clipB
    player.update(0.6);
    expect(player.getClip()!.name).toBe('b');
  });

  it('supports root motion extraction', () => {
    const clip = makePositionClip('rootMotion', 2, new Vector3(0, 0, 0), new Vector3(10, 0, 0));
    player.setClip(clip);
    player.registerTarget('root', target);
    player.enableRootMotion('root');
    expect(player.isRootMotionEnabled()).toBe(true);

    player.play();
    player.update(1);

    const rm = player.getRootMotion();
    expect(rm.deltaPosition).toBeDefined();
  });
});

// ─── 3. AnimationStateMachine ───────────────────────────────────────────────

describe('AnimationStateMachine – states and transitions', () => {
  let sm: AnimationStateMachine;
  let idleClip: AnimationClip;
  let runClip: AnimationClip;

  beforeEach(() => {
    sm = new AnimationStateMachine();
    idleClip = makePositionClip('idle', 1, new Vector3(), new Vector3(0, 1, 0));
    runClip  = makePositionClip('run',  1, new Vector3(), new Vector3(5, 0, 0));
  });

  it('creates states and sets default state', () => {
    const idle = sm.createState('idle', idleClip);
    sm.createState('run', runClip);

    sm.setDefaultState('idle');
    expect(sm.getCurrentState()).toBe('idle');
  });

  it('triggers a bool-based transition', () => {
    const idle = sm.createState('idle', idleClip);
    sm.createState('run', runClip);

    sm.addParameter('isRunning', ConditionType.BOOL, false);

    idle.addTransition('run', [
      { parameter: 'isRunning', operator: ComparisonOperator.EQUAL, value: true }
    ], 0.2);

    sm.setDefaultState('idle');
    sm.setBool('isRunning', true);

    expect(sm.isInTransition()).toBe(true);

    // Complete the transition
    sm.update(0.3);
    expect(sm.getCurrentState()).toBe('run');
  });

  it('triggers a float-based transition', () => {
    const idle = sm.createState('idle', idleClip);
    sm.createState('run', runClip);

    sm.addParameter('speed', ConditionType.FLOAT, 0);
    idle.addTransition('run', [
      { parameter: 'speed', operator: ComparisonOperator.GREATER, value: 2 }
    ], 0.1);

    sm.setDefaultState('idle');
    sm.setFloat('speed', 5);

    // Should be transitioning
    expect(sm.isInTransition()).toBe(true);
    sm.update(0.2);
    expect(sm.getCurrentState()).toBe('run');
  });

  it('triggers a trigger-based transition and auto-resets the trigger', () => {
    const idle = sm.createState('idle', idleClip);
    sm.createState('run', runClip);

    sm.addParameter('jump', ConditionType.TRIGGER, false);
    idle.addTransition('run', [
      { parameter: 'jump', operator: ComparisonOperator.EQUAL, value: true }
    ], 0.1);

    sm.setDefaultState('idle');
    sm.setTrigger('jump');

    expect(sm.isInTransition()).toBe(true);
    sm.update(0.2);
    expect(sm.getCurrentState()).toBe('run');
  });

  it('emits stateEnter events', () => {
    sm.createState('idle', idleClip);
    sm.createState('run', runClip);

    const entered: string[] = [];
    sm.getEvents().on('stateEnter', (d: any) => entered.push(d.state));

    sm.setDefaultState('idle');
    expect(entered).toContain('idle');
  });
});

// ─── 4. BlendTree (1D) ─────────────────────────────────────────────────────

describe('BlendTree – 1D parametric blending', () => {
  let tree: Simple1DBlendTree;

  beforeEach(() => {
    tree = new Simple1DBlendTree();
    tree.addSample(makePositionClip('walk', 1, new Vector3(), new Vector3(1, 0, 0)), 0);
    tree.addSample(makePositionClip('jog', 1, new Vector3(), new Vector3(2, 0, 0)), 0.5);
    tree.addSample(makePositionClip('run', 1, new Vector3(), new Vector3(4, 0, 0)), 1);
  });

  it('gives full weight to the matching sample when exactly on threshold', () => {
    tree.setParameter(0);
    const active = tree.getActiveSamples();
    expect(active.length).toBe(1);
    expect(active[0].clip.name).toBe('walk');
    expect(active[0].weight).toBeCloseTo(1, 2);
  });

  it('blends between two surrounding samples at midpoints', () => {
    tree.setParameter(0.25); // between walk(0) and jog(0.5)
    const active = tree.getActiveSamples();
    expect(active.length).toBe(2);

    const walkSample = active.find(s => s.clip.name === 'walk');
    const jogSample  = active.find(s => s.clip.name === 'jog');
    expect(walkSample!.weight).toBeCloseTo(0.5, 2);
    expect(jogSample!.weight).toBeCloseTo(0.5, 2);
  });

  it('clamps below lowest threshold', () => {
    tree.setParameter(-1);
    const active = tree.getActiveSamples();
    expect(active.length).toBe(1);
    expect(active[0].clip.name).toBe('walk');
  });

  it('clamps above highest threshold', () => {
    tree.setParameter(5);
    const active = tree.getActiveSamples();
    expect(active.length).toBe(1);
    expect(active[0].clip.name).toBe('run');
  });

  it('can be created through BlendTreeManager', () => {
    const mgr = new BlendTreeManager();
    const t = mgr.create1DBlendTree('locomotion');
    t.addSample(makePositionClip('w', 1, new Vector3(), new Vector3()), 0);
    expect(mgr.getBlendTree('locomotion')).toBe(t);
  });
});

// ─── 5. IK – TwoBoneIK ─────────────────────────────────────────────────────

describe('IK – TwoBoneIK solver', () => {
  it('solves a reachable target, end effector near target', () => {
    const ik = new TwoBoneIK(3, 3); // upper + lower = 6 total
    const root = new Vector3(0, 0, 0);
    const target = new Vector3(4, 0, 0);
    const pole = new Vector3(0, 1, 0);

    const result = ik.solve(root, target, pole);

    // End effector should be close to target
    const dist = result.end.distanceTo(target);
    expect(dist).toBeLessThan(0.5);
  });

  it('extends fully toward unreachable target', () => {
    const ik = new TwoBoneIK(2, 2); // max reach 4
    const root = new Vector3(0, 0, 0);
    const target = new Vector3(100, 0, 0);
    const pole = new Vector3(0, 1, 0);

    const result = ik.solve(root, target, pole);

    // End should be at roughly the max reach distance
    const dist = result.root.distanceTo(result.end);
    expect(dist).toBeCloseTo(4, 0);
  });

  it('handles target at root position gracefully', () => {
    const ik = new TwoBoneIK(2, 2);
    const root = new Vector3(5, 5, 5);
    const target = new Vector3(5, 5, 5);
    const pole = new Vector3(0, 1, 0);

    const result = ik.solve(root, target, pole);
    expect(result.root).toBeDefined();
    expect(result.middle).toBeDefined();
    expect(result.end).toBeDefined();
  });

  it('reports correct bone lengths', () => {
    const ik = new TwoBoneIK(3, 4);
    expect(ik.getUpperLength()).toBe(3);
    expect(ik.getLowerLength()).toBe(4);
  });
});

describe('IK – FABRIK solver', () => {
  it('solves a multi-joint chain toward reachable target', () => {
    const joints = [
      new Vector3(0, 0, 0),
      new Vector3(0, 2, 0),
      new Vector3(0, 4, 0),
      new Vector3(0, 6, 0)
    ];
    const solver = new FABRIKSolver(joints, 20, 0.01);
    const target = new Vector3(3, 3, 0);
    const root = new Vector3(0, 0, 0);

    const solved = solver.solve(target, root);
    const endDist = solved[solved.length - 1].distanceTo(target);
    expect(endDist).toBeLessThan(0.1);
  });
});

// ─── 6. Skeleton ────────────────────────────────────────────────────────────

describe('Skeleton – bone hierarchy', () => {
  it('creates bones with parent-child relationships', () => {
    const root = new Bone('Root');
    const spine = new Bone('Spine', root);
    const chest = new Bone('Chest', spine);

    expect(root.children).toContain(spine);
    expect(spine.children).toContain(chest);
    expect(chest.parent).toBe(spine);
  });

  it('adds bones and looks up by name', () => {
    const skeleton = new Skeleton();
    const root = new Bone('Root');
    const arm = new Bone('Arm', root);
    skeleton.addBone(root);
    skeleton.addBone(arm);

    expect(skeleton.getBoneCount()).toBe(2);
    expect(skeleton.getBone('Arm')).toBe(arm);
    expect(skeleton.getBone('missing')).toBeUndefined();
  });

  it('updates world matrices through hierarchy', () => {
    const skeleton = new Skeleton();
    const root = new Bone('Root');
    const child = new Bone('Child', root);
    child.position.set(0, 5, 0);
    skeleton.addBone(root);
    skeleton.addBone(child);

    skeleton.update();

    // After update child's worldMatrix should be valid and non-identity
    const mat = child.worldMatrix.elements;
    // Translation component in column-major: elements[12], [13], [14]
    expect(mat[13]).toBeCloseTo(5, 1);
  });

  it('provides bone matrices array for skinning', () => {
    const skeleton = Skeleton.createTestSkeleton();
    const matrices = skeleton.getBoneMatrices();
    expect(matrices.length).toBe(skeleton.getBoneCount());
  });

  it('sets bone transform by name', () => {
    const skeleton = Skeleton.createTestSkeleton();
    skeleton.setBoneTransform('Head', new Vector3(0, 10, 0));
    const head = skeleton.getBone('Head')!;
    expect(head.position.y).toBe(10);
  });

  it('SkinnedMesh provides Float32Array of bone matrices', () => {
    const skeleton = Skeleton.createTestSkeleton();
    const mesh = new SkinnedMesh(skeleton);
    mesh.setVertexInfluences(0, [0, 1], [0.7, 0.3]);

    const influences = mesh.getVertexInfluences(0);
    expect(influences.bones.length).toBe(4); // padded to 4
    expect(influences.weights[0]).toBeCloseTo(0.7, 2);

    const arr = mesh.getBoneMatricesArray();
    expect(arr).toBeInstanceOf(Float32Array);
    expect(arr.length).toBe(skeleton.getBoneCount() * 16);
  });
});

// ─── 7. MorphTargets ────────────────────────────────────────────────────────

describe('MorphTargets – blend shapes', () => {
  let system: MorphTargetSystem;

  beforeEach(() => {
    system = new MorphTargetSystem(4); // 4 vertices
    system.addTarget({
      name: 'smile',
      positionDeltas: new Float32Array([0.1, 0, 0, 0.1, 0, 0, 0.1, 0, 0, 0.1, 0, 0])
    });
    system.addTarget({
      name: 'blink',
      positionDeltas: new Float32Array([0, -0.1, 0, 0, -0.1, 0, 0, -0.1, 0, 0, -0.1, 0])
    });
  });

  it('registers targets and reports correct count/names', () => {
    expect(system.getTargetCount()).toBe(2);
    expect(system.getTargetNames()).toEqual(['smile', 'blink']);
    expect(system.getTarget('smile')).toBeDefined();
    expect(system.getTarget('nonexistent')).toBeUndefined();
  });

  it('sets and gets blend-shape weights', () => {
    system.setWeight('smile', 0.6);
    expect(system.getWeight('smile')).toBeCloseTo(0.6, 3);
    expect(system.getWeight('blink')).toBe(0);
  });

  it('clamps weights to [0, 1]', () => {
    system.setWeight('smile', 2.0);
    expect(system.getWeight('smile')).toBe(1.0);
    system.setWeight('smile', -1.0);
    expect(system.getWeight('smile')).toBe(0.0);
  });

  it('resets all weights', () => {
    system.setWeight('smile', 0.8);
    system.setWeight('blink', 0.4);
    system.resetWeights();
    expect(system.getWeight('smile')).toBe(0);
    expect(system.getWeight('blink')).toBe(0);
  });

  it('setWeights sets multiple weights at once', () => {
    system.setWeights({ smile: 0.5, blink: 0.3 });
    expect(system.getWeight('smile')).toBeCloseTo(0.5, 3);
    expect(system.getWeight('blink')).toBeCloseTo(0.3, 3);
  });

  it('computes deformed positions', () => {
    system.setWeight('smile', 1.0);
    const base = new Float32Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const deformed = system.computeDeformedPositions(base);
    expect(deformed[0]).toBeCloseTo(0.1, 3); // first vertex x offset
  });

  it('supports morph animation clips with update()', () => {
    const clip = new MorphAnimationClip('smileAnim', 1);
    clip.addKeyframe(0, { smile: 0, blink: 0 });
    clip.addKeyframe(1, { smile: 1, blink: 0.5 });

    system.playClip(clip);
    system.update(0.5); // halfway
    expect(system.getWeight('smile')).toBeCloseTo(0.5, 1);
    expect(system.getWeight('blink')).toBeCloseTo(0.25, 1);
  });

  it('supports expression presets', () => {
    // Add standard ARKit-like targets
    const presetSystem = new MorphTargetSystem(1);
    const names = [
      'mouthSmileLeft', 'mouthSmileRight', 'cheekSquintLeft', 'cheekSquintRight',
      'eyeBlinkLeft', 'eyeBlinkRight'
    ];
    for (const n of names) {
      presetSystem.addTarget({ name: n, positionDeltas: new Float32Array(3) });
    }

    presetSystem.setExpression('happy');
    expect(presetSystem.getWeight('mouthSmileLeft')).toBeCloseTo(0.8, 2);

    presetSystem.setExpression('blink');
    expect(presetSystem.getWeight('eyeBlinkLeft')).toBeCloseTo(1.0, 2);

    presetSystem.setExpression('neutral');
    expect(presetSystem.getWeight('eyeBlinkLeft')).toBe(0);
  });

  it('adds and queries groups', () => {
    system.addGroup('mouth', MorphCategory.MOUTH, ['smile']);
    const groups = system.getGroups();
    expect(groups.length).toBe(1);
    expect(groups[0].name).toBe('mouth');
    expect(groups[0].targetIndices).toEqual([0]);
  });
});

// ─── Mock Web Audio API for happy-dom ───────────────────────────────────────
// happy-dom does not provide AudioContext, so we install a minimal class mock.

class MockGainNode {
  gain = { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() };
  connect = vi.fn();
  disconnect = vi.fn();
}

class MockAudioBufferSourceNode {
  buffer: any = null;
  loop = false;
  loopStart = 0;
  loopEnd = 0;
  playbackRate = { value: 1, setValueAtTime: vi.fn() };
  connect = vi.fn();
  disconnect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
  onended: any = null;
}

class MockAudioContext {
  state: AudioContextState = 'running';
  sampleRate = 44100;
  currentTime = 0;
  destination = {};
  resume = vi.fn().mockResolvedValue(undefined);
  suspend = vi.fn().mockResolvedValue(undefined);
  close = vi.fn().mockResolvedValue(undefined);
  createGain() { return new MockGainNode(); }
  createBufferSource() { return new MockAudioBufferSourceNode(); }
  createPanner = vi.fn();
  createConvolver = vi.fn();
  createBiquadFilter = vi.fn();
  createDelay = vi.fn();
  createDynamicsCompressor = vi.fn();
  createAnalyser = vi.fn();
  decodeAudioData = vi.fn();
  createBuffer(channels: number, length: number, rate: number) {
    return {
      duration: length / rate,
      numberOfChannels: channels,
      sampleRate: rate,
      length,
      getChannelData: () => new Float32Array(length)
    };
  }
}

// Install mock before audio tests
beforeAll(() => {
  if (typeof globalThis.AudioContext === 'undefined') {
    (globalThis as any).AudioContext = MockAudioContext;
  }
});

// ─── 8. Audio context & manager ─────────────────────────────────────────────

describe('Audio – WebForgeAudioContext', () => {
  it('constructs with default config and reports suspended', () => {
    const ctx = new WebForgeAudioContext();
    expect(ctx).toBeDefined();
    expect(ctx.isSuspended()).toBe(true);
  });

  it('constructs with custom config', () => {
    const ctx = new WebForgeAudioContext({
      sampleRate: 48000,
      masterVolume: 0.5,
      latencyHint: 'playback'
    });
    expect(ctx.getSampleRate()).toBe(48000);
    expect(ctx.getMasterVolume()).toBe(0.5);
  });

  it('initialises successfully with mocked AudioContext', () => {
    const ctx = new WebForgeAudioContext();
    const ok = ctx.initialize();
    expect(ok).toBe(true);
  });

  it('exposes master volume control (pre-init)', () => {
    const ctx = new WebForgeAudioContext({ masterVolume: 0.7 });
    ctx.setMasterVolume(0.3);
    expect(ctx.getMasterVolume()).toBeCloseTo(0.3, 2);
  });

  it('clamps volume to [0, 1]', () => {
    const ctx = new WebForgeAudioContext();
    ctx.setMasterVolume(5);
    expect(ctx.getMasterVolume()).toBe(1);
    ctx.setMasterVolume(-2);
    expect(ctx.getMasterVolume()).toBe(0);
  });

  it('reports not running before initialisation', () => {
    const ctx = new WebForgeAudioContext();
    expect(ctx.isRunning()).toBe(false);
    expect(ctx.getCurrentTime()).toBe(0);
  });
});

describe('Audio – AudioManager', () => {
  // BUG: AudioManager constructor eagerly creates default groups via createGroup(),
  // which calls getMasterGain() before initialize() is called, causing a throw.
  // Workaround: pass defaultGroups: [] to defer group creation until after init.

  it('constructs with deferred groups and creates them after init', () => {
    const mgr = new AudioManager({ defaultGroups: [] });
    mgr.initialize();
    mgr.createGroup('music');
    mgr.createGroup('sfx');

    expect(mgr.getGroup('music')).toBeDefined();
    expect(mgr.getGroup('sfx')).toBeDefined();
  });

  it('reports stats after initialisation', () => {
    const mgr = new AudioManager({ defaultGroups: [] });
    mgr.initialize();
    const stats = mgr.getStats();
    expect(stats.initialized).toBe(true);
    expect(stats.activeSources).toBe(0);
  });

  it('controls master volume', () => {
    const mgr = new AudioManager({ defaultGroups: [] });
    mgr.initialize();
    mgr.setMasterVolume(0.4);
    expect(mgr.getMasterVolume()).toBeCloseTo(0.4, 2);
  });

  it('documents AudioManager constructor bug with default groups', () => {
    // This test documents the bug: constructing AudioManager with default
    // groups throws because getMasterGain() is called before initialize().
    expect(() => new AudioManager()).toThrow('Audio context not initialized');
  });
});

// ─── 9. AudioSource ─────────────────────────────────────────────────────────

describe('Audio – AudioSource properties', () => {
  let ctx: WebForgeAudioContext;
  let buffer: AudioBuffer;

  beforeEach(() => {
    ctx = new WebForgeAudioContext();
    ctx.initialize();
    buffer = ctx.createBuffer(1, 44100, 44100); // 1s mono silence
  });

  it('creates a source and reads default properties', () => {
    const src = new AudioSource(ctx, { buffer });
    expect(src.getState()).toBe(AudioSourceState.STOPPED);
    expect(src.getVolume()).toBe(1);
    expect(src.getPitch()).toBe(1);
    expect(src.getLoop()).toBe(false);
    expect(src.getDuration()).toBeCloseTo(1, 1);
  });

  it('sets volume and pitch', () => {
    const src = new AudioSource(ctx, { buffer, volume: 0.8, pitch: 1.5 });
    expect(src.getVolume()).toBeCloseTo(0.8, 2);
    expect(src.getPitch()).toBeCloseTo(1.5, 2);

    src.setVolume(0.3);
    expect(src.getVolume()).toBeCloseTo(0.3, 2);

    src.setPitch(2);
    expect(src.getPitch()).toBeCloseTo(2, 2);
  });

  it('clamps volume to [0, 1]', () => {
    const src = new AudioSource(ctx, { buffer });
    src.setVolume(5);
    expect(src.getVolume()).toBe(1);
    src.setVolume(-1);
    expect(src.getVolume()).toBe(0);
  });

  it('clamps pitch to [0.25, 4]', () => {
    const src = new AudioSource(ctx, { buffer });
    src.setPitch(10);
    expect(src.getPitch()).toBe(4);
    src.setPitch(0.01);
    expect(src.getPitch()).toBe(0.25);
  });

  it('can set loop and loop points', () => {
    const src = new AudioSource(ctx, { buffer });
    src.setLoop(true);
    expect(src.getLoop()).toBe(true);
    src.setLoopPoints(0.2, 0.8);
    // No error thrown
  });

  it('plays, pauses and stops', () => {
    const src = new AudioSource(ctx, { buffer });
    src.play();
    expect(src.isPlaying()).toBe(true);

    src.pause();
    expect(src.getState()).toBe(AudioSourceState.PAUSED);

    src.stop();
    expect(src.isStopped()).toBe(true);
  });

  it('cleans up on destroy', () => {
    const src = new AudioSource(ctx, { buffer });
    src.play();
    src.destroy();
    expect(src.getState()).toBe(AudioSourceState.STOPPED);
  });
});

// ─── 10. Keyframe interpolation accuracy ────────────────────────────────────

describe('AnimationClip – keyframe interpolation', () => {
  it('linearly interpolates Vector3 values at fractional times', () => {
    const track = new AnimationTrack('obj', TrackType.POSITION, InterpolationMode.LINEAR);
    track.addKeyframe(0, new Vector3(0, 0, 0));
    track.addKeyframe(1, new Vector3(10, 20, 30));

    for (const t of [0.0, 0.25, 0.5, 0.75, 1.0]) {
      const v = track.evaluate(t) as Vector3;
      expect(v.x).toBeCloseTo(10 * t, 2);
      expect(v.y).toBeCloseTo(20 * t, 2);
      expect(v.z).toBeCloseTo(30 * t, 2);
    }
  });

  it('interpolates between multiple keyframes', () => {
    const track = new AnimationTrack('obj', TrackType.POSITION, InterpolationMode.LINEAR);
    track.addKeyframe(0, new Vector3(0, 0, 0));
    track.addKeyframe(1, new Vector3(10, 0, 0));
    track.addKeyframe(2, new Vector3(10, 10, 0));

    const v1 = track.evaluate(0.5) as Vector3;
    expect(v1.x).toBeCloseTo(5, 2);
    expect(v1.y).toBeCloseTo(0, 2);

    const v2 = track.evaluate(1.5) as Vector3;
    expect(v2.x).toBeCloseTo(10, 2);
    expect(v2.y).toBeCloseTo(5, 2);
  });

  it('linearly interpolates numeric values', () => {
    const track = new AnimationTrack('light', TrackType.PROPERTY, InterpolationMode.LINEAR);
    track.property = 'intensity';
    track.addKeyframe(0, 0);
    track.addKeyframe(2, 100);

    expect(track.evaluate(0)).toBe(0);
    expect(track.evaluate(1)).toBeCloseTo(50, 2);
    expect(track.evaluate(2)).toBe(100);
  });

  it('cubic interpolation produces smooth numeric values', () => {
    const track = new AnimationTrack('cam', TrackType.PROPERTY, InterpolationMode.CUBIC);
    track.property = 'fov';
    track.addKeyframe(0, 60);
    track.addKeyframe(1, 90);

    const mid = track.evaluate(0.5) as number;
    // Hermite at t=0.5: h1 = 0.5, h2 = 0.5 → result = 0.5*60 + 0.5*90 = 75
    expect(mid).toBeCloseTo(75, 1);
  });

  it('evaluates single-keyframe track as constant', () => {
    const track = new AnimationTrack('obj', TrackType.POSITION, InterpolationMode.LINEAR);
    track.addKeyframe(1, new Vector3(5, 5, 5));

    const v = track.evaluate(0) as Vector3;
    expect(v.x).toBe(5);
  });

  it('empty track returns null', () => {
    const track = new AnimationTrack('obj', TrackType.POSITION, InterpolationMode.LINEAR);
    expect(track.evaluate(0)).toBeNull();
  });

  it('clip evaluate produces per-target per-type map', () => {
    const clip = new AnimationClip('multi');
    const posTrack = new AnimationTrack('obj', TrackType.POSITION, InterpolationMode.LINEAR);
    posTrack.addKeyframe(0, new Vector3(0, 0, 0));
    posTrack.addKeyframe(1, new Vector3(10, 0, 0));

    const scaleTrack = new AnimationTrack('obj', TrackType.SCALE, InterpolationMode.LINEAR);
    scaleTrack.addKeyframe(0, new Vector3(1, 1, 1));
    scaleTrack.addKeyframe(1, new Vector3(2, 2, 2));

    clip.addTrack(posTrack);
    clip.addTrack(scaleTrack);

    const result = clip.evaluate(0.5);
    const objMap = result.get('obj')!;
    const pos = objMap.get(TrackType.POSITION) as Vector3;
    const scale = objMap.get(TrackType.SCALE) as Vector3;

    expect(pos.x).toBeCloseTo(5, 2);
    expect(scale.x).toBeCloseTo(1.5, 2);
  });

  it('MorphAnimationClip interpolates weights between keyframes', () => {
    const clip = new MorphAnimationClip('talk', 2);
    clip.addKeyframe(0, { mouth: 0, brow: 1 });
    clip.addKeyframe(2, { mouth: 1, brow: 0 });

    const mid = clip.evaluate(1);
    expect(mid.get('mouth')).toBeCloseTo(0.5, 2);
    expect(mid.get('brow')).toBeCloseTo(0.5, 2);
  });
});
