/**
 * WebForge Advanced VFX System
 * 
 * Phase 13 - AAA-Grade Features: Advanced Visual FX
 * Volumetric fog, atmospheric scattering, god rays, and advanced particle effects.
 */

import { Vector3 } from '../math/Vector3';

/**
 * Volumetric fog settings
 */
export interface VolumetricFogSettings {
    enabled: boolean;
    density: number;        // 0-1
    height: number;         // Fog height falloff start
    heightFalloff: number;  // Falloff rate
    color: { r: number; g: number; b: number };
    scattering: number;     // Light scattering amount
    absorption: number;     // Light absorption
    anisotropy: number;     // -1 to 1 (directional scattering)
}

/**
 * Atmospheric scattering settings
 */
export interface AtmosphericSettings {
    enabled: boolean;
    sunDirection: Vector3;
    rayleighScattering: Vector3;  // RGB wavelength-dependent scattering
    mieScattering: number;
    rayleighScale: number;
    mieScale: number;
    planetRadius: number;
    atmosphereRadius: number;
}

/**
 * God rays (volumetric lighting) settings
 */
export interface GodRaysSettings {
    enabled: boolean;
    lightSource: Vector3;     // Position of light source
    intensity: number;        // 0-1
    decay: number;            // Light decay rate
    samples: number;          // Ray march samples (8-64)
    density: number;          // Ray density
}

/**
 * Advanced VFX System - Part of Phase 13 AAA-Grade Features
 */
export class AdvancedVFXSystem {
    private volumetricFog: VolumetricFogSettings;
    private atmospheric: AtmosphericSettings;
    private godRays: GodRaysSettings;
    
    private time: number = 0;
    
    constructor() {
        // Default volumetric fog
        this.volumetricFog = {
            enabled: false,
            density: 0.01,
            height: 10.0,
            heightFalloff: 0.5,
            color: { r: 0.8, g: 0.85, b: 0.9 },
            scattering: 0.5,
            absorption: 0.3,
            anisotropy: 0.3
        };
        
        // Default atmospheric scattering
        this.atmospheric = {
            enabled: true,
            sunDirection: new Vector3(0.5, 0.8, 0.3).normalize(),
            rayleighScattering: new Vector3(5.8, 13.5, 33.1),  // Wavelength-dependent
            mieScattering: 21.0,
            rayleighScale: 8.0,
            mieScale: 1.2,
            planetRadius: 6371000,      // Earth radius in meters
            atmosphereRadius: 6471000    // +100km atmosphere
        };
        
        // Default god rays
        this.godRays = {
            enabled: false,
            lightSource: new Vector3(0, 100, 0),
            intensity: 1.0,
            decay: 0.95,
            samples: 32,
            density: 0.5
        };
    }
    
    /**
     * Update VFX system
     */
    public update(deltaTime: number): void {
        this.time += deltaTime;
        
        // Animate volumetric fog
        if (this.volumetricFog.enabled) {
            this.animateVolumetricFog(deltaTime);
        }
        
        // Update atmospheric scattering based on sun position
        if (this.atmospheric.enabled) {
            this.animateAtmospheric(deltaTime);
        }
    }
    
    /**
     * Animate volumetric fog
     */
    private animateVolumetricFog(_deltaTime: number): void {
        // Fog can be animated here (e.g., density pulsing, movement)
    }
    
    /**
     * Animate atmospheric scattering
     */
    private animateAtmospheric(_deltaTime: number): void {
        // Sun movement can be updated here
    }
    
    /**
     * Enable volumetric fog
     */
    public enableVolumetricFog(settings: Partial<VolumetricFogSettings> = {}): void {
        this.volumetricFog = { ...this.volumetricFog, enabled: true, ...settings };
    }
    
    /**
     * Disable volumetric fog
     */
    public disableVolumetricFog(): void {
        this.volumetricFog.enabled = false;
    }
    
    /**
     * Update volumetric fog settings
     */
    public updateVolumetricFog(settings: Partial<VolumetricFogSettings>): void {
        this.volumetricFog = { ...this.volumetricFog, ...settings };
    }
    
    /**
     * Enable atmospheric scattering
     */
    public enableAtmospheric(settings: Partial<AtmosphericSettings> = {}): void {
        this.atmospheric = { ...this.atmospheric, enabled: true, ...settings };
    }
    
    /**
     * Disable atmospheric scattering
     */
    public disableAtmospheric(): void {
        this.atmospheric.enabled = false;
    }
    
    /**
     * Update atmospheric settings
     */
    public updateAtmospheric(settings: Partial<AtmosphericSettings>): void {
        this.atmospheric = { ...this.atmospheric, ...settings };
    }
    
    /**
     * Enable god rays (volumetric lighting)
     */
    public enableGodRays(settings: Partial<GodRaysSettings> = {}): void {
        this.godRays = { ...this.godRays, enabled: true, ...settings };
    }
    
    /**
     * Disable god rays
     */
    public disableGodRays(): void {
        this.godRays.enabled = false;
    }
    
    /**
     * Update god rays settings
     */
    public updateGodRays(settings: Partial<GodRaysSettings>): void {
        this.godRays = { ...this.godRays, ...settings };
    }
    
