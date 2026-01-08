/**
 * @fileoverview Terrain texture painting with multi-layer splatting
 * @module terrain/TerrainPainting
 */

import { Terrain } from './Terrain';

/**
 * Texture layer for terrain painting
 */
export interface TerrainLayer {
    name: string;
    index: number; // 0-3 (RGBA channels)
}

/**
 * Terrain texture painting system with splatting
 * 
 * Features:
 * - Multi-layer texture splatting (up to 4 layers)
 * - Blend map generation (RGBA channels)
 * - Brush-based painting
 * - Paint and erase modes
 * 
 * @example
 * ```typescript
 * const painting = new TerrainPainting();
 * painting.addLayer('grass', grassTexture);
 * painting.addLayer('rock', rockTexture);
 * painting.paint(terrain, worldX, worldZ, 'rock', 10, 0.8);
 * ```
 */
export class TerrainPainting {
    private layers: Map<string, TerrainLayer> = new Map();
    private weights!: Float32Array;
    private width: number = 0;
    private height: number = 0;
    
    /**
     * Creates a new terrain painting system
     */
    constructor() {}
    
    /**
     * Initializes painting for terrain
     * 
     * @param terrain - Target terrain
     */
    public initialize(terrain: Terrain): void {
        const dims = terrain.getDimensions();
        this.width = dims.width;
        this.height = dims.height;
        
        // 4 channels (RGBA) per texel
        this.weights = new Float32Array(this.width * this.height * 4);
        
        // Default to first layer (R channel)
        for (let i = 0; i < this.width * this.height; i++) {
            this.weights[i * 4] = 1.0; // R = 100%
        }
    }
    
    /**
     * Adds a texture layer
     * 
     * @param name - Layer name
     * @param _texture - Texture reference (not used in this implementation)
     * @returns Layer index (0-3) or -1 if full
     */
    public addLayer(name: string, _texture?: any): number {
        if (this.layers.size >= 4) return -1;
        
        const index = this.layers.size;
        this.layers.set(name, { name, index });
        return index;
    }
    
    /**
     * Gets layer by name
     * 
     * @param name - Layer name
     * @returns Layer or undefined
     */
    public getLayer(name: string): TerrainLayer | undefined {
        return this.layers.get(name);
    }
    
    /**
     * Gets weight at grid position for specific channel
     * 
     * @param x - Grid X coordinate
     * @param z - Grid Z coordinate
     * @param channel - Channel index (0-3)
     * @returns Weight value (0-1)
     */
    public getWeight(x: number, z: number, channel: number): number {
        if (x < 0 || x >= this.width || z < 0 || z >= this.height) return 0;
        return this.weights[(z * this.width + x) * 4 + channel];
    }
    
    /**
     * Sets weight at grid position for specific channel
     * 
     * @param x - Grid X coordinate
     * @param z - Grid Z coordinate
     * @param channel - Channel index (0-3)
     * @param weight - Weight value (0-1)
     */
    public setWeight(x: number, z: number, channel: number, weight: number): void {
        if (x < 0 || x >= this.width || z < 0 || z >= this.height) return;
        this.weights[(z * this.width + x) * 4 + channel] = Math.max(0, Math.min(1, weight));
    }
    
    /**
     * Normalizes weights at position so they sum to 1
     * 
     * @param x - Grid X coordinate
     * @param z - Grid Z coordinate
     */
    private normalizeWeights(x: number, z: number): void {
        const idx = (z * this.width + x) * 4;
        let sum = 0;
        
        for (let i = 0; i < 4; i++) {
            sum += this.weights[idx + i];
        }
        
        if (sum > 0) {
            for (let i = 0; i < 4; i++) {
                this.weights[idx + i] /= sum;
            }
        }
    }
    
    /**
     * Paints texture layer at world position
     * 
     * @param terrain - Target terrain
     * @param worldX - World X coordinate
     * @param worldZ - World Z coordinate
     * @param layerName - Layer to paint
     * @param brushRadius - Brush radius in world units
     * @param strength - Paint strength (0-1)
     */
    public paint(terrain: Terrain, worldX: number, worldZ: number, layerName: string, brushRadius: number, strength: number): void {
        const layer = this.layers.get(layerName);
        if (!layer) return;
        
        const dims = terrain.getDimensions();
        
        // Convert world to grid coordinates
        const centerGridX = ((worldX + dims.worldWidth / 2) / dims.worldWidth) * dims.width;
        const centerGridZ = ((worldZ + dims.worldDepth / 2) / dims.worldDepth) * dims.height;
        
        // Calculate grid radius
        const gridRadius = (brushRadius / dims.worldWidth) * dims.width;
        
        // Apply paint in radius
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
                    const falloff = 1 - (distance / gridRadius);
                    const effectiveStrength = strength * falloff * falloff; // Smooth falloff
                    
                    // Increase target layer weight
                    const currentWeight = this.getWeight(x, z, layer.index);
                    const newWeight = currentWeight + effectiveStrength * (1 - currentWeight);
                    this.setWeight(x, z, layer.index, newWeight);
                    
                    // Normalize all weights
                    this.normalizeWeights(x, z);
                }
            }
        }
    }
    
    /**
     * Erases texture layer at world position
     * 
     * @param terrain - Target terrain
     * @param worldX - World X coordinate
     * @param worldZ - World Z coordinate
     * @param layerName - Layer to erase
     * @param brushRadius - Brush radius in world units
     * @param strength - Erase strength (0-1)
     */
    public erase(terrain: Terrain, worldX: number, worldZ: number, layerName: string, brushRadius: number, strength: number): void {
        const layer = this.layers.get(layerName);
        if (!layer) return;
        
        const dims = terrain.getDimensions();
        
        const centerGridX = ((worldX + dims.worldWidth / 2) / dims.worldWidth) * dims.width;
        const centerGridZ = ((worldZ + dims.worldDepth / 2) / dims.worldDepth) * dims.height;
        const gridRadius = (brushRadius / dims.worldWidth) * dims.width;
        
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
                    const falloff = 1 - (distance / gridRadius);
                    const effectiveStrength = strength * falloff * falloff;
                    
                    const currentWeight = this.getWeight(x, z, layer.index);
                    const newWeight = currentWeight * (1 - effectiveStrength);
                    this.setWeight(x, z, layer.index, newWeight);
                    
                    this.normalizeWeights(x, z);
                }
            }
        }
    }
    
    /**
     * Gets blend map data (RGBA weights)
     */
    public getBlendMap(): Float32Array {
        return this.weights;
    }
}
