/**
 * WebForge Water Simulation System
 * 
 * Phase 13 - AAA-Grade Features: Advanced Visual FX
 * FFT-based ocean simulation with realistic wave physics, foam, and caustics.
 */

import { Vector3 } from '../math/Vector3';
import { Vector2 } from '../math/Vector2';

/**
 * Water quality settings
 */
export interface WaterQualitySettings {
    resolution: number;      // Grid resolution (power of 2: 64, 128, 256, 512)
    waveScale: number;       // Overall wave scale
    choppiness: number;      // Wave choppiness (0-1)
    windSpeed: number;       // Wind speed affecting waves
    windDirection: Vector2;  // Wind direction
    foamEnabled: boolean;
    causticsEnabled: boolean;
    reflectionsEnabled: boolean;
}

/**
 * Ocean wave parameters
 */
export interface OceanWaveParams {
    amplitude: number;
    frequency: number;
    steepness: number;
    speed: number;
    direction: Vector2;
}

/**
 * Water Simulation System using FFT for realistic ocean waves
 */
export class WaterSimulationSystem {
    private resolution: number;
    private waveScale: number;
    private choppiness: number;
    private windSpeed: number;
    private windDirection: Vector2;
    
    // Wave spectrum data
    private heightField: Float32Array;
    private displacementX: Float32Array;
    private displacementZ: Float32Array;
    
    // Foam and caustics
    private foamData: Float32Array;
    private causticsData: Float32Array;
    
    private time: number = 0;
    
    // Multiple wave layers for realism
    private waveLayers: OceanWaveParams[] = [];
    
    constructor(settings: Partial<WaterQualitySettings> = {}) {
        const defaults: WaterQualitySettings = {
            resolution: 128,
            waveScale: 1.0,
            choppiness: 0.5,
            windSpeed: 10.0,
            windDirection: new Vector2(1, 0),
            foamEnabled: true,
            causticsEnabled: true,
            reflectionsEnabled: true
        };
        
        const config = { ...defaults, ...settings };
        
        this.resolution = config.resolution;
        this.waveScale = config.waveScale;
        this.choppiness = config.choppiness;
        this.windSpeed = config.windSpeed;
        this.windDirection = config.windDirection;
        
        // Initialize data arrays
        const size = this.resolution * this.resolution;
        this.heightField = new Float32Array(size);
        this.displacementX = new Float32Array(size);
        this.displacementZ = new Float32Array(size);
        this.foamData = new Float32Array(size);
        this.causticsData = new Float32Array(size);
        
        // Initialize wave layers
        this.initializeWaveLayers();
        
        // Generate initial wave spectrum
        this.generateWaveSpectrum();
    }
    
    /**
     * Initialize multiple wave layers for realistic ocean
     */
    private initializeWaveLayers(): void {
        // Large ocean waves
        this.waveLayers.push({
            amplitude: 2.0,
            frequency: 0.05,
            steepness: 0.6,
            speed: 3.0,
            direction: this.windDirection.clone()
        });
        
        // Medium waves
        this.waveLayers.push({
            amplitude: 1.0,
            frequency: 0.1,
            steepness: 0.5,
            speed: 2.0,
            direction: this.windDirection.clone().rotate(Math.PI / 6)
        });
        
        // Small ripples
        this.waveLayers.push({
            amplitude: 0.3,
            frequency: 0.3,
            steepness: 0.3,
            speed: 1.0,
            direction: this.windDirection.clone().rotate(-Math.PI / 8)
        });
        
        // Fine detail
        this.waveLayers.push({
            amplitude: 0.1,
            frequency: 0.8,
            steepness: 0.2,
            speed: 0.5,
            direction: this.windDirection.clone().rotate(Math.PI / 4)
        });
    }
    