    /**
     * Calculate fog density at world position
     */
    public getFogDensityAt(position: Vector3): number {
        if (!this.volumetricFog.enabled) return 0;
        
        const heightFactor = Math.exp(-Math.max(0, position.y - this.volumetricFog.height) * this.volumetricFog.heightFalloff);
        return this.volumetricFog.density * heightFactor;
    }
    
    /**
     * Calculate atmospheric color at view direction
     */
    public getAtmosphericColor(viewDirection: Vector3, _sunIntensity: number = 1.0): { r: number; g: number; b: number } {
        if (!this.atmospheric.enabled) {
            return { r: 0, g: 0, b: 0 };
        }
        
        const cosTheta = viewDirection.dot(this.atmospheric.sunDirection);
        
        // Rayleigh scattering (blue sky)
        const rayleighPhase = (3.0 / (16.0 * Math.PI)) * (1.0 + cosTheta * cosTheta);
        
        // Mie scattering (sunset/haze)
        const g = 0.76;  // Anisotropy factor
        const g2 = g * g;
        const miePhase = (3.0 / (8.0 * Math.PI)) * ((1.0 - g2) * (1.0 + cosTheta * cosTheta)) / 
                        (Math.pow(1.0 + g2 - 2.0 * g * cosTheta, 1.5) * (2.0 + g2));
        
        // Combine scattering
        const r = this.atmospheric.rayleighScattering;
        const rayleighColor = {
            r: r.x * rayleighPhase * this.atmospheric.rayleighScale,
            g: r.y * rayleighPhase * this.atmospheric.rayleighScale,
            b: r.z * rayleighPhase * this.atmospheric.rayleighScale
        };
        
        const mieColor = {
            r: this.atmospheric.mieScattering * miePhase * this.atmospheric.mieScale,
            g: this.atmospheric.mieScattering * miePhase * this.atmospheric.mieScale,
            b: this.atmospheric.mieScattering * miePhase * this.atmospheric.mieScale
        };
        
        return {
            r: rayleighColor.r + mieColor.r,
            g: rayleighColor.g + mieColor.g,
            b: rayleighColor.b + mieColor.b
        };
    }
    
    /**
     * Calculate god ray contribution at screen position
     */
    public getGodRayIntensity(_screenPosition: Vector2, _lightScreenPosition: Vector2): number {
        if (!this.godRays.enabled) return 0;
        
        // Simplified god ray calculation
        return this.godRays.intensity * this.godRays.density;
    }
    
    /**
     * Get volumetric fog settings
     */
    public getVolumetricFogSettings(): VolumetricFogSettings {
        return { ...this.volumetricFog };
    }
    
    /**
     * Get atmospheric settings
     */
    public getAtmosphericSettings(): AtmosphericSettings {
        return { ...this.atmospheric };
    }
    
    /**
     * Get god rays settings
     */
    public getGodRaysSettings(): GodRaysSettings {
        return { ...this.godRays };
    }
    
    /**
     * Set sun direction for atmospheric scattering
     */
    public setSunDirection(direction: Vector3): void {
        this.atmospheric.sunDirection = direction.normalize();
    }
    
    /**
     * Get sun direction
     */
    public getSunDirection(): Vector3 {
        return this.atmospheric.sunDirection.clone();
    }
    
    /**
     * Preset: Clear sky
     */
    public presetClearSky(): void {
        this.disableVolumetricFog();
        this.enableAtmospheric({
            rayleighScattering: new Vector3(5.8, 13.5, 33.1),
            mieScattering: 21.0,
            rayleighScale: 8.0,
            mieScale: 1.2
        });
        this.disableGodRays();
    }
    
    /**
     * Preset: Foggy
     */
    public presetFoggy(): void {
        this.enableVolumetricFog({
            density: 0.05,
            height: 0,
            heightFalloff: 0.1,
            color: { r: 0.7, g: 0.75, b: 0.8 }
        });
        this.enableAtmospheric({
            rayleighScale: 2.0,
            mieScale: 5.0
        });
    }
    
    /**
     * Preset: Sunset
     */
    public presetSunset(): void {
        this.enableVolumetricFog({
            density: 0.02,
            height: 5,
            heightFalloff: 0.3,
            color: { r: 1.0, g: 0.6, b: 0.3 }
        });
        this.enableAtmospheric({
            rayleighScattering: new Vector3(4.0, 8.0, 15.0),
            mieScattering: 40.0,
            rayleighScale: 3.0,
            mieScale: 8.0
        });
        this.enableGodRays({
            intensity: 0.8,
            decay: 0.95,
            samples: 32
        });
    }
    
    /**
     * Preset: Stormy
     */
    public presetStormy(): void {
        this.enableVolumetricFog({
            density: 0.08,
            height: 20,
            heightFalloff: 0.2,
            color: { r: 0.3, g: 0.3, b: 0.35 }
        });
        this.enableAtmospheric({
            rayleighScale: 1.0,
            mieScale: 10.0
        });
        this.disableGodRays();
    }
}

/**
 * Vector2 for screen space calculations
 */
class Vector2 {
    constructor(public x: number = 0, public y: number = 0) {}
}
