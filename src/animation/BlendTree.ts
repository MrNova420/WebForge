/**
 * Blend Trees for parametric animation blending
 * 
 * Enables smooth transitions between animations based on parameters.
 * Similar to Unity's Blend Trees or Unreal's Blend Spaces.
 */

import { AnimationClip } from './AnimationClip';
import { Vector2 } from '../math/Vector2';

/**
 * Blend tree node types
 */
export enum BlendTreeType {
    SIMPLE_1D = 'simple1d',     // Blend based on single parameter
    SIMPLE_2D = 'simple2d',     // Blend based on two parameters
    DIRECT = 'direct',          // Direct control of blend weights
    ADDITIVE = 'additive'       // Additive blending
}

/**
 * Blend space sample point
 */
export interface BlendSample {
    clip: AnimationClip;
    threshold: number;      // For 1D: single value
    position?: Vector2;     // For 2D: position in blend space
    weight: number;         // Calculated blend weight
}

/**
 * Simple 1D Blend Tree
 * 
 * Blends between animations based on a single parameter.
 * Example: Walk to run based on speed.
 */
export class Simple1DBlendTree {
    private samples: BlendSample[];
    private parameter: number;

    constructor() {
        this.samples = [];
        this.parameter = 0;
    }

    /**
     * Add a blend sample
     */
    addSample(clip: AnimationClip, threshold: number): void {
        this.samples.push({
            clip,
            threshold,
            weight: 0
        });
        
        // Sort by threshold
        this.samples.sort((a, b) => a.threshold - b.threshold);
    }

    /**
     * Set the blend parameter
     */
    setParameter(value: number): void {
        this.parameter = value;
        this.calculateWeights();
    }

    /**
     * Get the blend parameter
     */
    getParameter(): number {
        return this.parameter;
    }

    /**
     * Calculate blend weights based on current parameter
     */
    private calculateWeights(): void {
        if (this.samples.length === 0) return;

        // Reset all weights
        this.samples.forEach(sample => sample.weight = 0);

        // Find surrounding samples
        let lowerIndex = -1;
        let upperIndex = -1;

        for (let i = 0; i < this.samples.length; i++) {
            if (this.samples[i].threshold <= this.parameter) {
                lowerIndex = i;
            }
            if (this.samples[i].threshold >= this.parameter && upperIndex === -1) {
                upperIndex = i;
            }
        }

        // Handle edge cases
        if (lowerIndex === -1) {
            // Below all samples
            this.samples[0].weight = 1.0;
            return;
        }

        if (upperIndex === -1) {
            // Above all samples
            this.samples[this.samples.length - 1].weight = 1.0;
            return;
        }

        if (lowerIndex === upperIndex) {
            // Exactly on a sample
            this.samples[lowerIndex].weight = 1.0;
            return;
        }

        // Interpolate between two samples
        const lower = this.samples[lowerIndex];
        const upper = this.samples[upperIndex];
        const range = upper.threshold - lower.threshold;
        const t = (this.parameter - lower.threshold) / range;

        lower.weight = 1.0 - t;
        upper.weight = t;
    }

    /**
     * Get all samples with their weights
     */
    getSamples(): BlendSample[] {
        return this.samples;
    }

    /**
     * Get active samples (weight > 0)
     */
    getActiveSamples(): BlendSample[] {
        return this.samples.filter(s => s.weight > 0);
    }
}

/**
 * Simple 2D Blend Tree
 * 
 * Blends between animations based on two parameters.
 * Example: Movement (forward/backward, left/right).
 */
export class Simple2DBlendTree {
    private samples: BlendSample[];
    private parameterX: number;
    private parameterY: number;

    constructor() {
        this.samples = [];
        this.parameterX = 0;
        this.parameterY = 0;
    }

    /**
     * Add a blend sample at a position
     */
    addSample(clip: AnimationClip, x: number, y: number): void {
        this.samples.push({
            clip,
            threshold: 0,
            position: new Vector2(x, y),
            weight: 0
        });
    }

    /**
     * Set blend parameters
     */
    setParameters(x: number, y: number): void {
        this.parameterX = x;
        this.parameterY = y;
        this.calculateWeights();
    }

    /**
     * Get blend parameters
     */
    getParameters(): { x: number; y: number } {
        return { x: this.parameterX, y: this.parameterY };
    }

    /**
     * Calculate blend weights using barycentric coordinates
     */
    private calculateWeights(): void {
        if (this.samples.length === 0) return;

        const input = new Vector2(this.parameterX, this.parameterY);

        // Use inverse distance weighting
        let totalWeight = 0;

        this.samples.forEach(sample => {
            if (!sample.position) return;

            const distance = input.distanceTo(sample.position);
            
            if (distance < 0.001) {
                // Very close to a sample point
                sample.weight = 1.0;
                totalWeight = 1.0;
            } else {
                // Inverse distance weighting
                const weight = 1.0 / (distance * distance);
                sample.weight = weight;
                totalWeight += weight;
            }
        });

        // Normalize weights
        if (totalWeight > 0) {
            this.samples.forEach(sample => {
                sample.weight /= totalWeight;
            });
        }

        // Apply threshold to reduce active samples
        this.samples.forEach(sample => {
            if (sample.weight < 0.01) {
                sample.weight = 0;
            }
        });

        // Re-normalize after threshold
        totalWeight = this.samples.reduce((sum, s) => sum + s.weight, 0);
        if (totalWeight > 0) {
            this.samples.forEach(sample => {
                sample.weight /= totalWeight;
            });
        }
    }