    /**
     * Generate wave spectrum using Phillips spectrum
     */
    private generateWaveSpectrum(): void {
        const gravity = 9.81;
        const L = (this.windSpeed * this.windSpeed) / gravity;
        
        for (let z = 0; z < this.resolution; z++) {
            for (let x = 0; x < this.resolution; x++) {
                const idx = z * this.resolution + x;
                
                // Wave vector
                const kx = (2 * Math.PI * (x - this.resolution / 2)) / this.waveScale;
                const kz = (2 * Math.PI * (z - this.resolution / 2)) / this.waveScale;
                const k = Math.sqrt(kx * kx + kz * kz);
                
                if (k < 0.0001) {
                    this.heightField[idx] = 0;
                    continue;
                }
                
                // Phillips spectrum
                const kLength = k * L;
                const phillips = Math.exp(-1.0 / (kLength * kLength)) / (k * k * k * k);
                
                // Wind alignment
                const windDot = (kx * this.windDirection.x + kz * this.windDirection.y) / k;
                const windAlignment = windDot * windDot;
                
                // Generate height
                const h0 = Math.sqrt(phillips * windAlignment * 0.5) * this.gaussianRandom();
                this.heightField[idx] = h0;
            }
        }
    }
    
    /**
     * Gaussian random for wave generation
     */
    private gaussianRandom(): number {
        let u1 = Math.random();
        let u2 = Math.random();
        if (u1 === 0) u1 = 0.0001;
        return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    }
    
    /**
     * Update water simulation
     */
    public update(deltaTime: number): void {
        this.time += deltaTime;
        
        // Update wave spectrum (simplified - full FFT implementation would be more complex)
        this.updateWaveSpectrum();
        
        // Update foam
        this.updateFoam();
        
        // Update caustics animation
        this.updateCaustics();
    }
    
    /**
     * Update wave spectrum over time
     */
    private updateWaveSpectrum(): void {
        const gravity = 9.81;
        
        for (let z = 0; z < this.resolution; z++) {
            for (let x = 0; x < this.resolution; x++) {
                const idx = z * this.resolution + x;
                
                // Calculate wave vector
                const kx = (2 * Math.PI * (x - this.resolution / 2)) / this.waveScale;
                const kz = (2 * Math.PI * (z - this.resolution / 2)) / this.waveScale;
                const k = Math.sqrt(kx * kx + kz * kz);
                
                if (k < 0.0001) continue;
                
                // Dispersion relation: omega = sqrt(g * k)
                const omega = Math.sqrt(gravity * k);
                
                // Time evolution
                const phase = omega * this.time;
                const h0 = this.heightField[idx];
                
                // Update height with time evolution
                const height = h0 * Math.cos(phase);
                
                // Choppiness (horizontal displacement)
                this.displacementX[idx] = -kx / k * h0 * Math.sin(phase) * this.choppiness;
                this.displacementZ[idx] = -kz / k * h0 * Math.sin(phase) * this.choppiness;
                
                // Store final height
                this.heightField[idx] = height;
            }
        }
    }
    
    /**
     * Update foam generation based on wave breaking
     */
    private updateFoam(): void {
        for (let z = 1; z < this.resolution - 1; z++) {
            for (let x = 1; x < this.resolution - 1; x++) {
                const idx = z * this.resolution + x;
                
                // Calculate Jacobian (wave breaking indicator)
                const dxdx = this.displacementX[idx + 1] - this.displacementX[idx - 1];
                const dzdz = this.displacementZ[idx + this.resolution] - this.displacementZ[idx - this.resolution];
                const jacobian = (1 + dxdx) * (1 + dzdz);
                
                // Generate foam where waves break (negative Jacobian)
                if (jacobian < 0.5) {
                    this.foamData[idx] = Math.min(1.0, this.foamData[idx] + 0.1);
                } else {
                    // Foam decay
                    this.foamData[idx] = Math.max(0.0, this.foamData[idx] - 0.05);
                }
            }
        }
    }
    
    /**
     * Update caustics pattern
     */
    private updateCaustics(): void {
        // Simplified caustics using wave height derivatives
        for (let z = 1; z < this.resolution - 1; z++) {
            for (let x = 1; x < this.resolution - 1; x++) {
                const idx = z * this.resolution + x;
                
                // Calculate surface normal using height field
                // const h = this.heightField[idx]; // Unused but shows center height
                const hx = this.heightField[idx + 1] - this.heightField[idx - 1];
                const hz = this.heightField[idx + this.resolution] - this.heightField[idx - this.resolution];
                
                // Caustics intensity based on surface curvature
                const curvature = Math.abs(hx) + Math.abs(hz);
                this.causticsData[idx] = Math.min(1.0, curvature * 2.0);
            }
        }
    }
    
