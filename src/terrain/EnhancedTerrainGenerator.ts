/**
 * WebForge Enhanced Terrain Generation
 * 
 * High-quality, realistic terrain generation with advanced features including
 * hydraulic erosion, thermal erosion, biomes, and vegetation placement.
 */

import { NoiseGenerator } from '../procedural/NoiseGenerator';

/**
 * Biome types for terrain
 */
export enum BiomeType {
    OCEAN = 'ocean',
    BEACH = 'beach',
    PLAINS = 'plains',
    FOREST = 'forest',
    DESERT = 'desert',
    TUNDRA = 'tundra',
    MOUNTAIN = 'mountain',
    SNOW_PEAK = 'snow_peak'
}

/**
 * Terrain generation parameters
 */
export interface TerrainGenerationParams {
    seed: number;
    width: number;
    depth: number;
    heightScale: number;
    waterLevel: number;
    erosionIterations: number;
    generateBiomes: boolean;
    thermalErosion: boolean;
    hydraulicErosion: boolean;
}

/**
 * Enhanced terrain generator with realistic features
 */
export class EnhancedTerrainGenerator {
    private noise: NoiseGenerator;
    private params: TerrainGenerationParams;
    
    constructor(params: Partial<TerrainGenerationParams> = {}) {
        this.params = {
            seed: 0,
            width: 256,
            depth: 256,
            heightScale: 100,
            waterLevel: 0.3,
            erosionIterations: 50,
            generateBiomes: true,
            thermalErosion: true,
            hydraulicErosion: true,
            ...params
        };
        
        this.noise = new NoiseGenerator(this.params.seed);
    }
    
    /**
     * Generate realistic terrain heightmap with erosion and biomes
     */
    public generateRealisticTerrain(): {
        heightmap: Float32Array,
        biomes: Uint8Array,
        moisture: Float32Array,
        temperature: Float32Array
    } {
        const size = this.params.width * this.params.depth;
        const heightmap = new Float32Array(size);
        const biomes = new Uint8Array(size);
        const moisture = new Float32Array(size);
        const temperature = new Float32Array(size);
        
        // Step 1: Generate base terrain with multiple noise octaves
        console.log('Generating base terrain...');
        this.generateBaseHeightmap(heightmap);
        
        // Step 2: Apply hydraulic erosion for realistic water flow
        if (this.params.hydraulicErosion) {
            console.log('Applying hydraulic erosion...');
            this.applyHydraulicErosion(heightmap, this.params.erosionIterations);
        }
        
        // Step 3: Apply thermal erosion for realistic weathering
        if (this.params.thermalErosion) {
            console.log('Applying thermal erosion...');
            this.applyThermalErosion(heightmap, this.params.erosionIterations / 2);
        }
        
        // Step 4: Generate climate maps
        if (this.params.generateBiomes) {
            console.log('Generating climate data...');
            this.generateClimateData(heightmap, moisture, temperature);
            
            // Step 5: Assign biomes based on height, moisture, and temperature
            console.log('Assigning biomes...');
            this.assignBiomes(heightmap, moisture, temperature, biomes);
        }
        
        console.log('Terrain generation complete');
        
        return { heightmap, biomes, moisture, temperature };
    }
    
    /**
     * Generate base heightmap using multi-octave noise
     */
    private generateBaseHeightmap(heightmap: Float32Array): void {
        const { width, depth, heightScale } = this.params;
        
        for (let z = 0; z < depth; z++) {
            for (let x = 0; x < width; x++) {
                const nx = x / width;
                const nz = z / depth;
                
                // Continental scale (large landmasses)
                const continental = this.noise.fbm2D(nx * 1, nz * 1, 3, 0.5, 2.0);
                
                // Regional features (hills and valleys)
                const regional = this.noise.fbm2D(nx * 4, nz * 4, 4, 0.6, 2.1);
                
                // Local detail (small terrain features)
                const local = this.noise.fbm2D(nx * 16, nz * 16, 4, 0.5, 2.2);
                
                // Mountain ridges
                const ridgeNoise = Math.abs(this.noise.perlin2D(nx * 8, nz * 8));
                const ridges = 1.0 - ridgeNoise;
                
                // Combine layers with realistic weighting
                let height = continental * 0.5 +
                           regional * 0.3 +
                           local * 0.15 +
                           Math.pow(ridges, 3) * 0.2;
                
                // Apply height curve for more natural distribution
                height = Math.pow(height, 1.3);
                
                const idx = z * width + x;
                heightmap[idx] = height * heightScale;
            }
        }
    }
    
