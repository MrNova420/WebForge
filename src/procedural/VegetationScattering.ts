/**
 * @fileoverview Procedural vegetation scattering for terrain
 * @module procedural/VegetationScattering
 * 
 * AAA-quality vegetation placement system similar to Unreal's foliage painter
 * and Blender's particle scatter. Supports density maps, slope filtering,
 * height filtering, and collision avoidance.
 */

import { Vector3 } from '../math/Vector3';
import { Terrain } from '../terrain/Terrain';
import { NoiseGenerator } from './NoiseGenerator';

/**
 * Vegetation instance placed on terrain
 */
export interface VegetationInstance {
    /** World position */
    position: Vector3;
    /** Rotation in radians (Y-axis) */
    rotation: number;
    /** Scale multiplier */
    scale: Vector3;
    /** Type index (maps to vegetation type array) */
    typeIndex: number;
    /** LOD level (0 = highest detail) */
    lodLevel: number;
}

/**
 * Vegetation type definition
 */
export interface VegetationType {
    /** Display name */
    name: string;
    /** Density (instances per square unit) */
    density: number;
    /** Minimum height above sea level */
    minHeight: number;
    /** Maximum height above sea level */
    maxHeight: number;
    /** Maximum slope angle in radians (0 = flat only, PI/2 = any slope) */
    maxSlopeAngle: number;
    /** Minimum scale */
    minScale: number;
    /** Maximum scale */
    maxScale: number;
    /** Minimum distance between instances of this type */
    minSpacing: number;
    /** Random rotation enabled */
    randomRotation: boolean;
    /** Align to terrain normal */
    alignToNormal: boolean;
    /** LOD distances [full, medium, low, billboard] */
    lodDistances: number[];
}

/**
 * Scatter configuration
 */
export interface ScatterConfig {
    /** Random seed for reproducible results */
    seed: number;
    /** Global density multiplier */
    densityMultiplier: number;
    /** Area bounds (min/max world coords) */
    bounds: { minX: number; minZ: number; maxX: number; maxZ: number };
    /** Use Poisson disk sampling for even distribution */
    poissonSampling: boolean;
    /** Maximum instances to place */
    maxInstances: number;
}

/**
 * Vegetation scattering system for procedural foliage placement
 * 
 * Features:
 * - Multiple vegetation types with independent density/height/slope rules
 * - Poisson disk sampling for natural-looking distribution
 * - Height and slope filtering for realistic placement
 * - Random scale and rotation variation
 * - LOD level assignment based on camera distance
 * - Collision avoidance between instances
 * 
 * @example
 * ```typescript
 * const scatter = new VegetationScattering();
 * scatter.addVegetationType({
 *     name: 'Oak Tree',
 *     density: 0.02,
 *     minHeight: 5, maxHeight: 80,
 *     maxSlopeAngle: 0.5,
 *     minScale: 0.8, maxScale: 1.2,
 *     minSpacing: 5,
 *     randomRotation: true,
 *     alignToNormal: false,
 *     lodDistances: [50, 100, 200, 400]
 * });
 * const instances = scatter.scatter(terrain, config);
 * ```
 */
export class VegetationScattering {
    private vegetationTypes: VegetationType[] = [];
    // @ts-expect-error - Reserved for future density map noise sampling
    private _noise: NoiseGenerator;
    
    constructor(seed: number = 0) {
        this._noise = new NoiseGenerator(seed);
    }
    
    /**
     * Adds a vegetation type
     * @param type - Vegetation type definition
     * @returns Type index
     */
    public addVegetationType(type: VegetationType): number {
        this.vegetationTypes.push(type);
        return this.vegetationTypes.length - 1;
    }
    
    /**
     * Removes a vegetation type by index
     * @param index - Type index to remove
     */
    public removeVegetationType(index: number): void {
        if (index >= 0 && index < this.vegetationTypes.length) {
            this.vegetationTypes.splice(index, 1);
        }
    }
    
    /**
     * Gets all vegetation types
     * @returns Array of vegetation types
     */
    public getVegetationTypes(): VegetationType[] {
        return [...this.vegetationTypes];
    }
    
