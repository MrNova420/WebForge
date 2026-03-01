/**
 * @module animation
 * @fileoverview Morph target / blend shape animation system
 * 
 * Supports facial animation, corrective shapes, and morph target blending.
 * Compatible with glTF morph targets.
 */

/**
 * A single morph target containing vertex deltas
 */
export interface MorphTargetData {
  /** Name of this morph target (e.g., "smile", "blink_left") */
  name: string;
  /** Position deltas (3 floats per vertex) */
  positionDeltas: Float32Array;
  /** Normal deltas (3 floats per vertex, optional) */
  normalDeltas?: Float32Array;
  /** Tangent deltas (3 floats per vertex, optional) */
  tangentDeltas?: Float32Array;
}

/**
 * Morph target category for organizational purposes
 */
export enum MorphCategory {
  /** Eye shapes (blink, squint, wide) */
  EYES = 'eyes',
  /** Mouth shapes (visemes, smile, frown) */
  MOUTH = 'mouth',
  /** Brow shapes (raise, furrow) */
  BROWS = 'brows',
  /** Nose shapes (flare, wrinkle) */
  NOSE = 'nose',
  /** Cheek shapes (puff, suck) */
  CHEEKS = 'cheeks',
  /** Jaw shapes (open, left, right) */
  JAW = 'jaw',
  /** Corrective shapes (combination fixes) */
  CORRECTIVE = 'corrective',
  /** Body shapes */
  BODY = 'body',
  /** Custom */
  CUSTOM = 'custom'
}

/**
 * Morph target group metadata
 */
export interface MorphTargetGroup {
  name: string;
  category: MorphCategory;
  targetIndices: number[];
}

/**
 * Keyframe for morph animation
 */
export interface MorphKeyframe {
  time: number;
  weights: Map<string, number>;
}

/**
 * Morph animation clip
 */
export class MorphAnimationClip {
  name: string;
  duration: number;
  keyframes: MorphKeyframe[] = [];
  loop: boolean = false;

  constructor(name: string, duration: number) {
    this.name = name;
    this.duration = duration;
  }

  /**
   * Adds a keyframe with morph weights
   */
  addKeyframe(time: number, weights: Record<string, number>): void {
    const map = new Map<string, number>();
    for (const [key, value] of Object.entries(weights)) {
      map.set(key, value);
    }
    this.keyframes.push({ time, weights: map });
    this.keyframes.sort((a, b) => a.time - b.time);
  }

  /**
   * Evaluates morph weights at a specific time
   */
  evaluate(time: number): Map<string, number> {
    if (this.keyframes.length === 0) return new Map();
    if (this.keyframes.length === 1) return new Map(this.keyframes[0].weights);

    // Handle looping
    if (this.loop && this.duration > 0) {
      time = time % this.duration;
    }

    // Find surrounding keyframes
    let k1 = this.keyframes[0];
    let k2 = this.keyframes[this.keyframes.length - 1];

    for (let i = 0; i < this.keyframes.length - 1; i++) {
      if (this.keyframes[i].time <= time && this.keyframes[i + 1].time >= time) {
        k1 = this.keyframes[i];
        k2 = this.keyframes[i + 1];
        break;
      }
    }

    if (time <= k1.time) return new Map(k1.weights);
    if (time >= k2.time) return new Map(k2.weights);

    // Interpolate
    const t = (time - k1.time) / (k2.time - k1.time);
    const result = new Map<string, number>();

    // Get all target names from both keyframes
    const allNames = new Set([...k1.weights.keys(), ...k2.weights.keys()]);
    for (const name of allNames) {
      const w1 = k1.weights.get(name) || 0;
      const w2 = k2.weights.get(name) || 0;
      result.set(name, w1 + (w2 - w1) * t);
    }

    return result;
  }
}

/**
 * ARKit-compatible face blend shape names (52 standard shapes)
 */