    /**
     * Get all samples with their weights
     */
    getSamples(): BlendSample[] {
        return this.samples;
    }

    /**
     * Get active samples (weight > 0)
     */
    getActiveSamples(): BlendSample[] {
        return this.samples.filter(s => s.weight > 0);
    }
}

/**
 * Direct Blend Tree
 * 
 * Allows manual control of blend weights for each animation.
 * Useful for layered animation or manual blending.
 */
export class DirectBlendTree {
    private samples: Map<string, BlendSample>;

    constructor() {
        this.samples = new Map();
    }

    /**
     * Add a blend sample with a name
     */
    addSample(name: string, clip: AnimationClip): void {
        this.samples.set(name, {
            clip,
            threshold: 0,
            weight: 0
        });
    }

    /**
     * Set weight for a specific animation
     */
    setWeight(name: string, weight: number): void {
        const sample = this.samples.get(name);
        if (sample) {
            sample.weight = Math.max(0, Math.min(1, weight));
        }
    }

    /**
     * Get weight for a specific animation
     */
    getWeight(name: string): number {
        return this.samples.get(name)?.weight || 0;
    }

    /**
     * Normalize all weights to sum to 1
     */
    normalizeWeights(): void {
        const totalWeight = Array.from(this.samples.values())
            .reduce((sum, s) => sum + s.weight, 0);

        if (totalWeight > 0) {
            this.samples.forEach(sample => {
                sample.weight /= totalWeight;
            });
        }
    }

    /**
     * Get all samples
     */
    getSamples(): BlendSample[] {
        return Array.from(this.samples.values());
    }

    /**
     * Get active samples (weight > 0)
     */
    getActiveSamples(): BlendSample[] {
        return this.getSamples().filter(s => s.weight > 0);
    }
}

/**
 * Additive Blend Tree
 * 
 * Applies animations additively on top of a base animation.
 * Example: Base walk + aim offset + hit reaction.
 */
export class AdditiveBlendTree {
    private baseClip: AnimationClip | null;
    private additiveClips: Map<string, { clip: AnimationClip; weight: number }>;

    constructor() {
        this.baseClip = null;
        this.additiveClips = new Map();
    }

    /**
     * Set the base animation
     */
    setBaseClip(clip: AnimationClip): void {
        this.baseClip = clip;
    }

    /**
     * Add an additive animation layer
     */
    addAdditiveClip(name: string, clip: AnimationClip, weight: number = 1.0): void {
        this.additiveClips.set(name, { clip, weight });
    }

    /**
     * Set weight for an additive layer
     */
    setAdditiveWeight(name: string, weight: number): void {
        const layer = this.additiveClips.get(name);
        if (layer) {
            layer.weight = Math.max(0, Math.min(1, weight));
        }
    }

    /**
     * Remove an additive layer
     */
    removeAdditiveClip(name: string): void {
        this.additiveClips.delete(name);
    }

    /**
     * Get base clip
     */
    getBaseClip(): AnimationClip | null {
        return this.baseClip;
    }

    /**
     * Get all additive clips with weights
     */
    getAdditiveClips(): Array<{ name: string; clip: AnimationClip; weight: number }> {
        const result: Array<{ name: string; clip: AnimationClip; weight: number }> = [];
        this.additiveClips.forEach((value, name) => {
            result.push({ name, clip: value.clip, weight: value.weight });
        });
        return result;
    }

    /**
     * Get active additive clips (weight > 0)
     */
    getActiveAdditiveClips(): Array<{ name: string; clip: AnimationClip; weight: number }> {
        return this.getAdditiveClips().filter(c => c.weight > 0);
    }
}

/**
 * Blend Tree Manager
 * 
 * High-level interface for managing blend trees.
 */
export class BlendTreeManager {
    private blendTrees: Map<string, Simple1DBlendTree | Simple2DBlendTree | DirectBlendTree | AdditiveBlendTree>;

    constructor() {
        this.blendTrees = new Map();
    }

    /**
     * Create a 1D blend tree
     */
    create1DBlendTree(name: string): Simple1DBlendTree {
        const tree = new Simple1DBlendTree();
        this.blendTrees.set(name, tree);
        return tree;
    }

    /**
     * Create a 2D blend tree
     */
    create2DBlendTree(name: string): Simple2DBlendTree {
        const tree = new Simple2DBlendTree();
        this.blendTrees.set(name, tree);
        return tree;
    }

    /**
     * Create a direct blend tree
     */
    createDirectBlendTree(name: string): DirectBlendTree {
        const tree = new DirectBlendTree();
        this.blendTrees.set(name, tree);
        return tree;
    }

    /**
     * Create an additive blend tree
     */
    createAdditiveBlendTree(name: string): AdditiveBlendTree {
        const tree = new AdditiveBlendTree();
        this.blendTrees.set(name, tree);
        return tree;
    }

    /**
     * Get a blend tree by name
     */
    getBlendTree(name: string): Simple1DBlendTree | Simple2DBlendTree | DirectBlendTree | AdditiveBlendTree | undefined {
        return this.blendTrees.get(name);
    }

    /**
     * Remove a blend tree
     */
    removeBlendTree(name: string): void {
        this.blendTrees.delete(name);
    }

    /**
     * Clear all blend trees
     */
    clear(): void {
        this.blendTrees.clear();
    }
}
