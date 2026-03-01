/**
 * @fileoverview Terrain sculpting brushes for height modification
 * @module terrain/TerrainBrush
 */

import { Terrain } from './Terrain';

/**
 * Brush type for terrain sculpting
 */
export type TerrainBrushType = 'raise' | 'lower' | 'smooth' | 'flatten' | 'erode' | 'noise' | 'stamp' | 'plateau';

/**
 * Brush falloff curve type
 */
export type TerrainFalloffType = 'linear' | 'smooth' | 'sharp';

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
    private type: TerrainBrushType;
    private radius: number;
    private strength: number;
    private falloff: TerrainFalloffType = 'smooth';
    private targetHeight: number = 0.5;
    private noiseScale: number = 0.1;
    private noiseSeed: number = Math.random() * 10000;
    private stampPattern: Float32Array | null = null;
    private stampSize: number = 16;
    
    /**
     * Creates a new terrain brush
     * 
     * @param type - Brush type
     * @param radius - Brush radius in world units
     * @param strength - Brush strength (0-1)
     */
    constructor(type: TerrainBrushType, radius: number, strength: number) {
        this.type = type;
        this.radius = radius;
        this.strength = strength;
    }
    
    /**
     * Sets brush type
     * 
     * @param type - New brush type
     */
    public setType(type: TerrainBrushType): void {
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
    public setFalloff(falloff: TerrainFalloffType): void {
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
     * Sets noise scale for noise brush
     * 
     * @param scale - Noise frequency scale
     */
    public setNoiseScale(scale: number): void {
        this.noiseScale = Math.max(0.01, scale);
    }
    
    /**
     * Randomizes noise seed
     */
    public randomizeNoise(): void {
        this.noiseSeed = Math.random() * 10000;
    }
    
    /**
     * Sets stamp pattern for stamp brush
     * 
     * @param pattern - Height pattern (2D array flattened, values 0-1)
     * @param size - Pattern width/height
     */
    public setStampPattern(pattern: Float32Array, size: number): void {
        this.stampPattern = pattern;
        this.stampSize = size;
    }
    
    /**
     * Creates a circular mesa/plateau stamp pattern
     * 
     * @param size - Pattern size
     * @returns Stamp pattern
     */
    public static createPlateauStamp(size: number): Float32Array {
        const pattern = new Float32Array(size * size);
        const center = size / 2;
        const innerRadius = size * 0.3;
        const outerRadius = size * 0.5;
        
        for (let z = 0; z < size; z++) {
            for (let x = 0; x < size; x++) {
                const dx = x - center;
                const dz = z - center;
                const dist = Math.sqrt(dx * dx + dz * dz);
                
                if (dist < innerRadius) {
                    pattern[z * size + x] = 1.0;
                } else if (dist < outerRadius) {
                    const t = (dist - innerRadius) / (outerRadius - innerRadius);
                    pattern[z * size + x] = 1.0 - (t * t * (3 - 2 * t)); // Smoothstep falloff
                } else {
                    pattern[z * size + x] = 0;
                }
            }
        }
        return pattern;
    }
    
    /**
     * Creates a ridge stamp pattern  
     * 
     * @param size - Pattern size
     * @returns Stamp pattern
     */
    public static createRidgeStamp(size: number): Float32Array {
        const pattern = new Float32Array(size * size);
        const center = size / 2;
        
        for (let z = 0; z < size; z++) {
            for (let x = 0; x < size; x++) {
                const distFromCenter = Math.abs(x - center) / center;
                const lengthFactor = 1 - (Math.abs(z - center) / center);
                
                if (lengthFactor > 0) {
                    const ridgeProfile = Math.max(0, 1 - distFromCenter * 2) * lengthFactor;
                    pattern[z * size + x] = ridgeProfile * ridgeProfile; // Sharper ridge
                }
            }
        }
        return pattern;
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
                    
                    this.applyAt(terrain, x, z, effectiveStrength, centerGridX, centerGridZ);
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
     * @param brushCenterX - Brush center grid X coordinate
     * @param brushCenterZ - Brush center grid Z coordinate
     */
    private applyAt(terrain: Terrain, x: number, z: number, strength: number, brushCenterX?: number, brushCenterZ?: number): void {
        const currentHeight = terrain.getHeightAt(x, z);
        
        switch (this.type) {
            case 'raise':
                terrain.setHeight(x, z, currentHeight + strength * 0.1);
                break;
                
            case 'lower':
                terrain.setHeight(x, z, currentHeight - strength * 0.1);
                break;
                
            case 'smooth': {
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
            }
                
            case 'flatten': {
                const flattened = currentHeight + (this.targetHeight - currentHeight) * strength;
                terrain.setHeight(x, z, flattened);
                break;
            }
                
            case 'erode': {
                // Hydraulic erosion brush - simulates water flow carving terrain
                const eDims = terrain.getDimensions();
                let lowestNeighbor = currentHeight;
                let _lowestX = x, _lowestZ = z;
                
                // Find steepest descent among neighbors
                for (let oz = -1; oz <= 1; oz++) {
                    for (let ox = -1; ox <= 1; ox++) {
                        if (ox === 0 && oz === 0) continue;
                        const nx = x + ox;
                        const nz = z + oz;
                        if (nx >= 0 && nx < eDims.width && nz >= 0 && nz < eDims.height) {
                            const nh = terrain.getHeightAt(nx, nz);
                            if (nh < lowestNeighbor) {
                                lowestNeighbor = nh;
                                _lowestX = nx;
                                _lowestZ = nz;
                            }
                        }
                    }
                }
                
                // Erode toward lowest neighbor (sediment transport)
                const heightDiff = currentHeight - lowestNeighbor;
                if (heightDiff > 0) {
                    const erosionAmount = Math.min(heightDiff * 0.5, strength * 0.05);
                    terrain.setHeight(x, z, currentHeight - erosionAmount);
                    // Deposit sediment at lowest neighbor
                    terrain.setHeight(_lowestX, _lowestZ, lowestNeighbor + erosionAmount * 0.7);
                }
                break;
            }
                
            case 'noise': {
                // Procedural noise brush - adds natural-looking terrain variation
                const noiseValue = this.simpleNoise(
                    x * this.noiseScale + this.noiseSeed,
                    z * this.noiseScale + this.noiseSeed
                );
                terrain.setHeight(x, z, currentHeight + noiseValue * strength * 0.1);
                break;
            }
                
            case 'stamp': {
                // Stamp brush - applies a height pattern relative to brush center
                if (!this.stampPattern) break;
                const sDims = terrain.getDimensions();
                const gridRadiusStamp = (this.radius / sDims.worldWidth) * sDims.width;
                // Use brush center (passed from apply) instead of terrain center
                const stampCenterX = brushCenterX !== undefined ? brushCenterX : sDims.width / 2;
                const stampCenterZ = brushCenterZ !== undefined ? brushCenterZ : sDims.height / 2;
                
                const sx = Math.floor(((x - (stampCenterX - gridRadiusStamp)) / (gridRadiusStamp * 2)) * this.stampSize);
                const sz = Math.floor(((z - (stampCenterZ - gridRadiusStamp)) / (gridRadiusStamp * 2)) * this.stampSize);
                
                if (sx >= 0 && sx < this.stampSize && sz >= 0 && sz < this.stampSize) {
                    const stampValue = this.stampPattern[sz * this.stampSize + sx];
                    terrain.setHeight(x, z, currentHeight + stampValue * strength * 0.2);
                }
                break;
            }
                
            case 'plateau': {
                // Plateau brush - creates flat-topped areas with natural edges relative to brush center
                const pDims = terrain.getDimensions();
                const gridRadiusPlateau = (this.radius / pDims.worldWidth) * pDims.width;
                // Use brush center (passed from apply) instead of terrain center
                const centerXp = brushCenterX !== undefined ? brushCenterX : pDims.width / 2;
                const centerZp = brushCenterZ !== undefined ? brushCenterZ : pDims.height / 2;
                const distFromCenter = Math.sqrt(
                    Math.pow(x - centerXp, 2) + Math.pow(z - centerZp, 2)
                ) / gridRadiusPlateau;
                
                if (distFromCenter < 0.6) {
                    // Inner flat area - flatten to target height
                    terrain.setHeight(x, z, currentHeight + (this.targetHeight - currentHeight) * strength);
                } else if (distFromCenter < 1.0) {
                    // Edge transition - smooth blend
                    const edgeFactor = (distFromCenter - 0.6) / 0.4;
                    const blendStrength = strength * (1 - edgeFactor * edgeFactor);
                    terrain.setHeight(x, z, currentHeight + (this.targetHeight - currentHeight) * blendStrength);
                }
                break;
            }
        }
    }
    
    /**
     * Simple noise function for procedural brush
     */
    private simpleNoise(x: number, z: number): number {
        // Simple hash-based noise for brush usage
        const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
        return (n - Math.floor(n)) * 2 - 1; // Range -1 to 1
    }
    
    /**
     * Gets brush properties
     */
    public getProperties(): { type: TerrainBrushType; radius: number; strength: number; falloff: TerrainFalloffType } {
        return {
            type: this.type,
            radius: this.radius,
            strength: this.strength,
            falloff: this.falloff
        };
    }
}