export const ARKIT_BLEND_SHAPES = [
  'browDownLeft', 'browDownRight', 'browInnerUp', 'browOuterUpLeft', 'browOuterUpRight',
  'cheekPuff', 'cheekSquintLeft', 'cheekSquintRight',
  'eyeBlinkLeft', 'eyeBlinkRight', 'eyeLookDownLeft', 'eyeLookDownRight',
  'eyeLookInLeft', 'eyeLookInRight', 'eyeLookOutLeft', 'eyeLookOutRight',
  'eyeLookUpLeft', 'eyeLookUpRight', 'eyeSquintLeft', 'eyeSquintRight',
  'eyeWideLeft', 'eyeWideRight',
  'jawForward', 'jawLeft', 'jawOpen', 'jawRight',
  'mouthClose', 'mouthDimpleLeft', 'mouthDimpleRight', 'mouthFrownLeft', 'mouthFrownRight',
  'mouthFunnel', 'mouthLeft', 'mouthLowerDownLeft', 'mouthLowerDownRight',
  'mouthPressLeft', 'mouthPressRight', 'mouthPucker', 'mouthRight',
  'mouthRollLower', 'mouthRollUpper', 'mouthShrugLower', 'mouthShrugUpper',
  'mouthSmileLeft', 'mouthSmileRight', 'mouthStretchLeft', 'mouthStretchRight',
  'mouthUpperUpLeft', 'mouthUpperUpRight',
  'noseSneerLeft', 'noseSneerRight',
  'tongueOut'
] as const;

/**
 * Standard viseme shapes for lip-sync
 */
export const VISEME_SHAPES = [
  'viseme_sil',  // silence
  'viseme_PP',   // P, B, M
  'viseme_FF',   // F, V
  'viseme_TH',   // Th
  'viseme_DD',   // D, T, N
  'viseme_kk',   // K, G, Ng
  'viseme_CH',   // Ch, J, Sh
  'viseme_SS',   // S, Z
  'viseme_nn',   // N, L
  'viseme_RR',   // R
  'viseme_aa',   // A
  'viseme_E',    // E
  'viseme_I',    // I
  'viseme_O',    // O
  'viseme_U'     // U
] as const;

/**
 * Morph target system for blend shapes and facial animation
 */
export class MorphTargetSystem {
  /** All registered morph targets */
  private targets: MorphTargetData[] = [];
  /** Current blend weights (0 to 1) */
  private weights: Float32Array = new Float32Array(0);
  /** Name to index mapping */
  private nameToIndex: Map<string, number> = new Map();
  /** Target groups for organization */
  private groups: MorphTargetGroup[] = [];
  /** Vertex count of the base mesh */
  public vertexCount: number = 0;
  /** Currently playing animation clips */
  private activeClips: { clip: MorphAnimationClip; time: number; speed: number; weight: number }[] = [];

  constructor(vertexCount: number = 0) {
    this.vertexCount = vertexCount;
  }

  /**
   * Adds a morph target
   */
  addTarget(target: MorphTargetData): number {
    const index = this.targets.length;
    this.targets.push(target);
    this.nameToIndex.set(target.name, index);
    
    // Resize weights array
    const newWeights = new Float32Array(this.targets.length);
    newWeights.set(this.weights);
    this.weights = newWeights;
    
    return index;
  }

  /**
   * Sets the weight for a morph target by name
   */
  setWeight(name: string, weight: number): void {
    const index = this.nameToIndex.get(name);
    if (index !== undefined) {
      this.weights[index] = Math.max(0, Math.min(1, weight));
    }
  }

  /**
   * Gets the weight for a morph target by name
   */
  getWeight(name: string): number {
    const index = this.nameToIndex.get(name);
    return index !== undefined ? this.weights[index] : 0;
  }

  /**
   * Gets all weights as a readonly array
   */
  getWeights(): Float32Array {
    return this.weights;
  }

  /**
   * Sets all weights at once
   */
  setWeights(weights: Record<string, number>): void {
    for (const [name, weight] of Object.entries(weights)) {
      this.setWeight(name, weight);
    }
  }

  /**
   * Resets all weights to zero
   */
  resetWeights(): void {
    this.weights.fill(0);
  }

  /**
   * Adds a target group for organization
   */
  addGroup(name: string, category: MorphCategory, targetNames: string[]): void {
    const indices = targetNames
      .map(n => this.nameToIndex.get(n))
      .filter((i): i is number => i !== undefined);
    
    this.groups.push({ name, category, targetIndices: indices });
  }

