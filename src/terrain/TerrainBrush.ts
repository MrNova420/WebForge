/**
 * @fileoverview Terrain sculpting brushes for height modification
 * @module terrain/TerrainBrush
 */

import { Terrain } from './Terrain';

/**
 * Brush type for terrain sculpting
 */
export type BrushType = 'raise' | 'lower' | 'smooth' | 'flatten';

/**
 * Brush falloff curve type
 */
export type FalloffType = 'linear' | 'smooth' | 'sharp';

/**
 * Terrain sculpting brush for height modification
 * 
 * Features:
 * - Multiple brush types (raise, lower, smooth, flatten)
 * - Configurable radius and strength
 * - Falloff curves for natural transitions
 * - Real-time preview support
 * 
 * @example
 * ```typescript
 * const brush = new TerrainBrush('raise', 10, 0.5);
 * brush.setFalloff('smooth');
 * brush.apply(terrain, worldX, worldZ);
 * ```
 */
export class TerrainBrush {
    private type: BrushType;
    private radius: number;
    private strength: number;
    private falloff: FalloffType = 'smooth';
    private targetHeight: number = 0.5;
    
    /**
     * Creates a new terrain brush
     * 
     * @param type - Brush type
     * @param radius - Brush radius in world units
     * @param strength - Brush strength (0-1)
     */
    constructor(type: BrushType, radius: number, strength: number) {
        this.type = type;
        this.radius = radius;
        this.strength = strength;
    }
    
    /**
     * Sets brush type
     * 
     * @param type - New brush type
     */
    public setType(type: BrushType): void {
        this.type = type;
    }
    
    /**
     * Sets brush radius
     * 
     * @param radius - New radius in world units
     */
    public setRadius(radius: number): void {
        this.radius = Math.max(0.1, radius);
    }
    
    /**
     * Sets brush strength
     * 
     * @param strength - New strength (0-1)
     */
    public setStrength(strength: number): void {
        this.strength = Math.max(0, Math.min(1, strength));
    }
    
    /**
     * Sets falloff curve type
     * 
     * @param falloff - Falloff type
     */
    public setFalloff(falloff: FalloffType): void {
        this.falloff = falloff;
    }
    
    /**
     * Sets target height for flatten brush
     * 
     * @param height - Target height (0-1)
     */
    public setTargetHeight(height: number): void {
        this.targetHeight = height;
    }
    
    /**
     * Calculates falloff multiplier based on distance
     * 
     * @param distance - Distance from brush center
     * @returns Falloff multiplier (0-1)
     */
    private calculateFalloff(distance: number): number {
        const t = 1 - Math.min(1, distance / this.radius);
        
        switch (this.falloff) {
            case 'linear':
                return t;
            case 'smooth':
                return t * t * (3 - 2 * t); // Smoothstep
            case 'sharp':
                return t * t * t; // Cubic
            default:
                return t;
        }
    }
    
    /**
     * Applies brush to terrain at world position
     * 
     * @param terrain - Target terrain
     * @param worldX - World X coordinate
     * @param worldZ - World Z coordinate
     */
    public apply(terrain: Terrain, worldX: number, worldZ: number): void {
        const dims = terrain.getDimensions();
        
        // Convert world to grid coordinates
        const centerGridX = ((worldX + dims.worldWidth / 2) / dims.worldWidth) * dims.width;
        const centerGridZ = ((worldZ + dims.worldDepth / 2) / dims.worldDepth) * dims.height;
        
        // Calculate grid radius
        const gridRadius = (this.radius / dims.worldWidth) * dims.width;
        
        // Apply brush in radius
        const minX = Math.max(0, Math.floor(centerGridX - gridRadius));
        const maxX = Math.min(dims.width - 1, Math.ceil(centerGridX + gridRadius));
        const minZ = Math.max(0, Math.floor(centerGridZ - gridRadius));
        const maxZ = Math.min(dims.height - 1, Math.ceil(centerGridZ + gridRadius));
        
        for (let z = minZ; z <= maxZ; z++) {
            for (let x = minX; x <= maxX; x++) {
                const dx = x - centerGridX;
                const dz = z - centerGridZ;
                const distance = Math.sqrt(dx * dx + dz * dz);
                
                if (distance <= gridRadius) {
                    const falloff = this.calculateFalloff(distance);
                    const effectiveStrength = this.strength * falloff;
                    
                    this.applyAt(terrain, x, z, effectiveStrength);
                }
            }
        }
    }
    
    /**
     * Applies brush effect at specific grid position
     * 
     * @param terrain - Target terrain
     * @param x - Grid X coordinate
     * @param z - Grid Z coordinate
     * @param strength - Effective strength at this position
     */
    private applyAt(terrain: Terrain, x: number, z: number, strength: number): void {
        const currentHeight = terrain.getHeightAt(x, z);
        
        switch (this.type) {
            case 'raise':
                terrain.setHeight(x, z, currentHeight + strength * 0.1);
                break;
                
            case 'lower':
                terrain.setHeight(x, z, currentHeight - strength * 0.1);
                break;
                
            case 'smooth':
                // Average with neighbors
                const dims = terrain.getDimensions();
                let sum = 0;
                let count = 0;
                
                for (let oz = -1; oz <= 1; oz++) {
                    for (let ox = -1; ox <= 1; ox++) {
                        const nx = x + ox;
                        const nz = z + oz;
                        if (nx >= 0 && nx < dims.width && nz >= 0 && nz < dims.height) {
                            sum += terrain.getHeightAt(nx, nz);
                            count++;
                        }
                    }
                }
                
                const avg = sum / count;
                const smoothed = currentHeight + (avg - currentHeight) * strength;
                terrain.setHeight(x, z, smoothed);
                break;
                
            case 'flatten':
                const flattened = currentHeight + (this.targetHeight - currentHeight) * strength;
                terrain.setHeight(x, z, flattened);
                break;
        }
    }
    
    /**
     * Gets brush properties
     */
    public getProperties(): { type: BrushType; radius: number; strength: number; falloff: FalloffType } {
        return {
            type: this.type,
            radius: this.radius,
            strength: this.strength,
            falloff: this.falloff
        };
    }
}