    /**
     * Apply hydraulic erosion simulation
     * Simulates water flow and sediment transport for realistic erosion
     */
    private applyHydraulicErosion(heightmap: Float32Array, iterations: number): void {
        const { width, depth } = this.params;
        const waterMap = new Float32Array(width * depth);
        const sedimentMap = new Float32Array(width * depth);
        
        // Erosion parameters
        const rainRate = 0.01;
        const evaporationRate = 0.5;
        const sedimentCapacity = 0.1;
        const depositionRate = 0.3;
        const erosionRate = 0.3;
        
        for (let iter = 0; iter < iterations; iter++) {
            // Add rain
            for (let i = 0; i < waterMap.length; i++) {
                waterMap[i] += rainRate;
            }
            
            // Simulate water flow
            for (let z = 1; z < depth - 1; z++) {
                for (let x = 1; x < width - 1; x++) {
                    const idx = z * width + x;
                    const height = heightmap[idx];
                    const water = waterMap[idx];
                    
                    if (water < 0.01) continue;
                    
                    // Find steepest descent
                    let lowestIdx = idx;
                    let lowestHeight = height + water;
                    
                    const neighbors = [
                        { dx: -1, dz: 0 },
                        { dx: 1, dz: 0 },
                        { dx: 0, dz: -1 },
                        { dx: 0, dz: 1 }
                    ];
                    
                    for (const { dx, dz } of neighbors) {
                        const nx = x + dx;
                        const nz = z + dz;
                        const nidx = nz * width + nx;
                        const nheight = heightmap[nidx] + waterMap[nidx];
                        
                        if (nheight < lowestHeight) {
                            lowestHeight = nheight;
                            lowestIdx = nidx;
                        }
                    }
                    
                    // Move water and sediment
                    if (lowestIdx !== idx) {
                        const heightDiff = (height + water) - lowestHeight;
                        const waterMove = Math.min(water, heightDiff) * 0.5;
                        
                        waterMap[idx] -= waterMove;
                        waterMap[lowestIdx] += waterMove;
                        
                        // Erosion and deposition
                        const capacity = waterMove * sedimentCapacity * heightDiff;
                        const sediment = sedimentMap[idx];
                        
                        if (sediment < capacity) {
                            // Erode
                            const eroded = Math.min(heightDiff, capacity - sediment) * erosionRate;
                            heightmap[idx] -= eroded;
                            sedimentMap[idx] += eroded;
                        } else {
                            // Deposit
                            const deposited = (sediment - capacity) * depositionRate;
                            heightmap[idx] += deposited;
                            sedimentMap[idx] -= deposited;
                        }
                        
                        // Move sediment with water
                        const sedimentMove = sediment * (waterMove / water);
                        sedimentMap[idx] -= sedimentMove;
                        sedimentMap[lowestIdx] += sedimentMove;
                    }
                }
            }
            
            // Evaporation
            for (let i = 0; i < waterMap.length; i++) {
                waterMap[i] *= (1.0 - evaporationRate);
            }
        }
    }
    
    /**
     * Apply thermal erosion (talus slope simulation)
     * Simulates material sliding down steep slopes
     */
    private applyThermalErosion(heightmap: Float32Array, iterations: number): void {
        const { width, depth } = this.params;
        const talusAngle = 0.7; // Maximum stable slope (radians)
        const erosionRate = 0.5;
        
        for (let iter = 0; iter < iterations; iter++) {
            const changes = new Float32Array(width * depth);
            
            for (let z = 1; z < depth - 1; z++) {
                for (let x = 1; x < width - 1; x++) {
                    const idx = z * width + x;
                    const height = heightmap[idx];
                    
                    // Check all neighbors
                    const neighbors = [
                        { dx: -1, dz: 0 },
                        { dx: 1, dz: 0 },
                        { dx: 0, dz: -1 },
                        { dx: 0, dz: 1 }
                    ];
                    
                    for (const { dx, dz } of neighbors) {
                        const nx = x + dx;
                        const nz = z + dz;
                        const nidx = nz * width + nx;
                        const nheight = heightmap[nidx];
                        
                        const heightDiff = height - nheight;
                        
                        // If slope exceeds talus angle, erode
                        if (heightDiff > talusAngle) {
                            const amount = (heightDiff - talusAngle) * erosionRate * 0.25;
                            changes[idx] -= amount;
                            changes[nidx] += amount;
                        }
                    }
                }
            }
            
            // Apply changes
            for (let i = 0; i < heightmap.length; i++) {
                heightmap[i] += changes[i];
            }
        }
    }
    
