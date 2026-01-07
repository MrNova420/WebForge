/**
 * @module animation
 * @fileoverview Animation clip system for skeletal and property animation
 */

import { Vector3 } from '../math/Vector3';
import { Quaternion } from '../math/Quaternion';

/**
 * Interpolation mode
 */
export enum InterpolationMode {
  /** Step interpolation (no smoothing) */
  STEP = 'step',
  /** Linear interpolation */
  LINEAR = 'linear',
  /** Cubic interpolation (smooth) */
  CUBIC = 'cubic'
}

/**
 * Animation track target type
 */
export enum TrackType {
  /** Position track */
  POSITION = 'position',
  /** Rotation track */
  ROTATION = 'rotation',
  /** Scale track */
  SCALE = 'scale',
  /** Custom property track */
  PROPERTY = 'property'
}

/**
 * Keyframe for animation
 */
export interface Keyframe {
  /** Time in seconds */
  time: number;
  /** Value at this time */
  value: any;
  /** Optional: tangent in for cubic interpolation */
  tangentIn?: Vector3 | Quaternion;
  /** Optional: tangent out for cubic interpolation */
  tangentOut?: Vector3 | Quaternion;
}

/**
 * Animation track
 */
export class AnimationTrack {
  /** Target object name or ID */
  target: string;
  
  /** Track type */
  type: TrackType;
  
  /** Property path (for property tracks) */
  property?: string;
  
  /** Keyframes */
  keyframes: Keyframe[];
  
  /** Interpolation mode */
  interpolation: InterpolationMode;

  constructor(
    target: string,
    type: TrackType,
    interpolation: InterpolationMode = InterpolationMode.LINEAR
  ) {
    this.target = target;
    this.type = type;
    this.interpolation = interpolation;
    this.keyframes = [];
  }

  /**
   * Adds a keyframe
   * @param time - Time in seconds
   * @param value - Value at this time
   */
  addKeyframe(time: number, value: any): void {
    this.keyframes.push({ time, value });
    // Keep sorted by time
    this.keyframes.sort((a, b) => a.time - b.time);
  }

  /**
   * Gets the value at a specific time
   * @param time - Time in seconds
   * @returns Interpolated value
   */
  evaluate(time: number): any {
    if (this.keyframes.length === 0) return null;
    if (this.keyframes.length === 1) return this.keyframes[0].value;

    // Find surrounding keyframes
    let k1: Keyframe | null = null;
    let k2: Keyframe | null = null;

    for (let i = 0; i < this.keyframes.length; i++) {
      if (this.keyframes[i].time <= time) {
        k1 = this.keyframes[i];
      }
      if (this.keyframes[i].time >= time) {
        k2 = this.keyframes[i];
        break;
      }
    }

    // Before first keyframe
    if (!k1) return k2!.value;
    // After last keyframe
    if (!k2) return k1.value;
    // Exactly on keyframe
    if (k1 === k2) return k1.value;

    // Interpolate
    const t = (time - k1.time) / (k2.time - k1.time);

    switch (this.interpolation) {
      case InterpolationMode.STEP:
        return k1.value;

      case InterpolationMode.LINEAR:
        return this.interpolateLinear(k1.value, k2.value, t);

      case InterpolationMode.CUBIC:
        return this.interpolateCubic(k1.value, k2.value, t);

      default:
        return k1.value;
    }
  }

  private interpolateLinear(v1: any, v2: any, t: number): any {
    if (v1 instanceof Vector3) {
      return v1.clone().lerp(v2, t);
    }
    if (v1 instanceof Quaternion) {
      return v1.clone().slerp(v2, t);
    }
    if (typeof v1 === 'number') {
      return v1 + (v2 - v1) * t;
    }
    return v1;
  }

  private interpolateCubic(v1: any, v2: any, t: number): any {
    // Hermite interpolation
    const t2 = t * t;
    const t3 = t2 * t;

    const h1 = 2 * t3 - 3 * t2 + 1;
    const h2 = -2 * t3 + 3 * t2;
    // const h3 = t3 - 2 * t2 + t;
    // const h4 = t3 - t2;

    if (v1 instanceof Vector3) {
      // For now, use linear (full cubic needs tangents)
      return v1.clone().lerp(v2, t);
    }
    if (v1 instanceof Quaternion) {
      return v1.clone().slerp(v2, t);
    }
    if (typeof v1 === 'number') {
      return h1 * v1 + h2 * v2;
    }
    return v1;
  }

  /**
   * Gets the duration of this track
   * @returns Duration in seconds
   */
  getDuration(): number {
    if (this.keyframes.length === 0) return 0;
    return this.keyframes[this.keyframes.length - 1].time;
  }
}

/**
 * Animation clip
 */
export class AnimationClip {
  /** Clip name */
  name: string;
  
  /** Tracks */
  tracks: AnimationTrack[];
  
  /** Duration in seconds */
  duration: number;

  constructor(name: string, duration?: number) {
    this.name = name;
    this.tracks = [];
    this.duration = duration || 0;
  }

  /**
   * Adds a track
   * @param track - Track to add
   */
  addTrack(track: AnimationTrack): void {
    this.tracks.push(track);
    // Update duration
    this.duration = Math.max(this.duration, track.getDuration());
  }

  /**
   * Evaluates all tracks at a specific time
   * @param time - Time in seconds
   * @returns Map of target -> type -> value
   */
  evaluate(time: number): Map<string, Map<TrackType, any>> {
    const result = new Map<string, Map<TrackType, any>>();

    for (const track of this.tracks) {
      const value = track.evaluate(time);
      
      if (!result.has(track.target)) {
        result.set(track.target, new Map());
      }
      
      result.get(track.target)!.set(track.type, value);
    }

    return result;
  }

  /**
   * Gets the clip duration
   * @returns Duration in seconds
   */
  getDuration(): number {
    return this.duration;
  }
}