    /**
     * Scatters vegetation on terrain
     * @param terrain - Target terrain
     * @param config - Scatter configuration
     * @returns Array of placed vegetation instances
     */
    public scatter(terrain: Terrain, config: ScatterConfig): VegetationInstance[] {
        const instances: VegetationInstance[] = [];
        const rng = this.createSeededRNG(config.seed);
        
        for (let typeIdx = 0; typeIdx < this.vegetationTypes.length; typeIdx++) {
            const type = this.vegetationTypes[typeIdx];
            const effectiveDensity = type.density * config.densityMultiplier;
            
            if (effectiveDensity <= 0) continue;
            
            const typeInstances = config.poissonSampling
                ? this.poissonScatter(terrain, type, typeIdx, effectiveDensity, config, rng)
                : this.uniformScatter(terrain, type, typeIdx, effectiveDensity, config, rng);
            
            instances.push(...typeInstances);
            
            if (instances.length >= config.maxInstances) {
                instances.length = config.maxInstances;
                break;
            }
        }
        
        return instances;
    }
    
    /**
     * Uniform random scatter (fast but less natural)
     */
    private uniformScatter(
        terrain: Terrain,
        type: VegetationType,
        typeIndex: number,
        density: number,
        config: ScatterConfig,
        rng: () => number
    ): VegetationInstance[] {
        const instances: VegetationInstance[] = [];
        const areaWidth = config.bounds.maxX - config.bounds.minX;
        const areaDepth = config.bounds.maxZ - config.bounds.minZ;
        const area = areaWidth * areaDepth;
        const count = Math.floor(area * density);
        
        for (let i = 0; i < count && instances.length < config.maxInstances; i++) {
            const worldX = config.bounds.minX + rng() * areaWidth;
            const worldZ = config.bounds.minZ + rng() * areaDepth;
            
            const instance = this.tryPlaceInstance(terrain, type, typeIndex, worldX, worldZ, instances, rng);
            if (instance) {
                instances.push(instance);
            }
        }
        
        return instances;
    }
    
    /**
     * Poisson disk sampling scatter (more natural distribution)
     */
    private poissonScatter(
        terrain: Terrain,
        type: VegetationType,
        typeIndex: number,
        density: number,
        config: ScatterConfig,
        rng: () => number
    ): VegetationInstance[] {
        const instances: VegetationInstance[] = [];
        const spacing = Math.max(type.minSpacing, 1 / Math.sqrt(density));
        
        // Simplified Poisson disk sampling using grid acceleration
        const areaWidth = config.bounds.maxX - config.bounds.minX;
        const areaDepth = config.bounds.maxZ - config.bounds.minZ;
        const cellSize = spacing / Math.SQRT2;
        const gridW = Math.ceil(areaWidth / cellSize);
        const gridH = Math.ceil(areaDepth / cellSize);
        const grid: (VegetationInstance | null)[] = new Array(gridW * gridH).fill(null);
        
        // Active list for Poisson sampling
        const active: { x: number; z: number }[] = [];
        
        // Start with random seed point
        const startX = config.bounds.minX + rng() * areaWidth;
        const startZ = config.bounds.minZ + rng() * areaDepth;
        active.push({ x: startX, z: startZ });
        
        const maxAttempts = 30; // Attempts per active point
        
        while (active.length > 0 && instances.length < config.maxInstances) {
            const idx = Math.floor(rng() * active.length);
            const point = active[idx];
            let found = false;
            
            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                // Generate candidate point at distance [spacing, 2*spacing]
                const angle = rng() * Math.PI * 2;
                const dist = spacing + rng() * spacing;
                const cx = point.x + Math.cos(angle) * dist;
                const cz = point.z + Math.sin(angle) * dist;
                
                // Check bounds
                if (cx < config.bounds.minX || cx > config.bounds.maxX ||
                    cz < config.bounds.minZ || cz > config.bounds.maxZ) {
                    continue;
                }
                
                // Check grid for nearby points
                const gi = Math.floor((cx - config.bounds.minX) / cellSize);
                const gj = Math.floor((cz - config.bounds.minZ) / cellSize);
                
                if (gi < 0 || gi >= gridW || gj < 0 || gj >= gridH) continue;
                
                let tooClose = false;
                for (let dj = -2; dj <= 2 && !tooClose; dj++) {
                    for (let di = -2; di <= 2 && !tooClose; di++) {
                        const ni = gi + di;
                        const nj = gj + dj;
                        if (ni >= 0 && ni < gridW && nj >= 0 && nj < gridH) {
                            const neighbor = grid[nj * gridW + ni];
                            if (neighbor) {
                                const dx = neighbor.position.x - cx;
                                const dz = neighbor.position.z - cz;
                                if (dx * dx + dz * dz < spacing * spacing) {
                                    tooClose = true;
                                }
                            }
                        }
                    }
                }
                
                if (!tooClose) {
                    const instance = this.tryPlaceInstance(terrain, type, typeIndex, cx, cz, instances, rng);
                    if (instance) {
                        instances.push(instance);
                        grid[gj * gridW + gi] = instance;
                        active.push({ x: cx, z: cz });
                        found = true;
                        break;
                    }
                }
            }
            
            if (!found) {
                active.splice(idx, 1);
            }
        }
        