    /**
     * Generate climate data (moisture and temperature)
     */
    private generateClimateData(
        heightmap: Float32Array,
        moisture: Float32Array,
        temperature: Float32Array
    ): void {
        const { width, depth, heightScale } = this.params;
        
        for (let z = 0; z < depth; z++) {
            for (let x = 0; x < width; x++) {
                const idx = z * width + x;
                const nx = x / width;
                const nz = z / depth;
                const height = heightmap[idx];
                
                // Moisture based on noise and height
                const baseMoisture = this.noise.fbm2D(nx * 3 + 1000, nz * 3 + 1000, 4, 0.5, 2.0);
                // Lower altitude = more moisture (near water sources)
                const heightFactor = Math.max(0, 1.0 - (height / heightScale));
                moisture[idx] = baseMoisture * 0.7 + heightFactor * 0.3;
                
                // Temperature based on latitude (z) and altitude
                const latitude = Math.abs(nz - 0.5) * 2; // 0 at equator, 1 at poles
                const baseTemp = 1.0 - latitude * 0.7;
                const altitudeCooling = Math.min(1.0, height / (heightScale * 0.7));
                temperature[idx] = Math.max(0, baseTemp - altitudeCooling * 0.6);
            }
        }
    }
    
    /**
     * Assign biomes based on height, moisture, and temperature
     */
    private assignBiomes(
        heightmap: Float32Array,
        moisture: Float32Array,
        temperature: Float32Array,
        biomes: Uint8Array
    ): void {
        const { heightScale, waterLevel } = this.params;
        
        for (let i = 0; i < heightmap.length; i++) {
            const height = heightmap[i] / heightScale;
            const moist = moisture[i];
            const temp = temperature[i];
            
            let biome: BiomeType;
            
            // Water biomes
            if (height < waterLevel) {
                biome = BiomeType.OCEAN;
            }
            // Beach
            else if (height < waterLevel + 0.05) {
                biome = BiomeType.BEACH;
            }
            // Mountain peaks
            else if (height > 0.7) {
                if (temp < 0.3) {
                    biome = BiomeType.SNOW_PEAK;
                } else {
                    biome = BiomeType.MOUNTAIN;
                }
            }
            // High altitude
            else if (height > 0.5) {
                if (temp < 0.4) {
                    biome = BiomeType.TUNDRA;
                } else if (moist > 0.5) {
                    biome = BiomeType.FOREST;
                } else {
                    biome = BiomeType.MOUNTAIN;
                }
            }
            // Mid altitude
            else {
                if (temp < 0.3) {
                    biome = BiomeType.TUNDRA;
                } else if (temp > 0.7 && moist < 0.3) {
                    biome = BiomeType.DESERT;
                } else if (moist > 0.6) {
                    biome = BiomeType.FOREST;
                } else {
                    biome = BiomeType.PLAINS;
                }
            }
            
            biomes[i] = this.biomeToIndex(biome);
        }
    }
    
    /**
     * Convert biome enum to index
     */
    private biomeToIndex(biome: BiomeType): number {
        const mapping: Record<BiomeType, number> = {
            [BiomeType.OCEAN]: 0,
            [BiomeType.BEACH]: 1,
            [BiomeType.PLAINS]: 2,
            [BiomeType.FOREST]: 3,
            [BiomeType.DESERT]: 4,
            [BiomeType.TUNDRA]: 5,
            [BiomeType.MOUNTAIN]: 6,
            [BiomeType.SNOW_PEAK]: 7
        };
        return mapping[biome];
    }
    
    /**
     * Get biome color for visualization
     */
    public static getBiomeColor(biomeIndex: number): { r: number, g: number, b: number } {
        const colors = [
            { r: 0.2, g: 0.3, b: 0.7 },   // Ocean - blue
            { r: 0.9, g: 0.85, b: 0.6 },  // Beach - sand
            { r: 0.5, g: 0.7, b: 0.3 },   // Plains - green
            { r: 0.2, g: 0.5, b: 0.2 },   // Forest - dark green
            { r: 0.9, g: 0.8, b: 0.5 },   // Desert - tan
            { r: 0.7, g: 0.8, b: 0.8 },   // Tundra - grey-white
            { r: 0.6, g: 0.6, b: 0.6 },   // Mountain - grey
            { r: 0.95, g: 0.95, b: 1.0 }  // Snow Peak - white
        ];
        return colors[biomeIndex] || colors[0];
    }
}
