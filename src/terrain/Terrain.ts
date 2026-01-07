/**
 * @fileoverview Terrain system with heightmap-based representation
 * @module terrain/Terrain
 */

import { Vector3 } from '../math/Vector3';
import { MeshData } from '../geometry/MeshData';

/**
 * Heightmap-based terrain with LOD support
 * 
 * Features:
 * - 2D heightmap grid
 * - Configurable dimensions and resolution
 * - Height queries with bilinear interpolation
 * - Normal computation using sobel operator
 * - Mesh generation from height data
 * - Multi-material support
 * 
 * @example
 * ```typescript
 * const terrain = new Terrain(1024, 1024, 100, 100);
 * terrain.setHeightRange(0, 50);
 * terrain.setHeight(512, 512, 25);
 * const height = terrain.getHeight(50, 50); // World position
 * const mesh = terrain.generateMesh(4); // LOD level 4
 * ```
 */
export class Terrain {
    /** Width of heightmap grid */
    private width: number;
    
    /** Height of heightmap grid */
    private height: number;
    
    /** World space width */
    private worldWidth: number;
    
    /** World space depth */
    private worldDepth: number;
    
    /** Heightmap data (2D array flattened) */
    private heights: Float32Array;
    
    /** Minimum terrain height */
    private minHeight: number = 0;
    
    /** Maximum terrain height */
    private maxHeight: number = 100;
    
    /**
     * Creates a new terrain
     * 
     * @param width - Heightmap width (samples)
     * @param height - Heightmap height (samples)
     * @param worldWidth - World space width
     * @param worldDepth - World space depth
     */
    constructor(width: number, height: number, worldWidth: number, worldDepth: number) {
        this.width = width;
        this.height = height;
        this.worldWidth = worldWidth;
        this.worldDepth = worldDepth;
        this.heights = new Float32Array(width * height);
    }
    
    /**
     * Sets the height range for the terrain
     * 
     * @param min - Minimum height
     * @param max - Maximum height
     */
    public setHeightRange(min: number, max: number): void {
        this.minHeight = min;
        this.maxHeight = max;
    }
    
    /**
     * Sets height at grid position
     * 
     * @param x - X grid coordinate
     * @param z - Z grid coordinate
     * @param height - Height value (normalized 0-1 or absolute)
     */
    public setHeight(x: number, z: number, height: number): void {
        if (x < 0 || x >= this.width || z < 0 || z >= this.height) return;
        this.heights[z * this.width + x] = height;
    }
    
    /**
     * Gets height at grid position
     * 
     * @param x - X grid coordinate
     * @param z - Z grid coordinate
     * @returns Height value
     */
    public getHeightAt(x: number, z: number): number {
        if (x < 0 || x >= this.width || z < 0 || z >= this.height) return 0;
        return this.heights[z * this.width + x];
    }
    
    /**
     * Gets height at world position with bilinear interpolation
     * 
     * @param worldX - World X coordinate
     * @param worldZ - World Z coordinate
     * @returns Interpolated height value
     */
    public getHeight(worldX: number, worldZ: number): number {
        // Convert world to grid coordinates
        const gridX = (worldX / this.worldWidth) * (this.width - 1);
        const gridZ = (worldZ / this.worldDepth) * (this.height - 1);
        
        // Get integer parts
        const x0 = Math.floor(gridX);
        const z0 = Math.floor(gridZ);
        const x1 = Math.min(x0 + 1, this.width - 1);
        const z1 = Math.min(z0 + 1, this.height - 1);
        
        // Get fractional parts
        const fx = gridX - x0;
        const fz = gridZ - z0;
        
        // Bilinear interpolation
        const h00 = this.getHeightAt(x0, z0);
        const h10 = this.getHeightAt(x1, z0);
        const h01 = this.getHeightAt(x0, z1);
        const h11 = this.getHeightAt(x1, z1);
        
        const h0 = h00 * (1 - fx) + h10 * fx;
        const h1 = h01 * (1 - fx) + h11 * fx;
        
        return h0 * (1 - fz) + h1 * fz;
    }
    
    /**
     * Computes normal at grid position using sobel operator
     * 
     * @param x - X grid coordinate
     * @param z - Z grid coordinate
     * @returns Normal vector
     */
    public getNormal(x: number, z: number): Vector3 {
        const scale = this.worldWidth / this.width;
        
        // Sample surrounding heights
        const hL = this.getHeightAt(x - 1, z);
        const hR = this.getHeightAt(x + 1, z);
        const hD = this.getHeightAt(x, z - 1);
        const hU = this.getHeightAt(x, z + 1);
        
        // Compute gradient
        const nx = (hL - hR) / (2 * scale);
        const nz = (hD - hU) / (2 * scale);
        
        // Normalize
        const normal = new Vector3(nx, 1, nz);
        normal.normalize();
        
        return normal;
    }
    
    /**
     * Generates mesh from heightmap at specified LOD level
     * 
     * @param lodLevel - LOD level (0 = full detail, 4 = lowest)
     * @returns Generated mesh data
     */
    public generateMesh(lodLevel: number = 0): MeshData {
        const step = Math.pow(2, lodLevel); // 1, 2, 4, 8, 16
        const mesh = new MeshData(
            { position: [], normal: [], uv: [], color: [] },
            []
        );
        
        const vertexMap = new Map<string, number>();
        
        // Generate vertices and UVs
        for (let z = 0; z < this.height; z += step) {
            for (let x = 0; x < this.width; x += step) {
                const worldX = (x / (this.width - 1)) * this.worldWidth - this.worldWidth / 2;
                const worldZ = (z / (this.height - 1)) * this.worldDepth - this.worldDepth / 2;
                const height = this.getHeightAt(x, z);
                const normal = this.getNormal(x, z);
                
                const u = x / (this.width - 1);
                const v = z / (this.height - 1);
                
                const vertexIndex = mesh.addVertex(
                    new Vector3(worldX, height, worldZ),
                    normal,
                    { x: u, y: v } as any
                );
                
                vertexMap.set(`${x},${z}`, vertexIndex);
            }
        }
        
        // Generate faces (triangles)
        for (let z = 0; z < this.height - step; z += step) {
            for (let x = 0; x < this.width - step; x += step) {
                const v00 = vertexMap.get(`${x},${z}`)!;
                const v10 = vertexMap.get(`${x + step},${z}`)!;
                const v01 = vertexMap.get(`${x},${z + step}`)!;
                const v11 = vertexMap.get(`${x + step},${z + step}`)!;
                
                // Two triangles per quad
                mesh.addFace(v00, v10, v11);
                mesh.addFace(v00, v11, v01);
            }
        }
        
        return mesh;
    }
    
    /**
     * Gets terrain dimensions
     */
    public getDimensions(): { width: number; height: number; worldWidth: number; worldDepth: number } {
        return {
            width: this.width,
            height: this.height,
            worldWidth: this.worldWidth,
            worldDepth: this.worldDepth
        };
    }
    
    /**
     * Clears all height data
     */
    public clear(): void {
        this.heights.fill(0);
    }
    
    /**
     * Fills terrain with constant height
     * 
     * @param height - Height value
     */
    public fill(height: number): void {
        this.heights.fill(height);
    }
    
    /**
     * Clones the terrain
     */
    public clone(): Terrain {
        const clone = new Terrain(this.width, this.height, this.worldWidth, this.worldDepth);
        clone.heights.set(this.heights);
        clone.minHeight = this.minHeight;
        clone.maxHeight = this.maxHeight;
        return clone;
    }
}
