/**
 * WebForge Weather System
 * 
 * Phase 13 - AAA-Grade Features: Advanced Visual FX
 * Comprehensive weather simulation with rain, snow, fog, wind, and dynamic conditions.
 */

import { Vector3 } from '../math/Vector3';
import { ParticleEmitter } from '../particles/ParticleEmitter';
import { ParticleSystem } from '../particles/ParticleSystem';

/**
 * Weather types
 */
export enum WeatherType {
    CLEAR = 'clear',
    CLOUDY = 'cloudy',
    RAINY = 'rainy',
    STORMY = 'stormy',
    SNOWY = 'snowy',
    FOGGY = 'foggy',
    WINDY = 'windy'
}

/**
 * Weather intensity levels
 */
export enum WeatherIntensity {
    LIGHT = 'light',
    MODERATE = 'moderate',
    HEAVY = 'heavy',
    EXTREME = 'extreme'
}

/**
 * Weather configuration
 */
export interface WeatherConfig {
    type: WeatherType;
    intensity: WeatherIntensity;
    windDirection: Vector3;
    windSpeed: number;
    temperature: number;
    humidity: number;
    visibility: number;
    precipitation: number;
}

/**
 * Weather System - Part of Phase 13 AAA-Grade Features
 * Implements realistic weather simulation for professional games
 */
export class WeatherSystem {
    private currentWeather: WeatherConfig;
    private targetWeather: WeatherConfig | null = null;
    private transitionProgress: number = 0;
    private transitionDuration: number = 0;
    
    private particleSystem: ParticleSystem;
    private rainEmitter: ParticleEmitter | null = null;
    private snowEmitter: ParticleEmitter | null = null;
    
    private fogDensity: number = 0;
    private cloudCoverage: number = 0;
    private lightingIntensity: number = 1;
    
    // @ts-expect-error - Stored for future area-based weather effects
    private _weatherCenter: Vector3;
    
    constructor(particleSystem: ParticleSystem, center: Vector3 = new Vector3(0, 0, 0), _radius: number = 100) {
        this.particleSystem = particleSystem;
        this._weatherCenter = center;
        
        this.currentWeather = {
            type: WeatherType.CLEAR,
            intensity: WeatherIntensity.LIGHT,
            windDirection: new Vector3(1, 0, 0),
            windSpeed: 2.0,
            temperature: 20,
            humidity: 0.5,
            visibility: 1000,
            precipitation: 0
        };
    }
    
    /**
     * Set weather type with auto-configuration
     */
    public setWeatherType(type: WeatherType, intensity: WeatherIntensity = WeatherIntensity.MODERATE): void {
        const config = this.getDefaultConfig(type, intensity);
        this.currentWeather = config;
        this.updateEffects();
    }
    
    /**
     * Transition to new weather over time
     */
    public transitionTo(type: WeatherType, intensity: WeatherIntensity, duration: number = 5): void {
        this.targetWeather = this.getDefaultConfig(type, intensity);
        this.transitionDuration = duration;
        this.transitionProgress = 0;
    }
    
    /**
     * Update weather system
     */
    public update(deltaTime: number): void {
        if (this.targetWeather) {
            this.transitionProgress += deltaTime / this.transitionDuration;
            
            if (this.transitionProgress >= 1.0) {
                this.currentWeather = this.targetWeather;
                this.targetWeather = null;
                this.transitionProgress = 0;
            } else {
                const t = this.smoothStep(this.transitionProgress);
                this.currentWeather = this.interpolate(this.currentWeather, this.targetWeather, t);
            }
            
            this.updateEffects();
        }
    }
    
    /**
     * Get default configuration for weather type
     */
    private getDefaultConfig(type: WeatherType, intensity: WeatherIntensity): WeatherConfig {
        const mult = this.getIntensityMultiplier(intensity);
        
        const configs: Record<WeatherType, Omit<WeatherConfig, 'intensity'>> = {
            [WeatherType.CLEAR]: {
                type, windDirection: new Vector3(1, 0, 0), windSpeed: 2 * mult,
                temperature: 22, humidity: 0.4, visibility: 1000, precipitation: 0
            },
            [WeatherType.CLOUDY]: {
                type, windDirection: new Vector3(1, 0, 0.5), windSpeed: 5 * mult,
                temperature: 18, humidity: 0.6, visibility: 800, precipitation: 0
            },
            [WeatherType.RAINY]: {
                type, windDirection: new Vector3(0.8, -0.2, 0.4), windSpeed: 8 * mult,
                temperature: 15, humidity: 0.9, visibility: 500, precipitation: 0.6 * mult
            },
            [WeatherType.STORMY]: {
                type, windDirection: new Vector3(0.6, -0.3, 0.7), windSpeed: 15 * mult,
                temperature: 12, humidity: 0.95, visibility: 300, precipitation: 0.9 * mult
            },
            [WeatherType.SNOWY]: {
                type, windDirection: new Vector3(0.9, -0.1, 0.3), windSpeed: 6 * mult,
                temperature: -2, humidity: 0.8, visibility: 400, precipitation: 0.5 * mult
            },
            [WeatherType.FOGGY]: {
                type, windDirection: new Vector3(0.5, 0, 0.5), windSpeed: 1 * mult,
                temperature: 10, humidity: 0.95, visibility: 50 + (200 * (1 - mult)), precipitation: 0.1 * mult
            },
            [WeatherType.WINDY]: {
                type, windDirection: new Vector3(1, 0, 0.2), windSpeed: 20 * mult,
                temperature: 16, humidity: 0.5, visibility: 900, precipitation: 0
            }
        };
        
        return { ...configs[type], intensity };
    }
    