  /**
   * Gets all groups
   */
  getGroups(): MorphTargetGroup[] {
    return [...this.groups];
  }

  /**
   * Gets all target names
   */
  getTargetNames(): string[] {
    return this.targets.map(t => t.name);
  }

  /**
   * Gets a morph target by name
   */
  getTarget(name: string): MorphTargetData | undefined {
    const index = this.nameToIndex.get(name);
    return index !== undefined ? this.targets[index] : undefined;
  }

  /**
   * Gets the number of morph targets
   */
  getTargetCount(): number {
    return this.targets.length;
  }

  /**
   * Plays a morph animation clip
   */
  playClip(clip: MorphAnimationClip, speed: number = 1, weight: number = 1): void {
    this.activeClips.push({ clip, time: 0, speed, weight });
  }

  /**
   * Stops a playing clip by name
   */
  stopClip(clipName: string): void {
    this.activeClips = this.activeClips.filter(c => c.clip.name !== clipName);
  }

  /**
   * Stops all playing clips
   */
  stopAllClips(): void {
    this.activeClips = [];
  }

  /**
   * Updates the morph target system
   * @param dt - Delta time in seconds
   */
  update(dt: number): void {
    // Update clip playback
    const finishedClips: number[] = [];
    
    for (let i = 0; i < this.activeClips.length; i++) {
      const active = this.activeClips[i];
      active.time += dt * active.speed;

      // Check if clip finished
      if (!active.clip.loop && active.time >= active.clip.duration) {
        finishedClips.push(i);
        active.time = active.clip.duration;
      }

      // Evaluate and apply weights
      const clipWeights = active.clip.evaluate(active.time);
      for (const [name, weight] of clipWeights) {
        const current = this.getWeight(name);
        this.setWeight(name, current + weight * active.weight);
      }
    }

    // Remove finished clips (in reverse order)
    for (let i = finishedClips.length - 1; i >= 0; i--) {
      this.activeClips.splice(finishedClips[i], 1);
    }
  }

  /**
   * Computes the deformed vertex positions based on current weights
   * @param basePositions - Base mesh positions (3 floats per vertex)
   * @returns Deformed positions
   */
  computeDeformedPositions(basePositions: Float32Array): Float32Array {
    const result = new Float32Array(basePositions);
    
    for (let t = 0; t < this.targets.length; t++) {
      const weight = this.weights[t];
      if (weight < 0.001) continue;
      
      const deltas = this.targets[t].positionDeltas;
      for (let i = 0; i < result.length && i < deltas.length; i++) {
        result[i] += deltas[i] * weight;
      }
    }
    
    return result;
  }

  /**
   * Creates a standard expression preset
   */
  setExpression(expression: 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised' | 'blink'): void {
    this.resetWeights();
    
    switch (expression) {
      case 'neutral':
        break;
      case 'happy':
        this.setWeight('mouthSmileLeft', 0.8);
        this.setWeight('mouthSmileRight', 0.8);
        this.setWeight('cheekSquintLeft', 0.5);
        this.setWeight('cheekSquintRight', 0.5);
        break;
      case 'sad':
        this.setWeight('mouthFrownLeft', 0.7);
        this.setWeight('mouthFrownRight', 0.7);
        this.setWeight('browInnerUp', 0.6);
        break;
      case 'angry':
        this.setWeight('browDownLeft', 0.8);
        this.setWeight('browDownRight', 0.8);
        this.setWeight('noseSneerLeft', 0.5);
        this.setWeight('noseSneerRight', 0.5);
        this.setWeight('jawForward', 0.2);
        break;
      case 'surprised':
        this.setWeight('eyeWideLeft', 0.9);
        this.setWeight('eyeWideRight', 0.9);
        this.setWeight('browOuterUpLeft', 0.8);
        this.setWeight('browOuterUpRight', 0.8);
        this.setWeight('jawOpen', 0.6);
        break;
      case 'blink':
        this.setWeight('eyeBlinkLeft', 1.0);
        this.setWeight('eyeBlinkRight', 1.0);
        break;
    }
  }
}
