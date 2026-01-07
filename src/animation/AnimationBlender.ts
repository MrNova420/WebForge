/**
 * @module animation
 * @fileoverview Animation blending system for smooth transitions
 */

import { AnimationClip } from './AnimationClip';
import { Vector3 } from '../math/Vector3';
import { Quaternion } from '../math/Quaternion';

/**
 * Animation blend layer
 */
interface BlendLayer {
  clip: AnimationClip;
  weight: number;
  time: number;
  speed: number;
}

/**
 * Animation blender
 */
export class AnimationBlender {
  private layers: BlendLayer[] = [];
  private targets: Map<string, any> = new Map();

  /**
   * Adds a blend layer
   * @param clip - Animation clip
   * @param weight - Blend weight (0-1)
   * @param time - Start time
   * @param speed - Playback speed
   * @returns Layer index
   */
  addLayer(clip: AnimationClip, weight: number = 1.0, time: number = 0, speed: number = 1.0): number {
    this.layers.push({ clip, weight, time, speed });
    return this.layers.length - 1;
  }

  /**
   * Removes a layer
   * @param index - Layer index
   */
  removeLayer(index: number): void {
    if (index >= 0 && index < this.layers.length) {
      this.layers.splice(index, 1);
    }
  }

  /**
   * Sets layer weight
   * @param index - Layer index
   * @param weight - New weight (0-1)
   */
  setLayerWeight(index: number, weight: number): void {
    if (index >= 0 && index < this.layers.length) {
      this.layers[index].weight = Math.max(0, Math.min(1, weight));
    }
  }

  /**
   * Sets layer time
   * @param index - Layer index
   * @param time - New time
   */
  setLayerTime(index: number, time: number): void {
    if (index >= 0 && index < this.layers.length) {
      this.layers[index].time = time;
    }
  }

  /**
   * Registers a target object
   * @param name - Target name
   * @param object - Target object
   */
  registerTarget(name: string, object: any): void {
    this.targets.set(name, object);
  }

  /**
   * Updates all layers
   * @param deltaTime - Time since last update
   */
  update(deltaTime: number): void {
    // Update layer times
    for (const layer of this.layers) {
      layer.time += deltaTime * layer.speed;
      // Loop animation
      if (layer.time > layer.clip.getDuration()) {
        layer.time = layer.time % layer.clip.getDuration();
      }
    }

    // Blend and apply
    this.blend();
  }

  /**
   * Blends all layers and applies to targets
   */
  private blend(): void {
    if (this.layers.length === 0) return;

    // Collect all values from all layers
    const allValues = new Map<string, Map<string, any[]>>();

    for (const layer of this.layers) {
      if (layer.weight === 0) continue;

      const values = layer.clip.evaluate(layer.time);

      for (const [targetName, trackValues] of values) {
        if (!allValues.has(targetName)) {
          allValues.set(targetName, new Map());
        }

        const targetMap = allValues.get(targetName)!;

        for (const [trackType, value] of trackValues) {
          const key = trackType.toString();
          if (!targetMap.has(key)) {
            targetMap.set(key, []);
          }

          targetMap.get(key)!.push({ value, weight: layer.weight });
        }
      }
    }

    // Blend values and apply
    for (const [targetName, trackMap] of allValues) {
      const target = this.targets.get(targetName);
      if (!target) continue;

      for (const [trackType, values] of trackMap) {
        const blended = this.blendValues(values);
        this.applyValue(target, trackType, blended);
      }
    }
  }

  /**
   * Blends multiple values with weights
   * @param values - Array of {value, weight} pairs
   * @returns Blended value
   */
  private blendValues(values: Array<{ value: any; weight: number }>): any {
    if (values.length === 0) return null;
    if (values.length === 1) return values[0].value;

    // Normalize weights
    const totalWeight = values.reduce((sum, v) => sum + v.weight, 0);
    if (totalWeight === 0) return values[0].value;

    const v0 = values[0].value;

    if (v0 instanceof Vector3) {
      const result = new Vector3();
      for (const { value, weight } of values) {
        result.add(value.clone().multiplyScalar(weight / totalWeight));
      }
      return result;
    }

    if (v0 instanceof Quaternion) {
      // SLERP blending for quaternions
      let result = values[0].value.clone();
      let accumulatedWeight = values[0].weight;

      for (let i = 1; i < values.length; i++) {
        const t = values[i].weight / (accumulatedWeight + values[i].weight);
        result = result.slerp(values[i].value, t);
        accumulatedWeight += values[i].weight;
      }

      return result;
    }

    if (typeof v0 === 'number') {
      let result = 0;
      for (const { value, weight } of values) {
        result += value * (weight / totalWeight);
      }
      return result;
    }

    return v0;
  }

  /**
   * Applies a value to a target
   * @param target - Target object
   * @param trackType - Track type
   * @param value - Value to apply
   */
  private applyValue(target: any, trackType: string, value: any): void {
    if (trackType === 'position') {
      if (target.setPosition) {
        target.setPosition(value);
      } else if (target.position) {
        target.position.copy(value);
      }
    } else if (trackType === 'rotation') {
      if (target.setRotation) {
        target.setRotation(value);
      } else if (target.rotation) {
        target.rotation.copy(value);
      }
    } else if (trackType === 'scale') {
      if (target.scale) {
        target.scale.copy(value);
      }
    }
  }

  /**
   * Clears all layers
   */
  clear(): void {
    this.layers = [];
  }

  /**
   * Gets layer count
   * @returns Number of layers
   */
  getLayerCount(): number {
    return this.layers.length;
  }

  /**
   * Creates a smooth transition to a new animation
   * @param targetClip - Target animation clip
   * @param duration - Transition duration in seconds
   * @returns Transition layer index
   */
  crossFade(targetClip: AnimationClip, duration: number): number {
    // Fade out all existing layers
    for (const layer of this.layers) {
      this.fadeOut(this.layers.indexOf(layer), duration);
    }

    // Fade in new layer
    const index = this.addLayer(targetClip, 0, 0);
    this.fadeIn(index, duration);

    return index;
  }

  /**
   * Fades in a layer over time
   * @param index - Layer index
   * @param duration - Fade duration
   */
  fadeIn(index: number, duration: number): void {
    if (index < 0 || index >= this.layers.length) return;

    const layer = this.layers[index];
    const startWeight = layer.weight;
    const targetWeight = 1.0;

    // Simple fade (in real implementation, would use tweening system)
    const steps = 60; // 60 frames
    const increment = (targetWeight - startWeight) / steps;

    let step = 0;
    const interval = setInterval(() => {
      layer.weight = Math.min(targetWeight, startWeight + increment * step);
      step++;

      if (step >= steps) {
        clearInterval(interval);
      }
    }, (duration * 1000) / steps);
  }

  /**
   * Fades out a layer over time
   * @param index - Layer index
   * @param duration - Fade duration
   */
  fadeOut(index: number, duration: number): void {
    if (index < 0 || index >= this.layers.length) return;

    const layer = this.layers[index];
    const startWeight = layer.weight;

    const steps = 60;
    const decrement = startWeight / steps;

    let step = 0;
    const interval = setInterval(() => {
      layer.weight = Math.max(0, startWeight - decrement * step);
      step++;

      if (step >= steps) {
        clearInterval(interval);
        this.removeLayer(index);
      }
    }, (duration * 1000) / steps);
  }
}