    private getIntensityMultiplier(intensity: WeatherIntensity): number {
        return { light: 0.5, moderate: 1.0, heavy: 1.5, extreme: 2.0 }[intensity];
    }
    
    private smoothStep(t: number): number {
        return t * t * (3 - 2 * t);
    }
    
    private interpolate(from: WeatherConfig, to: WeatherConfig, t: number): WeatherConfig {
        return {
            type: t < 0.5 ? from.type : to.type,
            intensity: t < 0.5 ? from.intensity : to.intensity,
            windDirection: from.windDirection.lerp(to.windDirection, t),
            windSpeed: from.windSpeed + (to.windSpeed - from.windSpeed) * t,
            temperature: from.temperature + (to.temperature - from.temperature) * t,
            humidity: from.humidity + (to.humidity - from.humidity) * t,
            visibility: from.visibility + (to.visibility - from.visibility) * t,
            precipitation: from.precipitation + (to.precipitation - from.precipitation) * t
        };
    }
    
    private updateEffects(): void {
        this.fogDensity = this.calculateFogDensity();
        this.cloudCoverage = this.calculateCloudCoverage();
        this.lightingIntensity = this.calculateLightingIntensity();
        this.updatePrecipitation();
    }
    
    private calculateFogDensity(): number {
        let density = 0;
        if (this.currentWeather.type === WeatherType.FOGGY) {
            density = 0.02 + (0.03 * this.getIntensityMultiplier(this.currentWeather.intensity));
        } else if ([WeatherType.RAINY, WeatherType.STORMY].includes(this.currentWeather.type)) {
            density = 0.005 * this.currentWeather.precipitation;
        }
        density += (1 - (this.currentWeather.visibility / 1000)) * 0.01;
        return Math.min(density, 0.1);
    }
    
    private calculateCloudCoverage(): number {
        const coverage: Record<WeatherType, number> = {
            [WeatherType.CLEAR]: 0.1, [WeatherType.CLOUDY]: 0.7, [WeatherType.RAINY]: 0.9,
            [WeatherType.STORMY]: 1.0, [WeatherType.SNOWY]: 0.85, [WeatherType.FOGGY]: 0.8,
            [WeatherType.WINDY]: 0.4
        };
        return coverage[this.currentWeather.type];
    }
    
    private calculateLightingIntensity(): number {
        const intensity: Record<WeatherType, number> = {
            [WeatherType.CLEAR]: 1.0, [WeatherType.CLOUDY]: 0.7, [WeatherType.RAINY]: 0.5,
            [WeatherType.STORMY]: 0.3, [WeatherType.SNOWY]: 0.8, [WeatherType.FOGGY]: 0.4,
            [WeatherType.WINDY]: 0.9
        };
        return intensity[this.currentWeather.type];
    }
    
    private updatePrecipitation(): void {
        if (this.rainEmitter) {
            this.particleSystem.removeEmitter('weather_rain');
            this.rainEmitter = null;
        }
        if (this.snowEmitter) {
            this.particleSystem.removeEmitter('weather_snow');
            this.snowEmitter = null;
        }
        
        if (this.currentWeather.precipitation > 0.1) {
            if (this.currentWeather.temperature > 2) {
                this.rainEmitter = this.createRainEmitter();
                this.particleSystem.addEmitter('weather_rain', this.rainEmitter);
            } else {
                this.snowEmitter = this.createSnowEmitter();
                this.particleSystem.addEmitter('weather_snow', this.snowEmitter);
            }
        }
    }
    
    private createRainEmitter(): ParticleEmitter {
        const w = this.currentWeather;
        return new ParticleEmitter({
            rate: 100 * w.precipitation,
            maxParticles: 500,
            shape: 'box',
            shapeParams: { width: 50, height: 10, depth: 50 },
            lifetime: [1.5, 2.5],
            velocity: {
                min: new Vector3(w.windDirection.x * w.windSpeed * 0.3, -25 - (w.precipitation * 10), w.windDirection.z * w.windSpeed * 0.3),
                max: new Vector3(w.windDirection.x * w.windSpeed * 0.7, -15 - (w.precipitation * 10), w.windDirection.z * w.windSpeed * 0.7)
            },
            size: [0.05, 0.1],
            loop: true
        });
    }
    
    private createSnowEmitter(): ParticleEmitter {
        const w = this.currentWeather;
        return new ParticleEmitter({
            rate: 50 * w.precipitation,
            maxParticles: 300,
            shape: 'box',
            shapeParams: { width: 50, height: 10, depth: 50 },
            lifetime: [4.0, 6.0],
            velocity: {
                min: new Vector3(w.windDirection.x * w.windSpeed * 0.2, -6 - (w.precipitation * 3), w.windDirection.z * w.windSpeed * 0.2),
                max: new Vector3(w.windDirection.x * w.windSpeed * 0.4, -4 - (w.precipitation * 3), w.windDirection.z * w.windSpeed * 0.4)
            },
            size: [0.1, 0.2],
            loop: true
        });
    }
    
    public getCurrentWeather(): WeatherConfig { return { ...this.currentWeather }; }
    public getFogDensity(): number { return this.fogDensity; }
    public getCloudCoverage(): number { return this.cloudCoverage; }
    public getLightingIntensity(): number { return this.lightingIntensity; }
    public getWindVector(): Vector3 { return this.currentWeather.windDirection.multiplyScalar(this.currentWeather.windSpeed); }
    public isPrecipitating(): boolean { return this.currentWeather.precipitation > 0.1; }
    public getPrecipitationType(): 'rain' | 'snow' | 'none' {
        if (this.currentWeather.precipitation < 0.1) return 'none';
        return this.currentWeather.temperature > 2 ? 'rain' : 'snow';
    }
}