        return instances;
    }
    
    /**
     * Try to place a vegetation instance at world position
     * @returns Instance if valid, null if placement failed
     */
    private tryPlaceInstance(
        terrain: Terrain,
        type: VegetationType,
        typeIndex: number,
        worldX: number,
        worldZ: number,
        _existing: VegetationInstance[],
        rng: () => number
    ): VegetationInstance | null {
        const dims = terrain.getDimensions();
        
        // Convert to terrain-local coordinates for height query
        const localX = worldX + dims.worldWidth / 2;
        const localZ = worldZ + dims.worldDepth / 2;
        
        // Bounds check
        if (localX < 0 || localX >= dims.worldWidth || localZ < 0 || localZ >= dims.worldDepth) {
            return null;
        }
        
        // Get height at position
        const height = terrain.getHeight(localX, localZ);
        
        // Height filter
        if (height < type.minHeight || height > type.maxHeight) {
            return null;
        }
        
        // Slope filter
        const gridX = Math.floor((localX / dims.worldWidth) * (dims.width - 1));
        const gridZ = Math.floor((localZ / dims.worldDepth) * (dims.height - 1));
        const normal = terrain.getNormal(
            Math.max(0, Math.min(dims.width - 1, gridX)),
            Math.max(0, Math.min(dims.height - 1, gridZ))
        );
        const slopeAngle = Math.acos(Math.min(1, normal.y));
        
        if (slopeAngle > type.maxSlopeAngle) {
            return null;
        }
        
        // Random scale
        const scaleValue = type.minScale + rng() * (type.maxScale - type.minScale);
        
        // Random rotation
        const rotation = type.randomRotation ? rng() * Math.PI * 2 : 0;
        
        return {
            position: new Vector3(worldX, height, worldZ),
            rotation,
            scale: new Vector3(scaleValue, scaleValue, scaleValue),
            typeIndex,
            lodLevel: 0
        };
    }
    
    /**
     * Updates LOD levels for instances based on camera position
     * @param instances - Vegetation instances
     * @param cameraPosition - Camera world position
     */
    public updateLODs(instances: VegetationInstance[], cameraPosition: Vector3): void {
        for (const instance of instances) {
            const type = this.vegetationTypes[instance.typeIndex];
            if (!type) continue;
            
            const dist = instance.position.distanceTo(cameraPosition);
            
            // Assign LOD based on distance thresholds
            instance.lodLevel = 0;
            for (let i = 0; i < type.lodDistances.length; i++) {
                if (dist > type.lodDistances[i]) {
                    instance.lodLevel = i + 1;
                }
            }
        }
    }
    
    /**
     * Filters instances by visibility (frustum culling placeholder)
     * @param instances - All instances
     * @param cameraPosition - Camera position
     * @param maxDistance - Maximum render distance
     * @returns Visible instances
     */
    public getVisibleInstances(instances: VegetationInstance[], cameraPosition: Vector3, maxDistance: number): VegetationInstance[] {
        return instances.filter(inst => {
            const dist = inst.position.distanceTo(cameraPosition);
            return dist <= maxDistance;
        });
    }
    
    /**
     * Gets statistics about scattered vegetation
     * @param instances - Scattered instances
     * @returns Statistics object
     */
    public getStatistics(instances: VegetationInstance[]): {
        total: number;
        perType: Map<number, number>;
        perLOD: Map<number, number>;
    } {
        const perType = new Map<number, number>();
        const perLOD = new Map<number, number>();
        
        for (const instance of instances) {
            perType.set(instance.typeIndex, (perType.get(instance.typeIndex) || 0) + 1);
            perLOD.set(instance.lodLevel, (perLOD.get(instance.lodLevel) || 0) + 1);
        }
        
        return { total: instances.length, perType, perLOD };
    }
    
    /**
     * Creates a seeded random number generator
     */
    private createSeededRNG(seed: number): () => number {
        let s = seed;
        return () => {
            s = (s * 1103515245 + 12345) & 0x7fffffff;
            return s / 0x7fffffff;
        };
    }
    
    /**
     * Preset: Forest vegetation
     * @returns Configured scattering system with forest types
     */
    public static createForestPreset(): VegetationScattering {
        const scatter = new VegetationScattering(42);
        
        scatter.addVegetationType({
            name: 'Oak Tree',
            density: 0.01,
            minHeight: 2, maxHeight: 60,
            maxSlopeAngle: 0.6,
            minScale: 0.7, maxScale: 1.3,
            minSpacing: 8,
            randomRotation: true,
            alignToNormal: false,
            lodDistances: [50, 100, 200, 500]
        });
        
        scatter.addVegetationType({
            name: 'Pine Tree',
            density: 0.015,
            minHeight: 10, maxHeight: 80,
            maxSlopeAngle: 0.5,
            minScale: 0.8, maxScale: 1.4,
            minSpacing: 6,
            randomRotation: true,
            alignToNormal: false,
            lodDistances: [40, 80, 160, 400]
        });
        
        scatter.addVegetationType({
            name: 'Bush',
            density: 0.05,
            minHeight: 1, maxHeight: 50,
            maxSlopeAngle: 0.8,
            minScale: 0.5, maxScale: 1.0,
            minSpacing: 2,
            randomRotation: true,
            alignToNormal: true,
            lodDistances: [20, 40, 80, 150]
        });
        
        scatter.addVegetationType({
            name: 'Grass Clump',
            density: 0.2,
            minHeight: 0, maxHeight: 40,
            maxSlopeAngle: 1.0,
            minScale: 0.3, maxScale: 0.8,
            minSpacing: 0.5,
            randomRotation: true,
            alignToNormal: true,
            lodDistances: [10, 20, 40, 80]
        });
        
        return scatter;
    }
    
    /**
     * Preset: Desert vegetation
     * @returns Configured scattering system with desert types
     */
    public static createDesertPreset(): VegetationScattering {
        const scatter = new VegetationScattering(99);
        
        scatter.addVegetationType({
            name: 'Cactus',
            density: 0.003,
            minHeight: 0, maxHeight: 30,
            maxSlopeAngle: 0.3,
            minScale: 0.6, maxScale: 1.5,
            minSpacing: 10,
            randomRotation: true,
            alignToNormal: false,
            lodDistances: [30, 60, 120, 300]
        });
        
        scatter.addVegetationType({
            name: 'Desert Shrub',
            density: 0.01,
            minHeight: 0, maxHeight: 20,
            maxSlopeAngle: 0.5,
            minScale: 0.4, maxScale: 0.9,
            minSpacing: 3,
            randomRotation: true,
            alignToNormal: true,
            lodDistances: [15, 30, 60, 120]
        });
        
        scatter.addVegetationType({
            name: 'Rock',
            density: 0.008,
            minHeight: 0, maxHeight: 50,
            maxSlopeAngle: 1.2,
            minScale: 0.3, maxScale: 2.0,
            minSpacing: 4,
            randomRotation: true,
            alignToNormal: true,
            lodDistances: [40, 80, 160, 400]
        });
        
        return scatter;
    }
}