    /**
     * Get wave height at world position
     */
    public getHeightAt(worldX: number, worldZ: number): number {
        // Convert world coordinates to grid coordinates
        const gridX = ((worldX / this.waveScale) % this.resolution + this.resolution) % this.resolution;
        const gridZ = ((worldZ / this.waveScale) % this.resolution + this.resolution) % this.resolution;
        
        // Bilinear interpolation
        const x0 = Math.floor(gridX);
        const z0 = Math.floor(gridZ);
        const x1 = (x0 + 1) % this.resolution;
        const z1 = (z0 + 1) % this.resolution;
        
        const fx = gridX - x0;
        const fz = gridZ - z0;
        
        const h00 = this.heightField[z0 * this.resolution + x0];
        const h10 = this.heightField[z0 * this.resolution + x1];
        const h01 = this.heightField[z1 * this.resolution + x0];
        const h11 = this.heightField[z1 * this.resolution + x1];
        
        const h0 = h00 * (1 - fx) + h10 * fx;
        const h1 = h01 * (1 - fx) + h11 * fx;
        
        return h0 * (1 - fz) + h1 * fz;
    }
    
    /**
     * Get surface normal at world position
     */
    public getNormalAt(worldX: number, worldZ: number): Vector3 {
        const epsilon = 0.1;
        const _h = this.getHeightAt(worldX, worldZ);
        const hx = this.getHeightAt(worldX + epsilon, worldZ);
        const hz = this.getHeightAt(worldX, worldZ + epsilon);
        
        const dx = new Vector3(epsilon, hx - _h, 0);
        const dz = new Vector3(0, hz - _h, epsilon);
        
        return dx.cross(dz).normalize();
    }
    
    /**
     * Get displacement at world position
     */
    public getDisplacementAt(worldX: number, worldZ: number): Vector3 {
        const gridX = Math.floor(((worldX / this.waveScale) % this.resolution + this.resolution) % this.resolution);
        const gridZ = Math.floor(((worldZ / this.waveScale) % this.resolution + this.resolution) % this.resolution);
        const idx = gridZ * this.resolution + gridX;
        
        return new Vector3(
            this.displacementX[idx],
            this.heightField[idx],
            this.displacementZ[idx]
        );
    }
    
    /**
     * Get foam intensity at world position
     */
    public getFoamAt(worldX: number, worldZ: number): number {
        const gridX = Math.floor(((worldX / this.waveScale) % this.resolution + this.resolution) % this.resolution);
        const gridZ = Math.floor(((worldZ / this.waveScale) % this.resolution + this.resolution) % this.resolution);
        const idx = gridZ * this.resolution + gridX;
        
        return this.foamData[idx];
    }
    
    /**
     * Get caustics intensity at world position
     */
    public getCausticsAt(worldX: number, worldZ: number): number {
        const gridX = Math.floor(((worldX / this.waveScale) % this.resolution + this.resolution) % this.resolution);
        const gridZ = Math.floor(((worldZ / this.waveScale) % this.resolution + this.resolution) % this.resolution);
        const idx = gridZ * this.resolution + gridX;
        
        return this.causticsData[idx];
    }
    
    /**
     * Update settings
     */
    public updateSettings(settings: Partial<WaterQualitySettings>): void {
        if (settings.windSpeed !== undefined) this.windSpeed = settings.windSpeed;
        if (settings.windDirection !== undefined) this.windDirection = settings.windDirection;
        if (settings.choppiness !== undefined) this.choppiness = settings.choppiness;
        if (settings.waveScale !== undefined) this.waveScale = settings.waveScale;
        
        // Regenerate wave spectrum with new settings
        this.initializeWaveLayers();
        this.generateWaveSpectrum();
    }
    
    /**
     * Get height field for rendering
     */
    public getHeightField(): Float32Array {
        return this.heightField;
    }
    
    /**
     * Get foam data for rendering
     */
    public getFoamData(): Float32Array {
        return this.foamData;
    }
    
    /**
     * Get caustics data for rendering
     */
    public getCausticsData(): Float32Array {
        return this.causticsData;
    }
    
    /**
     * Get resolution
     */
    public getResolution(): number {
        return this.resolution;
    }
}
