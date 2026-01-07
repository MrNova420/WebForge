/**
 * @fileoverview Procedural terrain generation with noise algorithms
 * @module terrain/TerrainGenerator
 */

import { Terrain } from './Terrain';

/**
 * Procedural terrain generator using noise algorithms
 * 
 * Features:
 * - Perlin noise generation
 * - Fractal Brownian Motion (fBm)
 * - Configurable octaves, frequency, amplitude
 * - Seed-based reproducible generation
 * - Multiple terrain types (plateau, valley, ridge)
 * 
 * @example
 * ```typescript
 * const generator = new TerrainGenerator(12345);
 * generator.generatePerlin(terrain, 4, 0.01, 0.5);
 * ```
 */
export class TerrainGenerator {
    private seed: number;
    private perm: number[];
    
    /**
     * Creates a new terrain generator
     * 
     * @param seed - Random seed for reproducible generation
     */
    constructor(seed: number = Date.now()) {
        this.seed = seed;
        this.perm = this.generatePermutation();
    }
    
    /**
     * Generates permutation table for Perlin noise
     */
    private generatePermutation(): number[] {
        const perm: number[] = [];
        for (let i = 0; i < 256; i++) {
            perm[i] = i;
        }
        
        // Fisher-Yates shuffle with seed
        let random = this.seed;
        for (let i = 255; i > 0; i--) {
            random = (random * 1664525 + 1013904223) % 4294967296;
            const j = Math.floor((random / 4294967296) * (i + 1));
            [perm[i], perm[j]] = [perm[j], perm[i]];
        }
        
        // Duplicate for overflow
        return [...perm, ...perm];
    }
    
    /**
     * Fade function for smooth interpolation
     */
    private fade(t: number): number {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }
    
    /**
     * Linear interpolation
     */
    private lerp(t: number, a: number, b: number): number {
        return a + t * (b - a);
    }
    
    /**
     * Gradient calculation for Perlin noise
     */
    private grad(hash: number, x: number, y: number): number {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : h === 12 || h === 14 ? x : 0;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }
    
    /**
     * 2D Perlin noise
     * 
     * @param x - X coordinate
     * @param y - Y coordinate
     * @returns Noise value [-1, 1]
     */
    public perlin(x: number, y: number): number {
        // Find unit square
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        
        // Relative position in square
        x -= Math.floor(x);
        y -= Math.floor(y);
        
        // Fade curves
        const u = this.fade(x);
        const v = this.fade(y);
        
        // Hash coordinates
        const a = this.perm[X] + Y;
        const aa = this.perm[a];
        const ab = this.perm[a + 1];
        const b = this.perm[X + 1] + Y;
        const ba = this.perm[b];
        const bb = this.perm[b + 1];
        
        // Blend results
        return this.lerp(v,
            this.lerp(u, this.grad(this.perm[aa], x, y),
                        this.grad(this.perm[ba], x - 1, y)),
            this.lerp(u, this.grad(this.perm[ab], x, y - 1),
                        this.grad(this.perm[bb], x - 1, y - 1)));
    }
    
    /**
     * Fractal Brownian Motion (fBm)
     * 
     * @param x - X coordinate
     * @param y - Y coordinate
     * @param octaves - Number of octaves (detail levels)
     * @param persistence - Amplitude multiplier per octave
     * @returns Combined noise value
     */
    public fbm(x: number, y: number, octaves: number, persistence: number): number {
        let total = 0;
        let frequency = 1;
        let amplitude = 1;
        let maxValue = 0;
        
        for (let i = 0; i < octaves; i++) {
            total += this.perlin(x * frequency, y * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= 2;
        }
        
        return total / maxValue; // Normalize to [-1, 1]
    }
    
    /**
     * Generates terrain using Perlin noise
     * 
     * @param terrain - Target terrain
     * @param octaves - Number of octaves (1-8)
     * @param frequency - Base frequency (0.001-0.1)
     * @param persistence - Amplitude decay (0.1-0.9)
     */
    public generatePerlin(terrain: Terrain, octaves: number = 4, frequency: number = 0.01, persistence: number = 0.5): void {
        const dims = terrain.getDimensions();
        
        for (let z = 0; z < dims.height; z++) {
            for (let x = 0; x < dims.width; x++) {
                const noise = this.fbm(x * frequency, z * frequency, octaves, persistence);
                const height = (noise + 1) * 0.5; // Normalize to [0, 1]
                terrain.setHeight(x, z, height);
            }
        }
    }
    
    /**
     * Generates plateau terrain
     * 
     * @param terrain - Target terrain
     * @param plateauHeight - Height of plateau (0-1)
     * @param smoothness - Edge smoothness (0-1)
     */
    public generatePlateau(terrain: Terrain, plateauHeight: number = 0.7, smoothness: number = 0.1): void {
        const dims = terrain.getDimensions();
        
        for (let z = 0; z < dims.height; z++) {
            for (let x = 0; x < dims.width; x++) {
                const noise = this.perlin(x * 0.02, z * 0.02);
                let height = noise > 0 ? plateauHeight : plateauHeight * 0.3;
                
                // Smooth edges
                const transition = (noise + smoothness) / (smoothness * 2);
                height = this.lerp(Math.max(0, Math.min(1, transition)), plateauHeight * 0.3, plateauHeight);
                
                terrain.setHeight(x, z, height);
            }
        }
    }
    
    /**
     * Generates valley terrain
     * 
     * @param terrain - Target terrain
     * @param valleyDepth - Depth of valley (0-1)
     */
    public generateValleys(terrain: Terrain, valleyDepth: number = 0.5): void {
        const dims = terrain.getDimensions();
        const centerX = dims.width / 2;
        const centerZ = dims.height / 2;
        
        for (let z = 0; z < dims.height; z++) {
            for (let x = 0; x < dims.width; x++) {
                const dx = (x - centerX) / dims.width;
                const dz = (z - centerZ) / dims.height;
                const dist = Math.sqrt(dx * dx + dz * dz);
                
                const noise = this.perlin(x * 0.03, z * 0.03);
                const height = (1 - dist * 2) * valleyDepth + noise * 0.2;
                
                terrain.setHeight(x, z, Math.max(0, height));
            }
        }
    }
    
    /**
     * Generates ridge terrain
     * 
     * @param terrain - Target terrain
     * @param ridgeHeight - Height of ridges (0-1)
     */
    public generateRidges(terrain: Terrain, ridgeHeight: number = 0.8): void {
        const dims = terrain.getDimensions();
        
        for (let z = 0; z < dims.height; z++) {
            for (let x = 0; x < dims.width; x++) {
                const noise = this.perlin(x * 0.02, z * 0.02);
                const height = Math.abs(noise) * ridgeHeight;
                terrain.setHeight(x, z, height);
            }
        }
    }
    
    /**
     * Applies erosion simulation (simplified)
     * 
     * @param terrain - Target terrain
     * @param iterations - Number of erosion passes
     * @param strength - Erosion strength (0-1)
     */
    public applyErosion(terrain: Terrain, iterations: number = 10, strength: number = 0.1): void {
        const dims = terrain.getDimensions();
        
        for (let iter = 0; iter < iterations; iter++) {
            for (let z = 1; z < dims.height - 1; z++) {
                for (let x = 1; x < dims.width - 1; x++) {
                    const center = terrain.getHeightAt(x, z);
                    
                    // Average neighbors
                    const avg = (
                        terrain.getHeightAt(x - 1, z) +
                        terrain.getHeightAt(x + 1, z) +
                        terrain.getHeightAt(x, z - 1) +
                        terrain.getHeightAt(x, z + 1)
                    ) / 4;
                    
                    // Erode towards average
                    const newHeight = center + (avg - center) * strength;
                    terrain.setHeight(x, z, newHeight);
                }
            }
        }
    }
}
